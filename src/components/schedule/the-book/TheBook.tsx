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

// Import view components
import { WeeklyView } from "./WeeklyView";
import { MonthlyView } from "./MonthlyView";
import { ForceListView } from "./ForceListView";
import { VacationListView } from "./VacationListView";
import { BeatPreferencesView } from "./BeatPreferencesView";
import { ScheduleExportDialog } from "./ScheduleExportDialog";
import { AssignmentEditDialogMobile } from "./AssignmentEditDialogMobile";
import { PTODialogMobile } from "./PTODialogMobile";

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

// In TheBook.tsx, REPLACE the entire schedule query (lines ~245-510) with:

// Main schedule query - SIMPLIFIED version that matches mobile
const { data: schedules, isLoading: schedulesLoading, error } = useQuery({
  queryKey: ['schedule-data', activeView, selectedShiftId, currentWeekStart.toISOString(), currentMonth.toISOString()],
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

      // Organize data by day for WeeklyView
      const dailySchedules = dates.map(dateStr => {
        const date = parseISO(dateStr);
        const dayOfWeek = date.getDay();
        
        // Get exceptions for this day
        const dayExceptions = exceptions?.filter(e => e.date === dateStr) || [];
        const dayRecurring = recurringSchedules?.filter(r => r.day_of_week === dayOfWeek) || [];
        
        const officers = [];
        const processedOfficers = new Set();
        
        // Process exceptions first (they override recurring)
        dayExceptions.forEach(exception => {
          const officerId = exception.officer_id;
          processedOfficers.add(officerId);
          
          const profile = exception.profiles || {};
          officers.push({
            officerId: officerId,
            officerName: profile.full_name || "Unknown",
            badgeNumber: profile.badge_number || "9999",
            rank: profile.rank || "Officer",
            hire_date: profile.hire_date,
            promotion_date_sergeant: profile.promotion_date_sergeant,
            promotion_date_lieutenant: profile.promotion_date_lieutenant,
            service_credit_override: profile.service_credit_override || 0,
            date: dateStr,
            dayOfWeek: dayOfWeek,
            scheduleType: "exception",
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
          });
        });
        
        // Process recurring schedules that weren't overridden by exceptions
        dayRecurring.forEach(recurring => {
          const officerId = recurring.officer_id;
          if (processedOfficers.has(officerId)) return; // Skip if already processed
          
          const profile = recurring.profiles || {};
          officers.push({
            officerId: officerId,
            officerName: profile.full_name || "Unknown",
            badgeNumber: profile.badge_number || "9999",
            rank: profile.rank || "Officer",
            hire_date: profile.hire_date,
            promotion_date_sergeant: profile.promotion_date_sergeant,
            promotion_date_lieutenant: profile.promotion_date_lieutenant,
            service_credit_override: profile.service_credit_override || 0,
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
          });
        });
        
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
        totalOfficers: dailySchedules.reduce((sum, day) => sum + day.officers.length, 0)
      });

      return {
        dailySchedules,
        dates,
        recurring: recurringSchedules || [],
        exceptions: exceptions || [],
        startDate: startStr,
        endDate: endStr,
        minimumStaffing
      };

    } catch (error) {
      console.error('❌ Desktop schedule query error:', error);
      throw error;
    }
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
      
      console.log('✅ Cache invalidated for schedule queries');
    } catch (error) {
      console.error('❌ Error invalidating schedule queries:', error);
    }
  };

  // FIXED: PTO Assignment Handler (simplified like mobile)
  const handleAssignPTO = (schedule: any, date: string, officerId: string, officerName: string) => {
    console.log('🎯 handleAssignPTO called (desktop):', { schedule, date, officerId, officerName });
    
    // Get the current shift times (like mobile does)
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

  // Helper function to get PTO column name (like mobile)
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

  // Helper function to calculate hours used (like mobile)
  const calculateHoursUsed = (startTime: string, endTime: string): number => {
    try {
      const [startHour, startMin] = startTime.split(":").map(Number);
      const [endHour, endMin] = endTime.split(":").map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      return (endMinutes - startMinutes) / 60;
    } catch (error) {
      console.error('Error calculating hours:', error);
      return 8; // Default to 8 hours
    }
  };

// SIMPLIFIED handleSavePTO in TheBook.tsx
const handleSavePTO = async (ptoData: any) => {
  console.log('💾 Saving PTO for:', selectedOfficerForPTO?.name);

  if (!selectedOfficerForPTO || !selectedShiftId) {
    toast.error("Missing required information");
    return;
  }

  try {
    toast.loading("Assigning PTO...");

    // Prepare PTO data
    const startTime = ptoData.isFullShift 
      ? (ptoData.startTime || "00:00") 
      : ptoData.startTime;
    
    const endTime = ptoData.isFullShift 
      ? (ptoData.endTime || "23:59") 
      : ptoData.endTime;

    // Create or update PTO exception
    const { data: existingExceptions } = await supabase
      .from("schedule_exceptions")
      .select("id")
      .eq("officer_id", selectedOfficerForPTO.id)
      .eq("date", selectedOfficerForPTO.date)
      .eq("shift_type_id", selectedShiftId);

    if (existingExceptions && existingExceptions.length > 0) {
      // Update existing
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
      // Create new
      await supabase
        .from("schedule_exceptions")
        .insert({
          officer_id: selectedOfficerForPTO.id,
          date: selectedOfficerForPTO.date,
          shift_type_id: selectedShiftId,
          is_off: true,
          reason: ptoData.ptoType,
          custom_start_time: ptoData.isFullShift ? null : startTime,
          custom_end_time: ptoData.isFullShift ? null : endTime,
        });
    }

    // Handle PTO balance if enabled
    if (websiteSettings?.show_pto_balances) {
      const ptoColumn = getPTOColumn(ptoData.ptoType);
      if (ptoColumn) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", selectedOfficerForPTO.id)
          .single();

        if (profile) {
          let hoursUsed = 8; // Default
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

    // Log audit
    auditLogger.logPTOAssignment(
      selectedOfficerForPTO.id,
      ptoData.ptoType,
      selectedOfficerForPTO.date,
      userEmail,
      `Assigned ${ptoData.ptoType} PTO`
    );

    // CRITICAL: Close dialog FIRST
    setPtoDialogOpen(false);
    setSelectedOfficerForPTO(null);

    // Then invalidate and show success
    queryClient.invalidateQueries({ queryKey: scheduleQueryKey });
    
    toast.success(`${ptoData.ptoType} PTO assigned successfully`);

  } catch (error: any) {
    toast.error(error.message || "Failed to assign PTO");
    console.error('PTO assignment error:', error);
  } finally {
    toast.dismiss();
  }
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

    // Call the mutation
    safeRemovePTOMutation.mutate(ptoMutationData, {
      onSuccess: () => {
        // Force cache invalidation
        invalidateScheduleQueries();
        
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

// FIXED: Assignment Edit Handler - properly detects new assignments
const handleEditAssignment = (officer: any, dateStr: string) => {
  console.log('=== EDIT ASSIGNMENT CLICKED (desktop) ===');
  console.log('Full officer object:', officer);
  console.log('Officer shiftInfo:', officer?.shiftInfo);
  console.log('Date:', dateStr);
  
  const officerId = officer?.officerId || officer?.officer_id || officer?.id;
  const officerName = officer?.officerName || officer?.full_name || "Unknown Officer";
  
  console.log('Found officerId:', officerId);
  console.log('Found officerName:', officerName);
  
  // Check if this is a NEW assignment (no scheduleId or no officer data at all)
  const isNewAssignment = !officer || 
                         !officer.shiftInfo || 
                         !officer.shiftInfo.scheduleId ||
                         officer.shiftInfo.scheduleId === 'new' ||
                         officer.shiftInfo.scheduleType === 'new';
  
  console.log('Is this a new assignment?', isNewAssignment);
  
  // Prepare officer data for editing
  const officerData = {
    ...officer,
    officerId: officerId,
    officerName: officerName,
    shiftInfo: {
      ...officer?.shiftInfo,
      currentPosition: officer?.shiftInfo?.position || '',
      // For new assignments, ensure proper defaults
      scheduleId: isNewAssignment ? 'new' : officer?.shiftInfo?.scheduleId,
      scheduleType: isNewAssignment ? 'new' : officer?.shiftInfo?.scheduleType,
      isOff: false // CRITICAL: New assignments should NOT be "off"
    }
  };
  
  console.log('Prepared officer data for editing:', officerData);
  
  setEditingAssignment({ 
    officer: officerData, 
    dateStr,
    shiftTypeId: selectedShiftId,
    officerId: officerId,
    officerName: officerName
  });
};

// FIXED: Save Assignment Handler (handles new assignments properly)
// In TheBook.tsx, REPLACE the handleSaveAssignment function (lines ~850-920) with:

// SIMPLIFIED: Save Assignment Handler
const handleSaveAssignment = async (assignmentData: any) => {
  console.log('💾 [Desktop] Saving assignment:', assignmentData);
  
  if (!assignmentData.officerId || !assignmentData.date) {
    toast.error("Missing required information");
    return;
  }
  
  try {
    toast.loading("Saving assignment...");
    
    // Check if this is a new assignment
    const { data: existingExceptions } = await supabase
      .from("schedule_exceptions")
      .select("id")
      .eq("officer_id", assignmentData.officerId)
      .eq("date", assignmentData.date)
      .eq("shift_type_id", selectedShiftId);
    
    let result;
    
    if (existingExceptions && existingExceptions.length > 0) {
      // Update existing exception
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
      result = { id: existingExceptions[0].id, updated: true };
    } else {
      // Create new exception
      const { data, error } = await supabase
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
        })
        .select("id")
        .single();
      
      if (error) throw error;
      result = { id: data.id, updated: false };
    }
    
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ 
      queryKey: scheduleQueryKey,
      refetchType: 'all'
    });
    
    // Log audit
    auditLogger.logPositionChange(
      assignmentData.officerId,
      editingAssignment?.officerName || "Unknown",
      editingAssignment?.officer?.shiftInfo?.position || 'None',
      assignmentData.positionName,
      userEmail,
      `Updated assignment on desktop`
    );
    
    setEditingAssignment(null);
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

  // Prepare common props for view components
// In TheBook.tsx, update the viewProps object (lines ~950-970):

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
  // ADD these missing props that WeeklyView expects:
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

      {/* FIXED: Assignment Edit Dialog (same as mobile) */}
      <AssignmentEditDialogMobile
        editingAssignment={editingAssignment}
        onClose={() => setEditingAssignment(null)}
        onSave={handleSaveAssignment}
        isUpdating={updatePositionMutation.isPending}
      />

      {/* FIXED: PTO Dialog (same as mobile) */}
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
    // This will be called after successful save
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
