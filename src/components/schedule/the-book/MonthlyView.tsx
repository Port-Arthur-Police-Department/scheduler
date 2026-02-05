// MonthlyView.tsx - UPDATED VERSION
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addDays, isSameMonth, isSameDay, parseISO, addMonths, startOfYear, endOfYear } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import type { ViewProps } from "./types";
import { calculateStaffingCounts, getRankAbbreviation as getRankAbbreviationUtil } from "./utils";
import TheBookMobile from "./TheBookMobile";

// Define extended interface that includes onDateChange
interface ExtendedViewProps extends ViewProps {
  onDateChange?: (date: Date) => void;
}

export const MonthlyView: React.FC<ExtendedViewProps> = ({
  currentDate,
  selectedShiftId,
  schedules,
  isAdminOrSupervisor,
  weeklyColors,
  onDateNavigation,
  onEventHandlers,
  mutations,
  navigateToDailySchedule,
  getLastName,
  getRankAbbreviation = getRankAbbreviationUtil,
  onDateChange,
}) => {
  // Add state hooks here
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [selectedMonthDate, setSelectedMonthDate] = useState(currentDate);

  // Sync with parent when date changes
  useEffect(() => {
    setSelectedMonthDate(currentDate);
  }, [currentDate]);

  // Call onDateChange when component mounts with initial date
  useEffect(() => {
    if (onDateChange) {
      onDateChange(currentDate);
    }
  }, []);

  // Sync selected date when popover opens
  useEffect(() => {
    if (monthPickerOpen) {
      setSelectedMonthDate(currentDate);
    }
  }, [monthPickerOpen, currentDate]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  const startDay = monthStart.getDay();
  const endDay = monthEnd.getDay();
  
  const previousMonthDays = Array.from({ length: startDay }, (_, i) => 
    addDays(monthStart, -startDay + i)
  );
  
  const nextMonthDays = Array.from({ length: 6 - endDay }, (_, i) => 
    addDays(monthEnd, i + 1)
  );

  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const allCalendarDays = [...previousMonthDays, ...monthDays, ...nextMonthDays];

  if (!schedules) {
    return <div className="text-center py-8 text-muted-foreground">No schedule data available</div>;
  }

  // FIXED: Helper function to get minimum staffing
  const getMinimumStaffing = (dayOfWeek: number) => {
    if (!schedules?.minimumStaffing) {
      console.log('❌ No minimum staffing data available');
      return { minimumOfficers: 0, minimumSupervisors: 0 };
    }
    
    console.log('🔍 Checking minimum staffing for day:', dayOfWeek, 'shift:', selectedShiftId);
    console.log('📊 Minimum staffing structure:', schedules.minimumStaffing);
    
    // Handle both Map and object structures
    if (schedules.minimumStaffing instanceof Map) {
      // Map structure from TheBook.tsx query
      const dayStaffing = schedules.minimumStaffing.get(dayOfWeek);
      console.log('🗺️ Day staffing from Map:', dayStaffing);
      
      if (dayStaffing instanceof Map) {
        const shiftStaffing = dayStaffing.get(selectedShiftId);
        console.log('🎯 Shift staffing from Map:', shiftStaffing);
        return shiftStaffing || { minimumOfficers: 0, minimumSupervisors: 0 };
      }
    } else if (typeof schedules.minimumStaffing === 'object') {
      // Object structure (fallback)
      const dayStaffing = schedules.minimumStaffing[dayOfWeek];
      console.log('📋 Day staffing from object:', dayStaffing);
      
      if (dayStaffing && typeof dayStaffing === 'object') {
        const shiftStaffing = dayStaffing[selectedShiftId];
        console.log('🎯 Shift staffing from object:', shiftStaffing);
        return shiftStaffing || { minimumOfficers: 0, minimumSupervisors: 0 };
      }
    }
    
    console.log('⚠️ Using default minimum staffing (0, 0)');
    return { minimumOfficers: 0, minimumSupervisors: 0 };
  };

  // FIXED: Helper function to calculate staffing counts for a day
  const calculateDayStaffing = (daySchedule: any) => {
    if (!daySchedule || !daySchedule.officers) {
      return { supervisorCount: 0, officerCount: 0, ppoCount: 0 };
    }
    
    let supervisorCount = 0;
    let officerCount = 0;
    let ppoCount = 0;
    
    // Filter out officers with full-day PTO or who are off
    daySchedule.officers.forEach((officer: any) => {
      const isSupervisor = isSupervisorByRank(officer);
      const isPPO = officer.rank?.toLowerCase() === 'probationary';
      const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
      const isOff = officer.shiftInfo?.isOff === true;
      const isScheduled = officer.shiftInfo && !isOff && !hasFullDayPTO;
      
      if (isScheduled) {
        if (isSupervisor) {
          supervisorCount++;
        } else if (isPPO) {
          ppoCount++;
        } else {
          officerCount++;
        }
      }
    });
    
    console.log(`📊 Day ${daySchedule.date}: Sup=${supervisorCount}, Ofc=${officerCount}, PPO=${ppoCount}`);
    return { supervisorCount, officerCount, ppoCount };
  };

  // Handle jump to month
  const handleJumpToMonth = (date: Date) => {
    const monthStart = startOfMonth(date);
    setMonthPickerOpen(false);
    if (onDateChange) {
      onDateChange(monthStart);
    }
  };

  // FIXED: Helper function for supervisor detection
  const isSupervisorByRank = (officer: any) => {
    const rank = officer?.rank || '';
    const rankLower = rank.toLowerCase();
    return rankLower.includes('lieutenant') || 
           rankLower.includes('sergeant') ||
           rankLower.includes('sgt') ||
           rankLower.includes('lt') ||
           rankLower.includes('chief') ||
           rankLower.includes('captain');
  };

  return (
    <div className="space-y-4">
      {/* Navigation Header with Jump to Month Button */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDateNavigation.goToPrevious}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="text-center">
            <h3 className="text-lg font-semibold">
              {format(currentDate, "MMMM yyyy")}
            </h3>
            <p className="text-sm text-muted-foreground">
              Month of {format(currentDate, "MMMM yyyy")}
            </p>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onDateNavigation.goToNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Jump to Month Button */}
          <Popover open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                Jump to Month
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-3">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Select a month</div>
                  <Calendar
                    mode="single"
                    selected={selectedMonthDate}
                    onSelect={(date) => {
                      if (date) {
                        handleJumpToMonth(date);
                      }
                    }}
                    className="rounded-md border"
                  />
                  <div className="flex items-center justify-between pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const monthStart = startOfMonth(new Date());
                        handleJumpToMonth(monthStart);
                      }}
                    >
                      This Month
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const nextMonth = addMonths(currentDate, 1);
                        handleJumpToMonth(nextMonth);
                      }}
                    >
                      Next Month
                    </Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onDateNavigation.goToCurrent}
          >
            Today
          </Button>
        </div>
      </div>

      {/* Days of Week Header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="text-center font-medium text-sm py-2 bg-muted/50 rounded">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {allCalendarDays.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayOfWeek = day.getDay();
          const daySchedule = schedules.dailySchedules?.find(s => s.date === dateStr);
          const isCurrentMonthDay = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());
          
          // FIXED: Get minimum staffing using the helper function
          const minStaffing = getMinimumStaffing(dayOfWeek);
          const minimumOfficers = minStaffing.minimumOfficers || 0;
          const minimumSupervisors = minStaffing.minimumSupervisors || 0;
          
          console.log(`📅 Day ${dateStr} (${dayOfWeek}): Min=${minimumSupervisors} sup, ${minimumOfficers} ofc`);
          
          // Filter PTO officers
          const ptoOfficers = daySchedule?.officers?.filter((officer: any) => {
            if (!officer.shiftInfo?.hasPTO || !officer.shiftInfo?.ptoData) {
              return false;
            }
            
            const ptoType = officer.shiftInfo?.ptoData?.ptoType?.toLowerCase() || '';
            return ptoType.includes('vacation') || ptoType.includes('holiday') || 
                   ptoType.includes('sick') || ptoType.includes('comp');
          }) || [];

          // FIXED: Calculate staffing counts for the day
          const { supervisorCount, officerCount } = isCurrentMonthDay && daySchedule
            ? calculateDayStaffing(daySchedule)
            : { supervisorCount: 0, officerCount: 0 };

          // FIXED: Only show understaffed if we have minimum requirements AND are below them
          const isOfficersUnderstaffed = isCurrentMonthDay && 
                                         minimumOfficers > 0 && 
                                         officerCount < minimumOfficers;
          
          const isSupervisorsUnderstaffed = isCurrentMonthDay && 
                                           minimumSupervisors > 0 && 
                                           supervisorCount < minimumSupervisors;
          
          const isUnderstaffed = isCurrentMonthDay && (isOfficersUnderstaffed || isSupervisorsUnderstaffed);

          console.log(`👮 Day ${dateStr}: ${supervisorCount}/${minimumSupervisors} sup, ${officerCount}/${minimumOfficers} ofc, Understaffed=${isUnderstaffed}`);

          return (
            <div
              key={day.toISOString()}
              className={`
                min-h-32 p-2 border rounded-lg text-sm flex flex-col
                ${isCurrentMonthDay ? 'bg-card' : 'bg-muted/20 text-muted-foreground'}
                ${isToday ? 'border-primary ring-2 ring-primary' : 'border-border'}
                hover:bg-accent/50 transition-colors
                ${isUnderstaffed ? 'bg-red-50 border-red-200' : ''}
              `}
            >
              <div className="flex justify-between items-start mb-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`
                    h-6 w-6 p-0 text-xs font-medium hover:bg-primary hover:text-primary-foreground
                    ${isToday ? 'bg-primary text-primary-foreground' : ''}
                    ${!isCurrentMonthDay ? 'text-muted-foreground' : ''}
                  `}
                  onClick={() => navigateToDailySchedule(dateStr)}
                  title={`View daily schedule for ${format(day, "MMM d, yyyy")}`}
                >
                  {format(day, "d")}
                </Button>
                
                <div className="flex flex-col gap-1">
                  {isUnderstaffed && (
                    <Badge variant="destructive" className="text-xs h-4">
                      Understaffed
                    </Badge>
                  )}
                  {ptoOfficers.length > 0 && (
                    <Badge 
                      variant="outline" 
                      className="text-xs h-4 border-green-200"
                      style={{
                        backgroundColor: weeklyColors.pto?.bg,
                        color: weeklyColors.pto?.text
                      }}
                    >
                      PTO: {ptoOfficers.length}
                    </Badge>
                  )}
                  {isCurrentMonthDay && !isUnderstaffed && minimumSupervisors > 0 && (
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="text-xs h-4">
                        {supervisorCount}/{minimumSupervisors} Sup
                      </Badge>
                      <Badge variant="outline" className="text-xs h-4">
                        {officerCount}/{minimumOfficers} Ofc
                      </Badge>
                    </div>
                  )}
                  {isCurrentMonthDay && !isUnderstaffed && minimumSupervisors === 0 && (
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="text-xs h-4">
                        {supervisorCount} Sup
                      </Badge>
                      <Badge variant="outline" className="text-xs h-4">
                        {officerCount} Ofc
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-1 flex-1 overflow-y-auto">
                {ptoOfficers.length > 0 ? (
                  <div className="space-y-1">
                    {ptoOfficers.map((officer: any) => {
                      const isSupervisor = officer.rank?.toLowerCase().includes('lieutenant') || 
                                         officer.rank?.toLowerCase().includes('sergeant') ||
                                         officer.rank?.toLowerCase().includes('sgt') ||
                                         officer.rank?.toLowerCase().includes('lt') ||
                                         officer.rank?.toLowerCase().includes('chief');
                      const isPPO = officer.rank?.toLowerCase() === 'probationary';
                      const rankAbbreviation = getRankAbbreviation(officer.rank);
                      const ptoType = officer.shiftInfo?.ptoData?.ptoType || 'PTO';
                      
                      // Get the correct color based on PTO type
                      const getPTOColor = (ptoType: string) => {
                        const ptoTypeLower = ptoType?.toLowerCase() || '';
                        
                        if (ptoTypeLower.includes('vacation') || ptoTypeLower === 'vacation') {
                          return {
                            bg: weeklyColors.vacation?.bg || 'rgb(173, 216, 230)',
                            text: weeklyColors.vacation?.text || 'rgb(0, 0, 139)',
                            border: weeklyColors.vacation?.border || 'rgb(100, 149, 237)'
                          };
                        } else if (ptoTypeLower.includes('holiday') || ptoTypeLower === 'holiday') {
                          return {
                            bg: weeklyColors.holiday?.bg || 'rgb(255, 218, 185)',
                            text: weeklyColors.holiday?.text || 'rgb(165, 42, 42)',
                            border: weeklyColors.holiday?.border || 'rgb(255, 165, 0)'
                          };
                        } else if (ptoTypeLower.includes('sick') || ptoTypeLower === 'sick') {
                          return {
                            bg: weeklyColors.sick?.bg || 'rgb(255, 200, 200)',
                            text: weeklyColors.sick?.text || 'rgb(139, 0, 0)',
                            border: weeklyColors.sick?.border || 'rgb(255, 100, 100)'
                          };
                        } else if (ptoTypeLower.includes('comp') || ptoTypeLower === 'comp') {
                          return {
                            bg: weeklyColors.comp?.bg || 'rgb(221, 160, 221)',
                            text: weeklyColors.comp?.text || 'rgb(128, 0, 128)',
                            border: weeklyColors.comp?.border || 'rgb(186, 85, 211)'
                          };
                        } else {
                          // Default PTO color for other types
                          return {
                            bg: weeklyColors.pto?.bg || 'rgb(144, 238, 144)',
                            text: weeklyColors.pto?.text || 'rgb(0, 100, 0)',
                            border: weeklyColors.pto?.border || 'rgb(0, 100, 0)'
                          };
                        }
                      };

                      // Get badge color based on rank
                      const getRankBadgeColor = (rankAbbr: string) => {
                        if (rankAbbr === 'Sgt') {
                          return "bg-gray-100 text-gray-800 border-gray-300";
                        } else {
                          return "bg-yellow-100 text-yellow-800 border-yellow-300";
                        }
                      };

                      const ptoColors = getPTOColor(ptoType);
                      const rankBadgeClass = getRankBadgeColor(rankAbbreviation);
                      
                      return (
                        <div 
                          key={officer.officerId} 
                          className="text-xs p-1 rounded border flex items-center justify-between group hover:opacity-90"
                          style={{
                            backgroundColor: ptoColors.bg,
                            borderColor: ptoColors.border,
                            color: ptoColors.text
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <div className={`font-medium truncate ${!isCurrentMonthDay ? 'opacity-70' : ''}`}>
                              {getLastName(officer.officerName)}
                            </div>
                            {isSupervisor && (
                              <Badge variant="outline" className={`h-3 text-[8px] px-1 ${rankBadgeClass}`}>
                                {rankAbbreviation}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <div className={`text-[10px] font-medium ${!isCurrentMonthDay ? 'opacity-70' : ''}`}>
                              {ptoType}
                            </div>
                            {isAdminOrSupervisor && isCurrentMonthDay && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEventHandlers.onRemovePTO(officer.shiftInfo, dateStr, officer.officerId);
                                }}
                                disabled={mutations.removePTOMutation.isPending}
                                title="Remove PTO"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={`text-xs text-center py-2 ${!isCurrentMonthDay ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                    No PTO
                  </div>
                )}
              </div>
              
              {isUnderstaffed && (
                <div className="mt-1 text-[10px] space-y-0.5 text-red-600">
                  {isSupervisorsUnderstaffed && (
                    <div>Sup: {supervisorCount}/{minimumSupervisors}</div>
                  )}
                  {isOfficersUnderstaffed && (
                    <div>Ofc: {officerCount}/{minimumOfficers}</div>
                  )}
                </div>
              )}
              
              {!isCurrentMonthDay && (
                <div className="text-[8px] text-muted-foreground text-center mt-1">
                  {format(day, "MMM")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
