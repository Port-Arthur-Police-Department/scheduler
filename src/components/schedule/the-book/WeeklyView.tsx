// Updated WeeklyView.tsx with internal profile fetching
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
import { toast } from "sonner"; // Added toast for feedback

// Define extended interface that includes onDateChange
interface ExtendedViewProps extends ViewProps {
  onDateChange?: (date: Date) => void;
  officerProfiles?: Map<string, any>; // Optional prop
  queryKey?: any[]; // Add queryKey to invalidate
}

// Helper function to calculate service credit
const calculateServiceCredit = (hireDate: string | null, 
                               override: number = 0,
                               promotionDateSergeant: string | null = null,
                               promotionDateLieutenant: string | null = null,
                               currentRank: string | null = null) => {
  // If there's an override, use it
  if (override && override > 0) {
    return override;
  }
  
  // Determine which date to use based on rank and promotion dates
  let relevantDate: Date | null = null;
  
  if (currentRank) {
    const rankLower = currentRank.toLowerCase();
    
    // Check if officer is a supervisor rank
    if ((rankLower.includes('sergeant') || rankLower.includes('sgt')) && promotionDateSergeant) {
      relevantDate = new Date(promotionDateSergeant);
    } else if ((rankLower.includes('lieutenant') || rankLower.includes('lt')) && promotionDateLieutenant) {
      relevantDate = new Date(promotionDateLieutenant);
    } else if (rankLower.includes('chief') && promotionDateLieutenant) {
      // Chiefs usually come from Lieutenant rank
      relevantDate = new Date(promotionDateLieutenant);
    }
  }
  
  // If no relevant promotion date found, use hire date
  if (!relevantDate && hireDate) {
    relevantDate = new Date(hireDate);
  }
  
  if (!relevantDate) return 0;
  
  try {
    const now = new Date();
    const years = now.getFullYear() - relevantDate.getFullYear();
    const months = now.getMonth() - relevantDate.getMonth();
    const days = now.getDate() - relevantDate.getDate();
    
    // Calculate decimal years
    const totalYears = years + (months / 12) + (days / 365);
    
    // Round to 1 decimal place
    return Math.max(0, Math.round(totalYears * 10) / 10);
  } catch (error) {
    console.error('Error calculating service credit:', error);
    return 0;
  }
};

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
}) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(initialDate);
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  const [selectedWeekDate, setSelectedWeekDate] = useState(initialDate);
  
  // Get query client for cache invalidation
  const queryClient = useQueryClient();

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

  // Use either provided prop or fetched data
  const effectiveOfficerProfiles = officerProfiles || fetchedOfficerProfiles || new Map();

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

  // Handler for PTO assignment with cache invalidation
  const handleAssignPTO = async (schedule: any, date: string, officerId: string, officerName: string) => {
    if (!onEventHandlers.onAssignPTO) return;
    
    try {
      // Show loading state
      toast.loading("Assigning PTO...");
      
      await onEventHandlers.onAssignPTO(schedule, date, officerId, officerName);
      
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ 
        queryKey: queryKey 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['weekly-schedule', selectedShiftId, currentWeekStart.toISOString()] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['officer-profiles-weekly'] 
      });
      
      // Force refetch
      await queryClient.refetchQueries({ 
        queryKey: queryKey 
      });
      
      toast.success("PTO assigned successfully");
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
      
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ 
        queryKey: queryKey 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['weekly-schedule', selectedShiftId, currentWeekStart.toISOString()] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['officer-profiles-weekly'] 
      });
      
      // Force refetch
      await queryClient.refetchQueries({ 
        queryKey: queryKey 
      });
      
      toast.success("PTO removed successfully");
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
      
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ 
        queryKey: queryKey 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['weekly-schedule', selectedShiftId, currentWeekStart.toISOString()] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['officer-profiles-weekly'] 
      });
      
      // Force refetch
      await queryClient.refetchQueries({ 
        queryKey: queryKey 
      });
      
      toast.success("Assignment updated successfully");
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
      
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ 
        queryKey: queryKey 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['weekly-schedule', selectedShiftId, currentWeekStart.toISOString()] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['officer-profiles-weekly'] 
      });
      
      // Force refetch
      await queryClient.refetchQueries({ 
        queryKey: queryKey 
      });
      
      toast.success("Officer removed successfully");
    } catch (error) {
      toast.error("Failed to remove officer");
      console.error('Error removing officer:', error);
    } finally {
      toast.dismiss();
    }
  };

  if (!schedules) {
    return <div className="text-center py-8 text-muted-foreground">No schedule data available</div>;
  }

  if (isLoadingProfiles && !officerProfiles) {
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

  // ============ UPDATED SECTION: Extract and organize officer data ============
  const allOfficers = new Map();
  const recurringSchedulesByOfficer = new Map();

  // Extract recurring schedule patterns
  schedules.recurring?.forEach((recurring: any) => {
    if (!recurringSchedulesByOfficer.has(recurring.officer_id)) {
      recurringSchedulesByOfficer.set(recurring.officer_id, new Set());
    }
    recurringSchedulesByOfficer.get(recurring.officer_id).add(recurring.day_of_week);
  });

  // Process daily schedules - FIXED: Include all necessary data
  schedules.dailySchedules?.forEach(day => {
    day.officers.forEach((officer: any) => {
      if (!allOfficers.has(officer.officerId)) {
        // IMPORTANT: The officer object from parent might not have hire/promotion dates
        // We need to extract them from profiles if available
        let profileData = null;
        
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
        else if (effectiveOfficerProfiles && effectiveOfficerProfiles.has(officer.officerId)) {
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

        // Calculate service credit with available data
        const serviceCredit = calculateServiceCredit(
          profileData.hire_date,
          profileData.service_credit_override || 0,
          profileData.promotion_date_sergeant,
          profileData.promotion_date_lieutenant,
          officer.rank // Pass the rank for logic
        );
        
        // Store officer with calculated service credit
        allOfficers.set(officer.officerId, {
          ...officer,
          service_credit: serviceCredit, // Use calculated service credit
          hire_date: profileData.hire_date,
          promotion_date_sergeant: profileData.promotion_date_sergeant,
          promotion_date_lieutenant: profileData.promotion_date_lieutenant,
          service_credit_override: profileData.service_credit_override || 0,
          recurringDays: recurringSchedulesByOfficer.get(officer.officerId) || new Set(),
          weeklySchedule: {} as Record<string, any>
        });
      }
      
      // Store daily schedule for this officer with ALL necessary data
      // CRITICAL: Make sure we're passing through the schedule ID and other metadata
      const daySchedule = {
        ...officer,
        scheduleId: officer.scheduleId || officer.shiftInfo?.scheduleId, // Extract schedule ID
        scheduleType: officer.shiftInfo?.scheduleType || officer.scheduleType,
        isRegularRecurringDay: recurringSchedulesByOfficer.get(officer.officerId)?.has(day.dayOfWeek) || false,
        shiftInfo: {
          ...officer.shiftInfo,
          // Ensure scheduleId is in shiftInfo as well
          scheduleId: officer.shiftInfo?.scheduleId || officer.scheduleId,
          scheduleType: officer.shiftInfo?.scheduleType || officer.scheduleType
        }
      };
      
      allOfficers.get(officer.officerId).weeklySchedule[day.date] = daySchedule;
    });
  });

  console.log(`Processed ${allOfficers.size} officers with profiles`);

  // Categorize officers with UPDATED supervisor sorting
  // First get all supervisors
  const allSupervisors = Array.from(allOfficers.values())
    .filter(o => isSupervisorByRank(o));

  // Separate Lieutenants and Sergeants
  const lieutenants = allSupervisors.filter(o => 
    o.rank?.toLowerCase().includes('lieutenant') || 
    o.rank?.toLowerCase().includes('lt') ||
    o.rank?.toLowerCase().includes('chief')
  ).sort((a, b) => {
    // Sort Lieutenants by service credit DESCENDING (highest first)
    const aCredit = a.service_credit || 0;
    const bCredit = b.service_credit || 0;
    if (bCredit !== aCredit) {
      return bCredit - aCredit; // Descending
    }
    // If same service credit, sort by last name
    return getLastName(a.officerName).localeCompare(getLastName(b.officerName));
  });

  const sergeants = allSupervisors.filter(o => 
    o.rank?.toLowerCase().includes('sergeant') || 
    o.rank?.toLowerCase().includes('sgt')
  ).sort((a, b) => {
    // Sort Sergeants by service credit DESCENDING (highest first)
    const aCredit = a.service_credit || 0;
    const bCredit = b.service_credit || 0;
    if (bCredit !== aCredit) {
      return bCredit - aCredit; // Descending
    }
    // If same service credit, sort by last name
    return getLastName(a.officerName).localeCompare(getLastName(b.officerName));
  });

  // Combine with Lieutenants first, then Sergeants
  const supervisors = [...lieutenants, ...sergeants];

  const allOfficersList = Array.from(allOfficers.values())
    .filter(o => !isSupervisorByRank(o));

  const ppos = allOfficersList
    .filter(o => o.rank?.toLowerCase() === 'probationary')
    .sort((a, b) => {
      const aCredit = a.service_credit || 0;
      const bCredit = b.service_credit || 0;
      if (bCredit !== aCredit) {
        return bCredit - aCredit;
      }
      return getLastName(a.officerName).localeCompare(getLastName(b.officerName));
    });

  const regularOfficers = allOfficersList
    .filter(o => o.rank?.toLowerCase() !== 'probationary')
    .sort((a, b) => {
      const aCredit = a.service_credit || 0;
      const bCredit = b.service_credit || 0;
      if (bCredit !== aCredit) {
        return bCredit - aCredit;
      }
      return getLastName(a.officerName).localeCompare(getLastName(b.officerName));
    });

  // Debug: Check sorting results
  console.log('Sorting results:', {
    totalOfficers: allOfficers.size,
    supervisors: supervisors.length,
    lieutenants: lieutenants.length,
    sergeants: sergeants.length,
    regularOfficers: regularOfficers.length,
    ppos: ppos.length,
    sampleLieutenants: lieutenants.slice(0, 3).map(l => ({
      name: l.officerName,
      rank: l.rank,
      serviceCredit: l.service_credit
    })),
    sampleSergeants: sergeants.slice(0, 3).map(s => ({
      name: s.officerName,
      rank: s.rank,
      serviceCredit: s.service_credit
    }))
  });

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
              const daySchedule = schedules.dailySchedules?.find(s => s.date === dateStr);
              
              // Get minimum staffing for this day of week and shift
              const minStaffingForDay = schedules.minimumStaffing?.get(dayOfWeek)?.get(selectedShiftId);
              const minimumOfficers = minStaffingForDay?.minimumOfficers || 0;
              const minimumSupervisors = minStaffingForDay?.minimumSupervisors || 1;
              
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
              const daySchedule = schedules.dailySchedules?.find(s => s.date === dateStr);
              
              // Get minimum staffing from database
              const minStaffingForDay = schedules.minimumStaffing?.get(dayOfWeek)?.get(selectedShiftId);
              const minimumSupervisors = minStaffingForDay?.minimumSupervisors || 1;
              
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
                {getLastName(officer.officerName)}
                <div className="text-xs opacity-80">{officer.rank || 'Officer'}</div>
                <div className="text-xs text-muted-foreground">
                  SC: {officer.service_credit?.toFixed(1) || '0.0'}
                </div>
              </div>
              {weekDays.map(({ dateStr }) => {
                const dayOfficer = officer.weeklySchedule[dateStr];
                return (
                  <ScheduleCell
                    key={dateStr}
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
              const daySchedule = schedules.dailySchedules?.find(s => s.date === dateStr);
              
              // Get minimum staffing from database
              const minStaffingForDay = schedules.minimumStaffing?.get(dayOfWeek)?.get(selectedShiftId);
              const minimumOfficers = minStaffingForDay?.minimumOfficers || 0;
              
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
                  {getLastName(officer.officerName)}
                  <div className="text-xs text-muted-foreground">
                    SC: {officer.service_credit?.toFixed(1) || '0.0'}
                  </div>
                </div>
                {weekDays.map(({ dateStr }) => {
                  const dayOfficer = officer.weeklySchedule[dateStr];
                  return (
                    <ScheduleCell
                      key={dateStr}
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
                  const daySchedule = schedules.dailySchedules?.find(s => s.date === dateStr);
                  
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
                    const dayOfficer = officer.weeklySchedule[dateStr];
                    
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
                        key={dateStr}
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
