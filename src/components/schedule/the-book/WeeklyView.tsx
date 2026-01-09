// Updated WeeklyView.tsx with enhanced error handling
import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query'; // Added useQueryClient
import { format, addDays, isSameDay, startOfWeek, addWeeks, subWeeks } from "date-fns";
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
import { sortOfficersConsistently, getServiceCreditForSorting } from "@/utils/sortingUtils";

// Define extended interface that includes onDateChange
interface ExtendedViewProps extends ViewProps {
  onDateChange?: (date: Date) => void;
  officerProfiles?: Map<string, any>; // Optional prop
  queryKey?: any[]; // Add queryKey to invalidate
  refetchScheduleData?: () => Promise<void>; // Add refetch function prop
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
  officerProfiles, // Optional prop
  queryKey = ['weekly-schedule', selectedShiftId], // Default queryKey
  refetchScheduleData, // Optional refetch function from parent
}) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(initialDate);
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  const [selectedWeekDate, setSelectedWeekDate] = useState(initialDate);
  const [localSchedules, setLocalSchedules] = useState(schedules);
  
  // Get query client for cache invalidation
  const queryClient = useQueryClient();

  // Sync local state with prop changes
  useEffect(() => {
    if (schedules) {
      setLocalSchedules(schedules);
    }
  }, [schedules]);

  // Fetch officer profiles if not provided as prop
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
      
      // Convert to Map for easy lookup
      const profilesMap = new Map();
      data.forEach(profile => {
        profilesMap.set(profile.id, profile);
      });
      
      console.log(`Fetched ${profilesMap.size} officer profiles`);
      return profilesMap;
    },
    enabled: !officerProfiles, // Only fetch if not provided
  });

  // Use either provided prop or fetched data - ensure it's always a Map
  const effectiveOfficerProfiles = React.useMemo(() => {
    return officerProfiles || fetchedOfficerProfiles || new Map();
  }, [officerProfiles, fetchedOfficerProfiles]);

  // Sync with parent when date changes
  useEffect(() => {
    setCurrentWeekStart(initialDate);
    setSelectedWeekDate(initialDate);
  }, [initialDate]);

  // Call onDateChange when component mounts with initial date
  useEffect(() => {
    if (onDateChange) {
      onDateChange(currentWeekStart);
    }
  }, []);

  // Sync selected date when popover opens
  useEffect(() => {
    if (weekPickerOpen) {
      setSelectedWeekDate(currentWeekStart);
    }
  }, [weekPickerOpen, currentWeekStart]);

  // Helper function to invalidate all schedule queries
  const invalidateScheduleQueries = () => {
    // Invalidate the main schedule query
    queryClient.invalidateQueries({ queryKey: ['weekly-schedule', selectedShiftId] });
    queryClient.invalidateQueries({ queryKey: ['weekly-schedule', selectedShiftId, currentWeekStart.toISOString()] });
    
    // Invalidate the mobile schedule query if it exists
    queryClient.invalidateQueries({ queryKey: ['weekly-schedule-mobile', selectedShiftId, currentWeekStart.toISOString()] });
    
    // Invalidate any date-specific queries
    queryClient.invalidateQueries({ queryKey: ['schedule', selectedShiftId] });
    queryClient.invalidateQueries({ queryKey: ['schedule-exceptions', selectedShiftId] });
    queryClient.invalidateQueries({ queryKey: ['recurring-schedules', selectedShiftId] });
    
    // Invalidate officer profiles
    queryClient.invalidateQueries({ queryKey: ['officer-profiles-weekly'] });
    
    console.log('Invalidated all schedule queries');
  };

  // Handler for PTO assignment with cache invalidation
  const handleAssignPTO = async (schedule: any, date: string, officerId: string, officerName: string) => {
    if (!onEventHandlers.onAssignPTO) return;
    
    try {
      // Show loading state
      toast.loading("Assigning PTO...");
      
      await onEventHandlers.onAssignPTO(schedule, date, officerId, officerName);
      
      // Force a complete state reset
      setCurrentWeekStart(prev => new Date(prev.getTime()));
      
      // Invalidate all schedule queries
      invalidateScheduleQueries();
      
      // If parent provides a refetch function, use it
      if (refetchScheduleData) {
        await refetchScheduleData();
      } else {
        // Force immediate refetch
        await queryClient.refetchQueries({ 
          queryKey: ['weekly-schedule', selectedShiftId],
          type: 'active'
        });
      }
      
      // Add a small delay to ensure UI updates
      setTimeout(() => {
        toast.success("PTO assigned successfully");
      }, 300);
      
    } catch (error) {
      toast.error("Failed to assign PTO");
      console.error('Error assigning PTO:', error);
    } finally {
      toast.dismiss();
    }
  };

  const handleRemovePTO = async (schedule: any, date: string, officerId: string) => {
    if (!onEventHandlers.onRemovePTO) return;
    
    try {
      toast.loading("Removing PTO...");
      
      await onEventHandlers.onRemovePTO(schedule, date, officerId);
      
      // Force a complete state reset
      setCurrentWeekStart(prev => new Date(prev.getTime()));
      
      // Invalidate all schedule queries
      invalidateScheduleQueries();
      
      // If parent provides a refetch function, use it
      if (refetchScheduleData) {
        await refetchScheduleData();
      } else {
        // Force immediate refetch
        await queryClient.refetchQueries({ 
          queryKey: ['weekly-schedule', selectedShiftId],
          type: 'active'
        });
      }
      
      // Add a small delay to ensure UI updates
      setTimeout(() => {
        toast.success("PTO removed successfully");
      }, 300);
      
    } catch (error) {
      toast.error("Failed to remove PTO");
      console.error('Error removing PTO:', error);
    } finally {
      toast.dismiss();
    }
  };

  const handleEditAssignment = async (officerData: any, dateStr: string) => {
    if (!onEventHandlers.onEditAssignment) return;
    
    try {
      toast.loading("Updating assignment...");
      
      // Get the specific day's schedule for this officer to extract scheduleId
      const dayOfficer = officerData?.weeklySchedule?.[dateStr];
      const scheduleId = dayOfficer?.shiftInfo?.scheduleId || dayOfficer?.scheduleId;
      
      console.log('handleEditAssignment called with:', {
        officerId: officerData.officerId,
        officerName: officerData.officerName,
        dateStr,
        dayOfficer,
        scheduleId,
        scheduleType: dayOfficer?.shiftInfo?.scheduleType || dayOfficer?.scheduleType
      });
      
      if (!scheduleId) {
        console.error('No scheduleId found for officer:', officerData.officerId, 'on date:', dateStr);
        toast.error("Cannot update assignment: Schedule ID not found");
        return;
      }
      
      // Create a complete officer object with schedule ID
      const officerWithSchedule = {
        ...officerData,
        scheduleId: scheduleId,
        scheduleType: dayOfficer?.shiftInfo?.scheduleType || 'exception',
        date: dateStr,
        shiftInfo: dayOfficer?.shiftInfo
      };
      
      await onEventHandlers.onEditAssignment(officerWithSchedule, dateStr);
      
      // Force a complete state reset
      setCurrentWeekStart(prev => new Date(prev.getTime()));
      
      // Invalidate all schedule queries
      invalidateScheduleQueries();
      
      // If parent provides a refetch function, use it
      if (refetchScheduleData) {
        await refetchScheduleData();
      } else {
        // Force immediate refetch
        await queryClient.refetchQueries({ 
          queryKey: ['weekly-schedule', selectedShiftId],
          type: 'active'
        });
      }
      
      // Add a small delay to ensure UI updates
      setTimeout(() => {
        toast.success("Assignment updated successfully");
      }, 300);
      
    } catch (error) {
      toast.error("Failed to update assignment");
      console.error('Error updating assignment:', error);
    } finally {
      toast.dismiss();
    }
  };

  const handleRemoveOfficer = async (scheduleId: string, type: 'recurring' | 'exception', officerData?: any) => {
    if (!onEventHandlers.onRemoveOfficer) return;
    
    try {
      toast.loading("Removing officer...");
      
      await onEventHandlers.onRemoveOfficer(scheduleId, type, officerData);
      
      // Force a complete state reset
      setCurrentWeekStart(prev => new Date(prev.getTime()));
      
      // Invalidate all schedule queries
      invalidateScheduleQueries();
      
      // If parent provides a refetch function, use it
      if (refetchScheduleData) {
        await refetchScheduleData();
      } else {
        // Force immediate refetch
        await queryClient.refetchQueries({ 
          queryKey: ['weekly-schedule', selectedShiftId],
          type: 'active'
        });
      }
      
      // Add a small delay to ensure UI updates
      setTimeout(() => {
        toast.success("Officer removed successfully");
      }, 300);
      
    } catch (error) {
      toast.error("Failed to remove officer");
      console.error('Error removing officer:', error);
    } finally {
      toast.dismiss();
    }
  };

  if (!localSchedules) {
    return <div className="text-center py-8 text-muted-foreground">No schedule data available</div>;
  }

  if (isLoadingProfiles && !officerProfiles && !effectiveOfficerProfiles) {
    return <div className="text-center py-8">Loading officer data...</div>;
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => {
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

  // Helper function to check if an assignment is a special assignment
  const isSpecialAssignment = (position: string) => {
    return position && (
      position.toLowerCase().includes('other') ||
      (position && !PREDEFINED_POSITIONS.includes(position))
    );
  };

  // Handle jump to week
  const handleJumpToWeek = (date: Date) => {
    const weekStart = startOfWeek(date, { weekStartsOn: 0 });
    setCurrentWeekStart(weekStart);
    setSelectedWeekDate(weekStart);
    setWeekPickerOpen(false);
    if (onDateChange) {
      onDateChange(weekStart);
    }
  };

  // ============ ENHANCED SECTION: Extract and organize officer data with better error handling ============
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

  // Process daily schedules with enhanced safety
  if (localSchedules.dailySchedules) {
    localSchedules.dailySchedules.forEach(day => {
      // Ensure day.officers exists and is an array
      if (!day.officers || !Array.isArray(day.officers)) {
        console.warn('No officers array found for day:', day.date);
        return;
      }
      
      day.officers.forEach((officer: any) => {
        if (!officer || !officer.officerId) {
          console.warn('Invalid officer data found:', officer);
          return;
        }
        
        if (!allOfficers.has(officer.officerId)) {
          // IMPORTANT: The officer object from parent might not have hire/promotion dates
          // We need to extract them from profiles if available
          let profileData: any = null;
          
          // Try to get profile data from different sources
          // Option 1: Check if officer has direct profile data
          if (officer.hire_date || officer.promotion_date_sergeant || officer.promotion_date_lieutenant) {
            profileData = {
              hire_date: officer.hire_date,
              promotion_date_sergeant: officer.promotion_date_sergeant,
              promotion_date_lieutenant: officer.promotion_date_lieutenant,
              service_credit_override: officer.service_credit_override || 0
            };
          }
          // Option 2: Check if officerProfiles prop has the data
          else if (effectiveOfficerProfiles && 
                   effectiveOfficerProfiles instanceof Map && 
                   effectiveOfficerProfiles.has(officer.officerId)) {
            profileData = effectiveOfficerProfiles.get(officer.officerId);
          }
          // Option 3: Use officer data as is (may be incomplete)
          else {
            profileData = {
              hire_date: officer.hire_date || null,
              promotion_date_sergeant: officer.promotion_date_sergeant || null,
              promotion_date_lieutenant: officer.promotion_date_lieutenant || null,
              service_credit_override: officer.service_credit_override || 0
            };
          }

// Don't calculate service credit here - just pass the raw data
// The sorting utility will handle calculation with override properly
allOfficers.set(officer.officerId, {
  officerId: officer.officerId,
  officerName: officer.officerName || officer.full_name || "Unknown",
  badgeNumber: officer.badgeNumber || officer.badge_number || "9999",
  rank: officer.rank || "Officer",
  // REMOVE service_credit calculation here
  hire_date: profileData?.hire_date || null,
  promotion_date_sergeant: profileData?.promotion_date_sergeant || null,
  promotion_date_lieutenant: profileData?.promotion_date_lieutenant || null,
  service_credit_override: profileData?.service_credit_override || 0,
  recurringDays: recurringSchedulesByOfficer.get(officer.officerId) || new Set(),
  weeklySchedule: {} as Record<string, any>
});
        
        // Store daily schedule for this officer with FRESH data
        // Determine if this is a recurring day
        const isRecurringDay = recurringSchedulesByOfficer.get(officer.officerId)?.has(day.dayOfWeek) || false;
        
        // Check if this is an exception (not a regular recurring day)
        const isException = !isRecurringDay || 
                           officer.scheduleType === 'exception' || 
                           officer.shiftInfo?.scheduleType === 'exception';
        
        // Check if officer has PTO - ONLY if it's an exception
        const hasPTO = isException && (officer.shiftInfo?.hasPTO || false);
        
        const daySchedule = {
          officerId: officer.officerId,
          officerName: officer.officerName || officer.full_name || "Unknown",
          badgeNumber: officer.badgeNumber || officer.badge_number || "9999",
          rank: officer.rank || "Officer",
          service_credit: allOfficers.get(officer.officerId)?.service_credit || 0,
          date: day.date,
          dayOfWeek: day.dayOfWeek,
          scheduleId: officer.scheduleId || officer.shiftInfo?.scheduleId,
          scheduleType: isException ? 'exception' : 'recurring',
          isRegularRecurringDay: isRecurringDay && !hasPTO, // Only true if recurring and no PTO
          shiftInfo: {
            scheduleId: officer.shiftInfo?.scheduleId || officer.scheduleId,
            scheduleType: isException ? 'exception' : 'recurring',
            position: officer.shiftInfo?.position || officer.position || "",
            unitNumber: officer.shiftInfo?.unitNumber,
            notes: officer.shiftInfo?.notes,
            isOff: hasPTO || officer.shiftInfo?.isOff || false,
            hasPTO: hasPTO,
            ptoData: hasPTO ? officer.shiftInfo?.ptoData : undefined,
            reason: officer.shiftInfo?.reason
          }
        };
        
        const currentOfficer = allOfficers.get(officer.officerId);
        if (currentOfficer) {
          // Ensure weeklySchedule exists
          if (!currentOfficer.weeklySchedule) {
            currentOfficer.weeklySchedule = {};
          }
          // Overwrite with fresh data - don't merge with old data
          currentOfficer.weeklySchedule[day.date] = daySchedule;
        }
      });
    });
  }

  console.log(`Processed ${allOfficers.size} officers with profiles. Profiles available: ${effectiveOfficerProfiles && effectiveOfficerProfiles instanceof Map ? 'Yes' : 'No'}`);

// Convert allOfficers Map to array for sorting
const allOfficersArray = Array.from(allOfficers.values()).filter(o => o);

// Map to OfficerForSorting interface for the utility
const officersForSorting = allOfficersArray.map(officer => ({
  id: officer.officerId,
  full_name: officer.officerName,
  officerName: officer.officerName,
  badge_number: officer.badgeNumber,
  badgeNumber: officer.badgeNumber,
  rank: officer.rank,
  // Don't set service_credit here - let the utility calculate it
  hire_date: officer.hire_date,
  service_credit_override: officer.service_credit_override || 0,
  promotion_date_sergeant: officer.promotion_date_sergeant,
  promotion_date_lieutenant: officer.promotion_date_lieutenant
}));

// Debug: Check what data we're passing
console.log('Officers for sorting:', officersForSorting.map(o => ({
  name: o.full_name,
  badge: o.badge_number,
  override: o.service_credit_override,
  rank: o.rank
})));

// Sort officers consistently - the utility will calculate service credit
const sortedOfficers = sortOfficersConsistently(officersForSorting);

// Debug: Check sorted results
console.log('Sorted officers:', sortedOfficers.map(o => ({
  name: o.full_name,
  rank: o.rank,
  serviceCredit: getServiceCreditForSorting(o) // Use utility to get calculated value
})));

// Now categorize the sorted officers
// First, we need to map back from OfficerForSorting to our original officer structure
const sortedOriginalOfficers = sortedOfficers.map(sortedOfficer => {
  // Find the original officer data
  const originalOfficer = allOfficersArray.find(o => o.officerId === sortedOfficer.id);
  if (!originalOfficer) return null;
  
  // Get the calculated service credit from the utility
  const service_credit = getServiceCreditForSorting(sortedOfficer);
  
  return {
    ...originalOfficer,
    service_credit: service_credit // Add the calculated service credit
  };
}).filter(Boolean);

// Now categorize
const supervisors = sortedOriginalOfficers.filter(officer => 
  isSupervisorByRank(officer)
);

const regularOfficers = sortedOriginalOfficers.filter(officer => 
  !isSupervisorByRank(officer) && 
  officer.rank?.toLowerCase() !== 'probationary'
);

const ppos = sortedOriginalOfficers.filter(officer => 
  officer.rank?.toLowerCase() === 'probationary'
);

// Debug log to verify
console.log('Sorted officers:', {
  total: sortedOfficers.length,
  supervisors: supervisors.length,
  regularOfficers: regularOfficers.length,
  ppos: ppos.length
});

  // Safeguard for rendering
  const safeGetWeeklySchedule = (officer: any, dateStr: string) => {
    if (!officer || !officer.weeklySchedule) {
      console.warn('Officer or weeklySchedule is undefined:', officer);
      return null;
    }
    return officer.weeklySchedule[dateStr];
  };

  // Helper function to safely get minimum staffing data
  const getMinimumStaffing = (dayOfWeek: number) => {
    if (!localSchedules.minimumStaffing) {
      return { minimumOfficers: 0, minimumSupervisors: 1 };
    }
    
    // Check if minimumStaffing is a Map
    if (localSchedules.minimumStaffing instanceof Map) {
      const dayStaffing = localSchedules.minimumStaffing.get(dayOfWeek);
      if (dayStaffing instanceof Map) {
        const shiftStaffing = dayStaffing.get(selectedShiftId);
        return shiftStaffing || { minimumOfficers: 0, minimumSupervisors: 1 };
      }
    }
    
    // Check if minimumStaffing is an object
    if (typeof localSchedules.minimumStaffing === 'object') {
      const dayStaffing = localSchedules.minimumStaffing[dayOfWeek];
      if (dayStaffing && typeof dayStaffing === 'object') {
        const shiftStaffing = dayStaffing[selectedShiftId];
        return shiftStaffing || { minimumOfficers: 0, minimumSupervisors: 1 };
      }
    }
    
    return { minimumOfficers: 0, minimumSupervisors: 1 };
  };

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
          
          {/* Jump to Week Button */}
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
          </Popover>
          
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
              
              // Get minimum staffing for this day of week and shift using safe function
              const minStaffing = getMinimumStaffing(dayOfWeek);
              const minimumOfficers = minStaffing.minimumOfficers || 0;
              const minimumSupervisors = minStaffing.minimumSupervisors || 1;
              
              // Calculate counts excluding full-day PTO AND special assignments
              const supervisorCount = daySchedule?.officers?.filter((officer: any) => {
                const isSupervisor = isSupervisorByRank(officer);
                const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
                const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
                const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
                return isSupervisor && isScheduled;
              }).length || 0;

              const officerCount = daySchedule?.officers?.filter((officer: any) => {
                const isOfficer = !isSupervisorByRank(officer);
                const isNotPPO = officer.rank?.toLowerCase() !== 'probationary';
                const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
                const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
                const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
                return isOfficer && isNotPPO && isScheduled;
              }).length || 0;
              
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
              
              // Get minimum staffing using safe function
              const minStaffing = getMinimumStaffing(dayOfWeek);
              const minimumSupervisors = minStaffing.minimumSupervisors || 1;
              
              // Count supervisors, excluding full-day PTO AND special assignments
              const supervisorCount = daySchedule?.officers?.filter((officer: any) => {
                const isSupervisor = isSupervisorByRank(officer);
                const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
                const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
                const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
                return isSupervisor && isScheduled;
              }).length || 0;
              
              return (
                <div key={dateStr} className="p-2 text-center border-r text-sm">
                  {supervisorCount} / {minimumSupervisors}
                </div>
              );
            })}
          </div>

          {/* SUPERVISORS */}
          {supervisors.map((officer: any) => (
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
                    onEditAssignment={() => handleEditAssignment(officer, dateStr)}
                    onRemoveOfficer={() => handleRemoveOfficer(
                      dayOfficer?.shiftInfo?.scheduleId || dayOfficer?.scheduleId,
                      (dayOfficer?.shiftInfo?.scheduleType || dayOfficer?.scheduleType) as 'recurring' | 'exception',
                      officer
                    )}
                    isUpdating={mutations.removeOfficerMutation.isPending}
                  />
                );
              })}
            </div>
          ))}

          {/* SEPARATION ROW WITH OFFICER COUNT (EXCLUDING PPOS AND SPECIAL ASSIGNMENTS) */}
          <div className="grid grid-cols-9 border-b bg-muted/30">
            <div className="p-2 border-r"></div>
            <div className="p-2 border-r text-sm font-medium">OFFICERS</div>
            {weekDays.map(({ dateStr, dayOfWeek }) => {
              const daySchedule = localSchedules.dailySchedules?.find(s => s.date === dateStr);
              
              // Get minimum staffing using safe function
              const minStaffing = getMinimumStaffing(dayOfWeek);
              const minimumOfficers = minStaffing.minimumOfficers || 0;
              
              // Count only non-PPO officers, excluding full-day PTO AND special assignments
              const officerCount = daySchedule?.officers?.filter((officer: any) => {
                const isOfficer = !isSupervisorByRank(officer);
                const isNotPPO = officer.rank?.toLowerCase() !== 'probationary';
                const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
                const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
                const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
                return isOfficer && isNotPPO && isScheduled;
              }).length || 0;
              
              return (
                <div key={dateStr} className="p-2 text-center border-r text-sm font-medium">
                  {officerCount} / {minimumOfficers}
                </div>
              );
            })}
          </div>

          {/* REGULAR OFFICERS SECTION */}
          <div>
            {regularOfficers.map((officer: any) => (
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
                      onEditAssignment={() => handleEditAssignment(officer, dateStr)}
                      onRemoveOfficer={() => handleRemoveOfficer(
                        dayOfficer?.shiftInfo?.scheduleId || dayOfficer?.scheduleId,
                        (dayOfficer?.shiftInfo?.scheduleType || dayOfficer?.scheduleType) as 'recurring' | 'exception',
                        officer
                      )}
                      isUpdating={mutations.removeOfficerMutation.isPending}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* PPO SECTION */}
          {ppos.length > 0 && (
            <div className="border-t-2 border-blue-200">
              {/* PPO COUNT ROW */}
              <div className="grid grid-cols-9 border-b"
                style={{ backgroundColor: weeklyColors.ppo?.bg, color: weeklyColors.ppo?.text }}>
                <div className="p-2 border-r"></div>
                <div className="p-2 border-r text-sm font-medium">PPO</div>
                {weekDays.map(({ dateStr }) => {
                  const daySchedule = localSchedules.dailySchedules?.find(s => s.date === dateStr);
                  
                  // Count PPOs, excluding only full-day PTO
                  const ppoCount = daySchedule?.officers?.filter((officer: any) => {
                    const isOfficer = !isSupervisorByRank(officer);
                    const isPPO = officer.rank?.toLowerCase() === 'probationary';
                    const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
                    const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO;
                    return isOfficer && isPPO && isScheduled;
                  }).length || 0;
                  
                  return (
                    <div key={dateStr} className="p-2 text-center border-r text-sm font-medium">
                      {ppoCount}
                    </div>
                  );
                })}
              </div>

              {/* PPO OFFICERS */}
              {ppos.map((officer: any) => (
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
                    
                    // Extract partner information from position for PPOs
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
                        onEditAssignment={() => handleEditAssignment(officer, dateStr)}
                        onRemoveOfficer={() => handleRemoveOfficer(
                          dayOfficer?.shiftInfo?.scheduleId || dayOfficer?.scheduleId,
                          (dayOfficer?.shiftInfo?.scheduleType || dayOfficer?.scheduleType) as 'recurring' | 'exception',
                          officer
                        )}
                        isUpdating={mutations.removeOfficerMutation.isPending}
                        isPPO={true}
                        partnerInfo={partnerInfo}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
