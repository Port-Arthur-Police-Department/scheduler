// VacationListView.tsx - IMPROVED VERSION
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfYear, endOfYear, parseISO, isSameDay, addDays, isAfter, isBefore } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plane, CalendarIcon, Filter, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getLastName, getRankAbbreviation } from "./utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface VacationListViewProps {
  selectedShiftId: string;
  setSelectedShiftId: (shiftId: string) => void;
  shiftTypes: any[];
}

interface VacationBlock {
  startDate: Date;
  endDate: Date;
  daysCount: number;
  dates: Date[];
}

export const VacationListView: React.FC<VacationListViewProps> = ({
  selectedShiftId,
  setSelectedShiftId,
  shiftTypes
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [viewType, setViewType] = useState<'summary' | 'detailed'>('summary');
  const [showAllVacations, setShowAllVacations] = useState<boolean>(true);

  // Fetch vacation data with grouping for consecutive days
  const { data: vacationData, isLoading } = useQuery({
    queryKey: ['vacation-list', selectedShiftId, selectedYear, showAllVacations],
    queryFn: async () => {
      if (!selectedShiftId) return null;

      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;

      // Fetch PTO exceptions
      const { data: ptoExceptions, error } = await supabase
        .from("schedule_exceptions")
        .select(`
          *,
          profiles!schedule_exceptions_officer_id_fkey (
            id,
            full_name,
            badge_number,
            rank,
            hire_date
          )
        `)
        .eq("is_off", true)
        .gte("date", startDate)
        .lte("date", endDate)
        .eq("shift_type_id", selectedShiftId)
        .order("date", { ascending: true });

      if (error) throw error;

      // Group PTO by officer and create vacation blocks for consecutive days
      const officersMap = new Map();
      
      ptoExceptions?.forEach(pto => {
        const officerId = pto.officer_id;
        if (!officersMap.has(officerId)) {
          officersMap.set(officerId, {
            officer: pto.profiles,
            vacationDays: [],
            vacationBlocks: []
          });
        }
        
        const officerData = officersMap.get(officerId);
        const date = parseISO(pto.date);
        officerData.vacationDays.push({
          date,
          ptoType: pto.reason || 'Vacation'
        });
      });

      // Process each officer's vacation days to create blocks of consecutive days
      officersMap.forEach((officerData, officerId) => {
        // Sort dates ascending
        officerData.vacationDays.sort((a, b) => a.date.getTime() - b.date.getTime());
        
        const blocks: VacationBlock[] = [];
        let currentBlock: Date[] = [];
        
        officerData.vacationDays.forEach((day, index) => {
          if (currentBlock.length === 0) {
            currentBlock.push(day.date);
          } else {
            const lastDate = currentBlock[currentBlock.length - 1];
            const currentDate = day.date;
            const diffInDays = Math.abs((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffInDays === 1) {
              // Consecutive day, add to current block
              currentBlock.push(currentDate);
            } else {
              // Non-consecutive, finalize current block and start new one
              if (currentBlock.length > 0) {
                blocks.push({
                  startDate: currentBlock[0],
                  endDate: currentBlock[currentBlock.length - 1],
                  daysCount: currentBlock.length,
                  dates: [...currentBlock]
                });
              }
              currentBlock = [currentDate];
            }
          }
        });
        
        // Don't forget the last block
        if (currentBlock.length > 0) {
          blocks.push({
            startDate: currentBlock[0],
            endDate: currentBlock[currentBlock.length - 1],
            daysCount: currentBlock.length,
            dates: [...currentBlock]
          });
        }
        
        officerData.vacationBlocks = blocks;
        officerData.totalDays = officerData.vacationDays.length;
      });

      // Convert to array and sort by total days descending
      const officersArray = Array.from(officersMap.values()).sort((a, b) => 
        b.totalDays - a.totalDays
      );

      // Get all unique months with vacation data for column headers
      const monthsWithVacations = new Set<string>();
      ptoExceptions?.forEach(pto => {
        const date = parseISO(pto.date);
        const monthKey = format(date, 'MMM yyyy');
        monthsWithVacations.add(monthKey);
      });

      const sortedMonths = Array.from(monthsWithVacations).sort((a, b) => {
        const dateA = new Date(a);
        const dateB = new Date(b);
        return dateA.getTime() - dateB.getTime();
      });

      return {
        officers: officersArray,
        summary: {
          totalOfficers: officersArray.length,
          totalDays: ptoExceptions?.length || 0,
          averageDays: officersArray.length > 0 ? 
            (ptoExceptions?.length || 0) / officersArray.length : 0
        },
        months: sortedMonths,
        rawData: ptoExceptions || []
      };
    },
    enabled: !!selectedShiftId,
  });

  const handleExport = () => {
    toast.info("Export feature coming soon!");
  };

  const formatDateRange = (startDate: Date, endDate: Date) => {
    if (isSameDay(startDate, endDate)) {
      return format(startDate, 'M/d/yy');
    }
    return `${format(startDate, 'M/d/yy')} - ${format(endDate, 'M/d/yy')}`;
  };

  const getPTOColor = (ptoType: string) => {
    switch (ptoType?.toLowerCase()) {
      case 'vacation':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'sick':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'holiday':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'comp':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getPTOBadge = (ptoType: string) => {
    switch (ptoType?.toLowerCase()) {
      case 'vacation':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Vac</Badge>;
      case 'sick':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Sick</Badge>;
      case 'holiday':
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Hol</Badge>;
      case 'comp':
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Comp</Badge>;
      default:
        return <Badge variant="outline">{ptoType}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5" />
              Vacation List
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

            {/* View Toggle */}
            <div className="space-y-2">
              <Label>View</Label>
              <Tabs value={viewType} onValueChange={(v) => setViewType(v as 'summary' | 'detailed')} className="w-full">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="detailed">Detailed</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Show All Toggle */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Switch
                  checked={showAllVacations}
                  onCheckedChange={setShowAllVacations}
                />
                Show All
              </Label>
            </div>

            {/* Summary Stats */}
            <div className="space-y-2">
              <Label>Summary</Label>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{vacationData?.summary?.totalOfficers || 0}</div>
                  <div className="text-sm text-muted-foreground">Officers</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{vacationData?.summary?.totalDays || 0}</div>
                  <div className="text-sm text-muted-foreground">Days</div>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {!selectedShiftId ? (
            <div className="text-center py-8 text-muted-foreground">
              Please select a shift from the Weekly or Monthly tab first
            </div>
          ) : isLoading ? (
            <div className="text-center py-8">Loading vacation data...</div>
          ) : viewType === 'summary' ? (
            <div className="space-y-4">
              {/* Officer Vacation Summary Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 bg-muted/50 p-3 font-semibold border-b text-sm">
                  <div className="col-span-2">Badge #</div>
                  <div className="col-span-3">Officer</div>
                  <div className="col-span-2">Rank</div>
                  <div className="col-span-2">Total Days</div>
                  <div className="col-span-3">Vacation Periods</div>
                </div>
                
                <div className="max-h-[600px] overflow-y-auto">
                  {vacationData?.officers.map(({ officer, totalDays, vacationBlocks }) => (
                    <div key={officer.id} className="grid grid-cols-12 p-3 border-b hover:bg-muted/30 items-center">
                      <div className="col-span-2 font-mono">{officer.badge_number}</div>
                      <div className="col-span-3 font-medium">{getLastName(officer.full_name)}</div>
                      <div className="col-span-2">
                        <Badge variant="outline">{getRankAbbreviation(officer.rank)}</Badge>
                      </div>
                      <div className="col-span-2 font-bold text-lg">{totalDays}</div>
                      <div className="col-span-3">
                        <div className="flex flex-wrap gap-2">
                          {vacationBlocks.map((block, index) => (
                            <div 
                              key={index}
                              className={`px-3 py-1 rounded-md border text-sm whitespace-nowrap ${getPTOColor('vacation')}`}
                              title={`${block.daysCount} day(s)`}
                            >
                              {formatDateRange(block.startDate, block.endDate)}
                              {block.daysCount > 1 && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  {block.daysCount}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {vacationData?.officers.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      No vacation data found for {selectedYear}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Detailed View - Similar to Weekly Schedule */}
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-14 bg-muted/50 p-3 font-semibold border-b text-sm">
                  <div className="col-span-2">Badge #</div>
                  <div className="col-span-3">Officer</div>
                  <div className="col-span-2">Rank</div>
                  {vacationData?.months.map(month => (
                    <div key={month} className="text-center py-1 px-2 border-x">
                      {month}
                    </div>
                  ))}
                </div>
                
                <div className="max-h-[600px] overflow-y-auto">
                  {vacationData?.officers.map(({ officer, vacationDays, vacationBlocks }) => {
                    // Create a map of month to vacation days for this officer
                    const monthMap = new Map();
                    
                    vacationDays.forEach(({ date, ptoType }) => {
                      const monthKey = format(date, 'MMM yyyy');
                      if (!monthMap.has(monthKey)) {
                        monthMap.set(monthKey, []);
                      }
                      monthMap.get(monthKey).push({ date, ptoType });
                    });
                    
                    return (
                      <div key={officer.id} className="grid grid-cols-14 p-3 border-b hover:bg-muted/30 items-center text-sm">
                        <div className="col-span-2 font-mono">{officer.badge_number}</div>
                        <div className="col-span-3 font-medium">{getLastName(officer.full_name)}</div>
                        <div className="col-span-2">
                          <Badge variant="outline">{getRankAbbreviation(officer.rank)}</Badge>
                        </div>
                        
                        {vacationData.months.map(month => {
                          const daysInMonth = monthMap.get(month) || [];
                          if (daysInMonth.length === 0) {
                            return (
                              <div key={month} className="text-center py-1 px-2 border-x">
                                -
                              </div>
                            );
                          }
                          
                          // Group consecutive days within this month
                          const sortedDays = daysInMonth.sort((a, b) => a.date.getTime() - b.date.getTime());
                          const blocksInMonth: {start: Date, end: Date, type: string}[] = [];
                          let currentBlock: Date[] = [];
                          
                          sortedDays.forEach(({ date }) => {
                            if (currentBlock.length === 0) {
                              currentBlock.push(date);
                            } else {
                              const lastDate = currentBlock[currentBlock.length - 1];
                              const diffInDays = Math.abs((date.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                              
                              if (diffInDays === 1) {
                                currentBlock.push(date);
                              } else {
                                if (currentBlock.length > 0) {
                                  blocksInMonth.push({
                                    start: currentBlock[0],
                                    end: currentBlock[currentBlock.length - 1],
                                    type: sortedDays.find(d => isSameDay(d.date, currentBlock[0]))?.ptoType || 'Vacation'
                                  });
                                }
                                currentBlock = [date];
                              }
                            }
                          });
                          
                          if (currentBlock.length > 0) {
                            blocksInMonth.push({
                              start: currentBlock[0],
                              end: currentBlock[currentBlock.length - 1],
                              type: sortedDays.find(d => isSameDay(d.date, currentBlock[0]))?.ptoType || 'Vacation'
                            });
                          }
                          
                          return (
                            <div key={month} className="text-center py-1 px-2 border-x">
                              <div className="flex flex-col gap-1 items-center">
                                {blocksInMonth.map((block, idx) => (
                                  <div key={idx} className="flex items-center gap-1">
                                    {getPTOBadge(block.type)}
                                    <span className="text-xs">
                                      {isSameDay(block.start, block.end) 
                                        ? format(block.start, 'd')
                                        : `${format(block.start, 'd')}-${format(block.end, 'd')}`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                  
                  {vacationData?.officers.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground col-span-full">
                      No vacation data found for {selectedYear}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Legend */}
          <div className="mt-6 pt-4 border-t">
            <h4 className="font-semibold mb-2">Legend</h4>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Vac</Badge>
                <span className="text-sm">Vacation</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Sick</Badge>
                <span className="text-sm">Sick Leave</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Hol</Badge>
                <span className="text-sm">Holiday</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Comp</Badge>
                <span className="text-sm">Comp Time</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
