// src/components/schedule/the-book/TheBook.tsx - COMPLETE FIXED VERSION
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
import { auditLogger } from "@/lib/auditLogger";
import { 
  isShiftUnderstaffed, 
  hasMinimumRequirements,
  formatStaffingCount  
} from "@/utils/staffingUtils";
import { 
  categorizeOfficers, 
  calculateStaffingCounts as calculateStaffingCountsFromUtils,
  isSupervisorByRank as isSupervisorByRankUtil,
  isRidingWithPartnerPosition,
  OfficerData 
} from "@/utils/scheduleUtils";
import { filterRecurringSchedulesByWeekOffset } from "@/utils/weekOffsetUtils";

// Import view components
import { WeeklyView } from "./WeeklyView";
import { MonthlyView } from "./MonthlyView";
import { ForceListView } from "./ForceListView";
import { VacationListView } from "./VacationListView";
import { BeatPreferencesView } from "./BeatPreferencesView";
import { ScheduleExportDialog } from "./ScheduleExportDialog";
import { AssignmentEditDialogMobile } from "./AssignmentEditDialogMobile";
import { PTODialogMobile } from "./PTODialogMobile";
import { formatLocalDate, parseLocalDate } from "@/utils/dateUtils";

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
  isAdminOrSupervisor = false,
  userCurrentShift
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
  
  // SIMPLIFIED Dialog states (like mobile)
  const [ptoDialogOpen, setPtoDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  
  const [selectedOfficerForPTO, setSelectedOfficerForPTO] = useState<{
    id: string;
    name: string;
    date: string;
    schedule: any;
    shiftStartTime?: string;
    shiftEndTime?: string;
  } | null>(null);

  const [editingAssignment, setEditingAssignment] = useState<{
    officer: any;
    dateStr: string;
    shiftTypeId?: string;
    officerId?: string;
    officerName?: string;
  } | null>(null);

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

  // ADD THE useEffect HERE - AFTER shiftTypes query
  useEffect(() => {
    if (shiftTypes && shiftTypes.length > 0 && !selectedShiftId) {
      // Only auto-select if user has a specific assigned shift (not "all")
      if (userCurrentShift && userCurrentShift !== "all") {
        // Check if userCurrentShift exists in available shifts
        const userShiftExists = shiftTypes.some(shift => shift.id === userCurrentShift);
        if (userShiftExists) {
          console.log("🎯 Desktop: Setting user's assigned shift:", userCurrentShift);
          setSelectedShiftId(userCurrentShift);
        } else {
          console.log("⚠️ Desktop: User's assigned shift not found. No auto-selection.");
          // Don't auto-select anything - user must choose
        }
      }
      // If userCurrentShift is "all" or undefined, don't auto-select
    }
  }, [shiftTypes, userCurrentShift, selectedShiftId]);

  // Fetch default assignments for all officers
  const { data: allDefaultAssignments } = useQuery({
    queryKey: ["all-default-assignments", selectedShiftId],
    queryFn: async () => {
      if (!selectedShiftId) return [];
      
      const today = format(new Date(), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("officer_default_assignments")
        .select(`
          *,
          profiles:officer_id (
            id, full_name, badge_number, rank, hire_date
          )
        `)
        .eq("shift_type_id", selectedShiftId)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .lte("start_date", today);

      if (error) {
        console.error("Error fetching default assignments:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!selectedShiftId,
  });

  // Function to get default assignment for an officer on a specific day
  const getDefaultAssignmentForDay = (officerId: string, dayOfWeek: number) => {
    if (!allDefaultAssignments) return null;
    
    const today = new Date();
    return allDefaultAssignments.find(da => 
      da.officer_id === officerId &&
      da.day_of_week === dayOfWeek &&
      parseISO(da.start_date) <= today &&
      (!da.end_date || parseISO(da.end_date) >= today)
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

  // Build the main schedule query key
  const scheduleQueryKey = ['schedule-data', activeView, selectedShiftId, currentWeekStart.toISOString(), currentMonth.toISOString()];

  // Main schedule query - FIXED with week offset filtering for Dispatch shifts
  const { data: schedules, isLoading: schedulesLoading, error } = useQuery({
    queryKey: scheduleQueryKey,
    queryFn: async () => {
      if (!selectedShiftId) return null;
    
      console.log('📱 [Desktop] Fetching schedule data...');
      
      const startStr = activeView === "weekly" 
        ? format(currentWeekStart, "yyyy-MM-dd") 
        : format(startOfMonth(currentMonth), "yyyy-MM-dd");
      
      const endStr = activeView === "weekly"
        ? format(endOfWeek(currentWeekStart, { weekStartsOn: 0 }), "yyyy-MM-dd")
        : format(endOfMonth(currentMonth), "yyyy-MM-dd");
    
      console.log('📅 Desktop date range:', startStr, 'to', endStr);
    
      try {
        // Get shift type to check if it's Dispatch
        const { data: shiftType, error: shiftTypeError } = await supabase
          .from("shift_types")
          .select("name")
          .eq("id", selectedShiftId)
          .single();
        
        const isDispatchShift = !shiftTypeError && shiftType?.name?.toLowerCase()?.includes('dispatch') || false;
        console.log(`🔍 Desktop shift ${selectedShiftId} is Dispatch: ${isDispatchShift}`);
    
        // Fetch schedule exceptions (including overtime)
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
    
        // Fetch recurring schedules
        let { data: recurringSchedules, error: recurringError } = await supabase
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
    
        // Get the cycle start date for this shift (only if Dispatch)
        let cycleStartDate: Date | null = null;
        if (isDispatchShift) {
          const { data: cycleStartData, error: cycleStartError } = await supabase
            .from("recurring_schedules")
            .select("start_date")
            .eq("shift_type_id", selectedShiftId)
            .eq("week_offset", 0)
            .order("start_date", { ascending: true })
            .limit(1)
            .single();
          
          if (!cycleStartError && cycleStartData) {
            const [year, month, day] = cycleStartData.start_date.split('-').map(Number);
            cycleStartDate = new Date(year, month - 1, day);
            console.log(`📅 Cycle start date for ${shiftType?.name}: ${cycleStartDate.toDateString()}`);
          }
        }
    
        // APPLY WEEK OFFSET FILTERING FOR DISPATCH SHIFTS (using the utility)
        if (isDispatchShift && recurringSchedules && recurringSchedules.length > 0 && cycleStartDate) {
          const originalCount = recurringSchedules.length;
          const startDate = activeView === "weekly" ? currentWeekStart : startOfMonth(currentMonth);
          const endDate = activeView === "weekly" ? endOfWeek(currentWeekStart, { weekStartsOn: 0 }) : endOfMonth(currentMonth);
          
          // Import this from weekOffsetUtils or define it here
          const filteredSchedules: any[] = [];
          const datesInRange: Date[] = [];
          let currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            datesInRange.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          for (const schedule of recurringSchedules) {
            if (schedule.week_offset === null || schedule.week_offset === undefined) {
              filteredSchedules.push(schedule);
              continue;
            }
            
            let shouldInclude = false;
            for (const date of datesInRange) {
              if (schedule.day_of_week === date.getDay()) {
                const diffTime = date.getTime() - cycleStartDate.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                let currentWeekOffset = 0;
                if (diffDays >= 0) {
                  const weeksPassed = Math.floor(diffDays / 7);
                  currentWeekOffset = weeksPassed % 4;
                }
                if (schedule.week_offset === currentWeekOffset) {
                  shouldInclude = true;
                  break;
                }
              }
            }
            if (shouldInclude) {
              filteredSchedules.push(schedule);
            }
          }
          recurringSchedules = filteredSchedules;
          console.log(`✅ Dispatch shift - Filtered recurring schedules: ${originalCount} → ${recurringSchedules.length}`);
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
    
        // Generate dates array
        const dates = activeView === "weekly"
          ? eachDayOfInterval({ start: currentWeekStart, end: endOfWeek(currentWeekStart, { weekStartsOn: 0 }) })
              .map(date => format(date, "yyyy-MM-dd"))
          : eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
              .map(date => format(date, "yyyy-MM-dd"));
    
        // Create a map to store all officers and their service credits
        const allOfficersMap = new Map();
        
        // First, collect all officers from exceptions and recurring schedules
        const allOfficerIds = new Set<string>();
        
        // Add officer IDs from exceptions
        exceptions?.forEach(exception => {
          if (exception.officer_id) {
            allOfficerIds.add(exception.officer_id);
          }
        });
        
        // Add officer IDs from recurring schedules
        recurringSchedules?.forEach(recurring => {
          if (recurring.officer_id) {
            allOfficerIds.add(recurring.officer_id);
          }
        });
    
        // Fetch service credits for all officers
        let serviceCreditsMap = new Map();
        if (allOfficerIds.size > 0) {
          serviceCreditsMap = await fetchServiceCredits(Array.from(allOfficerIds));
        }
    
        // Organize data by day for WeeklyView/MonthlyView - WITH DEFAULT ASSIGNMENTS
        const dailySchedules = dates.map(dateStr => {
          const date = parseISO(dateStr);
          const dayOfWeek = date.getDay();
          
          // Get exceptions for this day
          const dayExceptions = exceptions?.filter(e => e.date === dateStr) || [];
          const dayRecurring = recurringSchedules?.filter(r => r.day_of_week === dayOfWeek) || [];
          
          const officers = [];
          const processedOfficers = new Set();
          
          // Process exceptions first (they override recurring and defaults)
          dayExceptions.forEach(exception => {
            const officerId = exception.officer_id;
            processedOfficers.add(officerId);
            
            const profile = exception.profiles || {};
            const officerData = {
              officerId: officerId,
              officerName: profile.full_name || "Unknown",
              badgeNumber: profile.badge_number || "9999",
              rank: profile.rank || "Officer",
              hire_date: profile.hire_date,
              promotion_date_sergeant: profile.promotion_date_sergeant,
              promotion_date_lieutenant: profile.promotion_date_lieutenant,
              service_credit_override: profile.service_credit_override || 0,
              service_credit: serviceCreditsMap.get(officerId) || 0,
              date: dateStr,
              dayOfWeek: dayOfWeek,
              scheduleType: "exception",
              isException: true,
              shiftInfo: {
                scheduleId: exception.id,
                scheduleType: "exception",
                position: exception.position_name,
                unitNumber: exception.unit_number,
                isOff: exception.is_off || false,
                hasPTO: exception.is_off && !!exception.reason,
                ptoData: exception.is_off ? {
                  ptoType: exception.reason,
                  isFullShift: !exception.custom_start_time && !exception.custom_end_time,
                  startTime: exception.custom_start_time,
                  endTime: exception.custom_end_time
                } : undefined,
                reason: exception.reason,
                is_extra_shift: exception.is_extra_shift || false,
                custom_start_time: exception.custom_start_time,
                custom_end_time: exception.custom_end_time
              }
            };
            
            // Store officer in map for easy access
            if (!allOfficersMap.has(officerId)) {
              allOfficersMap.set(officerId, {
                ...officerData,
                weeklySchedule: {}
              });
            }
            
            officers.push(officerData);
          });
          
          // Process recurring schedules that weren't overridden by exceptions
          dayRecurring.forEach(recurring => {
            const officerId = recurring.officer_id;
            if (processedOfficers.has(officerId)) return;
            
            processedOfficers.add(officerId);
            
            const profile = recurring.profiles || {};
            const officerData = {
              officerId: officerId,
              officerName: profile.full_name || "Unknown",
              badgeNumber: profile.badge_number || "9999",
              rank: profile.rank || "Officer",
              hire_date: profile.hire_date,
              promotion_date_sergeant: profile.promotion_date_sergeant,
              promotion_date_lieutenant: profile.promotion_date_lieutenant,
              service_credit_override: profile.service_credit_override || 0,
              service_credit: serviceCreditsMap.get(officerId) || 0,
              date: dateStr,
              dayOfWeek: dayOfWeek,
              scheduleType: "recurring",
              isRegularRecurringDay: true,
              shiftInfo: {
                scheduleId: recurring.id,
                scheduleType: "recurring",
                position: recurring.position_name,
                unitNumber: recurring.unit_number,
                isOff: false,
                hasPTO: false,
                is_extra_shift: false
              }
            };
            
            // Store officer in map
            if (!allOfficersMap.has(officerId)) {
              allOfficersMap.set(officerId, {
                ...officerData,
                weeklySchedule: {}
              });
            }
            
            officers.push(officerData);
          });
          
          // ADD DEFAULT ASSIGNMENTS for officers not already scheduled
          if (allDefaultAssignments) {
            allDefaultAssignments.forEach(defaultAssignment => {
              const officerId = defaultAssignment.officer_id;
              
              if (processedOfficers.has(officerId)) return;
              
              if (defaultAssignment.day_of_week === dayOfWeek) {
                processedOfficers.add(officerId);
                
                const profile = defaultAssignment.profiles || {};
                const defaultOfficerData = {
                  officerId: officerId,
                  officerName: profile.full_name || "Unknown",
                  badgeNumber: profile.badge_number || "9999",
                  rank: profile.rank || "Officer",
                  hire_date: profile.hire_date,
                  service_credit: serviceCreditsMap.get(officerId) || 0,
                  date: dateStr,
                  dayOfWeek: dayOfWeek,
                  scheduleType: "default",
                  isDefaultAssignment: true,
                  shiftInfo: {
                    scheduleType: "default",
                    position: defaultAssignment.position_name || "Default Assignment",
                    isDefaultAssignment: true,
                    isOff: false,
                    hasPTO: false,
                    is_extra_shift: false
                  }
                };
                
                if (!allOfficersMap.has(officerId)) {
                  allOfficersMap.set(officerId, {
                    ...defaultOfficerData,
                    weeklySchedule: {}
                  });
                }
                
                officers.push(defaultOfficerData);
              }
            });
          }
          
          return {
            date: dateStr,
            dayOfWeek: dayOfWeek,
            officers: officers,
            isCurrentMonth: activeView === "monthly" ? isSameMonth(date, currentMonth) : true
          };
        });
    
        console.log('✅ Desktop schedule data fetched:', {
          dates: dates.length,
          dailySchedules: dailySchedules.length,
          totalOfficers: dailySchedules.reduce((sum, day) => sum + day.officers.length, 0),
          uniqueOfficers: allOfficersMap.size,
          defaultAssignmentsApplied: dailySchedules.reduce((sum, day) => 
            sum + day.officers.filter((o: any) => o.isDefaultAssignment).length, 0
          )
        });
    
        return {
          dailySchedules,
          dates,
          recurring: recurringSchedules || [],
          exceptions: exceptions || [],
          startDate: startStr,
          endDate: endStr,
          minimumStaffing,
          officerProfiles: allOfficersMap,
          allOfficers: Array.from(allOfficersMap.values())
        };
    
      } catch (error) {
        console.error('❌ Desktop schedule query error:', error);
        throw error;
      }
    },
    enabled: !!selectedShiftId && (activeView === "weekly" || activeView === "monthly"),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
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

  // Helper function to invalidate schedule queries
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
      
      // Invalidate default assignments query
      queryClient.invalidateQueries({ 
        queryKey: ['all-default-assignments', selectedShiftId],
        refetchType: 'all'
      });
      
      console.log('✅ Cache invalidated for schedule queries');
    } catch (error) {
      console.error('❌ Error invalidating schedule queries:', error);
    }
  };

  // PTO Assignment Handler
  const handleAssignPTO = (schedule: any, date: string, officerId: string, officerName: string) => {
    console.log('🎯 handleAssignPTO called (desktop):', { schedule, date, officerId, officerName });
    
    const currentShift = shiftTypes?.find(shift => shift.id === selectedShiftId);
    const shiftStartTime = currentShift?.start_time || "08:00";
    const shiftEndTime = currentShift?.end_time || "17:00";
    
    setSelectedOfficerForPTO({
      id: officerId,
      name: officerName,
      date: date,
      schedule: schedule,
      shiftStartTime: shiftStartTime,
      shiftEndTime: shiftEndTime
    });
    setPtoDialogOpen(true);
  };

  // Helper function to get PTO column name
  const getPTOColumn = (ptoType: string): string | null => {
    const ptoTypes = {
      'vacation': 'vacation_hours',
      'sick': 'sick_hours',
      'holiday': 'holiday_hours',
      'comp': 'comp_time_hours',
      'other': 'other_pto_hours'
    };
    return ptoTypes[ptoType as keyof typeof ptoTypes] || null;
  };

  // Helper function to calculate hours used
  const calculateHoursUsed = (startTime: string, endTime: string): number => {
    try {
      const [startHour, startMin] = startTime.split(":").map(Number);
      const [endHour, endMin] = endTime.split(":").map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      return (endMinutes - startMinutes) / 60;
    } catch (error) {
      console.error('Error calculating hours:', error);
      return 8;
    }
  };

  const handleSavePTO = async (ptoData: any) => {
    console.log('💾 Saving PTO for:', selectedOfficerForPTO?.name);
  
    if (!selectedOfficerForPTO || !selectedShiftId) {
      toast.error("Missing required information");
      return;
    }
  
    try {
      toast.loading("Assigning PTO...");
  
      const startTime = ptoData.isFullShift 
        ? (ptoData.startTime || "00:00") 
        : ptoData.startTime;
      
      const endTime = ptoData.isFullShift 
        ? (ptoData.endTime || "23:59") 
        : ptoData.endTime;
  
      // Use formatLocalDate to prevent timezone issues
      const dateStr = formatLocalDate(new Date(selectedOfficerForPTO.date));
  
      const { data: existingExceptions } = await supabase
        .from("schedule_exceptions")
        .select("id")
        .eq("officer_id", selectedOfficerForPTO.id)
        .eq("date", dateStr)
        .eq("shift_type_id", selectedShiftId);
  
      if (existingExceptions && existingExceptions.length > 0) {
        await supabase
          .from("schedule_exceptions")
          .update({
            is_off: true,
            reason: ptoData.ptoType,
            custom_start_time: ptoData.isFullShift ? null : startTime,
            custom_end_time: ptoData.isFullShift ? null : endTime,
          })
          .eq("id", existingExceptions[0].id);
      } else {
        await supabase
          .from("schedule_exceptions")
          .insert({
            officer_id: selectedOfficerForPTO.id,
            date: dateStr,
            shift_type_id: selectedShiftId,
            is_off: true,
            reason: ptoData.ptoType,
            custom_start_time: ptoData.isFullShift ? null : startTime,
            custom_end_time: ptoData.isFullShift ? null : endTime,
          });
      }
  
      if (websiteSettings?.show_pto_balances) {
        const ptoColumn = getPTOColumn(ptoData.ptoType);
        if (ptoColumn) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", selectedOfficerForPTO.id)
            .single();
  
          if (profile) {
            let hoursUsed = 8;
            if (!ptoData.isFullShift) {
              hoursUsed = calculateHoursUsed(startTime, endTime);
            }
            
            const currentBalance = profile[ptoColumn as keyof typeof profile] as number || 0;
            
            await supabase
              .from("profiles")
              .update({
                [ptoColumn]: Math.max(0, currentBalance - hoursUsed),
              })
              .eq("id", selectedOfficerForPTO.id);
          }
        }
      }
  
      auditLogger.logPTOAssignment(
        selectedOfficerForPTO.id,
        ptoData.ptoType,
        dateStr,
        userEmail,
        `Assigned ${ptoData.ptoType} PTO`
      );
  
      setPtoDialogOpen(false);
      setSelectedOfficerForPTO(null);
      invalidateScheduleQueries();
      
      toast.success(`${ptoData.ptoType} PTO assigned successfully`);
  
    } catch (error: any) {
      toast.error(error.message || "Failed to assign PTO");
      console.error('PTO assignment error:', error);
    } finally {
      toast.dismiss();
    }
  };

  const handleRemovePTO = async (schedule: ShiftInfo, date: string, officerId: string) => {
    console.log('🔄 Removing PTO:', { schedule, date, officerId });
    
    if (!schedule?.ptoData?.id) {
      toast.error("Cannot remove PTO: Missing PTO data");
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
  
    // Use parseLocalDate to ensure correct date
    const formattedDate = date;
  
    const ptoMutationData = {
      id: schedule.ptoData.id,
      officerId: officerId,
      date: formattedDate,
      shiftTypeId: schedule.shift?.id || schedule.ptoData.shiftTypeId || selectedShiftId,
      ptoType: schedule.ptoData.ptoType || "PTO",
      startTime: schedule.ptoData.startTime || schedule.shift?.start_time || "00:00",
      endTime: schedule.ptoData.endTime || schedule.shift?.end_time || "23:59"
    };
  
    safeRemovePTOMutation.mutate(ptoMutationData, {
      onSuccess: () => {
        invalidateScheduleQueries();
        
        try {
          auditLogger.logPTORemoval(
            officerId,
            ptoMutationData.ptoType,
            formattedDate,
            userEmail,
            `Removed ${ptoMutationData.ptoType} PTO for ${officerName} on ${formattedDate}`
          );
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

  const handleEditAssignment = (officer: any, dateStr: string) => {
    console.log('=== EDIT ASSIGNMENT CLICKED (desktop) ===');
    
    const officerId = officer?.officerId || officer?.officer_id || officer?.id;
    const officerName = officer?.officerName || officer?.full_name || "Unknown Officer";
    
    const isNewAssignment = !officer || 
                           !officer.shiftInfo || 
                           !officer.shiftInfo.scheduleId ||
                           officer.shiftInfo.scheduleId === 'new' ||
                           officer.shiftInfo.scheduleType === 'new' ||
                           officer.scheduleType === 'default';
    
    const officerData = {
      ...officer,
      officerId: officerId,
      officerName: officerName,
      shiftInfo: {
        ...officer?.shiftInfo,
        currentPosition: officer?.shiftInfo?.position || '',
        scheduleId: isNewAssignment ? 'new' : officer?.shiftInfo?.scheduleId,
        scheduleType: isNewAssignment ? 'new' : officer?.shiftInfo?.scheduleType,
        isOff: false
      }
    };
    
    setEditingAssignment({ 
      officer: officerData, 
      dateStr,
      shiftTypeId: selectedShiftId,
      officerId: officerId,
      officerName: officerName
    });
    setAssignmentDialogOpen(true);
  };

  const handleSaveAssignment = async (assignmentData: any) => {
    console.log('💾 [Desktop] Saving assignment:', assignmentData);
    
    if (!assignmentData.officerId || !assignmentData.date) {
      toast.error("Missing required information");
      return;
    }
    
    try {
      toast.loading("Saving assignment...");
      
      const { data: existingExceptions } = await supabase
        .from("schedule_exceptions")
        .select("id")
        .eq("officer_id", assignmentData.officerId)
        .eq("date", assignmentData.date)
        .eq("shift_type_id", selectedShiftId);
      
      if (existingExceptions && existingExceptions.length > 0) {
        const { error } = await supabase
          .from("schedule_exceptions")
          .update({
            position_name: assignmentData.positionName,
            unit_number: assignmentData.unitNumber || null,
            notes: assignmentData.notes || null,
            is_off: false,
            is_extra_shift: assignmentData.isExtraShift || false
          })
          .eq("id", existingExceptions[0].id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("schedule_exceptions")
          .insert({
            officer_id: assignmentData.officerId,
            date: assignmentData.date,
            shift_type_id: selectedShiftId,
            position_name: assignmentData.positionName,
            unit_number: assignmentData.unitNumber || null,
            notes: assignmentData.notes || null,
            is_off: false,
            is_extra_shift: assignmentData.isExtraShift || false
          });
        
        if (error) throw error;
      }
      
      invalidateScheduleQueries();
      
      auditLogger.logPositionChange(
        assignmentData.officerId,
        editingAssignment?.officerName || "Unknown",
        editingAssignment?.officer?.shiftInfo?.position || 'None',
        assignmentData.positionName,
        userEmail,
        `Updated assignment on desktop`
      );
      
      setEditingAssignment(null);
      setAssignmentDialogOpen(false);
      toast.success("Assignment saved successfully");
      
    } catch (error: any) {
      console.error('❌ Error saving assignment:', error);
      toast.error(error.message || "Failed to save assignment");
    } finally {
      toast.dismiss();
    }
  };

  const handleRemoveOfficer = (scheduleId: string, type: 'recurring' | 'exception', officerData?: any) => {
    safeRemoveOfficerMutation.mutate({
      scheduleId,
      type,
      officerData
    }, {
      onSuccess: () => {
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

  // Prepare common props for view components
  const viewProps = {
    currentDate: activeView === "weekly" ? currentWeekStart : currentMonth,
    selectedShiftId,
    schedules: schedules || null,
    shiftTypes: shiftTypes || [],
    isAdminOrSupervisor,
    weeklyColors,
    currentWeekStart: currentWeekStart,
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
      updatePositionMutation,
    },
    navigateToDailySchedule,
    getLastName,
    getRankAbbreviation,
    getRankPriority,
    isSupervisorByRank,
    officerProfiles: schedules?.officerProfiles || new Map(),
    refetchScheduleData: invalidateScheduleQueries,
    getMinimumStaffing: (dayOfWeek: number) => {
      if (!schedules?.minimumStaffing) {
        return { minimumOfficers: 0, minimumSupervisors: 0 };
      }
      
      if (schedules.minimumStaffing instanceof Map) {
        const dayStaffing = schedules.minimumStaffing.get(dayOfWeek);
        if (dayStaffing instanceof Map) {
          const shiftStaffing = dayStaffing.get(selectedShiftId);
          return shiftStaffing || { minimumOfficers: 0, minimumSupervisors: 0 };
        }
      }
      
      return { minimumOfficers: 0, minimumSupervisors: 0 };
    }
  };

  const renderView = () => {
    switch (activeView) {
      case "weekly":
        return <WeeklyView 
          {...viewProps}
          schedules={{
            ...schedules,
            dailySchedules: schedules?.dailySchedules || [],
            minimumStaffing: schedules?.minimumStaffing || new Map()
          }}
          refetchScheduleData={invalidateScheduleQueries}
        />;
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
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => queryClient.invalidateQueries({ queryKey: scheduleQueryKey })}
          >
            Retry Loading
          </Button>
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

      {/* Assignment Edit Dialog */}
      <AssignmentEditDialogMobile
        open={assignmentDialogOpen}
        onOpenChange={setAssignmentDialogOpen}
        editingAssignment={editingAssignment}
        onClose={() => {
          setEditingAssignment(null);
          setAssignmentDialogOpen(false);
        }}
        onSave={handleSaveAssignment}
        isUpdating={updatePositionMutation.isPending}
      />

      {/* PTO Dialog */}
      {selectedOfficerForPTO && (
        <PTODialogMobile
          open={ptoDialogOpen}
          onOpenChange={(open) => {
            setPtoDialogOpen(open);
            if (!open) {
              setSelectedOfficerForPTO(null);
            }
          }}
          officerName={selectedOfficerForPTO.name}
          date={selectedOfficerForPTO.date}
          officerId={selectedOfficerForPTO.id}
          shiftTypeId={selectedShiftId}
          shiftStartTime={selectedOfficerForPTO.shiftStartTime}
          shiftEndTime={selectedOfficerForPTO.shiftEndTime}
          onSave={handleSavePTO}
          onSuccess={() => {
            setPtoDialogOpen(false);
            setSelectedOfficerForPTO(null);
          }}
          isUpdating={false}
        />
      )}

      <ScheduleExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        selectedShiftId={selectedShiftId}
        shiftTypes={shiftTypes || []}
        activeView={activeView}
        userEmail={userEmail}
      />
    </>
  );
};

export default TheBook;
