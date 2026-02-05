// MonthlyView.tsx - UPDATED USING CONSTANTS
import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addDays, isSameMonth, isSameDay, parseISO, addMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import type { ViewProps } from "./types";
import { getRankAbbreviation as getRankAbbreviationUtil } from "./utils";
import { PREDEFINED_POSITIONS } from "@/constants/positions";
import { 
  categorizeOfficers, 
  calculateStaffingCounts,
  isSupervisorByRank,
  isRidingWithPartnerPosition,
  OfficerData 
} from "@/utils/scheduleUtils";

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
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [selectedMonthDate, setSelectedMonthDate] = useState(currentDate);

  // Sync with parent when date changes
  useEffect(() => {
    setSelectedMonthDate(currentDate);
  }, [currentDate]);

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

  // Handle jump to month
  const handleJumpToMonth = (date: Date) => {
    const monthStart = startOfMonth(date);
    setMonthPickerOpen(false);
    if (onDateChange) {
      onDateChange(monthStart);
    }
  };

  // ============ STAFFING CALCULATION LOGIC ============
  
  // Helper function to check if an officer is a supervisor
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

  // Helper function to check if an assignment is a regular position (not special)
  // USING PREDEFINED_POSITIONS from constants
  const isRegularPosition = (position: string) => {
    if (!position) return false;
    
    const positionLower = position.toLowerCase();
    
    // Check if it's a "Partner with" assignment
    if (positionLower.includes('partner with')) {
      return false; // Partner assignments are NOT regular positions
    }
    
    // Check if position matches any predefined position (case-insensitive)
    return PREDEFINED_POSITIONS.some(predefined => 
      positionLower === predefined.toLowerCase() || 
      positionLower.includes(predefined.toLowerCase())
    );
  };

  // Helper function to check if an assignment is special (not a regular position)
  const isSpecialAssignment = (position: string) => {
    return !isRegularPosition(position);
  };

  // Get minimum staffing
  const getMinimumStaffing = (dayOfWeek: number) => {
    if (!schedules?.minimumStaffing) {
      return { minimumOfficers: 0, minimumSupervisors: 0 };
    }
    
    // Handle Map structure (from TheBook.tsx query)
    if (schedules.minimumStaffing instanceof Map) {
      const dayStaffing = schedules.minimumStaffing.get(dayOfWeek);
      
      if (dayStaffing && dayStaffing instanceof Map) {
        const shiftStaffing = dayStaffing.get(selectedShiftId);
        return shiftStaffing || { minimumOfficers: 0, minimumSupervisors: 0 };
      }
    }
    
    // Handle object structure (fallback)
    if (typeof schedules.minimumStaffing === 'object') {
      const dayStaffing = (schedules.minimumStaffing as any)[dayOfWeek];
      
      if (dayStaffing && typeof dayStaffing === 'object') {
        const shiftStaffing = dayStaffing[selectedShiftId];
        return shiftStaffing || { minimumOfficers: 0, minimumSupervisors: 0 };
      }
    }
    
    return { minimumOfficers: 0, minimumSupervisors: 0 };
  };

  // Calculate staffing for a day - INCLUDES OVERTIME OFFICERS
  const calculateDayStaffing = (daySchedule: any) => {
    if (!daySchedule || !daySchedule.officers) {
      return { supervisorCount: 0, officerCount: 0 };
    }
    
    let supervisorCount = 0;
    let officerCount = 0;
    
    daySchedule.officers.forEach((officer: any) => {
      const position = officer.shiftInfo?.position || '';
      const hasPTO = officer.shiftInfo?.hasPTO === true;
      const isOff = officer.shiftInfo?.isOff === true;
      const isSupervisor = isSupervisorByRank(officer);
      const isPPO = officer.rank?.toLowerCase() === 'probationary';
      
      // Check if it's a regular position (not special assignment)
      const isRegular = isRegularPosition(position);
      
      // Check if it's a special assignment
      const isSpecial = !isRegular;
      
      // IMPORTANT: Officer is counted for staffing IF:
      // 1. They are NOT off (unless they're working overtime)
      // 2. They do NOT have PTO
      // 3. They are NOT assigned to a special assignment
      // 4. They are NOT a PPO (PPOs have separate minimums if any)
      // 5. OVERTIME OFFICERS ARE COUNTED (is_extra_shift = true)
      
      const isOvertime = officer.shiftInfo?.is_extra_shift === true;
      
      // Overtime officers should be counted UNLESS they have PTO
      if (isOvertime && hasPTO) {
        return; // Overtime officer with PTO doesn't count
      }
      
      const shouldCount = !isOff && !hasPTO && !isSpecial && !isPPO;
      
      if (shouldCount) {
        if (isSupervisor) {
          supervisorCount++;
        } else {
          officerCount++;
        }
      }
    });
    
    return { supervisorCount, officerCount };
  };

  // Helper function to format staffing count
  const formatStaffingCount = (count: number, minimum: number, label: string) => {
    if (minimum > 0) {
      return `${count}/${minimum} ${label}`;
    }
    return `${count} ${label}`;
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
          
          // Get minimum staffing
          const minStaffing = getMinimumStaffing(dayOfWeek);
          const minimumOfficers = minStaffing.minimumOfficers || 0;
          const minimumSupervisors = minStaffing.minimumSupervisors || 0;
          
          // Filter PTO officers
          const ptoOfficers = daySchedule?.officers?.filter((officer: any) => {
            if (!officer.shiftInfo?.hasPTO || !officer.shiftInfo?.ptoData) {
              return false;
            }
            
            const ptoType = officer.shiftInfo?.ptoData?.ptoType?.toLowerCase() || '';
            return ptoType.includes('vacation') || ptoType.includes('holiday') || 
                   ptoType.includes('sick') || ptoType.includes('comp');
          }) || [];

// Calculate staffing counts using shared utilities
let supervisorCount = 0;
let officerCount = 0;

if (isCurrentMonthDay && daySchedule) {
  // Transform officers to match OfficerData interface
  const processedOfficers = daySchedule.officers?.map((officer: any) => ({
    scheduleId: officer.scheduleId,
    officerId: officer.officerId,
    name: officer.officerName,
    badge: officer.badgeNumber,
    rank: officer.rank,
    isPPO: officer.rank?.toLowerCase() === 'probationary',
    position: officer.shiftInfo?.position,
    unitNumber: officer.shiftInfo?.unitNumber,
    notes: officer.shiftInfo?.notes,
    type: officer.scheduleType === 'exception' ? 'exception' : 'recurring',
    hasPTO: officer.shiftInfo?.hasPTO || false,
    ptoData: officer.shiftInfo?.hasPTO ? {
      id: officer.scheduleId,
      ptoType: officer.shiftInfo?.ptoData?.ptoType || officer.shiftInfo?.reason,
      startTime: officer.shiftInfo?.custom_start_time,
      endTime: officer.shiftInfo?.custom_end_time,
      isFullShift: !officer.shiftInfo?.custom_start_time && !officer.shiftInfo?.custom_end_time
    } : undefined,
    isPartnership: false, // Monthly view doesn't track partnerships
    partnerOfficerId: undefined,
    partnershipSuspended: false,
    isExtraShift: officer.shiftInfo?.is_extra_shift === true,
    shift: { id: selectedShiftId, name: 'Monthly View Shift' },
    date: dateStr,
    dayOfWeek: dayOfWeek
  })) || [];

  // Categorize officers
  const categorized = categorizeOfficers(processedOfficers);
  const staffingCounts = calculateStaffingCounts(categorized);
  
  supervisorCount = staffingCounts.currentSupervisors;
  officerCount = staffingCounts.currentOfficers;
}

          // Check understaffing
          const isOfficersUnderstaffed = isCurrentMonthDay && 
                                         minimumOfficers > 0 && 
                                         officerCount < minimumOfficers;
          
          const isSupervisorsUnderstaffed = isCurrentMonthDay && 
                                           minimumSupervisors > 0 && 
                                           supervisorCount < minimumSupervisors;
          
          const isUnderstaffed = isCurrentMonthDay && (isOfficersUnderstaffed || isSupervisorsUnderstaffed);

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
                  {isCurrentMonthDay && (
                    <div className="flex flex-col gap-1">
                      <Badge 
                        variant={isSupervisorsUnderstaffed ? "destructive" : "outline"} 
                        className="text-xs h-4"
                      >
                        {formatStaffingCount(supervisorCount, minimumSupervisors, 'Sup')}
                      </Badge>
                      <Badge 
                        variant={isOfficersUnderstaffed ? "destructive" : "outline"} 
                        className="text-xs h-4"
                      >
                        {formatStaffingCount(officerCount, minimumOfficers, 'Ofc')}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-1 flex-1 overflow-y-auto">
                {ptoOfficers.length > 0 ? (
                  <div className="space-y-1">
                    {ptoOfficers.map((officer: any) => {
                      const isSupervisor = isSupervisorByRank(officer);
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
