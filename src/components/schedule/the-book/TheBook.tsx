// src/components/schedule/the-book/TheBook.tsx
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import TheBookMobile from "./TheBookMobile";
import { exportWeeklyPDF } from "@/utils/pdfExportUtils";
import { CalendarIcon, Download, ChevronLeft, ChevronRight, CalendarDays, Users, Plane, MapPin } from "lucide-react";
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  addWeeks, 
  subWeeks, 
  startOfMonth, 
  endOfMonth, 
  addMonths, 
  subMonths, 
  isSameMonth, 
  isSameDay, 
  eachDayOfInterval, 
  parseISO 
} from "date-fns";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import { useWeeklyScheduleMutations } from "@/hooks/useWeeklyScheduleMutations";
import { useColorSettings } from "@/hooks/useColorSettings";
import { useWebsiteSettings } from "@/hooks/useWebsiteSettings";
import { PTOAssignmentDialog } from "../PTOAssignmentDialog";
import { auditLogger } from "@/lib/auditLogger";

// Import view components
import { WeeklyView } from "./WeeklyView";
import { MonthlyView } from "./MonthlyView";
import { ForceListView } from "./ForceListView";
import { VacationListView } from "./VacationListView";
import { BeatPreferencesView } from "./BeatPreferencesView";
import { ScheduleExportDialog } from "./ScheduleExportDialog";
import { AssignmentEditDialogMobile } from "./AssignmentEditDialogMobile";
//import { AssignmentEditDialog } from "./AssignmentEditDialog";

// Import types and utils
import type { TheBookProps, TheBookView, ScheduleData, ShiftInfo } from "./types";
import { 
  getLastName, 
  getRankAbbreviation, 
  getRankPriority, 
  isSupervisorByRank,
  categorizeAndSortOfficers,
  calculateStaffingCounts
} from "./utils";

const TheBook = ({  
  userRole = 'officer', 
  isAdminOrSupervisor = false 
}: TheBookProps) => {
  // ALL hooks must be declared first
  const { userEmail } = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: websiteSettings } = useWebsiteSettings();
  const { weekly: weeklyColors } = useColorSettings();
  
  // NOW continue with desktop-only state and logic
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeView, setActiveView] = useState<TheBookView>("weekly");
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [ptoDialogOpen, setPtoDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [editingAssignment, setEditingAssignment] = useState<{ officer: any; dateStr: string } | null>(null);
  const mutationsResult = useWeeklyScheduleMutations(currentWeekStart, currentMonth, activeView, selectedShiftId);
  
  // Destructure with safe fallbacks
  const {
    updatePositionMutation,
    removeOfficerMutation = {
      mutate: () => {
        console.error("removeOfficerMutation not available");
        toast.error("Cannot remove officer: System error");
      },
      isPending: false
    },
    removePTOMutation = {
      mutate: () => {
        console.error("removePTOMutation not available");
        toast.error("Cannot remove PTO: System error");
      },
      isPending: false
    },
    queryKey: mutationQueryKey
  } = mutationsResult;

  console.log("🔍 Mutations initialized:", {
    hasRemoveOfficerMutation: !!removeOfficerMutation,
    hasRemovePTOMutation: !!removePTOMutation
  });

  // If removeOfficerMutation is still undefined, add a fallback
  const safeRemoveOfficerMutation = removeOfficerMutation || {
    mutate: () => {
      console.error("removeOfficerMutation is not available");
      toast.error("Cannot remove officer: Mutation not available");
    },
    isPending: false
  };

  const safeRemovePTOMutation = removePTOMutation || {
    mutate: () => {
      console.error("removePTOMutation is not available");
      toast.error("Cannot remove PTO: Mutation not available");
    },
    isPending: false
  };

  // Get shift types
  const { data: shiftTypes, isLoading: shiftsLoading } = useQuery({
    queryKey: ["shift-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_types")
        .select("*")
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  // Fetch default assignments
  const { data: allDefaultAssignments } = useQuery({
    queryKey: ["all-default-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("officer_default_assignments")
        .select("*")
        .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`)
        .lte("start_date", new Date().toISOString().split('T')[0]);

      if (error) {
        console.error("Error fetching default assignments:", error);
        return [];
      }
      return data || [];
    },
    enabled: true, // Changed: Default assignments are officer-specific, not shift-specific
  });

  // Helper function to get default assignment
  const getDefaultAssignment = (officerId: string, date: string) => {
    if (!allDefaultAssignments) return null;
    const dateObj = parseISO(date);
    return allDefaultAssignments.find(da => 
      da.officer_id === officerId &&
      parseISO(da.start_date) <= dateObj &&
      (!da.end_date || parseISO(da.end_date) >= dateObj)
    );
  };

  // Function to fetch service credits for multiple officers
  const fetchServiceCredits = async (officerIds: string[]) => {
    if (!officerIds.length) return new Map();
    
    const serviceCredits = new Map();
    
    // Fetch service credits for each officer
    for (const officerId of officerIds) {
      try {
        const { data, error } = await supabase
          .rpc('get_service_credit', { profile_id: officerId });
        
        if (error) {
          console.error(`Error fetching service credit for officer ${officerId}:`, error);
          serviceCredits.set(officerId, 0);
        } else {
          serviceCredits.set(officerId, data || 0);
        }
      } catch (error) {
        console.error(`Error fetching service credit for officer ${officerId}:`, error);
        serviceCredits.set(officerId, 0);
      }
    }
    
    return serviceCredits;
  };

  // Function to fetch minimum staffing from database
  const fetchMinimumStaffing = async (dayOfWeek: number) => {
    const { data, error } = await supabase
      .from("minimum_staffing")
      .select("minimum_officers, minimum_supervisors, shift_type_id, day_of_week")
      .eq("day_of_week", dayOfWeek);
    
    if (error) {
      console.error("Error fetching minimum staffing:", error);
      return new Map();
    }
    
    // Create a map of shift_type_id to minimum staffing
    const staffingMap = new Map();
    data?.forEach(item => {
      staffingMap.set(item.shift_type_id, {
        minimumOfficers: item.minimum_officers,
        minimumSupervisors: item.minimum_supervisors
      });
    });
    
    return staffingMap;
  };

  // Build the main schedule query key
  const scheduleQueryKey = ['schedule-data', activeView, selectedShiftId, currentWeekStart.toISOString(), currentMonth.toISOString()];

  // Main schedule query - UPDATED to include officer profiles
  const { data: schedules, isLoading: schedulesLoading, error } = useQuery({
    queryKey: scheduleQueryKey,
    queryFn: async () => {
      if (!selectedShiftId) return null;

      const startDate = activeView === "weekly" ? currentWeekStart : startOfMonth(currentMonth);
      const endDate = activeView === "weekly" ? endOfWeek(currentWeekStart, { weekStartsOn: 0 }) : endOfMonth(currentMonth);
      
      const dates = eachDayOfInterval({ start: startDate, end: endDate }).map(date => 
        format(date, "yyyy-MM-dd")
      );

      // Fetch minimum staffing for all days of the week (0-6)
      const minimumStaffing = new Map();
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const staffingForDay = await fetchMinimumStaffing(dayOfWeek);
        minimumStaffing.set(dayOfWeek, staffingForDay);
      }

      // Get recurring schedules
      const { data: recurringData, error: recurringError } = await supabase
        .from("recurring_schedules")
        .select(`
          *,
          profiles:officer_id (
            id, full_name, badge_number, rank, hire_date
          ),
          shift_types (
            id, name, start_time, end_time
          )
        `)
        .eq("shift_type_id", selectedShiftId)
        .or(`end_date.is.null,end_date.gte.${startDate.toISOString().split('T')[0]}`);

      if (recurringError) throw recurringError;

      // Get schedule exceptions
      const { data: exceptionsData, error: exceptionsError } = await supabase
        .from("schedule_exceptions")
        .select("*")
        .gte("date", startDate.toISOString().split('T')[0])
        .lte("date", endDate.toISOString().split('T')[0])
        .eq("shift_type_id", selectedShiftId);

      if (exceptionsError) throw exceptionsError;

      // Get ALL officer profiles at once (CRITICAL FIX)
      const allOfficerIds = new Set<string>();
      
      // Add officer IDs from recurring schedules
      recurringData?.forEach(r => r.officer_id && allOfficerIds.add(r.officer_id));
      
      // Add officer IDs from exceptions
      exceptionsData?.forEach(e => e.officer_id && allOfficerIds.add(e.officer_id));
      
      let officerProfilesMap = new Map();
      if (allOfficerIds.size > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select(`
            id, 
            full_name, 
            badge_number, 
            rank, 
            hire_date,
            promotion_date_sergeant,
            promotion_date_lieutenant,
            service_credit_override
          `)
          .in("id", Array.from(allOfficerIds));

        if (profilesError) {
          console.error("Error fetching officer profiles:", profilesError);
        } else {
          // Create a map of officer profiles for easy lookup
          profilesData?.forEach(profile => {
            officerProfilesMap.set(profile.id, profile);
          });
        }
      }

      console.log('📊 Fetched officer profiles:', {
        totalOfficers: allOfficerIds.size,
        profilesFound: officerProfilesMap.size,
        sampleProfile: officerProfilesMap.size > 0 ? 
          Array.from(officerProfilesMap.values())[0] : null
      });

      // Get shift types for exceptions
      const shiftTypeIds = [...new Set(exceptionsData?.map(e => e.shift_type_id).filter(Boolean))];
      let exceptionShiftTypes = [];
      if (shiftTypeIds.length > 0) {
        const { data: shiftTypesData } = await supabase
          .from("shift_types")
          .select("id, name, start_time, end_time")
          .in("id", shiftTypeIds);
        exceptionShiftTypes = shiftTypesData || [];
      }

      // Fetch service credits for all officers involved
      const allOfficerIdsArray = Array.from(allOfficerIds);
      const serviceCredits = await fetchServiceCredits(allOfficerIdsArray);

      // Combine exception data with profiles
      const combinedExceptions = exceptionsData?.map(exception => {
        const profile = officerProfilesMap.get(exception.officer_id);
        return {
          ...exception,
          profiles: profile || null,
          shift_types: exceptionShiftTypes.find(s => s.id === exception.shift_type_id)
        };
      }) || [];

      // Build schedule structure
      const scheduleByDateAndOfficer: Record<string, Record<string, any>> = {};
      dates.forEach(date => { scheduleByDateAndOfficer[date] = {}; });

      // Get recurring schedule patterns
      const recurringSchedulesByOfficer = new Map();
      recurringData?.forEach(recurring => {
        if (!recurringSchedulesByOfficer.has(recurring.officer_id)) {
          recurringSchedulesByOfficer.set(recurring.officer_id, new Set());
        }
        recurringSchedulesByOfficer.get(recurring.officer_id).add(recurring.day_of_week);
      });

      // Process recurring schedules
      recurringData?.forEach(recurring => {
        const profile = officerProfilesMap.get(recurring.officer_id);
        dates.forEach(date => {
          const currentDate = parseISO(date);
          const dayOfWeek = currentDate.getDay();
          
          if (recurring.day_of_week === dayOfWeek) {
            const scheduleStartDate = parseISO(recurring.start_date);
            const scheduleEndDate = recurring.end_date ? parseISO(recurring.end_date) : null;
            
            if (currentDate >= scheduleStartDate && (!scheduleEndDate || currentDate <= scheduleEndDate)) {
              const exception = combinedExceptions?.find(e => 
                e.officer_id === recurring.officer_id && e.date === date && !e.is_off
              );
              const ptoException = combinedExceptions?.find(e => 
                e.officer_id === recurring.officer_id && e.date === date && e.is_off
              );
              const defaultAssignment = getDefaultAssignment(recurring.officer_id, date);

              if (!scheduleByDateAndOfficer[date][recurring.officer_id]) {
                scheduleByDateAndOfficer[date][recurring.officer_id] = {
                  officerId: recurring.officer_id,
                  officerName: profile?.full_name || recurring.profiles?.full_name || "Unknown",
                  badgeNumber: profile?.badge_number || recurring.profiles?.badge_number,
                  rank: profile?.rank || recurring.profiles?.rank,
                  hire_date: profile?.hire_date || null,
                  promotion_date_sergeant: profile?.promotion_date_sergeant || null,
                  promotion_date_lieutenant: profile?.promotion_date_lieutenant || null,
                  service_credit_override: profile?.service_credit_override || 0,
                  service_credit: serviceCredits.get(recurring.officer_id) || 0,
                  date,
                  dayOfWeek,
                  isRegularRecurringDay: true,
                  shiftInfo: {
                    type: recurring.shift_types?.name,
                    time: `${recurring.shift_types?.start_time} - ${recurring.shift_types?.end_time}`,
                    position: recurring.position_name || defaultAssignment?.position_name,
                    unitNumber: recurring.unit_number || defaultAssignment?.unit_number,
                    scheduleId: recurring.id,
                    scheduleType: "recurring" as const,
                    shift: recurring.shift_types,
                    isOff: false,
                    hasPTO: !!ptoException,
                    ptoData: ptoException ? {
                      id: ptoException.id,
                      ptoType: ptoException.reason,
                      startTime: ptoException.custom_start_time || recurring.shift_types?.start_time,
                      endTime: ptoException.custom_end_time || recurring.shift_types?.end_time,
                      isFullShift: !ptoException.custom_start_time && !ptoException.custom_end_time,
                      shiftTypeId: ptoException.shift_type_id
                    } : undefined
                  }
                };
              }
            }
          }
        });
      });

      // Process working exceptions
      combinedExceptions?.filter(e => !e.is_off).forEach(exception => {
        if (!scheduleByDateAndOfficer[exception.date]) {
          scheduleByDateAndOfficer[exception.date] = {};
        }

        const profile = officerProfilesMap.get(exception.officer_id);
        const ptoException = combinedExceptions?.find(e => 
          e.officer_id === exception.officer_id && e.date === exception.date && e.is_off
        );
        const defaultAssignment = getDefaultAssignment(exception.officer_id, exception.date);
        const isRegularDay = recurringSchedulesByOfficer.get(exception.officer_id)?.has(parseISO(exception.date).getDay()) || false;

        scheduleByDateAndOfficer[exception.date][exception.officer_id] = {
          officerId: exception.officer_id,
          officerName: profile?.full_name || exception.profiles?.full_name || "Unknown",
          badgeNumber: profile?.badge_number || exception.profiles?.badge_number,
          rank: profile?.rank || exception.profiles?.rank,
          hire_date: profile?.hire_date || null,
          promotion_date_sergeant: profile?.promotion_date_sergeant || null,
          promotion_date_lieutenant: profile?.promotion_date_lieutenant || null,
          service_credit_override: profile?.service_credit_override || 0,
          service_credit: serviceCredits.get(exception.officer_id) || 0,
          date: exception.date,
          dayOfWeek: parseISO(exception.date).getDay(),
          isRegularRecurringDay: isRegularDay,
          shiftInfo: {
            type: exception.shift_types?.name || "Custom",
            time: exception.custom_start_time && exception.custom_end_time
              ? `${exception.custom_start_time} - ${exception.custom_end_time}`
              : `${exception.shift_types?.start_time} - ${exception.shift_types?.end_time}`,
            position: exception.position_name || defaultAssignment?.position_name,
            unitNumber: exception.unit_number || defaultAssignment?.unit_number,
            scheduleId: exception.id,
            scheduleType: "exception" as const,
            shift: exception.shift_types,
            isOff: false,
            hasPTO: !!ptoException,
            ptoData: ptoException ? {
              id: ptoException.id,
              ptoType: ptoException.reason,
              startTime: ptoException.custom_start_time || exception.shift_types?.start_time,
              endTime: ptoException.custom_end_time || exception.shift_types?.end_time,
              isFullShift: !ptoException.custom_start_time && !ptoException.custom_end_time,
              shiftTypeId: ptoException.shift_type_id
            } : undefined
          }
        };
      });

      // Process PTO-only exceptions
      combinedExceptions?.filter(e => e.is_off).forEach(ptoException => {
        if (!scheduleByDateAndOfficer[ptoException.date]) {
          scheduleByDateAndOfficer[ptoException.date] = {};
        }

        if (!scheduleByDateAndOfficer[ptoException.date][ptoException.officer_id]) {
          const profile = officerProfilesMap.get(ptoException.officer_id);
          scheduleByDateAndOfficer[ptoException.date][ptoException.officer_id] = {
            officerId: ptoException.officer_id,
            officerName: profile?.full_name || ptoException.profiles?.full_name || "Unknown",
            badgeNumber: profile?.badge_number || ptoException.profiles?.badge_number,
            rank: profile?.rank || ptoException.profiles?.rank,
            hire_date: profile?.hire_date || null,
            promotion_date_sergeant: profile?.promotion_date_sergeant || null,
            promotion_date_lieutenant: profile?.promotion_date_lieutenant || null,
            service_credit_override: profile?.service_credit_override || 0,
            service_credit: serviceCredits.get(ptoException.officer_id) || 0,
            date: ptoException.date,
            dayOfWeek: parseISO(ptoException.date).getDay(),
            shiftInfo: {
              type: "Off",
              time: "",
              position: "",
              scheduleId: ptoException.id,
              scheduleType: "exception" as const,
              shift: ptoException.shift_types,
              isOff: true,
              reason: ptoException.reason,
              hasPTO: true,
              ptoData: {
                id: ptoException.id,
                ptoType: ptoException.reason,
                startTime: ptoException.custom_start_time || ptoException.shift_types?.start_time || '00:00',
                endTime: ptoException.custom_end_time || ptoException.shift_types?.end_time || '23:59',
                isFullShift: !ptoException.custom_start_time && !ptoException.custom_end_time,
                shiftTypeId: ptoException.shift_type_id
              }
            }
          };
        }
      });

      // Convert to array format
      const dailySchedules = dates.map(date => {
        const officers = Object.values(scheduleByDateAndOfficer[date] || {});
        
        // Use the imported categorizeAndSortOfficers function
        const categorized = categorizeAndSortOfficers(officers);
        const { supervisorCount, officerCount } = calculateStaffingCounts(categorized);

        return {
          date,
          dayOfWeek: parseISO(date).getDay(),
          officers,
          categorizedOfficers: categorized,
          staffing: {
            supervisors: supervisorCount,
            officers: officerCount,
            total: supervisorCount + officerCount
          },
          isCurrentMonth: activeView === "monthly" ? isSameMonth(parseISO(date), currentMonth) : true
        };
      });

      console.log('📋 Schedule data prepared:', {
        dailySchedulesCount: dailySchedules.length,
        totalOfficers: dailySchedules.reduce((sum, day) => sum + day.officers.length, 0),
        officerProfilesCount: officerProfilesMap.size,
        sampleOfficer: dailySchedules[0]?.officers[0]
      });

      return { 
        dailySchedules, 
        dates,
        recurring: recurringData || [],
        exceptions: combinedExceptions,
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
        minimumStaffing,
        officerProfiles: officerProfilesMap // CRITICAL: Pass profiles to WeeklyView
      };
    },
    enabled: !!selectedShiftId && (activeView === "weekly" || activeView === "monthly"),
  });

  // Navigation functions
  const goToPreviousWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const goToNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
  const goToCurrentWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const goToPreviousMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const goToCurrentMonth = () => setCurrentMonth(new Date());

  // Navigate to daily schedule
  const navigateToDailySchedule = (dateStr: string) => {
    navigate(`/daily-schedule?date=${dateStr}&shift=${selectedShiftId}`);
  };

// Helper function to invalidate schedule queries - UPDATE THIS FUNCTION
const invalidateScheduleQueries = () => {
  try {
    console.log('🔄 Invalidating schedule queries...');
    
    // Invalidate the main schedule query
    queryClient.invalidateQueries({ 
      queryKey: scheduleQueryKey,
      refetchType: 'all'
    });
    
    // Also invalidate the mutation hook's query key
    if (mutationQueryKey) {
      queryClient.invalidateQueries({ 
        queryKey: mutationQueryKey,
        refetchType: 'all'
      });
    }
    
    // Invalidate officer profiles query
    queryClient.invalidateQueries({ 
      queryKey: ['officer-profiles-weekly'],
      refetchType: 'all'
    });
    
    console.log('✅ Cache invalidated for schedule queries');
  } catch (error) {
    console.error('❌ Error invalidating schedule queries:', error);
  }
};

  // Event handlers
const handleEditAssignment = (officer: any, dateStr: string) => {
  console.log('=== EDIT ASSIGNMENT CLICKED (desktop) ===');
  console.log('Full officer object:', officer);
  console.log('Officer shiftInfo:', officer?.shiftInfo);
  console.log('Date:', dateStr);
  
  const officerId = officer?.officerId || officer?.officer_id || officer?.id;
  console.log('Found officerId:', officerId);
  
  // Make sure we have all the necessary data
  const officerData = {
    ...officer,
    officerId: officerId,
    shiftInfo: {
      ...officer?.shiftInfo,
      // Store current position for comparison
      currentPosition: officer?.shiftInfo?.position || ''
    }
  };
  
  console.log('Prepared officer data for editing:', officerData);
  
  setEditingAssignment({ 
    officer: officerData, 
    dateStr 
  });
};

  const handleAssignPTO = (schedule: any, date: string, officerId: string, officerName: string) => {
    setSelectedSchedule({
      scheduleId: schedule.scheduleId,
      type: schedule.scheduleType,
      date,
      shift: schedule.shift,
      officerId,
      officerName,
      ...(schedule.hasPTO && schedule.ptoData ? { existingPTO: schedule.ptoData } : {})
    });
    setPtoDialogOpen(true);
  };

const handleRemovePTO = async (schedule: ShiftInfo, date: string, officerId: string) => {
  console.log('🔄 Removing PTO from MonthlyView:', { schedule, date, officerId });
  
  if (!schedule?.ptoData?.id) {
    console.error('❌ Missing PTO data:', { 
      hasSchedule: !!schedule, 
      hasPTOData: !!schedule?.ptoData,
      ptoDataId: schedule?.ptoData?.id 
    });
    toast.error("Cannot remove PTO: Missing PTO data");
    return;
  }

  if (!officerId) {
    console.error('❌ Missing officer ID');
    toast.error("Cannot remove PTO: Missing officer ID");
    return;
  }

  let officerName = "Unknown Officer";
  try {
    const daySchedule = schedules?.dailySchedules?.find(s => s.date === date);
    if (daySchedule) {
      const officerData = daySchedule.officers.find((o: any) => o.officerId === officerId);
      officerName = officerData?.officerName || officerName;
    }
  } catch (error) {
    console.error("Error getting officer name:", error);
  }

  const ptoMutationData = {
    id: schedule.ptoData.id,
    officerId: officerId,
    date: date,
    shiftTypeId: schedule.shift?.id || schedule.ptoData.shiftTypeId || selectedShiftId,
    ptoType: schedule.ptoData.ptoType || "PTO",
    startTime: schedule.ptoData.startTime || schedule.shift?.start_time || "00:00",
    endTime: schedule.ptoData.endTime || schedule.shift?.end_time || "23:59"
  };

  console.log('📋 Calling removePTOMutation with:', ptoMutationData);

  // FIRST: Directly update the cache to remove PTO styling immediately
  queryClient.setQueryData(scheduleQueryKey, (oldData: any) => {
    if (!oldData) return oldData;
    
    const newData = JSON.parse(JSON.stringify(oldData));
    
    // Find and update the specific day and officer
    if (newData.dailySchedules) {
      newData.dailySchedules = newData.dailySchedules.map((day: any) => {
        if (day.date === date) {
          return {
            ...day,
            officers: day.officers.map((officer: any) => {
              if (officer.officerId === officerId) {
                // Remove PTO data from this officer
                const updatedOfficer = {
                  ...officer,
                  shiftInfo: {
                    ...officer.shiftInfo,
                    hasPTO: false,
                    ptoData: undefined,
                    isOff: false // CRITICAL: Make sure isOff is false
                  }
                };
                
                console.log('🔄 Updated officer in cache:', updatedOfficer);
                return updatedOfficer;
              }
              return officer;
            })
          };
        }
        return day;
      });
    }
    
    return newData;
  });

  // SECOND: Call the mutation
  safeRemovePTOMutation.mutate(ptoMutationData, {
    onSuccess: () => {
      // THIRD: Force cache invalidation to ensure fresh data
      invalidateScheduleQueries();
      
      // FOURTH: Force immediate refetch
      queryClient.refetchQueries({ 
        queryKey: scheduleQueryKey,
        exact: true 
      }).then(() => {
        console.log('✅ Schedule data refetched after PTO removal');
      });
      
      try {
        auditLogger.logPTORemoval(
          officerId,
          ptoMutationData.ptoType,
          date,
          userEmail,
          `Removed ${ptoMutationData.ptoType} PTO for ${officerName} on ${date}`
        );
        console.log('📋 PTO removal logged to audit trail');
      } catch (logError) {
        console.error('Failed to log PTO removal audit:', logError);
      }
      
      toast.success(`PTO (${ptoMutationData.ptoType}) removed successfully`);
    },
    onError: (error) => {
      console.error('❌ Error removing PTO:', error);
      toast.error(`Failed to remove PTO: ${error.message}`);
    }
  });
};

const handleSaveAssignment = () => {
  if (!editingAssignment) return;

  const { officer, dateStr } = editingAssignment;
  
  console.log('💾 Saving assignment (desktop):', { officer, dateStr });
  console.log('Officer shiftInfo:', officer.shiftInfo);
  
  const officerId = officer?.officerId || 
                    officer?.officer_id || 
                    officer?.id ||
                    'unknown-id';
  
  const officerName = officer?.officerName || 
                      officer?.full_name || 
                      officer?.profiles?.full_name ||
                      'Unknown Officer';
  
  // Get the updated position from the dialog (this is critical!)
  // The dialog should have updated the officer.shiftInfo.position
  const positionName = officer.shiftInfo?.position || '';
  const unitNumber = officer.shiftInfo?.unitNumber || '';
  const notes = officer.shiftInfo?.notes || '';
  
  console.log('📝 Assignment data to save:', {
    officerId,
    officerName,
    positionName,
    unitNumber,
    notes,
    scheduleId: officer.shiftInfo?.scheduleId,
    scheduleType: officer.shiftInfo?.scheduleType,
    dateStr,
    selectedShiftId
  });
  
  if (!officerId || officerId === 'unknown-id') {
    console.error('Could not find officer ID in:', officer);
    toast.error("Cannot save: Officer ID not found");
    return;
  }
  
  if (!positionName) {
    console.error('Missing position name');
    toast.error("Cannot save: Position name is required");
    return;
  }
  
  // Prepare the complete mutation data
  const mutationData = {
    scheduleId: officer.shiftInfo?.scheduleId,
    type: officer.shiftInfo?.scheduleType as "recurring" | "exception",
    positionName: positionName,
    date: dateStr,
    officerId: officerId,
    shiftTypeId: selectedShiftId,
    currentPosition: officer.shiftInfo?.currentPosition || positionName,
    unitNumber: unitNumber || undefined,
    notes: notes || undefined
  };
  
  console.log('🚀 Calling updatePositionMutation with:', mutationData);
  
  updatePositionMutation.mutate(mutationData, {
    onSuccess: () => {
      // Force cache invalidation
      invalidateScheduleQueries();
      
      // Force immediate refetch
      queryClient.refetchQueries({ 
        queryKey: scheduleQueryKey,
        exact: true 
      }).then(() => {
        console.log('✅ Schedule data refetched after assignment update');
      });
      
      try {
        auditLogger.logPositionChange(
          officerId,
          officerName,
          officer.shiftInfo?.currentPosition || 'Unknown',
          positionName,
          userEmail,
          `Changed position for ${officerName} on ${dateStr}`
        );
      } catch (logError) {
        console.error('Failed to log position change audit:', logError);
      }
      
      setEditingAssignment(null);
      toast.success("Assignment updated successfully");
    },
    onError: (error) => {
      console.error('❌ Error updating assignment:', error);
      toast.error(error.message || "Failed to update assignment");
    }
  });
};

  const handleRemoveOfficer = (scheduleId: string, type: 'recurring' | 'exception', officerData?: any) => {
    safeRemoveOfficerMutation.mutate({
      scheduleId,
      type,
      officerData
    }, {
      onSuccess: () => {
        // Invalidate cache after successful officer removal
        invalidateScheduleQueries();
        
        if (officerData) {
          const officerId = officerData?.officerId || officerData?.officer_id || officerData?.id;
          const officerName = officerData?.officerName || officerData?.full_name || 'Unknown Officer';
          
          auditLogger.logOfficerRemoval(
            officerId,
            officerName,
            userEmail,
            `Removed ${officerName} from schedule`
          );
        }
      },
      onError: (error) => {
        console.error('Error removing officer:', error);
        toast.error("Failed to remove officer");
      }
    });
  };

  // Prepare common props for view components - UPDATED to include officerProfiles
  const viewProps = {
    currentDate: activeView === "weekly" ? currentWeekStart : currentMonth,
    selectedShiftId,
    schedules: schedules || null,
    shiftTypes: shiftTypes || [],
    isAdminOrSupervisor,
    weeklyColors,
    // ADD currentWeekStart prop for WeeklyView
    currentWeekStart: currentWeekStart,
    // ADD queryKey for cache invalidation in WeeklyView
    queryKey: scheduleQueryKey,
    onDateChange: (date: Date) => {
      if (activeView === "weekly") {
        setCurrentWeekStart(date);
      } else if (activeView === "monthly") {
        setCurrentMonth(date);
      }
    },
    onDateNavigation: {
      goToPrevious: activeView === "weekly" ? goToPreviousWeek : goToPreviousMonth,
      goToNext: activeView === "weekly" ? goToNextWeek : goToNextMonth,
      goToCurrent: activeView === "weekly" ? goToCurrentWeek : goToCurrentMonth,
    },
    onEventHandlers: {
      onAssignPTO: handleAssignPTO,
      onRemovePTO: handleRemovePTO,
      onEditAssignment: handleEditAssignment,
      onRemoveOfficer: handleRemoveOfficer,
    },
    mutations: {
      removeOfficerMutation: safeRemoveOfficerMutation,
      removePTOMutation: safeRemovePTOMutation,
      updatePositionMutation, // Make sure this is included
    },
    navigateToDailySchedule,
    getLastName,
    getRankAbbreviation,
    getRankPriority,
    isSupervisorByRank,
    officerProfiles: schedules?.officerProfiles || new Map(), // CRITICAL: Pass profiles to WeeklyView
  };

  const renderView = () => {
    switch (activeView) {
      case "weekly":
        return <WeeklyView {...viewProps} />;
      case "monthly":
        return <MonthlyView {...viewProps} />;
      case "force-list":
        return <ForceListView 
          selectedShiftId={selectedShiftId}
          setSelectedShiftId={setSelectedShiftId}
          shiftTypes={shiftTypes || []}
          isAdminOrSupervisor={isAdminOrSupervisor}
        />;
      case "vacation-list":
        return <VacationListView 
          selectedShiftId={selectedShiftId}
          setSelectedShiftId={setSelectedShiftId}
          shiftTypes={shiftTypes || []}
        />;
      case "beat-preferences":
        return <BeatPreferencesView 
          isAdminOrSupervisor={isAdminOrSupervisor}
          selectedShiftId={selectedShiftId}
          setSelectedShiftId={setSelectedShiftId}
          shiftTypes={shiftTypes || []}
        />;
      default:
        return <WeeklyView {...viewProps} />;
    }
  };

  const isLoading = schedulesLoading || shiftsLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" /> 
            Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Error loading schedule: {(error as Error).message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* DESKTOP VERSION - hidden on mobile */}
      <div className="hidden md:block">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Schedule - {shiftTypes?.find(s => s.id === selectedShiftId)?.name || "Select Shift"}
              </CardTitle>
              <div className="flex items-center gap-3">
                {isAdminOrSupervisor && (
                  <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select Shift" />
                    </SelectTrigger>
                    <SelectContent>
                      {shiftTypes?.map((shift) => (
                        <SelectItem key={shift.id} value={shift.id}>
                          {shift.name} ({shift.start_time} - {shift.end_time})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {(activeView === "weekly" || activeView === "monthly") && (
                  <Button onClick={() => setExportDialogOpen(true)} size="sm" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                )}
              </div>
            </div>
            
            {!isAdminOrSupervisor && (
              <div className="flex items-center gap-3 mt-3">
                <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select Shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {shiftTypes?.map((shift) => (
                      <SelectItem key={shift.id} value={shift.id}>
                        {shift.name} ({shift.start_time} - {shift.end_time})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <Tabs value={activeView} onValueChange={(value) => setActiveView(value as TheBookView)} className="mt-4">
              <TabsList className="grid w-full max-w-2xl grid-cols-5">
                <TabsTrigger value="weekly" className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Weekly
                </TabsTrigger>
                <TabsTrigger value="monthly" className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Monthly
                </TabsTrigger>
                <TabsTrigger value="force-list" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Force List
                </TabsTrigger>
                <TabsTrigger value="vacation-list" className="flex items-center gap-2">
                  <Plane className="h-4 w-4" />
                  Vacation List
                </TabsTrigger>
                <TabsTrigger value="beat-preferences" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Beat Preferences
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            {selectedShiftId && (activeView === "weekly" || activeView === "monthly") && (
              <p className="text-sm text-muted-foreground mt-2">
                Viewing officers assigned to: {shiftTypes?.find(s => s.id === selectedShiftId)?.name}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {!selectedShiftId && (activeView === "weekly" || activeView === "monthly") ? (
              <div className="text-center py-8 text-muted-foreground">
                Please select a shift to view the schedule
              </div>
            ) : (
              renderView()
            )}
          </CardContent>
        </Card>
      </div>

      {/* MOBILE VERSION - hidden on desktop */}
      <div className="block md:hidden">
        <TheBookMobile userRole={userRole} isAdminOrSupervisor={isAdminOrSupervisor} />
      </div>

      {/* Dialogs */}
<AssignmentEditDialog
  editingAssignment={editingAssignment}
  onClose={() => {
    console.log('Closing assignment dialog');
    setEditingAssignment(null);
  }}
  onSave={(assignmentData) => {
    // Use the same pattern as mobile - get the data directly from dialog
    console.log('💾 Assignment data from dialog:', assignmentData);
    
    if (!assignmentData.positionName) {
      toast.error("Position is required");
      return;
    }
    
    updatePositionMutation.mutate(assignmentData, {
      onSuccess: () => {
        // Force cache invalidation
        invalidateScheduleQueries();
        
        // Force immediate refetch
        queryClient.refetchQueries({ 
          queryKey: scheduleQueryKey,
          exact: true 
        }).then(() => {
          console.log('✅ Schedule data refetched after assignment update');
        });
        
        // Log audit
        try {
          auditLogger.logPositionChange(
            assignmentData.officerId || editingAssignment?.officer?.officerId,
            editingAssignment?.officer?.officerName || 'Unknown Officer',
            editingAssignment?.officer?.shiftInfo?.position || 'Unknown',
            assignmentData.positionName,
            userEmail,
            `Updated assignment via desktop`
          );
        } catch (logError) {
          console.error('Failed to log assignment audit:', logError);
        }
        
        setEditingAssignment(null);
        toast.success("Assignment updated successfully");
      },
      onError: (error) => {
        console.error('❌ Error updating assignment:', error);
        toast.error(error.message || "Failed to update assignment");
      }
    });
  }}
  updatePositionMutation={updatePositionMutation}
/>

      <ScheduleExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        selectedShiftId={selectedShiftId}
        shiftTypes={shiftTypes || []}
        activeView={activeView}
        userEmail={userEmail}
      />

{/* PTO Assignment Dialog */}
{selectedSchedule && (
  <PTOAssignmentDialog
    open={ptoDialogOpen}
    onOpenChange={(open) => {
      setPtoDialogOpen(open);
      if (!open) {
        // Force cache invalidation when PTO dialog closes
        invalidateScheduleQueries();
        
        // Force immediate refetch
        queryClient.refetchQueries({ 
          queryKey: scheduleQueryKey,
          exact: true 
        });
        
        setSelectedSchedule(null);
      }
    }}
    officer={{
      officerId: selectedSchedule.officerId,
      name: selectedSchedule.officerName,
      scheduleId: selectedSchedule.scheduleId,
      type: selectedSchedule.type,
      ...(selectedSchedule.existingPTO ? { existingPTO: selectedSchedule.existingPTO } : {})
    }}
    shift={selectedSchedule.shift}
    date={selectedSchedule.date}
    ptoBalancesEnabled={websiteSettings?.show_pto_balances}
  />
)}
    </>
  );
};

export default TheBook;
