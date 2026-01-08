// VacationListViewMobile.tsx - UPDATED VERSION
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plane, Download, Filter, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, isSameDay, isAfter, startOfDay } from "date-fns";
import { getLastName, getRankAbbreviation, isSupervisorByRank } from "./utils";
import { Separator } from "@/components/ui/separator";

interface VacationListViewMobileProps {
  selectedShiftId: string;
  setSelectedShiftId: (id: string) => void;
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

export const VacationListViewMobile: React.FC<VacationListViewMobileProps> = ({
  selectedShiftId,
  setSelectedShiftId,
  shiftTypes
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [onlyRemaining, setOnlyRemaining] = useState<boolean>(false);
  const today = startOfDay(new Date());

  // Fetch vacation data
  const { data: vacationData, isLoading } = useQuery({
    queryKey: ['mobile-vacation-list', selectedShiftId, selectedYear],
    queryFn: async () => {
      if (!selectedShiftId) return null;

      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;

      // Fetch all PTO exceptions first
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

      console.log('Mobile - Total PTO exceptions:', ptoExceptions?.length);

      // Filter for vacation/holiday types (case insensitive)
      const vacationAndHolidayExceptions = ptoExceptions?.filter(pto => {
        if (!pto.reason) return false;
        const reason = pto.reason.toLowerCase();
        return reason.includes('vacation') || 
               reason.includes('holiday') ||
               reason === 'vac' ||
               reason === 'hol';
      });

      console.log('Mobile - Filtered vacation/holiday:', vacationAndHolidayExceptions?.length);

      // Fetch all profiles for sorting
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
      
      // Sort like WeeklyView.tsx
      const allSupervisors = officersArray.filter(o => 
        o.officer && isSupervisorByRank(o.officer)
      );

      const lieutenants = allSupervisors.filter(o => 
        o.officer.rank && (
          o.officer.rank.toLowerCase().includes('lieutenant') || 
          o.officer.rank.toLowerCase().includes('lt') ||
          o.officer.rank.toLowerCase().includes('chief')
        )
      ).sort((a, b) => {
        const aCredit = a.serviceCredit || 0;
        const bCredit = b.serviceCredit || 0;
        if (bCredit !== aCredit) return bCredit - aCredit;
        return getLastName(a.officer.full_name || '').localeCompare(getLastName(b.officer.full_name || ''));
      });

      const sergeants = allSupervisors.filter(o => 
        o.officer.rank && (
          o.officer.rank.toLowerCase().includes('sergeant') || 
          o.officer.rank.toLowerCase().includes('sgt')
        )
      ).sort((a, b) => {
        const aCredit = a.serviceCredit || 0;
        const bCredit = b.serviceCredit || 0;
        if (bCredit !== aCredit) return bCredit - aCredit;
        return getLastName(a.officer.full_name || '').localeCompare(getLastName(b.officer.full_name || ''));
      });

      const supervisors = [...lieutenants, ...sergeants];

      const allOfficersList = officersArray.filter(o => 
        !o.officer || !isSupervisorByRank(o.officer)
      );

      const ppos = allOfficersList.filter(o => 
        o.officer?.rank?.toLowerCase() === 'probationary'
      ).sort((a, b) => {
        const aCredit = a.serviceCredit || 0;
        const bCredit = b.serviceCredit || 0;
        if (bCredit !== aCredit) return bCredit - aCredit;
        return getLastName(a.officer.full_name || '').localeCompare(getLastName(b.officer.full_name || ''));
      });

      const regularOfficers = allOfficersList.filter(o => 
        o.officer?.rank?.toLowerCase() !== 'probationary'
      ).sort((a, b) => {
        const aCredit = a.serviceCredit || 0;
        const bCredit = b.serviceCredit || 0;
        if (bCredit !== aCredit) return bCredit - aCredit;
        return getLastName(a.officer.full_name || '').localeCompare(getLastName(b.officer.full_name || ''));
      });

      const sortedOfficers = [...supervisors, ...regularOfficers, ...ppos];

      return {
        officers: sortedOfficers,
        summary: {
          totalOfficers: sortedOfficers.length,
          totalDays: vacationAndHolidayExceptions?.length || 0,
          averageDays: sortedOfficers.length > 0 ? 
            (vacationAndHolidayExceptions?.length || 0) / sortedOfficers.length : 0
        },
        rawData: vacationAndHolidayExceptions || []
      };
    },
    enabled: !!selectedShiftId,
  });

  // Apply "Only Remaining" filter
  const filteredOfficers = React.useMemo(() => {
    if (!vacationData?.officers) return [];
    
    if (!onlyRemaining) return vacationData.officers;
    
    return vacationData.officers
      .map(officer => {
        const futureBlocks = officer.vacationBlocks.filter(block => 
          isAfter(block.endDate, today)
        );
        
        const totalFutureDays = futureBlocks.reduce((sum, block) => sum + block.daysCount, 0);
        
        return {
          ...officer,
          vacationBlocks: futureBlocks,
          totalDays: totalFutureDays
        };
      })
      .filter(officer => officer.totalDays > 0);
  }, [vacationData?.officers, onlyRemaining, today]);

  const handleExport = () => {
    // Implement export logic
    console.log("Export vacation list");
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
      return 'border-l-4 border-green-500';
    }
    
    if (rank === 'probationary') {
      return 'border-l-4 border-blue-500';
    }
    
    return 'border-l-4 border-gray-300';
  };

  // Calculate summary stats for filtered view
  const filteredSummary = React.useMemo(() => {
    const totalDays = filteredOfficers.reduce((sum, officer) => sum + officer.totalDays, 0);
    const totalOfficers = filteredOfficers.length;
    
    return {
      totalOfficers,
      totalDays,
      averageDays: totalOfficers > 0 ? (totalDays / totalOfficers) : 0
    };
  }, [filteredOfficers]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plane className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Vacation List</h2>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
      </div>

      {/* Year Selection */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <Label>Select Year</Label>
            <Select 
              value={selectedYear.toString()} 
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2023, 2024, 2025, 2026, 2027].map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Only Remaining Toggle */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="font-medium">Only Remaining</Label>
                <p className="text-xs text-muted-foreground">
                  {onlyRemaining ? 'Show future dates only' : 'Show all dates'}
                </p>
              </div>
            </div>
            <Switch
              checked={onlyRemaining}
              onCheckedChange={setOnlyRemaining}
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {vacationData && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-blue-50 p-3 rounded-lg text-center border border-blue-100">
            <div className="text-xl font-bold">{filteredSummary.totalOfficers}</div>
            <div className="text-xs text-muted-foreground">Officers</div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg text-center border border-green-100">
            <div className="text-xl font-bold">{filteredSummary.totalDays}</div>
            <div className="text-xs text-muted-foreground">Days</div>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg text-center border border-purple-100">
            <div className="text-xl font-bold">{filteredSummary.averageDays.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Avg per Officer</div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">Loading vacation data...</div>
      ) : !selectedShiftId ? (
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Please select a shift</p>
        </div>
      ) : !vacationData ? (
        <div className="text-center py-8 text-muted-foreground">
          No vacation data found
        </div>
      ) : (
        <>
          {/* Officers List */}
          <div className="space-y-3">
            <h3 className="font-semibold">Officers</h3>
            {filteredOfficers.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  {onlyRemaining 
                    ? 'No future vacation or holiday dates found'
                    : 'No vacation or holiday data found for ' + selectedYear}
                </CardContent>
              </Card>
            ) : (
              filteredOfficers.map(({ officer, totalDays, vacationBlocks, serviceCredit }) => (
                <Card key={officer.id} className={`${getOfficerTypeColor(officer)}`}>
                  <CardContent className="p-4">
                    {/* Officer Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-semibold">{getLastName(officer.full_name)}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            #{officer.badge_number}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {getRankAbbreviation(officer.rank)}
                          </Badge>
                          {serviceCredit > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              SC: {serviceCredit.toFixed(1)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{totalDays}</div>
                        <div className="text-xs text-muted-foreground">days</div>
                      </div>
                    </div>

                    {/* Vacation Periods */}
                    {vacationBlocks.length > 0 ? (
                      <div className="space-y-2">
                        {vacationBlocks.map((block, index) => {
                          const isFuture = isAfter(block.endDate, today);
                          return (
                            <div 
                              key={index} 
                              className={`p-3 border rounded ${!isFuture && !onlyRemaining ? 'opacity-60 bg-gray-50' : ''}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {getPTOBadge(block.type)}
                                  <span className={`text-sm font-medium ${!isFuture && !onlyRemaining ? 'line-through' : ''}`}>
                                    {formatDateRange(block.startDate, block.endDate)}
                                  </span>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  {block.daysCount}d
                                </Badge>
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>
                                  {format(block.startDate, 'MMM d, yyyy')} - {format(block.endDate, 'MMM d, yyyy')}
                                </span>
                                {!isFuture && !onlyRemaining && (
                                  <span className="text-red-500">Past</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No vacation scheduled
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Legend */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3 text-sm">Vacation List Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">
                    Vac
                  </Badge>
                  <span>Vacation time off</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200">
                    Hol
                  </Badge>
                  <span>Holiday time off</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border-l-4 border-green-500"></div>
                  <span>Supervisor</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border-l-4 border-blue-500"></div>
                  <span>Probationary Officer (PPO)</span>
                </div>
                <Separator className="my-2" />
                <p className="text-xs text-muted-foreground">
                  {onlyRemaining 
                    ? 'Showing only future vacation/holiday dates'
                    : 'Showing all vacation/holiday dates for ' + selectedYear}
                </p>
                <p className="text-xs text-muted-foreground">
                  Only Vacation and Holiday PTO types are shown
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
