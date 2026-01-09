// VacationListView.tsx - FIXED VERSION
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, isSameDay, isAfter, startOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plane, Download, ChevronLeft, ChevronRight, Calendar, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getLastName, getRankAbbreviation, isSupervisorByRank } from "./utils";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface VacationListViewProps {
  selectedShiftId: string;
  setSelectedShiftId: (shiftId: string) => void;
  shiftTypes: any[];
}

interface VacationBlock {
  startDate: Date;
  endDate: Date;
  daysCount: number;
  type: string;
  dates: Date[];
}

// Helper function to calculate service credit
const calculateServiceCredit = (
  hireDate: string | null,
  override: number = 0,
  promotionDateSergeant: string | null = null,
  promotionDateLieutenant: string | null = null,
  currentRank: string | null = null
) => {
  if (override && override > 0) {
    return override;
  }
  
  let relevantDate: Date | null = null;
  
  if (currentRank) {
    const rankLower = currentRank.toLowerCase();
    
    if ((rankLower.includes('sergeant') || rankLower.includes('sgt')) && promotionDateSergeant) {
      relevantDate = new Date(promotionDateSergeant);
    } else if ((rankLower.includes('lieutenant') || rankLower.includes('lt')) && promotionDateLieutenant) {
      relevantDate = new Date(promotionDateLieutenant);
    } else if (rankLower.includes('chief') && promotionDateLieutenant) {
      relevantDate = new Date(promotionDateLieutenant);
    }
  }
  
  if (!relevantDate && hireDate) {
    relevantDate = new Date(hireDate);
  }
  
  if (!relevantDate) return 0;
  
  try {
    const now = new Date();
    const years = now.getFullYear() - relevantDate.getFullYear();
    const months = now.getMonth() - relevantDate.getMonth();
    const days = now.getDate() - relevantDate.getDate();
    const totalYears = years + (months / 12) + (days / 365);
    return Math.max(0, Math.round(totalYears * 10) / 10);
  } catch (error) {
    console.error('Error calculating service credit:', error);
    return 0;
  }
};

export const VacationListView: React.FC<VacationListViewProps> = ({
  selectedShiftId,
  setSelectedShiftId,
  shiftTypes
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [onlyRemaining, setOnlyRemaining] = useState<boolean>(false);
  const today = startOfDay(new Date());

  // First, let's debug what PTO types are in the database
  const { data: ptoTypesDebug } = useQuery({
    queryKey: ['pto-types-debug', selectedShiftId, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_exceptions")
        .select("reason")
        .eq("is_off", true)
        .eq("shift_type_id", selectedShiftId)
        .limit(100);
      
      if (error) {
        console.error('Error fetching PTO types:', error);
        return [];
      }
      
      const uniqueReasons = [...new Set(data.map(item => item.reason))];
      console.log('Available PTO types in database:', uniqueReasons);
      return uniqueReasons;
    },
    enabled: !!selectedShiftId,
  });

  // Fetch vacation data
  const { data: vacationData, isLoading } = useQuery({
    queryKey: ['vacation-list', selectedShiftId, selectedYear],
    queryFn: async () => {
      if (!selectedShiftId) return null;

      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;

      // Fetch all PTO exceptions first (we'll filter later)
      const { data: ptoExceptions, error } = await supabase
        .from("schedule_exceptions")
        .select(`
          *,
          profiles!schedule_exceptions_officer_id_fkey (
            id,
            full_name,
            badge_number,
            rank,
            hire_date,
            promotion_date_sergeant,
            promotion_date_lieutenant,
            service_credit_override
          )
        `)
        .eq("is_off", true)
        .gte("date", startDate)
        .lte("date", endDate)
        .eq("shift_type_id", selectedShiftId)
        .order("date", { ascending: true });

      if (error) throw error;

      console.log('Total PTO exceptions fetched:', ptoExceptions?.length);
      console.log('PTO reason distribution:', 
        ptoExceptions?.reduce((acc, pto) => {
          acc[pto.reason] = (acc[pto.reason] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      );

      // Filter for vacation/holiday types (case insensitive)
      const vacationAndHolidayExceptions = ptoExceptions?.filter(pto => {
        if (!pto.reason) return false;
        const reason = pto.reason.toLowerCase();
        return reason.includes('vacation') || 
               reason.includes('holiday') ||
               reason === 'vac' ||
               reason === 'hol';
      });

      console.log('Filtered vacation/holiday exceptions:', vacationAndHolidayExceptions?.length);

      // Fetch all profiles for this shift
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, badge_number, rank, hire_date, promotion_date_sergeant, promotion_date_lieutenant, service_credit_override");

      const profilesMap = new Map();
      allProfiles?.forEach(profile => {
        profilesMap.set(profile.id, profile);
      });

      // Group PTO by officer and create vacation blocks
      const officersMap = new Map();
      
      vacationAndHolidayExceptions?.forEach(pto => {
        const officerId = pto.officer_id;
        const profile = profilesMap.get(officerId) || pto.profiles;
        
        if (!officersMap.has(officerId)) {
          const serviceCredit = calculateServiceCredit(
            profile?.hire_date || null,
            profile?.service_credit_override || 0,
            profile?.promotion_date_sergeant || null,
            profile?.promotion_date_lieutenant || null,
            profile?.rank || null
          );
          
          officersMap.set(officerId, {
            officer: profile,
            serviceCredit,
            vacationDays: [],
            vacationBlocks: []
          });
        }
        
        const officerData = officersMap.get(officerId);
        const date = parseISO(pto.date);
        
        // Normalize PTO type
        let ptoType = pto.reason || 'Vacation';
        const ptoLower = ptoType.toLowerCase();
        if (ptoLower.includes('vacation') || ptoLower === 'vac') {
          ptoType = 'Vacation';
        } else if (ptoLower.includes('holiday') || ptoLower === 'hol') {
          ptoType = 'Holiday';
        }
        
        officerData.vacationDays.push({
          date,
          ptoType
        });
      });

      // Process each officer's vacation days to create blocks
      officersMap.forEach((officerData, officerId) => {
        officerData.vacationDays.sort((a, b) => a.date.getTime() - b.date.getTime());
        
        const blocks: VacationBlock[] = [];
        let currentBlock: {date: Date, type: string}[] = [];
        
        officerData.vacationDays.forEach((day, index) => {
          if (currentBlock.length === 0) {
            currentBlock.push(day);
          } else {
            const lastDate = currentBlock[currentBlock.length - 1].date;
            const diffInDays = Math.abs((day.date.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffInDays === 1 && day.ptoType === currentBlock[0].ptoType) {
              currentBlock.push(day);
            } else {
              if (currentBlock.length > 0) {
                blocks.push({
                  startDate: currentBlock[0].date,
                  endDate: currentBlock[currentBlock.length - 1].date,
                  daysCount: currentBlock.length,
                  type: currentBlock[0].ptoType,
                  dates: currentBlock.map(item => item.date)
                });
              }
              currentBlock = [day];
            }
          }
        });
        
        if (currentBlock.length > 0) {
          blocks.push({
            startDate: currentBlock[0].date,
            endDate: currentBlock[currentBlock.length - 1].date,
            daysCount: currentBlock.length,
            type: currentBlock[0].ptoType,
            dates: currentBlock.map(item => item.date)
          });
        }
        
        officerData.vacationBlocks = blocks;
        officerData.totalDays = officerData.vacationDays.length;
      });

      const officersArray = Array.from(officersMap.values());
      console.log('Processed officers with vacation:', officersArray.length);

      return {
        officers: officersArray,
        summary: {
          totalOfficers: officersArray.length,
          totalDays: vacationAndHolidayExceptions?.length || 0,
          averageDays: officersArray.length > 0 ? 
            (vacationAndHolidayExceptions?.length || 0) / officersArray.length : 0
        },
        rawData: vacationAndHolidayExceptions || []
      };
    },
    enabled: !!selectedShiftId,
  });

  // Filter and sort officers
  const filteredAndSortedOfficers = useMemo(() => {
    if (!vacationData?.officers) return [];
    
    let officers = [...vacationData.officers];
    
    if (onlyRemaining) {
      officers = officers.map(officer => {
        const futureBlocks = officer.vacationBlocks.filter(block => 
          isAfter(block.endDate, today)
        );
        
        const totalFutureDays = futureBlocks.reduce((sum, block) => sum + block.daysCount, 0);
        
        return {
          ...officer,
          vacationBlocks: futureBlocks,
          totalDays: totalFutureDays
        };
      }).filter(officer => officer.totalDays > 0);
    }
    
  // Categorize officers with UPDATED supervisor sorting
  // First get all supervisors
  const allSupervisors = Array.from(allOfficers.values())
    .filter(o => o && isSupervisorByRank(o));

  // Separate Lieutenants and Sergeants
  const lieutenants = allSupervisors.filter(o => 
    o && o.rank && (
      o.rank.toLowerCase().includes('lieutenant') || 
      o.rank.toLowerCase().includes('lt') ||
      o.rank.toLowerCase().includes('chief')
    )
  ).sort((a, b) => {
    // Sort Lieutenants by service credit DESCENDING (highest first)
    const aCredit = a.service_credit || 0;
    const bCredit = b.service_credit || 0;
    if (bCredit !== aCredit) {
      return bCredit - aCredit; // Descending
    }
    // If same service credit, sort by badge number ASCENDING (lower = higher seniority)
    const aBadge = parseInt(a.badgeNumber) || 9999;
    const bBadge = parseInt(b.badgeNumber) || 9999;
    return aBadge - bBadge; // Ascending
  });

  const sergeants = allSupervisors.filter(o => 
    o && o.rank && (
      o.rank.toLowerCase().includes('sergeant') || 
      o.rank.toLowerCase().includes('sgt')
    )
  ).sort((a, b) => {
    // Sort Sergeants by service credit DESCENDING (highest first)
    const aCredit = a.service_credit || 0;
    const bCredit = b.service_credit || 0;
    if (bCredit !== aCredit) {
      return bCredit - aCredit; // Descending
    }
    // If same service credit, sort by badge number ASCENDING (lower = higher seniority)
    const aBadge = parseInt(a.badgeNumber) || 9999;
    const bBadge = parseInt(b.badgeNumber) || 9999;
    return aBadge - bBadge; // Ascending
  });

  // Combine with Lieutenants first, then Sergeants
  const supervisors = [...lieutenants, ...sergeants];

  const allOfficersList = Array.from(allOfficers.values())
    .filter(o => o && !isSupervisorByRank(o));

  const ppos = allOfficersList
    .filter(o => o && o.rank && o.rank.toLowerCase() === 'probationary')
    .sort((a, b) => {
      const aCredit = a.service_credit || 0;
      const bCredit = b.service_credit || 0;
      if (bCredit !== aCredit) {
        return bCredit - aCredit;
      }
      // If same service credit, sort by badge number ASCENDING (lower = higher seniority)
      const aBadge = parseInt(a.badgeNumber) || 9999;
      const bBadge = parseInt(b.badgeNumber) || 9999;
      return aBadge - bBadge; // Ascending
    });

  const regularOfficers = allOfficersList
    .filter(o => o && o.rank && o.rank.toLowerCase() !== 'probationary')
    .sort((a, b) => {
      const aCredit = a.service_credit || 0;
      const bCredit = b.service_credit || 0;
      if (bCredit !== aCredit) {
        return bCredit - aCredit;
      }
      // If same service credit, sort by badge number ASCENDING (lower = higher seniority)
      const aBadge = parseInt(a.badgeNumber) || 9999;
      const bBadge = parseInt(b.badgeNumber) || 9999;
      return aBadge - bBadge; // Ascending
    });
    return [...supervisors, ...regularOfficers, ...ppos];
  }, [vacationData?.officers, onlyRemaining, today]);

  const handleExport = () => {
    toast.info("Export feature coming soon!");
  };

  const formatDateRange = (startDate: Date, endDate: Date) => {
    if (isSameDay(startDate, endDate)) {
      return format(startDate, 'MMM d');
    }
    return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}`;
  };

  const getPTOBadge = (ptoType: string) => {
    const ptoLower = ptoType.toLowerCase();
    if (ptoLower.includes('vacation') || ptoLower === 'vac') {
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">Vac</Badge>;
    }
    if (ptoLower.includes('holiday') || ptoLower === 'hol') {
      return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200">Hol</Badge>;
    }
    return <Badge variant="outline">{ptoType}</Badge>;
  };

  const getOfficerTypeColor = (officer: any) => {
    if (!officer) return '';
    
    const rank = officer.rank?.toLowerCase() || '';
    
    if (isSupervisorByRank(officer)) {
      return 'bg-green-50 border-l-4 border-green-500';
    }
    
    if (rank === 'probationary') {
      return 'bg-blue-50 border-l-4 border-blue-500';
    }
    
    return 'border-l-4 border-gray-200';
  };

  const filteredSummary = useMemo(() => {
    const totalDays = filteredAndSortedOfficers.reduce((sum, officer) => sum + officer.totalDays, 0);
    const totalOfficers = filteredAndSortedOfficers.length;
    
    return {
      totalOfficers,
      totalDays,
      averageDays: totalOfficers > 0 ? (totalDays / totalOfficers) : 0
    };
  }, [filteredAndSortedOfficers]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5" />
              Vacation List - {selectedYear}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-sm font-medium text-muted-foreground">
                Shift: {shiftTypes?.find(s => s.id === selectedShiftId)?.name || "Not selected"}
              </div>
              <Button onClick={handleExport} size="sm" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            {/* Year Selector */}
            <div className="space-y-2">
              <Label htmlFor="year-select">Year</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setSelectedYear(prev => prev - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <select 
                  id="year-select"
                  value={selectedYear.toString()}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {[2023, 2024, 2025, 2026, 2027].map((year) => (
                    <option key={year} value={year.toString()}>
                      {year}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setSelectedYear(prev => prev + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Only Remaining Toggle */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={onlyRemaining}
                  onCheckedChange={setOnlyRemaining}
                  id="only-remaining-toggle"
                />
                <span className="text-sm flex items-center gap-2">
                  <Filter className="h-3 w-3" />
                  Only Remaining
                </span>
              </Label>
              <p className="text-xs text-muted-foreground pl-10">
                {onlyRemaining 
                  ? 'Showing only future vacation/holiday dates' 
                  : 'Showing all vacation/holiday dates for ' + selectedYear}
              </p>
            </div>

            {/* Summary Stats */}
            <div className="space-y-2">
              <Label>Summary</Label>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{filteredSummary.totalOfficers}</div>
                  <div className="text-sm text-muted-foreground">Officers</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{filteredSummary.totalDays}</div>
                  <div className="text-sm text-muted-foreground">Days</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {filteredSummary.averageDays > 0 ? filteredSummary.averageDays.toFixed(1) : '0.0'}
                  </div>
                  <div className="text-sm text-muted-foreground">Avg Days</div>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {!selectedShiftId ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Please select a shift from the Weekly or Monthly tab first</p>
            </div>
          ) : isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
            
              {/* Header */}
              <div className="grid grid-cols-12 bg-muted/50 p-3 font-semibold border rounded-t-lg text-sm">
                <div className="col-span-1">#</div>
                <div className="col-span-3">Officer</div>
                <div className="col-span-2">Rank</div>
                <div className="col-span-1 text-center">Days</div>
                <div className="col-span-5">Vacation/Holiday Periods</div>
              </div>
              
              {/* Officers List */}
              <div className="max-h-[600px] overflow-y-auto border rounded-b-lg">
                {filteredAndSortedOfficers.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    {onlyRemaining 
                      ? 'No future vacation or holiday dates found for ' + selectedYear
                      : 'No vacation or holiday data found for ' + selectedYear}
                    <p className="text-xs mt-2">
                      Check if there are PTO exceptions marked as "Vacation" or "Holiday" in the schedule.
                    </p>
                  </div>
                ) : (
                  filteredAndSortedOfficers.map(({ officer, totalDays, vacationBlocks, serviceCredit }, index) => (
                    <div 
                      key={officer.id} 
                      className={`grid grid-cols-12 p-3 border-b hover:bg-muted/30 items-center ${getOfficerTypeColor(officer)}`}
                    >
                      {/* Badge Number */}
                      <div className="col-span-1 font-mono text-sm">
                        {officer.badge_number || 'N/A'}
                      </div>
                      
                      {/* Officer Name */}
                      <div className="col-span-3">
                        <div className="font-medium">{getLastName(officer.full_name)}</div>
                        {serviceCredit > 0 && (
                          <div className="text-xs text-muted-foreground">
                            SC: {serviceCredit.toFixed(1)}
                          </div>
                        )}
                      </div>
                      
                      {/* Rank */}
                      <div className="col-span-2">
                        <Badge variant="outline" className={isSupervisorByRank(officer) ? 'border-green-300' : ''}>
                          {getRankAbbreviation(officer.rank)}
                        </Badge>
                      </div>
                      
                      {/* Total Days */}
                      <div className="col-span-1 text-center">
                        <div className="font-bold text-lg">{totalDays}</div>
                      </div>
                      
                      {/* Vacation/Holiday Periods */}
                      <div className="col-span-5">
                        <div className="flex flex-col gap-2">
                          {vacationBlocks.map((block, blockIndex) => {
                            const isFuture = isAfter(block.endDate, today);
                            return (
                              <div 
                                key={blockIndex} 
                                className={`flex items-center justify-between gap-2 p-2 border rounded ${!isFuture && !onlyRemaining ? 'opacity-60' : ''}`}
                              >
                                <div className="flex items-center gap-2">
                                  {getPTOBadge(block.type)}
                                  <span className={`text-sm font-medium ${!isFuture && !onlyRemaining ? 'line-through' : ''}`}>
                                    {formatDateRange(block.startDate, block.endDate)}
                                  </span>
                                  {block.daysCount > 1 && (
                                    <Badge variant="secondary" className="text-xs">
                                      {block.daysCount}d
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {format(block.startDate, 'MM/dd')}
                                  {!isFuture && !onlyRemaining && ' (past)'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer Stats */}
              <div className="flex justify-between items-center text-sm text-muted-foreground pt-2">
                <div>
                  Showing {filteredAndSortedOfficers.length} officer{filteredAndSortedOfficers.length !== 1 ? 's' : ''}
                  {onlyRemaining && ' (future dates only)'}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-green-100 border border-green-300"></div>
                    <span>Supervisor</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></div>
                    <span>PPO</span>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <Separator className="my-4" />
              <div className="pt-2">
                <h4 className="font-semibold mb-3 text-sm">PTO Types</h4>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">Vac</Badge>
                    <span className="text-sm">Vacation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200">Hol</Badge>
                    <span className="text-sm">Holiday</span>
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  <p>Note: Shows only Vacation and Holiday PTO types.</p>
                  <p className="mt-1">When "Only Remaining" is enabled, past dates are hidden. When disabled, past dates are faded.</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
