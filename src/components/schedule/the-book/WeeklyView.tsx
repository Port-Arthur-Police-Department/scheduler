// WeeklyView.tsx - Completely rewritten with consistent staffing logic
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, addDays, isSameDay, startOfWeek, addWeeks } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScheduleCell } from "../ScheduleCell";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { ViewProps } from "./types";
import { PREDEFINED_POSITIONS, RANK_ORDER } from "@/constants/positions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sortOfficersConsistently } from "@/utils/sortingUtils";

// Import the same staffing calculation utilities used in DailyScheduleView
import {
  isShiftUnderstaffed,
  formatStaffingCount,
  getStaffingSeverity
} from "@/utils/staffingUtils";
import {
  calculateDailyStaffing,
  getStaffingMinimums,
  isSpecialAssignment,
  shouldCountForStaffing,
  getStaffingCategory,
  isSupervisorByRank
} from "@/utils/staffingCalculations";

interface ExtendedViewProps extends ViewProps {
  onDateChange?: (date: Date) => void;
  officerProfiles?: Map<string, any>;
  queryKey?: any[];
  refetchScheduleData?: () => Promise<void>;
}

export const WeeklyView: React.FC<ExtendedViewProps> = ({
  currentDate: initialDate,
  selectedShiftId,
  schedules,
  isAdminOrSupervisor,
  weeklyColors,
  onDateNavigation,
  onEventHandlers,
  mutations,
  navigateToDailySchedule,
  getLastName,
  getRankPriority,
  isSupervisorByRank: isSupervisorByRankProp,
  onDateChange,
  officerProfiles,
  queryKey = ['weekly-schedule', selectedShiftId],
  refetchScheduleData,
}) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(initialDate);
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  const [selectedWeekDate, setSelectedWeekDate] = useState(initialDate);
  
  const queryClient = useQueryClient();

  // Use the imported isSupervisorByRank function instead of the prop
  const isSupervisorByRank = (officer: any): boolean => {
    if (!officer) return false;
    const rank = officer.rank || '';
    return isSupervisorByRankProp ? isSupervisorByRankProp(officer) : 
      rank.toLowerCase().includes('sergeant') ||
      rank.toLowerCase().includes('lieutenant') ||
      rank.toLowerCase().includes('captain') ||
      rank.toLowerCase().includes('chief') ||
      rank.toLowerCase().includes('commander');
  };

  // Fetch overtime exceptions (extra shifts)
  const { data: overtimeExceptions, isLoading: isLoadingOvertime } = useQuery({
    queryKey: ['overtime-exceptions', currentWeekStart.toISOString(), selectedShiftId],
    queryFn: async () => {
      const weekStart = format(currentWeekStart, 'yyyy-MM-dd');
      const weekEnd = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');
      
      const { data: exceptions, error } = await supabase
        .from('schedule_exceptions')
        .select('*')
        .eq('is_extra_shift', true)
        .eq('shift_type_id', selectedShiftId)
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .order('date');
      
      if (error) {
        console.error('Error fetching overtime exceptions:', error);
        return [];
      }
      
      return exceptions || [];
    },
    enabled: !!selectedShiftId,
  });

  useEffect(() => {
    setCurrentWeekStart(initialDate);
    setSelectedWeekDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    if (onDateChange) {
      onDateChange(currentWeekStart);
    }
  }, [currentWeekStart, onDateChange]);

  useEffect(() => {
    if (weekPickerOpen) {
      setSelectedWeekDate(currentWeekStart);
    }
  }, [weekPickerOpen, currentWeekStart]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(currentWeekStart, i);
      const dayOfWeek = date.getDay();
      return {
        date,
        dateStr: format(date, "yyyy-MM-dd"),
        dayName: format(date, "EEE").toUpperCase(),
        formattedDate: format(date, "MMM d"),
        isToday: isSameDay(date, new Date()),
        dayOfWeek
      };
    });
  }, [currentWeekStart]);

  // Process schedule data for each day using the same logic as DailyScheduleView
  const dailyScheduleData = useMemo(() => {
    if (!schedules?.dailySchedules) {
      return {};
    }
    
    const result: Record<string, any> = {};
    
    weekDays.forEach(({ dateStr, dayOfWeek }) => {
      const daySchedule = schedules.dailySchedules?.find(s => s.date === dateStr);
      if (!daySchedule) return;
      
      // Use the same calculateDailyStaffing function as DailyScheduleView
      const {
        supervisors,
        officers,
        specialAssignmentOfficers,
        suspendedPartnershipOfficers,
        ptoRecords
      } = calculateDailyStaffing(daySchedule);
      
      // Get staffing counts that match DailyScheduleView logic
      const countedSupervisors = supervisors.filter(officer => 
        shouldCountForStaffing(officer)
      );
      const countedOfficers = officers.filter(officer => 
        shouldCountForStaffing(officer)
      );
      
      // Get minimum staffing requirements
      const { minimumOfficers, minimumSupervisors } = getStaffingMinimums(
        schedules.minimumStaffing,
        dayOfWeek,
        selectedShiftId
      );
      
      result[dateStr] = {
        date: dateStr,
        dayOfWeek,
        supervisors: supervisors || [],
        officers: officers || [],
        specialAssignmentOfficers: specialAssignmentOfficers || [],
        suspendedPartnershipOfficers: suspendedPartnershipOfficers || [],
        ptoRecords: ptoRecords || [],
        currentSupervisors: countedSupervisors.length,
        currentOfficers: countedOfficers.length,
        minSupervisors: minimumSupervisors || 0,
        minOfficers: minimumOfficers || 0,
        isSupervisorsUnderstaffed: minimumSupervisors > 0 && countedSupervisors.length < minimumSupervisors,
        isOfficersUnderstaffed: minimumOfficers > 0 && countedOfficers.length < minimumOfficers,
        isAnyUnderstaffed: (minimumSupervisors > 0 && countedSupervisors.length < minimumSupervisors) ||
                          (minimumOfficers > 0 && countedOfficers.length < minimumOfficers)
      };
    });
    
    return result;
  }, [schedules, weekDays, selectedShiftId]);

  // Process overtime data
  const processedOvertimeData = useMemo(() => {
    if (!overtimeExceptions || overtimeExceptions.length === 0) {
      return { overtimeByDate: {} };
    }

    const overtimeByDate: Record<string, any[]> = {};
    
    // Initialize with empty arrays for each day
    weekDays.forEach(day => {
      if (day.dateStr) {
        overtimeByDate[day.dateStr] = [];
      }
    });
    
    // Group overtime exceptions by date
    overtimeExceptions.forEach((exception: any) => {
      const dateStr = exception.date;
      if (overtimeByDate[dateStr]) {
        overtimeByDate[dateStr].push({
          ...exception,
          officerId: exception.officer_id,
          officerName: schedules?.profiles?.[exception.officer_id]?.full_name || "Unknown",
          scheduleId: exception.id,
          scheduleType: 'exception' as const,
          isExtraShift: true,
          shiftInfo: {
            scheduleId: exception.id,
            scheduleType: 'exception' as const,
            position: exception.position_name || "Extra Duty",
            unitNumber: exception.unit_number,
            notes: exception.notes,
            isOff: false,
            hasPTO: false,
            is_extra_shift: true,
            custom_start_time: exception.custom_start_time,
            custom_end_time: exception.custom_end_time
          }
        });
      }
    });
    
    return { overtimeByDate };
  }, [overtimeExceptions, weekDays, schedules]);

  // Get unique officers across all days (excluding overtime)
  const allOfficers = useMemo(() => {
    const officerMap = new Map<string, any>();
    
    Object.values(dailyScheduleData).forEach((dayData: any) => {
      // Combine all regular officers and supervisors (excluding special assignments)
      const regularOfficers = [...(dayData.officers || []), ...(dayData.supervisors || [])];
      
      regularOfficers.forEach((officer: any) => {
        if (!officer.officerId) return;
        
        if (!officerMap.has(officer.officerId)) {
          officerMap.set(officer.officerId, {
            ...officer,
            weeklySchedule: {}
          });
        }
        
        // Add this day's schedule to the officer's weekly schedule
        const existingOfficer = officerMap.get(officer.officerId);
        existingOfficer.weeklySchedule[dayData.date] = officer;
      });
    });
    
    return Array.from(officerMap.values());
  }, [dailyScheduleData]);

  // Get special assignment officers
  const specialAssignmentOfficers = useMemo(() => {
    const officerMap = new Map<string, any>();
    
    Object.values(dailyScheduleData).forEach((dayData: any) => {
      (dayData.specialAssignmentOfficers || []).forEach((officer: any) => {
        if (!officer.officerId) return;
        
        if (!officerMap.has(officer.officerId)) {
          officerMap.set(officer.officerId, {
            ...officer,
            weeklySchedule: {}
          });
        }
        
        const existingOfficer = officerMap.get(officer.officerId);
        existingOfficer.weeklySchedule[dayData.date] = officer;
      });
    });
    
    return Array.from(officerMap.values());
  }, [dailyScheduleData]);

  // Categorize officers (same logic as DailyScheduleView)
  const categorizedOfficers = useMemo(() => {
    const supervisors = allOfficers.filter(officer => 
      isSupervisorByRank(officer) && !isSpecialAssignment(officer.position)
    );
    
    const regularOfficers = allOfficers.filter(officer => 
      !isSupervisorByRank(officer) && 
      !isSpecialAssignment(officer.position) &&
      (!officer.rank || officer.rank.toLowerCase() !== 'probationary')
    );
    
    const ppos = allOfficers.filter(officer => 
      !isSupervisorByRank(officer) && 
      !isSpecialAssignment(officer.position) &&
      officer.rank?.toLowerCase() === 'probationary'
    );
    
    return { supervisors, regularOfficers, ppos };
  }, [allOfficers]);

  // Sort officers consistently
  const sortedSupervisors = useMemo(() => {
    return sortOfficersConsistently(categorizedOfficers.supervisors.map(officer => ({
      id: officer.officerId,
      full_name: officer.name || officer.officerName,
      officerName: officer.name || officer.officerName,
      badge_number: officer.badge,
      badgeNumber: officer.badge,
      rank: officer.rank
    }))).map(sortedOfficer => 
      categorizedOfficers.supervisors.find(o => o.officerId === sortedOfficer.id)
    ).filter(Boolean);
  }, [categorizedOfficers.supervisors]);

  const sortedRegularOfficers = useMemo(() => {
    return sortOfficersConsistently(categorizedOfficers.regularOfficers.map(officer => ({
      id: officer.officerId,
      full_name: officer.name || officer.officerName,
      officerName: officer.name || officer.officerName,
      badge_number: officer.badge,
      badgeNumber: officer.badge,
      rank: officer.rank
    }))).map(sortedOfficer => 
      categorizedOfficers.regularOfficers.find(o => o.officerId === sortedOfficer.id)
    ).filter(Boolean);
  }, [categorizedOfficers.regularOfficers]);

  const sortedPPOs = useMemo(() => {
    return sortOfficersConsistently(categorizedOfficers.ppos.map(officer => ({
      id: officer.officerId,
      full_name: officer.name || officer.officerName,
      officerName: officer.name || officer.officerName,
      badge_number: officer.badge,
      badgeNumber: officer.badge,
      rank: officer.rank
    }))).map(sortedOfficer => 
      categorizedOfficers.ppos.find(o => o.officerId === sortedOfficer.id)
    ).filter(Boolean);
  }, [categorizedOfficers.ppos]);

  const sortedSpecialAssignmentOfficers = useMemo(() => {
    return sortOfficersConsistently(specialAssignmentOfficers.map(officer => ({
      id: officer.officerId,
      full_name: officer.name || officer.officerName,
      officerName: officer.name || officer.officerName,
      badge_number: officer.badge,
      badgeNumber: officer.badge,
      rank: officer.rank
    }))).map(sortedOfficer => 
      specialAssignmentOfficers.find(o => o.officerId === sortedOfficer.id)
    ).filter(Boolean);
  }, [specialAssignmentOfficers]);

  // Helper function to get officer's schedule for a specific day
  const getOfficerScheduleForDay = (officer: any, dateStr: string) => {
    return officer?.weeklySchedule?.[dateStr] || null;
  };

  const handleJumpToWeek = (date: Date) => {
    const weekStart = startOfWeek(date, { weekStartsOn: 0 });
    setCurrentWeekStart(weekStart);
    setSelectedWeekDate(weekStart);
    setWeekPickerOpen(false);
    if (onDateChange) {
      onDateChange(weekStart);
    }
  };

  // Event handlers
  const handleAssignPTO = async (schedule: any, dateStr: string, officerId: string, officerName: string) => {
    if (!onEventHandlers.onAssignPTO) return;
    
    try {
      await onEventHandlers.onAssignPTO(schedule, dateStr, officerId, officerName);
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule', selectedShiftId] });
      toast.success("PTO assigned successfully");
    } catch (error) {
      toast.error("Failed to assign PTO");
      console.error('Error assigning PTO:', error);
    }
  };

  const handleRemovePTO = async (schedule: any, dateStr: string, officerId: string) => {
    if (!onEventHandlers.onRemovePTO) return;
    
    try {
      await onEventHandlers.onRemovePTO(schedule, dateStr, officerId);
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule', selectedShiftId] });
      toast.success("PTO removed successfully");
    } catch (error) {
      toast.error("Failed to remove PTO");
      console.error('Error removing PTO:', error);
    }
  };

  // Early returns
  if (!schedules) {
    return <div className="text-center py-8 text-muted-foreground">No schedule data available</div>;
  }

  if (isLoadingOvertime) {
    return <div className="text-center py-8">Loading overtime data...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-lg font-bold">
          {format(currentWeekStart, "MMM d")} - {format(addDays(currentWeekStart, 6), "MMM d, yyyy")}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onDateNavigation.goToPrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Popover open={weekPickerOpen} onOpenChange={setWeekPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                Jump to Week
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-3">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Select a week</div>
                  <Calendar
                    mode="single"
                    selected={selectedWeekDate}
                    onSelect={(date) => date && handleJumpToWeek(date)}
                    className="rounded-md border"
                  />
                  <div className="flex items-center justify-between pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleJumpToWeek(startOfWeek(new Date(), { weekStartsOn: 0 }))}
                    >
                      This Week
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleJumpToWeek(addWeeks(currentWeekStart, 1))}
                    >
                      Next Week
                    </Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          <Button variant="outline" size="sm" onClick={onDateNavigation.goToNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onDateNavigation.goToCurrent}>
            Today
          </Button>
        </div>
      </div>
      
      <div className="mobile-scroll overflow-x-auto">
        <div className="border rounded-lg overflow-hidden min-w-[900px]">
          {/* Header Row */}
          <div className="grid grid-cols-9 bg-muted/50 border-b">
            <div className="p-2 font-semibold border-r">Empl#</div>
            <div className="p-2 font-semibold border-r">NAME</div>
            {weekDays.map(({ dateStr, dayName, formattedDate, isToday }) => {
              const dayData = dailyScheduleData[dateStr];
              const hasData = !!dayData;
              
              return (
                <div key={dateStr} className={`p-2 text-center font-semibold border-r ${isToday ? 'bg-primary/10' : ''}`}>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-auto p-0 font-semibold hover:bg-transparent hover:underline" 
                    onClick={() => navigateToDailySchedule(dateStr)}
                  >
                    <div>{dayName}</div>
                    <div className="text-xs text-muted-foreground mb-1">{formattedDate}</div>
                  </Button>
                  {hasData ? (
                    <>
                      <Badge 
                        variant={dayData.isSupervisorsUnderstaffed ? "destructive" : "outline"} 
                        className="text-xs mb-1"
                      >
                        {dayData.currentSupervisors} / {dayData.minSupervisors} Sup
                        {dayData.minSupervisors === 0 && " (No min)"}
                      </Badge>
                      <Badge 
                        variant={dayData.isOfficersUnderstaffed ? "destructive" : "outline"} 
                        className="text-xs"
                      >
                        {dayData.currentOfficers} / {dayData.minOfficers} Ofc
                        {dayData.minOfficers === 0 && " (No min)"}
                      </Badge>
                    </>
                  ) : (
                    <div className="text-xs text-muted-foreground">No data</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Supervisor Count Row */}
          <div className="grid grid-cols-9 border-b">
            <div className="p-2 border-r"></div>
            <div className="p-2 border-r text-sm font-medium">SUPERVISORS</div>
            {weekDays.map(({ dateStr }) => {
              const dayData = dailyScheduleData[dateStr];
              return (
                <div key={dateStr} className="p-2 text-center border-r text-sm">
                  {dayData ? (
                    <>
                      <div className={dayData.isSupervisorsUnderstaffed ? 'text-red-600 font-bold' : ''}>
                        {dayData.currentSupervisors} {dayData.minSupervisors > 0 ? `/ ${dayData.minSupervisors}` : ''}
                      </div>
                      {dayData.minSupervisors === 0 && (
                        <div className="text-xs text-muted-foreground">No min</div>
                      )}
                    </>
                  ) : (
                    <div className="text-muted-foreground">-</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Supervisors Rows */}
          {sortedSupervisors.map((officer) => (
            <div key={officer.officerId} className="grid grid-cols-9 border-b hover:bg-muted/30"
              style={{ backgroundColor: weeklyColors.supervisor?.bg, color: weeklyColors.supervisor?.text }}>
              <div className="p-2 border-r text-sm font-mono">{officer.badge || 'N/A'}</div>
              <div className="p-2 border-r font-medium">
                {getLastName(officer.name || officer.officerName || '')}
                <div className="text-xs opacity-80">{officer.rank || 'Officer'}</div>
              </div>
              {weekDays.map(({ dateStr }) => {
                const dayOfficer = getOfficerScheduleForDay(officer, dateStr);
                return (
                  <ScheduleCell
                    key={`${dateStr}-${officer.officerId}`}
                    officer={dayOfficer}
                    dateStr={dateStr}
                    officerId={officer.officerId}
                    officerName={officer.name || officer.officerName}
                    isAdminOrSupervisor={isAdminOrSupervisor}
                    onAssignPTO={(scheduleData) => 
                      handleAssignPTO(scheduleData, dateStr, officer.officerId, officer.name || officer.officerName)
                    }
                    onRemovePTO={(scheduleData) => 
                      handleRemovePTO(scheduleData, dateStr, officer.officerId)
                    }
                    onEditAssignment={() => onEventHandlers.onEditAssignment?.(officer, dateStr)}
                    onRemoveOfficer={() => {
                      const dayOfficer = getOfficerScheduleForDay(officer, dateStr);
                      onEventHandlers.onRemoveOfficer?.(
                        dayOfficer?.scheduleId,
                        dayOfficer?.type as 'recurring' | 'exception',
                        officer
                      );
                    }}
                    isUpdating={mutations.removeOfficerMutation.isPending}
                  />
                );
              })}
            </div>
          ))}

          {/* Officer Count Row */}
          <div className="grid grid-cols-9 border-b bg-muted/30">
            <div className="p-2 border-r"></div>
            <div className="p-2 border-r text-sm font-medium">OFFICERS</div>
            {weekDays.map(({ dateStr }) => {
              const dayData = dailyScheduleData[dateStr];
              return (
                <div key={dateStr} className="p-2 text-center border-r text-sm font-medium">
                  {dayData ? (
                    <>
                      <div className={dayData.isOfficersUnderstaffed ? 'text-red-600 font-bold' : ''}>
                        {dayData.currentOfficers} {dayData.minOfficers > 0 ? `/ ${dayData.minOfficers}` : ''}
                      </div>
                      {dayData.minOfficers === 0 && (
                        <div className="text-xs text-muted-foreground">No min</div>
                      )}
                    </>
                  ) : (
                    <div className="text-muted-foreground">-</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Regular Officers Rows */}
          {sortedRegularOfficers.map((officer) => (
            <div key={officer.officerId} className="grid grid-cols-9 border-b hover:bg-muted/30"
              style={{ backgroundColor: weeklyColors.officer?.bg, color: weeklyColors.officer?.text }}>
              <div className="p-2 border-r text-sm font-mono">{officer.badge || 'N/A'}</div>
              <div className="p-2 border-r font-medium">
                {getLastName(officer.name || officer.officerName || '')}
                <div className="text-xs opacity-80">{officer.rank || 'Officer'}</div>
              </div>
              {weekDays.map(({ dateStr }) => {
                const dayOfficer = getOfficerScheduleForDay(officer, dateStr);
                return (
                  <ScheduleCell
                    key={`${dateStr}-${officer.officerId}`}
                    officer={dayOfficer}
                    dateStr={dateStr}
                    officerId={officer.officerId}
                    officerName={officer.name || officer.officerName}
                    isAdminOrSupervisor={isAdminOrSupervisor}
                    onAssignPTO={(scheduleData) => 
                      handleAssignPTO(scheduleData, dateStr, officer.officerId, officer.name || officer.officerName)
                    }
                    onRemovePTO={(scheduleData) => 
                      handleRemovePTO(scheduleData, dateStr, officer.officerId)
                    }
                    onEditAssignment={() => onEventHandlers.onEditAssignment?.(officer, dateStr)}
                    onRemoveOfficer={() => {
                      const dayOfficer = getOfficerScheduleForDay(officer, dateStr);
                      onEventHandlers.onRemoveOfficer?.(
                        dayOfficer?.scheduleId,
                        dayOfficer?.type as 'recurring' | 'exception',
                        officer
                      );
                    }}
                    isUpdating={mutations.removeOfficerMutation.isPending}
                  />
                );
              })}
            </div>
          ))}

          {/* PPO Rows */}
          {sortedPPOs.map((officer) => (
            <div key={officer.officerId} className="grid grid-cols-9 border-b hover:bg-muted/30"
              style={{ backgroundColor: weeklyColors.ppo?.bg, color: weeklyColors.ppo?.text }}>
              <div className="p-2 border-r text-sm font-mono">{officer.badge || 'N/A'}</div>
              <div className="p-2 border-r font-medium flex items-center gap-2">
                {getLastName(officer.name || officer.officerName || '')}
                <Badge 
                  variant="outline" 
                  className="text-xs border-blue-300"
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    color: weeklyColors.ppo?.text
                  }}
                >
                  PPO
                </Badge>
              </div>
              {weekDays.map(({ dateStr }) => {
                const dayOfficer = getOfficerScheduleForDay(officer, dateStr);
                return (
                  <ScheduleCell
                    key={`${dateStr}-${officer.officerId}`}
                    officer={dayOfficer}
                    dateStr={dateStr}
                    officerId={officer.officerId}
                    officerName={officer.name || officer.officerName}
                    isAdminOrSupervisor={isAdminOrSupervisor}
                    onAssignPTO={(scheduleData) => 
                      handleAssignPTO(scheduleData, dateStr, officer.officerId, officer.name || officer.officerName)
                    }
                    onRemovePTO={(scheduleData) => 
                      handleRemovePTO(scheduleData, dateStr, officer.officerId)
                    }
                    onEditAssignment={() => onEventHandlers.onEditAssignment?.(officer, dateStr)}
                    onRemoveOfficer={() => {
                      const dayOfficer = getOfficerScheduleForDay(officer, dateStr);
                      onEventHandlers.onRemoveOfficer?.(
                        dayOfficer?.scheduleId,
                        dayOfficer?.type as 'recurring' | 'exception',
                        officer
                      );
                    }}
                    isUpdating={mutations.removeOfficerMutation.isPending}
                    isPPO={true}
                  />
                );
              })}
            </div>
          ))}

          {/* Special Assignments Section */}
          {sortedSpecialAssignmentOfficers.length > 0 && (
            <>
              <div className="grid grid-cols-9 border-b bg-muted/50">
                <div className="p-2 border-r"></div>
                <div className="p-2 border-r text-sm font-medium">SPECIAL ASSIGNMENTS</div>
                {weekDays.map(({ dateStr }) => {
                  const dayData = dailyScheduleData[dateStr];
                  const specialAssignmentCount = dayData?.specialAssignmentOfficers?.length || 0;
                  return (
                    <div key={dateStr} className="p-2 text-center border-r text-sm font-medium">
                      {specialAssignmentCount}
                    </div>
                  );
                })}
              </div>
              
              {sortedSpecialAssignmentOfficers.map((officer) => (
                <div key={officer.officerId} className="grid grid-cols-9 border-b hover:bg-muted/30"
                  style={{ backgroundColor: '#e8f4fd', color: '#0369a1' }}>
                  <div className="p-2 border-r text-sm font-mono">{officer.badge || 'N/A'}</div>
                  <div className="p-2 border-r font-medium">
                    {getLastName(officer.name || officer.officerName || '')}
                    <div className="text-xs opacity-80">{officer.rank || 'Officer'}</div>
                  </div>
                  {weekDays.map(({ dateStr }) => {
                    const dayOfficer = getOfficerScheduleForDay(officer, dateStr);
                    return (
                      <ScheduleCell
                        key={`${dateStr}-${officer.officerId}`}
                        officer={dayOfficer}
                        dateStr={dateStr}
                        officerId={officer.officerId}
                        officerName={officer.name || officer.officerName}
                        isAdminOrSupervisor={isAdminOrSupervisor}
                        onAssignPTO={(scheduleData) => 
                          handleAssignPTO(scheduleData, dateStr, officer.officerId, officer.name || officer.officerName)
                        }
                        onRemovePTO={(scheduleData) => 
                          handleRemovePTO(scheduleData, dateStr, officer.officerId)
                        }
                        onEditAssignment={() => onEventHandlers.onEditAssignment?.(officer, dateStr)}
                        onRemoveOfficer={() => {
                          const dayOfficer = getOfficerScheduleForDay(officer, dateStr);
                          onEventHandlers.onRemoveOfficer?.(
                            dayOfficer?.scheduleId,
                            dayOfficer?.type as 'recurring' | 'exception',
                            officer
                          );
                        }}
                        isUpdating={mutations.removeOfficerMutation.isPending}
                        isSpecialAssignment={true}
                      />
                    );
                  })}
                </div>
              ))}
            </>
          )}

          {/* Overtime Section */}
          {Object.values(processedOvertimeData.overtimeByDate).some(arr => arr.length > 0) && (
            <div className="border-t-2 border-orange-300">
              <div className="grid grid-cols-9 border-b"
                style={{ backgroundColor: '#fff3cd', color: '#856404' }}>
                <div className="p-2 border-r"></div>
                <div className="p-2 border-r text-sm font-medium">OVERTIME</div>
                {weekDays.map(({ dateStr }) => {
                  const overtimeCount = processedOvertimeData.overtimeByDate[dateStr]?.length || 0;
                  return (
                    <div key={dateStr} className="p-2 text-center border-r text-sm font-medium">
                      {overtimeCount}
                    </div>
                  );
                })}
              </div>
              
              <div className="grid grid-cols-9 border-b hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#fff3cd', color: '#856404' }}>
                <div className="p-2 border-r text-sm font-mono">OT</div>
                <div className="p-2 border-r font-medium">
                  Overtime Assignments
                </div>
                {weekDays.map(({ dateStr }) => {
                  const overtimeOfficers = processedOvertimeData.overtimeByDate[dateStr] || [];
                  return (
                    <div key={dateStr} className="p-2 border-r">
                      {overtimeOfficers.length > 0 ? (
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {overtimeOfficers.map((officer: any) => (
                            <div key={`${officer.officerId}-${dateStr}`} 
                              className="text-xs p-1 bg-orange-100 rounded border border-orange-200">
                              <div className="font-medium truncate">
                                {getLastName(officer.officerName || '')}
                              </div>
                              <div className="text-xs text-orange-700 truncate">
                                {officer.shiftInfo?.position || 'Extra Duty'}
                              </div>
                              {officer.shiftInfo?.custom_start_time && (
                                <div className="text-xs text-orange-600">
                                  {officer.shiftInfo.custom_start_time}-{officer.shiftInfo.custom_end_time}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground text-center">-</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
