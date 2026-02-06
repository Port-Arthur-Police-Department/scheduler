// WeeklyView.tsx - Rewritten to match WeeklyViewMobile.tsx logic
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, addDays, isSameDay, startOfWeek, addWeeks, endOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScheduleCell } from "../ScheduleCell";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { ViewProps } from "./types";
import { PREDEFINED_POSITIONS } from "@/constants/positions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sortOfficersConsistently, type OfficerForSorting } from "@/utils/sortingUtils";

// Import the SAME staffing utilities used in WeeklyViewMobile
import {
  isShiftUnderstaffed,
  hasMinimumRequirements,
  formatStaffingCount 
} from "@/utils/staffingUtils";

interface ExtendedViewProps extends ViewProps {
  onDateChange?: (date: Date) => void;
  officerProfiles?: Map<string, any>;
  queryKey?: any[];
  refetchScheduleData?: () => Promise<void>;
}

export const WeeklyView: React.FC<ExtendedViewProps> = ({
  currentDate: initialDate,
  selectedShiftId,
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
  queryKey = ['weekly-schedule', selectedShiftId],
  refetchScheduleData,
}) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(initialDate);
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  const [selectedWeekDate, setSelectedWeekDate] = useState(initialDate);
  
  const queryClient = useQueryClient();

  // Use the prop or fallback to default implementation
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

  // MATCH MOBILE LOGIC: Data fetching and processing
  const { data: scheduleData, isLoading, error, refetch } = useQuery({
    queryKey: ['weekly-schedule-desktop', selectedShiftId, currentWeekStart.toISOString()],
    queryFn: async () => {
      console.log('🔍 Desktop query started for shift:', selectedShiftId, 'week:', format(currentWeekStart, 'yyyy-MM-dd'));
      
      if (!selectedShiftId) {
        console.log('❌ No shift ID selected');
        return null;
      }

      const startStr = format(currentWeekStart, "yyyy-MM-dd");
      const endStr = format(endOfWeek(currentWeekStart, { weekStartsOn: 0 }), "yyyy-MM-dd");

      console.log('📅 Fetching data for date range:', startStr, 'to', endStr);

      try {
        // Fetch schedule exceptions (including overtime with is_extra_shift = true)
        console.log('🔄 Fetching exceptions...');
        const { data: exceptions, error: exceptionsError } = await supabase
          .from("schedule_exceptions")
          .select(`
            *,
            profiles:officer_id (
              id, full_name, badge_number, rank, hire_date, 
              promotion_date_sergeant, promotion_date_lieutenant,
              service_credit_override
            )
          `)
          .eq("shift_type_id", selectedShiftId)
          .gte("date", startStr)
          .lte("date", endStr)
          .order("date", { ascending: true });

        if (exceptionsError) throw exceptionsError;
        console.log('✅ Exceptions fetched:', exceptions?.length, 'records');
        
        // Fetch recurring schedules
        console.log('🔄 Fetching recurring schedules...');
        const { data: recurringSchedules, error: recurringError } = await supabase
          .from("recurring_schedules")
          .select(`
            *,
            profiles:officer_id (
              id, full_name, badge_number, rank, hire_date,
              promotion_date_sergeant, promotion_date_lieutenant,
              service_credit_override
            )
          `)
          .eq("shift_type_id", selectedShiftId)
          .or(`end_date.is.null,end_date.gte.${startStr}`);

        if (recurringError) throw recurringError;
        console.log('✅ Recurring fetched:', recurringSchedules?.length, 'records');

        // Fetch all recurring schedules for primary shift determination
        console.log('🔄 Fetching all recurring schedules for primary shift determination...');
        const { data: allRecurringSchedules, error: allRecurringError } = await supabase
          .from("recurring_schedules")
          .select("officer_id, shift_type_id, day_of_week")
          .order("officer_id");

        if (allRecurringError) {
          console.error("Error fetching all recurring schedules:", allRecurringError);
        }

        // Determine primary shifts from recurring schedules
        const primaryShifts = new Map();
        if (allRecurringSchedules) {
          const shiftCountsByOfficer = new Map();
          
          allRecurringSchedules.forEach(schedule => {
            const officerId = schedule.officer_id;
            const shiftId = schedule.shift_type_id;
            
            if (!shiftCountsByOfficer.has(officerId)) {
              shiftCountsByOfficer.set(officerId, new Map());
            }
            
            const officerShifts = shiftCountsByOfficer.get(officerId);
            officerShifts.set(shiftId, (officerShifts.get(shiftId) || 0) + 1);
          });
          
          shiftCountsByOfficer.forEach((shiftCounts, officerId) => {
            let maxCount = 0;
            let primaryShiftId = null;
            
            shiftCounts.forEach((count, shiftId) => {
              if (count > maxCount) {
                maxCount = count;
                primaryShiftId = shiftId;
              }
            });
            
            if (primaryShiftId) {
              primaryShifts.set(officerId, primaryShiftId);
            }
          });
        }

        // Fetch minimum staffing
        const { data: minStaffingData, error: minStaffingError } = await supabase
          .from("minimum_staffing")
          .select("*")
          .eq("shift_type_id", selectedShiftId);

        if (minStaffingError) {
          console.error("Error fetching minimum staffing:", minStaffingError);
        }

        // Create minimum staffing map
        const minimumStaffing = new Map();
        minStaffingData?.forEach(staffing => {
          if (!minimumStaffing.has(staffing.day_of_week)) {
            minimumStaffing.set(staffing.day_of_week, new Map());
          }
          minimumStaffing.get(staffing.day_of_week).set(staffing.shift_type_id, {
            minimumOfficers: staffing.minimum_officers || 0,
            minimumSupervisors: staffing.minimum_supervisors || 0
          });
        });

        // Organize data
        const allOfficers = new Map();
        const recurringSchedulesByOfficer = new Map();
        const exceptionsByOfficerAndDate = new Map();

        // Extract recurring schedule patterns
        recurringSchedules?.forEach((recurring: any) => {
          if (!recurringSchedulesByOfficer.has(recurring.officer_id)) {
            recurringSchedulesByOfficer.set(recurring.officer_id, new Set());
          }
          recurringSchedulesByOfficer.get(recurring.officer_id).add(recurring.day_of_week);
        });

        // Map exceptions by officer and date for quick lookup
        exceptions?.forEach((exception: any) => {
          const key = `${exception.officer_id}-${exception.date}`;
          exceptionsByOfficerAndDate.set(key, exception);
        });

        console.log('🗺️ Processing weekly data...');

        // Helper function to get relevant promotion date
        const getRelevantPromotionDate = (
          rank: string | undefined, 
          sergeantDate: string | null, 
          lieutenantDate: string | null
        ): string | null => {
          if (!rank) return null;
          const rankLower = rank.toLowerCase();
          
          if (rankLower.includes('lieutenant') || rankLower.includes('chief')) {
            return lieutenantDate || sergeantDate || null;
          }
          if (rankLower.includes('sergeant') || rankLower.includes('sgt')) {
            return sergeantDate || null;
          }
          return null;
        };

        // Process weekly data - SEPARATE regular and overtime officers
        const regularOfficersMap = new Map(); // For regular shifts
        const overtimeOfficersMap = new Map(); // For overtime shifts

        weekDays.forEach(day => {
          const dayExceptions = exceptions?.filter(e => e.date === day.dateStr) || [];
          const dayRecurring = recurringSchedules?.filter(r => r.day_of_week === day.dayOfWeek) || [];
          
          // Prioritize exceptions over recurring
          const processedOfficers = new Set();
          
          // First, process exceptions
          dayExceptions.forEach(item => {
            const officerId = item.officer_id;
            processedOfficers.add(officerId);
            
            const profile = item.profiles || {};
            const hireDate = profile.hire_date;
            const promotionDateSergeant = profile.promotion_date_sergeant;
            const promotionDateLieutenant = profile.promotion_date_lieutenant;
            const overrideCredit = profile.service_credit_override || 0;
            const badgeNumber = profile.badge_number || '9999';
            const officerName = profile.full_name || "Unknown";
            const rank = profile.rank || "Officer";
            
            // MATCH MOBILE LOGIC: Use is_extra_shift flag from database
            const isExtraShift = item.is_extra_shift === true;
            
            console.log('DESKTOP OVERTIME CHECK for officer:', {
              officerName: profile.full_name,
              isExtraShift: item.is_extra_shift,
              exceptionId: item.id,
              date: day.dateStr,
              assignedToTargetMap: isExtraShift ? 'overtime' : 'regular'
            });
            
            // Determine which map to use based on whether this is overtime
            const targetMap = isExtraShift ? overtimeOfficersMap : regularOfficersMap;
            
            if (!targetMap.has(officerId)) {
              const relevantPromotionDate = getRelevantPromotionDate(
                rank,
                promotionDateSergeant,
                promotionDateLieutenant
              );
              
              targetMap.set(officerId, {
                officerId: officerId,
                officerName: officerName,
                badgeNumber: badgeNumber,
                rank: rank,
                service_credit: 0,
                hire_date: hireDate,
                promotion_date_sergeant: promotionDateSergeant,
                promotion_date_lieutenant: promotionDateLieutenant,
                service_credit_override: overrideCredit,
                promotion_date: relevantPromotionDate || hireDate,
                recurringDays: recurringSchedulesByOfficer.get(officerId) || new Set(),
                weeklySchedule: {} as Record<string, any>,
                primaryShiftId: primaryShifts.get(officerId),
                isExtraShift: isExtraShift
              });
            }
            
            // Properly set PTO data
            const hasPTO = item.is_off === true && !!item.reason;
            const daySchedule = {
              officerId: officerId,
              officerName: officerName,
              badgeNumber: badgeNumber,
              rank: rank,
              service_credit: 0,
              date: day.dateStr,
              dayOfWeek: day.dayOfWeek,
              isRegularRecurringDay: false,
              isExtraShift: isExtraShift,
              is_extra_shift: item.is_extra_shift || false,
              shiftInfo: {
                scheduleId: item.id,
                scheduleType: "exception",
                position: item.position_name,
                isOff: item.is_off || false,
                hasPTO: hasPTO,
                ptoData: hasPTO ? {
                  ptoType: item.reason,
                  isFullShift: true
                } : undefined,
                reason: item.reason,
                isExtraShift: isExtraShift,
                is_extra_shift: item.is_extra_shift || false,
                custom_start_time: item.custom_start_time,
                custom_end_time: item.custom_end_time
              }
            };
            
            if (hasPTO) {
              console.log('🎯 PTO Found for', officerName, 'on', day.dateStr, ':', {
                ptoType: item.reason
              });
            }
            
            const officerData = targetMap.get(officerId);
            if (officerData) {
              officerData.weeklySchedule[day.dateStr] = daySchedule;
            } else {
              console.error(`❌ Officer data is undefined for ID: ${officerId}`);
            }
          });
          
          // Then, process recurring ONLY if no exception exists
          dayRecurring.forEach(item => {
            const officerId = item.officer_id;
            
            // Skip if we already processed an exception for this officer on this day
            if (processedOfficers.has(officerId)) {
              return;
            }
            
            const profile = item.profiles || {};
            const hireDate = profile.hire_date;
            const promotionDateSergeant = profile.promotion_date_sergeant;
            const promotionDateLieutenant = profile.promotion_date_lieutenant;
            const overrideCredit = profile.service_credit_override || 0;
            const badgeNumber = profile.badge_number || '9999';
            const officerName = profile.full_name || "Unknown";
            const rank = profile.rank || "Officer";
            
            // MATCH MOBILE LOGIC: Regular recurring schedules are NEVER overtime
            const isExtraShift = false;
            
            // Determine which map to use
            const targetMap = regularOfficersMap; // Recurring always goes to regular
            
            if (!targetMap.has(officerId)) {
              const relevantPromotionDate = getRelevantPromotionDate(
                rank,
                promotionDateSergeant,
                promotionDateLieutenant
              );
              
              targetMap.set(officerId, {
                officerId: officerId,
                officerName: officerName,
                badgeNumber: badgeNumber,
                rank: rank,
                service_credit: 0,
                hire_date: hireDate,
                promotion_date_sergeant: promotionDateSergeant,
                promotion_date_lieutenant: promotionDateLieutenant,
                service_credit_override: overrideCredit,
                promotion_date: relevantPromotionDate || hireDate,
                recurringDays: recurringSchedulesByOfficer.get(officerId) || new Set(),
                weeklySchedule: {} as Record<string, any>,
                primaryShiftId: primaryShifts.get(officerId),
                isExtraShift: isExtraShift
              });
            }
            
            const daySchedule = {
              officerId: officerId,
              officerName: officerName,
              badgeNumber: badgeNumber,
              rank: rank,
              service_credit: 0,
              date: day.dateStr,
              dayOfWeek: day.dayOfWeek,
              isRegularRecurringDay: true,
              isExtraShift: isExtraShift,
              is_extra_shift: false,
              shiftInfo: {
                scheduleId: item.id,
                scheduleType: "recurring",
                position: item.position_name,
                isOff: item.is_off || false,
                hasPTO: false,
                ptoData: undefined,
                reason: item.reason,
                isExtraShift: isExtraShift,
                is_extra_shift: false // Regular recurring is never overtime
              }
            };
            
            const officerData = targetMap.get(officerId);
            if (officerData) {
              officerData.weeklySchedule[day.dateStr] = daySchedule;
            } else {
              console.error(`❌ Officer data is undefined for ID: ${officerId}`);
            }
          });
        });

        console.log('📊 Total unique officers found:', {
          regular: regularOfficersMap.size,
          overtime: overtimeOfficersMap.size,
          total: regularOfficersMap.size + overtimeOfficersMap.size
        });

        // Fetch service credits for all officers via RPC
        console.log('🔄 Fetching service credits via RPC...');
        const allOfficerIds = [
          ...Array.from(regularOfficersMap.keys()),
          ...Array.from(overtimeOfficersMap.keys())
        ];
        const uniqueOfficerIds = [...new Set(allOfficerIds)];
        const serviceCreditsMap = new Map();

        if (uniqueOfficerIds.length > 0) {
          for (const officerId of uniqueOfficerIds) {
            try {
              const { data, error } = await supabase
                .rpc('get_service_credit', { profile_id: officerId });
              
              if (!error && data !== null) {
                const creditValue = parseFloat(data);
                serviceCreditsMap.set(officerId, isNaN(creditValue) ? 0 : creditValue);
              } else {
                console.log(`No service credit data for officer ${officerId}:`, error);
                serviceCreditsMap.set(officerId, 0);
              }
            } catch (error) {
              console.error(`Error fetching service credit for officer ${officerId}:`, error);
              serviceCreditsMap.set(officerId, 0);
            }
          }
        }

        // Update officers with fetched service credits
        regularOfficersMap.forEach(officer => {
          officer.service_credit = serviceCreditsMap.get(officer.officerId) || 0;
          Object.values(officer.weeklySchedule).forEach((daySchedule: any) => {
            daySchedule.service_credit = officer.service_credit;
          });
        });

        overtimeOfficersMap.forEach(officer => {
          officer.service_credit = serviceCreditsMap.get(officer.officerId) || 0;
          Object.values(officer.weeklySchedule).forEach((daySchedule: any) => {
            daySchedule.service_credit = officer.service_credit;
          });
        });

        // Convert regular officers to OfficerForSorting format
        const regularOfficersArray = Array.from(regularOfficersMap.values());
        const overtimeOfficersArray = Array.from(overtimeOfficersMap.values());

        // Convert regular officers to OfficerForSorting format
        const regularOfficersForSorting: OfficerForSorting[] = regularOfficersArray.map(officer => ({
          id: officer.officerId,
          full_name: officer.officerName,
          officerName: officer.officerName,
          badge_number: officer.badgeNumber,
          badgeNumber: officer.badgeNumber,
          rank: officer.rank,
          service_credit: officer.service_credit,
          serviceCredit: officer.service_credit,
          hire_date: officer.hire_date,
          service_credit_override: officer.service_credit_override || 0,
          promotion_date_sergeant: officer.promotion_date_sergeant,
          promotion_date_lieutenant: officer.promotion_date_lieutenant
        }));

        // Sort officers consistently
        console.log('🔄 Sorting officers consistently...');
        const sortedOfficers = sortOfficersConsistently(regularOfficersForSorting);

        // Map back to original structure and categorize REGULAR officers only
        const supervisors = sortedOfficers
          .filter(officer => isSupervisorByRank({ rank: officer.rank }))
          .map(officer => {
            const originalOfficer = regularOfficersArray.find(o => o.officerId === officer.id);
            if (originalOfficer) {
              originalOfficer.service_credit = officer.service_credit;
            }
            return originalOfficer;
          })
          .filter(Boolean);

        const regularOfficers = sortedOfficers
          .filter(officer => 
            !isSupervisorByRank({ rank: officer.rank }) && 
            officer.rank?.toLowerCase() !== 'probationary'
          )
          .map(officer => {
            const originalOfficer = regularOfficersArray.find(o => o.officerId === officer.id);
            if (originalOfficer) {
              originalOfficer.service_credit = officer.service_credit;
            }
            return originalOfficer;
          })
          .filter(Boolean);

        const ppos = sortedOfficers
          .filter(officer => officer.rank?.toLowerCase() === 'probationary')
          .map(officer => {
            const originalOfficer = regularOfficersArray.find(o => o.officerId === officer.id);
            if (originalOfficer) {
              originalOfficer.service_credit = officer.service_credit;
            }
            return originalOfficer;
          })
          .filter(Boolean);

        // Group overtime officers by date - ONLY those with is_extra_shift = true
        const overtimeByDate: Record<string, any[]> = {};
        weekDays.forEach(day => {
          overtimeByDate[day.dateStr] = [];
        });
        
        overtimeOfficersArray.forEach(officer => {
          Object.entries(officer.weeklySchedule || {}).forEach(([dateStr, schedule]: [string, any]) => {
            if (schedule?.is_extra_shift === true && overtimeByDate[dateStr]) {
              overtimeByDate[dateStr].push(schedule);
            }
          });
        });

        console.log('✅ Data processing complete:', {
          supervisors: supervisors.length,
          regularOfficers: regularOfficers.length,
          ppos: ppos.length,
          overtimeOfficers: overtimeOfficersArray.length,
          overtimeDaysWithAssignments: Object.entries(overtimeByDate)
            .filter(([_, officers]) => officers.length > 0)
            .map(([date, officers]) => ({ date, count: officers.length }))
        });

        return {
          supervisors,
          regularOfficers,
          ppos,
          overtimeOfficers: overtimeOfficersArray,
          overtimeByDate,
          minimumStaffing,
          dailySchedules: weekDays.map(day => ({
            date: day.dateStr,
            dayOfWeek: day.dayOfWeek,
            officers: [
              ...Array.from(regularOfficersMap.values())
                .map(officer => officer.weeklySchedule[day.dateStr])
                .filter(Boolean),
              ...Array.from(overtimeOfficersMap.values())
                .map(officer => officer.weeklySchedule[day.dateStr])
                .filter(Boolean)
            ]
          }))
        };

      } catch (error) {
        console.error('❌ Error in desktop schedule query:', error);
        throw error;
      }
    },
    enabled: !!selectedShiftId,
    retry: 1,
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

  // Helper function to check if position is a special assignment
  const isSpecialAssignment = (position: string) => {
    return position && (
      position.toLowerCase().includes('other') ||
      position.toLowerCase().includes('special') ||
      position.toLowerCase().includes('training') ||
      position.toLowerCase().includes('detail') ||
      position.toLowerCase().includes('court') ||
      position.toLowerCase().includes('extra') ||
      (position && !PREDEFINED_POSITIONS.includes(position))
    );
  };

  // Helper function to check if position is a supervisor position
  const isSupervisorPosition = (position: string) => {
    if (!position) return false;
    const positionLower = position.toLowerCase();
    return positionLower.includes('supervisor') || 
           positionLower.includes('sgt') ||
           positionLower.includes('sergeant') ||
           positionLower.includes('lieutenant') ||
           positionLower.includes('chief') ||
           positionLower.includes('captain');
  };

  // Helper function to get minimum staffing for a specific day
  const getMinimumStaffing = (dayOfWeek: number) => {
    if (!scheduleData?.minimumStaffing) {
      return { minimumOfficers: 0, minimumSupervisors: 0 };
    }
    
    // Handle Map structure
    if (scheduleData.minimumStaffing instanceof Map) {
      const dayStaffing = scheduleData.minimumStaffing.get(dayOfWeek);
      if (dayStaffing instanceof Map) {
        const shiftStaffing = dayStaffing.get(selectedShiftId);
        return shiftStaffing || { minimumOfficers: 0, minimumSupervisors: 0 };
      }
    }
    
    // Handle object structure (fallback)
    const dayStaffing = scheduleData.minimumStaffing[dayOfWeek];
    if (dayStaffing && typeof dayStaffing === 'object') {
      const shiftStaffing = dayStaffing[selectedShiftId];
      return shiftStaffing || { minimumOfficers: 0, minimumSupervisors: 0 };
    }
    
    return { minimumOfficers: 0, minimumSupervisors: 0 };
  };

  // Helper function to check if an officer is working overtime
  const isOfficerOvertime = (officer: any): boolean => {
    if (!officer) return false;
    
    // Match mobile logic: Use is_extra_shift flag
    const isOvertime = 
      officer.shiftInfo?.is_extra_shift === true ||
      officer.is_extra_shift === true;
    
    return isOvertime;
  };

  // Helper to get officer's schedule for a specific day
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
      await refetch();
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
      await refetch();
      toast.success("PTO removed successfully");
    } catch (error) {
      toast.error("Failed to remove PTO");
      console.error('Error removing PTO:', error);
    }
  };

  // Early returns
  if (isLoading) {
    return <div className="text-center py-8">Loading schedule data...</div>;
  }

  if (error) {
    console.error('Query error details:', error);
    return (
      <div className="text-center py-8 text-destructive">
        <p className="font-semibold mb-2">Error loading schedule</p>
        <p className="text-sm text-muted-foreground mb-4">
          {error.message || 'Unknown error occurred'}
        </p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!selectedShiftId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Please select a shift to view schedule</p>
      </div>
    );
  }

  if (!scheduleData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No schedule data available
      </div>
    );
  }

  const hasOvertime = scheduleData.overtimeOfficers && scheduleData.overtimeOfficers.length > 0;

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
          {/* Table Header */}
          <div className="grid grid-cols-9 bg-muted/50 border-b">
            <div className="p-2 font-semibold border-r">Empl#</div>
            <div className="p-2 font-semibold border-r">NAME</div>
            {weekDays.map(({ dateStr, dayName, formattedDate, isToday, dayOfWeek }) => {
              // Use the helper function
              const minStaffing = getMinimumStaffing(dayOfWeek);
              const minimumSupervisors = minStaffing.minimumSupervisors || 0;
              const minimumOfficers = minStaffing.minimumOfficers || 0;
              
              // Calculate the actual counts
              const daySchedule = scheduleData.dailySchedules?.find(s => s.date === dateStr);
              
              // Calculate supervisor count
              const overtimeForDay = scheduleData.overtimeByDate?.[dateStr] || [];
              const overtimeSupervisorCount = overtimeForDay.filter((officer: any) => {
                const position = officer.shiftInfo?.position || "";
                return isSupervisorPosition(position);
              }).length || 0;
              
              const regularSupervisorCount = daySchedule?.officers?.filter((officer: any) => {
                const isSupervisor = isSupervisorByRank(officer);
                const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
                const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
                const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
                const isOvertime = officer.shiftInfo?.is_extra_shift === true || officer.is_extra_shift === true;
                return isSupervisor && isScheduled && !isOvertime;
              }).length || 0;
              
              const supervisorCount = regularSupervisorCount + overtimeSupervisorCount;
              
              // Calculate officer count
              const overtimeOfficerCount = overtimeForDay.filter((officer: any) => {
                const position = officer.shiftInfo?.position || "";
                return !isSupervisorPosition(position) && !isSpecialAssignment(position);
              }).length || 0;
              
              const regularOfficerCount = daySchedule?.officers?.filter((officer: any) => {
                const isOfficer = !isSupervisorByRank(officer);
                const isNotPPO = officer.rank?.toLowerCase() !== 'probationary';
                const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
                const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
                const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
                const isOvertime = officer.shiftInfo?.is_extra_shift === true || officer.is_extra_shift === true;
                return isOfficer && isNotPPO && isScheduled && !isOvertime;
              }).length || 0;
              
              const officerCount = regularOfficerCount + overtimeOfficerCount;
              
              // Use utility functions
              const isSupervisorsUnderstaffed = minimumSupervisors > 0 && supervisorCount < minimumSupervisors;
              const isOfficersUnderstaffed = minimumOfficers > 0 && officerCount < minimumOfficers;
              const hasRequirements = hasMinimumRequirements(minimumSupervisors, minimumOfficers);
              
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
                  
                  {hasRequirements ? (
                    <>
                      <Badge 
                        variant={isSupervisorsUnderstaffed ? "destructive" : "outline"} 
                        className="text-xs mb-1"
                      >
                        {supervisorCount} / {minimumSupervisors} Sup
                      </Badge>
                      <Badge 
                        variant={isOfficersUnderstaffed ? "destructive" : "outline"} 
                        className="text-xs"
                      >
                        {officerCount} / {minimumOfficers} Ofc
                      </Badge>
                    </>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      No minimums
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          {/* Supervisor Count Row - EXCLUDES OVERTIME SUPERVISORS */}
          <div className="grid grid-cols-9 border-b bg-muted/30">
            <div className="p-2 border-r text-sm"></div>
            <div className="p-2 border-r text-sm font-medium">SUPERVISORS</div>
            {weekDays.map(({ dateStr, dayOfWeek }) => {
              const daySchedule = scheduleData.dailySchedules?.find(s => s.date === dateStr);
              const minStaffing = getMinimumStaffing(dayOfWeek);
              const minimumSupervisors = minStaffing.minimumSupervisors || 0;
              
              // Get overtime supervisors for this day
              const overtimeForDay = scheduleData.overtimeByDate?.[dateStr] || [];
              const overtimeSupervisorCount = overtimeForDay.filter((officer: any) => {
                const position = officer.shiftInfo?.position || "";
                return isSupervisorPosition(position);
              }).length || 0;
              
              // Count regular supervisors (excluding overtime and special assignments)
              const regularSupervisorCount = daySchedule?.officers?.filter((officer: any) => {
                const isSupervisor = isSupervisorByRank(officer);
                const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
                const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
                const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
                const isOvertime = officer.shiftInfo?.is_extra_shift === true || officer.is_extra_shift === true;
                return isSupervisor && isScheduled && !isOvertime;
              }).length || 0;
              
              const supervisorCount = regularSupervisorCount + overtimeSupervisorCount;
              
              // Add understaffing check using utility function
              const isSupervisorsUnderstaffed = minimumSupervisors > 0 && supervisorCount < minimumSupervisors;
              
              return (
                <div key={dateStr} className="p-2 text-center border-r text-sm font-medium">
                  <div className={isSupervisorsUnderstaffed ? 'text-red-600 font-bold' : ''}>
                    {supervisorCount} {minimumSupervisors > 0 ? `/ ${minimumSupervisors}` : ''}
                  </div>
                  {minimumSupervisors === 0 && (
                    <div className="text-xs text-muted-foreground">No min</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Supervisors - REGULAR ONLY (no overtime) */}
          {scheduleData.supervisors.map((officer: any) => {
            // Check if this officer has ANY overtime days in their schedule
            const hasOvertimeInSchedule = weekDays.some(({ dateStr }) => {
              const dayOfficer = getOfficerScheduleForDay(officer, dateStr);
              return dayOfficer?.is_extra_shift === true || dayOfficer?.shiftInfo?.is_extra_shift === true;
            });
            
            // If officer has ANY overtime shifts, DO NOT RENDER them in regular rows
            if (hasOvertimeInSchedule) {
              console.log('Skipping supervisor officer with overtime shifts from regular rows:', officer.officerName);
              return null;
            }
            
            return (
              <div key={officer.officerId} className="grid grid-cols-9 border-b hover:bg-muted/30"
                style={{ backgroundColor: weeklyColors.supervisor?.bg, color: weeklyColors.supervisor?.text }}>
                <div className="p-2 border-r text-sm font-mono">{officer.badgeNumber}</div>
                <div className="p-2 border-r font-medium">
                  {getLastName(officer.officerName)}
                  <div className="text-xs opacity-80">{officer.rank || 'Officer'}</div>
                  <div className="text-xs text-muted-foreground">
                    SC: {officer.service_credit?.toFixed(1) || '0.0'}
                  </div>
                </div>
                {weekDays.map(({ dateStr }) => {
                  const dayOfficer = getOfficerScheduleForDay(officer, dateStr);
                  return (
                    <ScheduleCell
                      key={`${dateStr}-${officer.officerId}`}
                      officer={dayOfficer}
                      dateStr={dateStr}
                      officerId={officer.officerId}
                      officerName={officer.officerName}
                      isAdminOrSupervisor={isAdminOrSupervisor}
                      onAssignPTO={(scheduleData) => handleAssignPTO(scheduleData, dateStr, officer.officerId, officer.officerName)}
                      onRemovePTO={(scheduleData) => handleRemovePTO(scheduleData, dateStr, officer.officerId)}
                      onEditAssignment={() => onEventHandlers.onEditAssignment?.(officer, dateStr)}
                      onRemoveOfficer={() => {
                        const dayOfficer = getOfficerScheduleForDay(officer, dateStr);
                        onEventHandlers.onRemoveOfficer?.(
                          dayOfficer?.shiftInfo?.scheduleId,
                          dayOfficer?.shiftInfo?.scheduleType as 'recurring' | 'exception',
                          officer
                        );
                      }}
                      isUpdating={mutations.removeOfficerMutation.isPending}
                      isSupervisor={true}
                      isRegularRecurringDay={dayOfficer?.isRegularRecurringDay || false}
                      isSpecialAssignment={isSpecialAssignment}
                    />
                  );
                })}
              </div>
            );
          })}

          {/* Officer Count Row - EXCLUDES OVERTIME OFFICERS */}
          <div className="grid grid-cols-9 border-b bg-muted/30">
            <div className="p-2 border-r text-sm"></div>
            <div className="p-2 border-r text-sm font-medium">OFFICERS</div>
            {weekDays.map(({ dateStr, dayOfWeek }) => {
              const daySchedule = scheduleData.dailySchedules?.find(s => s.date === dateStr);
              const minStaffing = getMinimumStaffing(dayOfWeek);
              const minimumOfficers = minStaffing.minimumOfficers || 0;
              
              // Get overtime officers for this day
              const overtimeForDay = scheduleData.overtimeByDate?.[dateStr] || [];
              const overtimeOfficerCount = overtimeForDay.filter((officer: any) => {
                const position = officer.shiftInfo?.position || "";
                return !isSupervisorPosition(position) && !isSpecialAssignment(position);
              }).length || 0;
              
              // Count regular officers (excluding overtime, supervisors, PPOs, and special assignments)
              const regularOfficerCount = daySchedule?.officers?.filter((officer: any) => {
                const isOfficer = !isSupervisorByRank(officer);
                const isNotPPO = officer.rank?.toLowerCase() !== 'probationary';
                const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
                const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
                const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
                const isOvertime = officer.shiftInfo?.is_extra_shift === true || officer.is_extra_shift === true;
                return isOfficer && isNotPPO && isScheduled && !isOvertime;
              }).length || 0;
              
              const officerCount = regularOfficerCount + overtimeOfficerCount;
              
              // Add understaffing check using utility function
              const isOfficersUnderstaffed = minimumOfficers > 0 && officerCount < minimumOfficers;
              
              return (
                <div key={dateStr} className="p-2 text-center border-r text-sm font-medium">
                  <div className={`font-medium ${isOfficersUnderstaffed ? 'text-red-600 font-bold' : ''}`}>
                    {officerCount} {minimumOfficers > 0 ? `/ ${minimumOfficers}` : ''}
                  </div>
                  {minimumOfficers === 0 && (
                    <div className="text-xs text-muted-foreground">No min</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Regular Officers - REGULAR ONLY (no overtime) */}
          {scheduleData.regularOfficers.map((officer: any) => {
            // Check if this officer has ANY overtime days in their schedule
            const hasOvertimeInSchedule = weekDays.some(({ dateStr }) => {
              const dayOfficer = getOfficerScheduleForDay(officer, dateStr);
              return dayOfficer?.is_extra_shift === true || dayOfficer?.shiftInfo?.is_extra_shift === true;
            });
            
            // If officer has ANY overtime shifts, DO NOT RENDER them in regular rows
            if (hasOvertimeInSchedule) {
              console.log('Skipping officer with overtime shifts from regular rows:', officer.officerName);
              return null;
            }
            
            return (
              <div key={officer.officerId} className="grid grid-cols-9 border-b hover:bg-muted/30"
                style={{ backgroundColor: weeklyColors.officer?.bg, color: weeklyColors.officer?.text }}>
                <div className="p-2 border-r text-sm font-mono">{officer.badgeNumber}</div>
                <div className="p-2 border-r font-medium">
                  {getLastName(officer.officerName)}
                  <div className="text-xs opacity-80">{officer.rank || 'Officer'}</div>
                  <div className="text-xs text-muted-foreground">
                    SC: {officer.service_credit?.toFixed(1) || '0.0'}
                  </div>
                </div>
                {weekDays.map(({ dateStr }) => {
                  const dayOfficer = getOfficerScheduleForDay(officer, dateStr);
                  return (
                    <ScheduleCell
                      key={`${dateStr}-${officer.officerId}`}
                      officer={dayOfficer}
                      dateStr={dateStr}
                      officerId={officer.officerId}
                      officerName={officer.officerName}
                      isAdminOrSupervisor={isAdminOrSupervisor}
                      onAssignPTO={(scheduleData) => handleAssignPTO(scheduleData, dateStr, officer.officerId, officer.officerName)}
                      onRemovePTO={(scheduleData) => handleRemovePTO(scheduleData, dateStr, officer.officerId)}
                      onEditAssignment={() => onEventHandlers.onEditAssignment?.(officer, dateStr)}
                      onRemoveOfficer={() => {
                        const dayOfficer = getOfficerScheduleForDay(officer, dateStr);
                        onEventHandlers.onRemoveOfficer?.(
                          dayOfficer?.shiftInfo?.scheduleId,
                          dayOfficer?.shiftInfo?.scheduleType as 'recurring' | 'exception',
                          officer
                        );
                      }}
                      isUpdating={mutations.removeOfficerMutation.isPending}
                      isRegularRecurringDay={dayOfficer?.isRegularRecurringDay || false}
                      isSpecialAssignment={isSpecialAssignment}
                    />
                  );
                })}
              </div>
            );
          })}

          {/* PPO Section */}
          {scheduleData.ppos.length > 0 && (
            <>
              {/* PPO Count Row - EXCLUDES OVERTIME PPOS */}
              <div className="grid grid-cols-9 border-t-2 border-blue-200 bg-blue-50/30">
                <div className="p-2 border-r text-sm"></div>
                <div className="p-2 border-r text-sm font-medium">PPO</div>
                {weekDays.map(({ dateStr, dayOfWeek }) => {
                  const daySchedule = scheduleData.dailySchedules?.find(s => s.date === dateStr);
                  const minStaffing = getMinimumStaffing(dayOfWeek);
                  const ppoCount = daySchedule?.officers?.filter((officer: any) => {
                    const isOfficer = !isSupervisorByRank(officer);
                    const isPPO = officer.rank?.toLowerCase() === 'probationary';
                    const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
                    const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO;
                    const isOvertime = officer.shiftInfo?.is_extra_shift === true || officer.is_extra_shift === true;
                    return isOfficer && isPPO && isScheduled && !isOvertime;
                  }).length || 0;
                  
                  return (
                    <div key={dateStr} className="p-2 text-center border-r text-sm font-medium">
                      {ppoCount}
                    </div>
                  );
                })}
              </div>

              {/* PPO Officers - REGULAR ONLY (no overtime) */}
              {scheduleData.ppos.map((officer: any) => {
                // Check if this officer has ANY overtime days in their schedule
                const hasOvertimeInSchedule = weekDays.some(({ dateStr }) => {
                  const dayOfficer = getOfficerScheduleForDay(officer, dateStr);
                  return dayOfficer?.is_extra_shift === true || dayOfficer?.shiftInfo?.is_extra_shift === true;
                });
                
                // If officer has ANY overtime shifts, DO NOT RENDER them in regular rows
                if (hasOvertimeInSchedule) {
                  console.log('Skipping PPO officer with overtime shifts from regular rows:', officer.officerName);
                  return null;
                }
                
                return (
                  <div key={officer.officerId} className="grid grid-cols-9 border-b hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: weeklyColors.ppo?.bg, color: weeklyColors.ppo?.text }}>
                    <div className="p-2 border-r text-sm font-mono">{officer.badgeNumber}</div>
                    <div className="p-2 border-r font-medium flex items-center gap-2">
                      {getLastName(officer.officerName)}
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
                      <div className="text-xs text-muted-foreground">
                        SC: {officer.service_credit?.toFixed(1) || '0.0'}
                      </div>
                    </div>
                    {weekDays.map(({ dateStr }) => {
                      const dayOfficer = getOfficerScheduleForDay(officer, dateStr);
                      return (
                        <ScheduleCell
                          key={`${dateStr}-${officer.officerId}`}
                          officer={dayOfficer}
                          dateStr={dateStr}
                          officerId={officer.officerId}
                          officerName={officer.officerName}
                          isAdminOrSupervisor={isAdminOrSupervisor}
                          onAssignPTO={(scheduleData) => handleAssignPTO(scheduleData, dateStr, officer.officerId, officer.officerName)}
                          onRemovePTO={(scheduleData) => handleRemovePTO(scheduleData, dateStr, officer.officerId)}
                          onEditAssignment={() => onEventHandlers.onEditAssignment?.(officer, dateStr)}
                          onRemoveOfficer={() => {
                            const dayOfficer = getOfficerScheduleForDay(officer, dateStr);
                            onEventHandlers.onRemoveOfficer?.(
                              dayOfficer?.shiftInfo?.scheduleId,
                              dayOfficer?.shiftInfo?.scheduleType as 'recurring' | 'exception',
                              officer
                            );
                          }}
                          isUpdating={mutations.removeOfficerMutation.isPending}
                          isPPO={true}
                          isRegularRecurringDay={dayOfficer?.isRegularRecurringDay || false}
                          isSpecialAssignment={isSpecialAssignment}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

          {/* OVERTIME SECTION - MATCHES MOBILE LOGIC (is_extra_shift = true only) */}
          {hasOvertime && (
            <>
              {/* Overtime Count Row */}
              <div className="grid grid-cols-9 border-t-2 border-orange-300"
                style={{ backgroundColor: '#fff3cd', color: '#856404' }}>
                <div className="p-2 border-r text-sm"></div>
                <div className="p-2 border-r text-sm font-medium">OVERTIME</div>
                {weekDays.map(({ dateStr }) => {
                  const overtimeCount = scheduleData.overtimeByDate?.[dateStr]?.length || 0;
                  return (
                    <div key={dateStr} className="p-2 text-center border-r text-sm font-medium">
                      {overtimeCount}
                    </div>
                  );
                })}
              </div>

              {/* Overtime Row - Single consolidated row showing all overtime assignments */}
              <div className="grid grid-cols-9 border-b hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#fff3cd', color: '#856404' }}>
                <div className="p-2 border-r text-sm font-mono">OT</div>
                <div className="p-2 border-r font-medium">
                  Overtime Assignments
                </div>
                {weekDays.map(({ dateStr }) => {
                  const overtimeOfficers = scheduleData.overtimeByDate?.[dateStr] || [];
                  
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
                              {officer.shiftInfo?.reason && (
                                <div className="text-xs text-orange-500 italic">
                                  {officer.shiftInfo.reason}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};
