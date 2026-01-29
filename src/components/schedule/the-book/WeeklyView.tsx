// Updated WeeklyView.tsx with FIXED hooks order and overtime counting
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
import { PREDEFINED_POSITIONS } from "@/constants/positions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sortOfficersConsistently } from "@/utils/sortingUtils";

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
  isSupervisorByRank,
  onDateChange,
  officerProfiles,
  queryKey = ['weekly-schedule', selectedShiftId],
  refetchScheduleData,
}) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(initialDate);
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  const [selectedWeekDate, setSelectedWeekDate] = useState(initialDate);
  const [localSchedules, setLocalSchedules] = useState(schedules);
  
  const [serviceCreditsMap, setServiceCreditsMap] = useState<Map<string, number>>(new Map());
  const [isLoadingServiceCredits, setIsLoadingServiceCredits] = useState(false);
  
  const queryClient = useQueryClient();

  // Fetch schedule exceptions with is_extra_shift = true for the current week
  const { data: overtimeExceptions, isLoading: isLoadingOvertime } = useQuery({
    queryKey: ['overtime-exceptions', currentWeekStart.toISOString(), selectedShiftId],
    queryFn: async () => {
      console.log('Fetching overtime exceptions for week...');
      
      const weekStart = format(currentWeekStart, 'yyyy-MM-dd');
      const weekEnd = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');
      
      // First fetch the schedule exceptions
      const { data: exceptions, error: exceptionsError } = await supabase
        .from('schedule_exceptions')
        .select('*')
        .eq('is_extra_shift', true)
        .eq('shift_type_id', selectedShiftId)
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .order('date');
      
      if (exceptionsError) {
        console.error('Error fetching overtime exceptions:', exceptionsError);
        return [];
      }
      
      if (!exceptions || exceptions.length === 0) {
        return [];
      }
      
      // Then fetch the profiles for these officers
      const officerIds = [...new Set(exceptions.map(e => e.officer_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, badge_number, rank, hire_date, promotion_date_sergeant, promotion_date_lieutenant, service_credit_override')
        .in('id', officerIds);
      
      if (profilesError) {
        console.error('Error fetching officer profiles for overtime:', profilesError);
        // Return exceptions without profile data
        return exceptions.map(exception => ({
          ...exception,
          profiles: null
        }));
      }
      
      // Create a map of profiles by id
      const profilesMap = new Map();
      profiles?.forEach(profile => {
        profilesMap.set(profile.id, {
          ...profile,
          service_credit_override: profile.service_credit_override || 0
        });
      });
      
      // Combine exceptions with their profiles
      const result = exceptions.map(exception => ({
        ...exception,
        profiles: profilesMap.get(exception.officer_id) || null
      }));
      
      console.log(`Found ${result.length} overtime exceptions for this week`);
      return result;
    },
    enabled: !!selectedShiftId,
  });

  useEffect(() => {
    if (schedules) {
      setLocalSchedules(schedules);
    }
  }, [schedules]);

  const { data: fetchedOfficerProfiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['officer-profiles-weekly'],
    queryFn: async () => {
      console.log('Fetching officer profiles for WeeklyView...');
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, badge_number, rank, hire_date, promotion_date_sergeant, promotion_date_lieutenant, service_credit_override');
      
      if (error) {
        console.error('Error fetching officer profiles:', error);
        return new Map();
      }
      
      const profilesMap = new Map();
      data.forEach(profile => {
        profilesMap.set(profile.id, {
          ...profile,
          service_credit_override: profile.service_credit_override || 0
        });
      });
      
      console.log(`Fetched ${profilesMap.size} officer profiles`);
      return profilesMap;
    },
    enabled: !officerProfiles,
  });

  const effectiveOfficerProfiles = React.useMemo(() => {
    return officerProfiles || fetchedOfficerProfiles || new Map();
  }, [officerProfiles, fetchedOfficerProfiles]);

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
    try {
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
    } catch (error) {
      console.error('Error creating weekDays:', error);
      return []; // Always return an array, never undefined
    }
  }, [currentWeekStart]);

  const invalidateScheduleQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['weekly-schedule', selectedShiftId] });
    queryClient.invalidateQueries({ queryKey: ['weekly-schedule', selectedShiftId, currentWeekStart.toISOString()] });
    queryClient.invalidateQueries({ queryKey: ['weekly-schedule-mobile', selectedShiftId, currentWeekStart.toISOString()] });
    queryClient.invalidateQueries({ queryKey: ['schedule', selectedShiftId] });
    queryClient.invalidateQueries({ queryKey: ['schedule-exceptions', selectedShiftId] });
    queryClient.invalidateQueries({ queryKey: ['recurring-schedules', selectedShiftId] });
    queryClient.invalidateQueries({ queryKey: ['officer-profiles-weekly'] });
    console.log('Invalidated all schedule queries');
  };

  const handleAssignPTO = async (schedule: any, date: string, officerId: string, officerName: string) => {
    console.log('🎯 [WeeklyView] handleAssignPTO called:', { schedule, date, officerId, officerName });
    
    if (!onEventHandlers.onAssignPTO) {
      console.error('❌ No onAssignPTO handler provided');
      return;
    }
    
    try {
      toast.loading("Assigning PTO...");
      
      await onEventHandlers.onAssignPTO(schedule, date, officerId, officerName);
      
      console.log('🔄 [WeeklyView] Invalidating queries...');
      await queryClient.invalidateQueries({ 
        queryKey: ['weekly-schedule', selectedShiftId],
        refetchType: 'all'
      });
      
      await queryClient.invalidateQueries({ 
        queryKey: ['schedule-data', 'weekly', selectedShiftId, currentWeekStart.toISOString()],
        refetchType: 'all'
      });
      
      console.log('🔄 [WeeklyView] Refetching data...');
      await queryClient.refetchQueries({ 
        queryKey: ['weekly-schedule', selectedShiftId],
        type: 'active'
      });
      
      if (refetchScheduleData) {
        console.log('🔄 [WeeklyView] Calling parent refetch function...');
        await refetchScheduleData();
      }
      
      await queryClient.refetchQueries({ 
        queryKey: ['schedule-data', 'weekly', selectedShiftId, currentWeekStart.toISOString()],
        type: 'active'
      });
      
      console.log('✅ [WeeklyView] PTO assignment completed, cache refreshed');
      toast.success("PTO assigned successfully");
      
    } catch (error) {
      console.error('❌ [WeeklyView] Error assigning PTO:', error);
      toast.error("Failed to assign PTO");
    } finally {
      toast.dismiss();
    }
  };

  const handleRemovePTO = async (schedule: any, date: string, officerId: string) => {
    console.log('🗑️ [WeeklyView] handleRemovePTO called:', { schedule, date, officerId });
    
    if (!onEventHandlers.onRemovePTO) return;
    
    try {
      toast.loading("Removing PTO...");
      
      await onEventHandlers.onRemovePTO(schedule, date, officerId);
      
      await queryClient.invalidateQueries({ 
        queryKey: ['weekly-schedule', selectedShiftId],
        refetchType: 'all'
      });
      
      await queryClient.invalidateQueries({ 
        queryKey: ['schedule-data', 'weekly', selectedShiftId, currentWeekStart.toISOString()],
        refetchType: 'all'
      });
      
      await queryClient.refetchQueries({ 
        queryKey: ['weekly-schedule', selectedShiftId],
        type: 'active'
      });
      
      if (refetchScheduleData) {
        await refetchScheduleData();
      }
      
      await queryClient.refetchQueries({ 
        queryKey: ['schedule-data', 'weekly', selectedShiftId, currentWeekStart.toISOString()],
        type: 'active'
      });
      
      toast.success("PTO removed successfully");
      
    } catch (error) {
      toast.error("Failed to remove PTO");
      console.error('Error removing PTO:', error);
    } finally {
      toast.dismiss();
    }
  };

const detectPTOForOfficer = (officer: any, day: any) => {
  const isException = officer?.scheduleType === 'exception' || 
                     officer?.shiftInfo?.scheduleType === 'exception';
  
  const hasPTO = officer?.shiftInfo?.hasPTO === true ||
                 (officer?.shiftInfo?.isOff === true && officer?.shiftInfo?.reason) ||
                 (isException && officer?.shiftInfo?.isOff === true && officer?.shiftInfo?.reason);
  
  const ptoType = officer?.shiftInfo?.reason || 
                  officer?.shiftInfo?.ptoData?.ptoType;
  
  const ptoData = officer?.shiftInfo?.ptoData || 
                  (hasPTO ? {
                    ptoType: ptoType,
                    isFullShift: true,
                    startTime: officer?.shiftInfo?.custom_start_time,
                    endTime: officer?.shiftInfo?.custom_end_time
                  } : undefined);
  
  return { hasPTO, ptoType, ptoData };
};

  // Helper functions must be declared before early returns
  const isSpecialAssignment = (position: string) => {
    return position && (
      position.toLowerCase().includes('other') ||
      (position && !PREDEFINED_POSITIONS.includes(position))
    );
  };

  // Helper to check if an officer is working overtime on this shift
const isOfficerOvertime = (officer: any): boolean => {
  if (!officer) return false;
  
  // Check multiple ways to identify overtime
  const isOvertime = 
    officer.isOvertimeShift === true ||
    officer.shiftInfo?.is_extra_shift === true ||
    officer.shiftInfo?.isExtraShift === true ||
    officer.is_extra_shift === true;
  
  return isOvertime;
};

  // Check if position is a supervisor position
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

  const handleJumpToWeek = (date: Date) => {
    const weekStart = startOfWeek(date, { weekStartsOn: 0 });
    setCurrentWeekStart(weekStart);
    setSelectedWeekDate(weekStart);
    setWeekPickerOpen(false);
    if (onDateChange) {
      onDateChange(weekStart);
    }
  };

// ============ PROCESS REGULAR OFFICERS (EXCLUDING OVERTIME) ============
const processedOfficersData = useMemo(() => {
  console.log('Processing regular officers data (excluding overtime)...');
  
  if (!localSchedules || !localSchedules.dailySchedules) {
    return {
      allOfficers: new Map(),
      regularOfficers: []
    };
  }

  const allOfficers = new Map();
  const recurringSchedulesByOfficer = new Map();

  // Safely extract recurring schedule patterns
  if (localSchedules.recurring) {
    localSchedules.recurring.forEach((recurring: any) => {
      if (!recurringSchedulesByOfficer.has(recurring.officer_id)) {
        recurringSchedulesByOfficer.set(recurring.officer_id, new Set());
      }
      recurringSchedulesByOfficer.get(recurring.officer_id).add(recurring.day_of_week);
    });
  }

  // Process daily schedules - COMPLETELY EXCLUDE OVERTIME OFFICERS
localSchedules.dailySchedules.forEach(day => {
  if (!day.officers || !Array.isArray(day.officers)) {
    return;
  }
  
  // DEBUG: Check what officers we're processing
  console.log(`Day ${day.date} - Total officers: ${day.officers.length}`);
  
  // Filter out ALL officers with is_extra_shift = true
  const regularOfficersForDay = day.officers.filter((officer: any) => {
    // Strict check for overtime flag
    const isOvertime = officer?.shiftInfo?.is_extra_shift === true;
    
    if (isOvertime) {
      console.log(`Filtering out overtime officer: ${officer.officerName} on ${day.date}`);
    }
    
    return !isOvertime;
  });
  
  console.log(`Day ${day.date} - Regular officers after filtering: ${regularOfficersForDay.length}`);
  
  regularOfficersForDay.forEach((officer: any) => {
      if (!officer || !officer.officerId) {
        return;
      }
      
      // Double-check this isn't overtime
      if (isOfficerOvertime(officer)) {
        console.log('ERROR: Overtime officer still in regular list:', officer.officerName);
        return;
      }
      
      if (!allOfficers.has(officer.officerId)) {
        let profileData: any = null;
        
        if (officer.hire_date || officer.promotion_date_sergeant || officer.promotion_date_lieutenant) {
          profileData = {
            hire_date: officer.hire_date,
            promotion_date_sergeant: officer.promotion_date_sergeant,
            promotion_date_lieutenant: officer.promotion_date_lieutenant,
            service_credit_override: officer.service_credit_override || 0
          };
        }
        else if (effectiveOfficerProfiles && 
                 effectiveOfficerProfiles instanceof Map && 
                 effectiveOfficerProfiles.has(officer.officerId)) {
          profileData = effectiveOfficerProfiles.get(officer.officerId);
        }
        else {
          profileData = {
            hire_date: officer.hire_date || null,
            promotion_date_sergeant: officer.promotion_date_sergeant || null,
            promotion_date_lieutenant: officer.promotion_date_lieutenant || null,
            service_credit_override: officer.service_credit_override || 0
          };
        }
        
        allOfficers.set(officer.officerId, {
          officerId: officer.officerId,
          officerName: officer.officerName || officer.full_name || "Unknown",
          badgeNumber: officer.badgeNumber || officer.badge_number || "9999",
          rank: officer.rank || "Officer",
          hire_date: profileData?.hire_date || null,
          promotion_date_sergeant: profileData?.promotion_date_sergeant || null,
          promotion_date_lieutenant: profileData?.promotion_date_lieutenant || null,
          service_credit_override: profileData?.service_credit_override || 0,
          recurringDays: recurringSchedulesByOfficer.get(officer.officerId) || new Set(),
          weeklySchedule: {} as Record<string, any>,
          service_credit: 0
        });
      }
      
      const isRecurringDay = recurringSchedulesByOfficer.get(officer.officerId)?.has(day.dayOfWeek) || false;
      const isException = !isRecurringDay || 
                         officer.scheduleType === 'exception' || 
                         officer.shiftInfo?.scheduleType === 'exception';
      
      const { hasPTO, ptoType, ptoData } = detectPTOForOfficer(officer, day);
      
      const daySchedule = {
        officerId: officer.officerId,
        officerName: officer.officerName || officer.full_name || "Unknown",
        badgeNumber: officer.badgeNumber || officer.badge_number || "9999",
        rank: officer.rank || "Officer",
        service_credit: 0,
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        scheduleId: officer.scheduleId || officer.shiftInfo?.scheduleId,
        scheduleType: isException ? 'exception' : 'recurring',
        isRegularRecurringDay: isRecurringDay && !hasPTO,
        shiftInfo: {
          scheduleId: officer.shiftInfo?.scheduleId || officer.scheduleId,
          scheduleType: isException ? 'exception' : 'recurring',
          position: officer.shiftInfo?.position || officer.position || "",
          unitNumber: officer.shiftInfo?.unitNumber,
          notes: officer.shiftInfo?.notes,
          isOff: hasPTO || officer.shiftInfo?.isOff || false,
          hasPTO: hasPTO,
          ptoData: hasPTO ? (ptoData || {
            ptoType: ptoType || 'PTO',
            isFullShift: true,
            startTime: officer.shiftInfo?.custom_start_time,
            endTime: officer.shiftInfo?.custom_end_time
          }) : undefined,
          reason: officer.shiftInfo?.reason || ptoType,
          custom_start_time: officer.shiftInfo?.custom_start_time,
          custom_end_time: officer.shiftInfo?.custom_end_time
        }
      };
      
      const currentOfficer = allOfficers.get(officer.officerId);
      if (currentOfficer) {
        if (!currentOfficer.weeklySchedule) {
          currentOfficer.weeklySchedule = {};
        }
        currentOfficer.weeklySchedule[day.date] = daySchedule;
      }
    });
  });

  // Get regular officers with service credits
  const regularOfficers = Array.from(allOfficers.values())
    .map(officer => ({
      ...officer,
      service_credit: serviceCreditsMap.get(officer.officerId) || officer.service_credit || 0
    }));

  console.log(`Final regular officers count: ${regularOfficers.length}`);
  console.log(`Final all officers map size: ${allOfficers.size}`);

  return {
    allOfficers,
    regularOfficers
  };
}, [localSchedules, effectiveOfficerProfiles, serviceCreditsMap]);

  // Process overtime exceptions into a format for display
  const processedOvertimeData = useMemo(() => {
    console.log('Processing overtime data...');
    
    // Create a stable weekDays reference for this useMemo
    const stableWeekDays = weekDays || [];
    
    if (!overtimeExceptions || overtimeExceptions.length === 0) {
      return {
        overtimeByDate: {},
        overtimeOfficers: []
      };
    }

    // Group overtime exceptions by date
    const overtimeByDate: Record<string, any[]> = {};
    
    // Initialize with empty arrays for each day
    stableWeekDays.forEach(day => {
      if (day && day.dateStr) {
        overtimeByDate[day.dateStr] = [];
      }
    });
    
    // Process each overtime exception
    const overtimeOfficersMap = new Map();
    
    overtimeExceptions.forEach((exception: any) => {
      const officerId = exception.officer_id;
      const dateStr = exception.date;
      
      // Create officer entry if not exists
      if (!overtimeOfficersMap.has(officerId)) {
        const profile = exception.profiles;
        overtimeOfficersMap.set(officerId, {
          officerId: officerId,
          officerName: profile?.full_name || "Unknown",
          badgeNumber: profile?.badge_number || "9999",
          rank: profile?.rank || "Officer",
          weeklySchedule: {}
        });
      }
      
      // Create schedule entry for this date
      const officer = overtimeOfficersMap.get(officerId);
      const schedule = {
        officerId: officerId,
        officerName: officer.officerName,
        badgeNumber: officer.badgeNumber,
        rank: officer.rank,
        date: dateStr,
        scheduleId: exception.id,
        scheduleType: 'exception' as const,
        isExtraShift: true,
        shiftInfo: {
          scheduleId: exception.id,
          scheduleType: 'exception' as const,
          position: exception.position_name || exception.position || "Extra Duty",
          unitNumber: exception.unit_number,
          notes: exception.notes,
          isOff: false,
          hasPTO: false,
          isExtraShift: true,
          is_extra_shift: true, // Make sure this flag is set
          custom_start_time: exception.custom_start_time,
          custom_end_time: exception.custom_end_time,
          reason: exception.reason
        }
      };
      
      // Add to officer's weekly schedule
      if (!officer.weeklySchedule) {
        officer.weeklySchedule = {};
      }
      officer.weeklySchedule[dateStr] = schedule;
      
      // Add to date grouping
      if (overtimeByDate[dateStr]) {
        overtimeByDate[dateStr].push(schedule);
      }
    });
    
    const overtimeOfficers = Array.from(overtimeOfficersMap.values()).map(officer => ({
      ...officer,
      service_credit: serviceCreditsMap.get(officer.officerId) || 0
    }));
    
    return {
      overtimeByDate,
      overtimeOfficers
    };
  }, [overtimeExceptions, weekDays, serviceCreditsMap]);
    
  // Fetch service credits for all officers (regular + overtime)
  useEffect(() => {
    const fetchServiceCredits = async () => {
      const { allOfficers } = processedOfficersData;
      const { overtimeOfficers } = processedOvertimeData;
      
      const allOfficerIds = [
        ...Array.from(allOfficers.keys()),
        ...overtimeOfficers.map(o => o.officerId)
      ];
      
      const uniqueOfficerIds = [...new Set(allOfficerIds)];
      
      if (uniqueOfficerIds.length === 0) return;
      
      setIsLoadingServiceCredits(true);
      const credits = new Map();
      
      console.log(`Fetching service credits for ${uniqueOfficerIds.length} officers via RPC...`);
      for (const officerId of uniqueOfficerIds) {
        try {
          const { data, error } = await supabase
            .rpc('get_service_credit', { profile_id: officerId });
          
          if (!error && data !== null) {
            const creditValue = parseFloat(data);
            credits.set(officerId, isNaN(creditValue) ? 0 : creditValue);
          } else {
            credits.set(officerId, 0);
          }
        } catch (error) {
          console.error(`Error fetching service credit for officer ${officerId}:`, error);
          credits.set(officerId, 0);
        }
      }
      
      setServiceCreditsMap(credits);
      setIsLoadingServiceCredits(false);
    };
    
    if (processedOfficersData.allOfficers.size > 0 || processedOvertimeData.overtimeOfficers.length > 0) {
      fetchServiceCredits();
    }
  }, [processedOfficersData.allOfficers, processedOvertimeData.overtimeOfficers]);

  // Sort regular officers consistently
  const officersForSorting = processedOfficersData.regularOfficers.map(officer => ({
    id: officer.officerId,
    full_name: officer.officerName,
    officerName: officer.officerName,
    badge_number: officer.badgeNumber,
    badgeNumber: officer.badgeNumber,
    rank: officer.rank,
    service_credit: officer.service_credit || 0,
    hire_date: officer.hire_date,
    service_credit_override: officer.service_credit_override || 0,
    promotion_date_sergeant: officer.promotion_date_sergeant,
    promotion_date_lieutenant: officer.promotion_date_lieutenant
  }));

  const sortedOfficers = sortOfficersConsistently(officersForSorting);

  const sortedOriginalOfficers = sortedOfficers.map(sortedOfficer => {
    const originalOfficer = processedOfficersData.regularOfficers.find(o => o.officerId === sortedOfficer.id);
    if (!originalOfficer) return null;
    
    return {
      ...originalOfficer,
      service_credit: sortedOfficer.service_credit
    };
  }).filter(Boolean);

    // Helper functions that use hooks
  const safeGetWeeklySchedule = (officer: any, dateStr: string) => {
    if (!officer || !officer.weeklySchedule) {
      return null;
    }
    return officer.weeklySchedule[dateStr];
  };

// Categorize regular officers - EXCLUDE OVERTIME OFFICERS COMPLETELY
const supervisors = sortedOriginalOfficers.filter(officer => {
  const isSupervisor = isSupervisorByRank(officer);
  
  // Check if this officer has any overtime shifts in their weekly schedule
  const hasOvertimeShifts = weekDays.some(({ dateStr }) => {
    const dayOfficer = safeGetWeeklySchedule(officer, dateStr);
    return dayOfficer?.shiftInfo?.is_extra_shift === true;
  });
  
  return isSupervisor && !hasOvertimeShifts;
});

const regularOfficers = sortedOriginalOfficers.filter(officer => {
  const isNotSupervisor = !isSupervisorByRank(officer);
  const isNotPPO = officer.rank?.toLowerCase() !== 'probationary';
  
  // Check if this officer has any overtime shifts in their weekly schedule
  const hasOvertimeShifts = weekDays.some(({ dateStr }) => {
    const dayOfficer = safeGetWeeklySchedule(officer, dateStr);
    return dayOfficer?.shiftInfo?.is_extra_shift === true;
  });
  
  return isNotSupervisor && isNotPPO && !hasOvertimeShifts;
});

const ppos = sortedOriginalOfficers.filter(officer => {
  const isNotSupervisor = !isSupervisorByRank(officer);
  const isPPO = officer.rank?.toLowerCase() === 'probationary';
  
  // Check if this officer has any overtime shifts in their weekly schedule
  const hasOvertimeShifts = weekDays.some(({ dateStr }) => {
    const dayOfficer = safeGetWeeklySchedule(officer, dateStr);
    return dayOfficer?.shiftInfo?.is_extra_shift === true;
  });
  
  return isNotSupervisor && isPPO && !hasOvertimeShifts;
});

  const getMinimumStaffing = (dayOfWeek: number) => {
    if (!localSchedules.minimumStaffing) {
      return { minimumOfficers: 0, minimumSupervisors: 1 };
    }
    
    if (localSchedules.minimumStaffing instanceof Map) {
      const dayStaffing = localSchedules.minimumStaffing.get(dayOfWeek);
      if (dayStaffing instanceof Map) {
        const shiftStaffing = dayStaffing.get(selectedShiftId);
        return shiftStaffing || { minimumOfficers: 0, minimumSupervisors: 1 };
      }
    }
    
    const dayStaffing = localSchedules.minimumStaffing[dayOfWeek];
    if (dayStaffing && typeof dayStaffing === 'object') {
      const shiftStaffing = dayStaffing[selectedShiftId];
      return shiftStaffing || { minimumOfficers: 0, minimumSupervisors: 1 };
    }
    
    return { minimumOfficers: 0, minimumSupervisors: 1 };
  };

  // ============ NOW EARLY RETURNS ARE SAFE ============
  if (!localSchedules) {
    return <div className="text-center py-8 text-muted-foreground">No schedule data available</div>;
  }

  if ((isLoadingProfiles && !officerProfiles && !effectiveOfficerProfiles) || isLoadingOvertime) {
    return <div className="text-center py-8">Loading officer data...</div>;
  }

// ============ RENDER LOGIC ============
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
                  onSelect={(date) => {
                    if (date) {
                      handleJumpToWeek(date);
                    }
                  }}
                  className="rounded-md border"
                />
                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
                      handleJumpToWeek(weekStart);
                    }}
                  >
                    This Week
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const nextWeek = addWeeks(currentWeekStart, 1);
                      handleJumpToWeek(nextWeek);
                    }}
                  >
                    Next Week
                  </Button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover> {/* Moved Popover closing tag here */}
        
        <Button variant="outline" size="sm" onClick={onDateNavigation.goToNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onDateNavigation.goToCurrent}
        >
          Today
        </Button>
      </div> 
    </div> 
    
    <div className="mobile-scroll overflow-x-auto">
      <div className="border rounded-lg overflow-hidden min-w-[900px]">
        <div className="grid grid-cols-9 bg-muted/50 border-b">
          <div className="p-2 font-semibold border-r">Empl#</div>
          <div className="p-2 font-semibold border-r">NAME</div>
          {weekDays.map(({ dateStr, dayName, formattedDate, isToday, dayOfWeek }) => {
            const daySchedule = localSchedules.dailySchedules?.find(s => s.date === dateStr);
            
            const minStaffing = getMinimumStaffing(dayOfWeek);
            const minimumOfficers = minStaffing.minimumOfficers || 0;
            const minimumSupervisors = minStaffing.minimumSupervisors || 1;
            
            // Get overtime officers for this day
            const overtimeForDay = processedOvertimeData.overtimeByDate[dateStr] || [];
            
            // CRITICAL: Count ONLY non-overtime officers from daySchedule
            const regularSupervisorCount = daySchedule?.officers?.filter((officer: any) => {
              const isSupervisor = isSupervisorByRank(officer);
              const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
              const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
              const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
              const isOvertime = officer.shiftInfo?.is_extra_shift === true; // STRICT CHECK
              return isSupervisor && isScheduled && !isOvertime;
            }).length || 0;
            
            // Count overtime supervisors (those assigned as "Supervisor" or similar)
            const overtimeSupervisorCount = overtimeForDay.filter((officer: any) => {
              const position = officer.shiftInfo?.position || "";
              return isSupervisorPosition(position);
            }).length || 0;
            
            const supervisorCount = regularSupervisorCount + overtimeSupervisorCount;
            
            // CRITICAL: Count ONLY non-overtime officers from daySchedule
            const regularOfficerCount = daySchedule?.officers?.filter((officer: any) => {
              const isOfficer = !isSupervisorByRank(officer);
              const isNotPPO = officer.rank?.toLowerCase() !== 'probationary';
              const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
              const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
              const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
              const isOvertime = officer.shiftInfo?.is_extra_shift === true; // STRICT CHECK
              return isOfficer && isNotPPO && isScheduled && !isOvertime;
            }).length || 0;
            
            // Count overtime officers (those NOT assigned as supervisors)
            const overtimeOfficerCount = overtimeForDay.filter((officer: any) => {
              const position = officer.shiftInfo?.position || "";
              return !isSupervisorPosition(position) && !isSpecialAssignment(position);
            }).length || 0;
            
            const officerCount = regularOfficerCount + overtimeOfficerCount;
            
            const isOfficersUnderstaffed = officerCount < minimumOfficers;
            const isSupervisorsUnderstaffed = supervisorCount < minimumSupervisors;

            return (
              <div key={dateStr} className={`p-2 text-center font-semibold border-r ${isToday ? 'bg-primary/10' : ''}`}>
                <Button variant="ghost" size="sm" className="h-auto p-0 font-semibold hover:bg-transparent hover:underline" onClick={() => navigateToDailySchedule(dateStr)}>
                  <div>{dayName}</div>
                  <div className="text-xs text-muted-foreground mb-1">{formattedDate}</div>
                </Button>
                <Badge variant={isSupervisorsUnderstaffed ? "destructive" : "outline"} className="text-xs mb-1">
                  {supervisorCount} / {minimumSupervisors} Sup
                </Badge>
                <Badge variant={isOfficersUnderstaffed ? "destructive" : "outline"} className="text-xs">
                  {officerCount} / {minimumOfficers} Ofc
                </Badge>
              </div>
            );
          })}
        </div>

        {/* SUPERVISOR COUNT ROW */}
        <div className="grid grid-cols-9 border-b">
          <div className="p-2 border-r"></div>
          <div className="p-2 border-r text-sm font-medium">SUPERVISORS</div>
          {weekDays.map(({ dateStr, dayOfWeek }) => {
            const daySchedule = localSchedules.dailySchedules?.find(s => s.date === dateStr);
            const overtimeForDay = processedOvertimeData.overtimeByDate[dateStr] || [];
            
            const minStaffing = getMinimumStaffing(dayOfWeek);
            const minimumSupervisors = minStaffing.minimumSupervisors || 1;
            
            // CRITICAL: Count ONLY non-overtime supervisors from daySchedule
            const regularSupervisorCount = daySchedule?.officers?.filter((officer: any) => {
              const isSupervisor = isSupervisorByRank(officer);
              const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
              const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
              const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
              const isOvertime = officer.shiftInfo?.is_extra_shift === true; // STRICT CHECK
              return isSupervisor && isScheduled && !isOvertime;
            }).length || 0;
            
            // Count overtime supervisors
            const overtimeSupervisorCount = overtimeForDay.filter((officer: any) => {
              const position = officer.shiftInfo?.position || "";
              return isSupervisorPosition(position);
            }).length || 0;
            
            const supervisorCount = regularSupervisorCount + overtimeSupervisorCount;
            
            return (
              <div key={dateStr} className="p-2 text-center border-r text-sm">
                {supervisorCount} / {minimumSupervisors}
              </div>
            );
          })}
        </div>

        {/* SUPERVISORS */}
        {supervisors.map((officer: any) => {
          // CRITICAL: Check if this officer has ANY overtime days in their schedule
          const hasOvertimeInSchedule = weekDays.some(({ dateStr }) => {
            const dayOfficer = safeGetWeeklySchedule(officer, dateStr);
            return dayOfficer?.shiftInfo?.is_extra_shift === true;
          });
          
          // If officer has ANY overtime shifts, DO NOT RENDER them in regular rows
          if (hasOvertimeInSchedule) {
            console.log('Skipping officer with overtime shifts from regular rows:', officer.officerName);
            return null;
          }
          
          return (
            <div key={officer.officerId} className="grid grid-cols-9 border-b hover:bg-muted/30"
              style={{ backgroundColor: weeklyColors.supervisor?.bg, color: weeklyColors.supervisor?.text }}>
              <div className="p-2 border-r text-sm font-mono">{officer.badgeNumber}</div>
              <div className="p-2 border-r font-medium">
                {getLastName(officer.officerName || '')}
                <div className="text-xs opacity-80">{officer.rank || 'Officer'}</div>
                <div className="text-xs text-muted-foreground">
                  SC: {officer.service_credit?.toFixed(1) || '0.0'}
                </div>
              </div>
              {weekDays.map(({ dateStr }) => {
                const dayOfficer = safeGetWeeklySchedule(officer, dateStr);
                return (
                  <ScheduleCell
                    key={`${dateStr}-${officer.officerId}-${dayOfficer?.shiftInfo?.hasPTO ? 'pto' : 'no-pto'}`}
                    officer={dayOfficer}
                    dateStr={dateStr}
                    officerId={officer.officerId}
                    officerName={officer.officerName}
                    isAdminOrSupervisor={isAdminOrSupervisor}
                    onAssignPTO={(scheduleData) => handleAssignPTO(scheduleData, dateStr, officer.officerId, officer.officerName)}
                    onRemovePTO={(scheduleData) => handleRemovePTO(scheduleData, dateStr, officer.officerId)}
                    onEditAssignment={() => {
                      if (onEventHandlers.onEditAssignment) {
                        onEventHandlers.onEditAssignment(officer, dateStr);
                      }
                    }}
                    onRemoveOfficer={() => {
                      if (onEventHandlers.onRemoveOfficer) {
                        onEventHandlers.onRemoveOfficer(
                          dayOfficer?.shiftInfo?.scheduleId || dayOfficer?.scheduleId,
                          (dayOfficer?.shiftInfo?.scheduleType || dayOfficer?.scheduleType) as 'recurring' | 'exception',
                          officer
                        );
                      }
                    }}
                    isUpdating={mutations.removeOfficerMutation.isPending}
                  />
                );
              })}
            </div>
          );
        })}

        {/* SEPARATION ROW WITH OFFICER COUNT (EXCLUDING PPOS AND SPECIAL ASSIGNMENTS) */}
        <div className="grid grid-cols-9 border-b bg-muted/30">
          <div className="p-2 border-r"></div>
          <div className="p-2 border-r text-sm font-medium">OFFICERS</div>
          {weekDays.map(({ dateStr, dayOfWeek }) => {
            const daySchedule = localSchedules.dailySchedules?.find(s => s.date === dateStr);
            const overtimeForDay = processedOvertimeData.overtimeByDate[dateStr] || [];
            
            // Get minimum staffing using safe function
            const minStaffing = getMinimumStaffing(dayOfWeek);
            const minimumOfficers = minStaffing.minimumOfficers || 0;
            
            // CRITICAL: Count ONLY non-overtime officers from daySchedule
            const regularOfficerCount = daySchedule?.officers?.filter((officer: any) => {
              const isOfficer = !isSupervisorByRank(officer);
              const isNotPPO = officer.rank?.toLowerCase() !== 'probationary';
              const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
              const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
              const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
              const isOvertime = officer.shiftInfo?.is_extra_shift === true; // STRICT CHECK
              return isOfficer && isNotPPO && isScheduled && !isOvertime;
            }).length || 0;
            
            // Count overtime officers (those NOT assigned as supervisors or special assignments)
            const overtimeOfficerCount = overtimeForDay.filter((officer: any) => {
              const position = officer.shiftInfo?.position || "";
              return !isSupervisorPosition(position) && !isSpecialAssignment(position);
            }).length || 0;
            
            const officerCount = regularOfficerCount + overtimeOfficerCount;
            
            return (
              <div key={dateStr} className="p-2 text-center border-r text-sm font-medium">
                {officerCount} / {minimumOfficers}
              </div>
            );
          })}
        </div>

        {/* REGULAR OFFICERS SECTION */}
        <div>
          {regularOfficers.map((officer: any) => {
            // CRITICAL: Check if this officer has ANY overtime days in their schedule
            const hasOvertimeInSchedule = weekDays.some(({ dateStr }) => {
              const dayOfficer = safeGetWeeklySchedule(officer, dateStr);
              return dayOfficer?.shiftInfo?.is_extra_shift === true;
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
                  {getLastName(officer.officerName || '')}
                  <div className="text-xs text-muted-foreground">
                    SC: {officer.service_credit?.toFixed(1) || '0.0'}
                  </div>
                </div>
                {weekDays.map(({ dateStr }) => {
                  const dayOfficer = safeGetWeeklySchedule(officer, dateStr);
                  return (
                    <ScheduleCell
                      key={`${dateStr}-${officer.officerId}-${dayOfficer?.shiftInfo?.hasPTO ? 'pto' : 'no-pto'}`}
                      officer={dayOfficer}
                      dateStr={dateStr}
                      officerId={officer.officerId}
                      officerName={officer.officerName}
                      isAdminOrSupervisor={isAdminOrSupervisor}
                      onAssignPTO={(scheduleData) => handleAssignPTO(scheduleData, dateStr, officer.officerId, officer.officerName)}
                      onRemovePTO={(scheduleData) => handleRemovePTO(scheduleData, dateStr, officer.officerId)}
                      onEditAssignment={() => {
                        if (onEventHandlers.onEditAssignment) {
                          onEventHandlers.onEditAssignment(officer, dateStr);
                        }
                      }}
                      onRemoveOfficer={() => {
                        if (onEventHandlers.onRemoveOfficer) {
                          onEventHandlers.onRemoveOfficer(
                            dayOfficer?.shiftInfo?.scheduleId || dayOfficer?.scheduleId,
                            (dayOfficer?.shiftInfo?.scheduleType || dayOfficer?.scheduleType) as 'recurring' | 'exception',
                            officer
                          );
                        }
                      }}
                      isUpdating={mutations.removeOfficerMutation.isPending}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* PPO SECTION */}
        {ppos.map((officer: any) => {
          // CRITICAL: Check if this officer has ANY overtime days in their schedule
          const hasOvertimeInSchedule = weekDays.some(({ dateStr }) => {
            const dayOfficer = safeGetWeeklySchedule(officer, dateStr);
            return dayOfficer?.shiftInfo?.is_extra_shift === true;
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
                {getLastName(officer.officerName || '')}
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
                const dayOfficer = safeGetWeeklySchedule(officer, dateStr);
                
                let partnerInfo = null;
                if (dayOfficer?.shiftInfo?.position) {
                  const partnerMatch = dayOfficer.shiftInfo.position.match(/Partner with\s+(.+)/i);
                  if (partnerMatch) {
                    partnerInfo = partnerMatch[1];
                  }
                }
                
                return (
                  <ScheduleCell
                    key={`${dateStr}-${officer.officerId}-${dayOfficer?.shiftInfo?.hasPTO ? 'pto' : 'no-pto'}`}
                    officer={dayOfficer}
                    dateStr={dateStr}
                    officerId={officer.officerId}
                    officerName={officer.officerName}
                    isAdminOrSupervisor={isAdminOrSupervisor}
                    onAssignPTO={(scheduleData) => handleAssignPTO(scheduleData, dateStr, officer.officerId, officer.officerName)}
                    onRemovePTO={(scheduleData) => handleRemovePTO(scheduleData, dateStr, officer.officerId)}
                    onEditAssignment={() => {
                      if (onEventHandlers.onEditAssignment) {
                        onEventHandlers.onEditAssignment(officer, dateStr);
                      }
                    }}
                    onRemoveOfficer={() => {
                      if (onEventHandlers.onRemoveOfficer) {
                        onEventHandlers.onRemoveOfficer(
                          dayOfficer?.shiftInfo?.scheduleId || dayOfficer?.scheduleId,
                          (dayOfficer?.shiftInfo?.scheduleType || dayOfficer?.scheduleType) as 'recurring' | 'exception',
                          officer
                        );
                      }
                    }}
                    isUpdating={mutations.removeOfficerMutation.isPending}
                    isPPO={true}
                    partnerInfo={partnerInfo}
                  />
                );
              })}
            </div>
          );
        })}

        {/* OVERTIME SECTION - NOW ONLY SHOWS schedule_exceptions with is_extra_shift = true */}
        {processedOvertimeData.overtimeOfficers.length > 0 && (
          <div className="border-t-2 border-orange-300">
            {/* OVERTIME COUNT ROW */}
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

            {/* OVERTIME ROW - Single row showing all overtime assignments */}
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
          </div>
        )}
      </div>
    </div>
  </div>
);
};
