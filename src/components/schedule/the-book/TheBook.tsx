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
import { AssignmentEditDialog } from "./AssignmentEditDialog";

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
  queryKey
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

  // Main schedule query - UPDATED to return proper data structure
  const { data: schedules, isLoading: schedulesLoading, error } = useQuery({
    queryKey: ['schedule-data', activeView, selectedShiftId, currentWeekStart.toISOString(), currentMonth.toISOString()],
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

      // Get officer profiles separately
      const officerIds = [...new Set(exceptionsData?.map(e => e.officer_id).filter(Boolean))];
      let officerProfiles = [];
      if (officerIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, badge_number, rank, hire_date")
          .in("id", officerIds);
        officerProfiles = profilesData || [];
      }

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
      const allOfficerIds = [
        ...(recurringData?.map(r => r.officer_id) || []),
        ...officerIds
      ];
      const uniqueOfficerIds = [...new Set(allOfficerIds)];
      const serviceCredits = await fetchServiceCredits(uniqueOfficerIds);

      // Combine exception data
      const combinedExceptions = exceptionsData?.map(exception => ({
        ...exception,
        profiles: officerProfiles.find(p => p.id === exception.officer_id),
        shift_types: exceptionShiftTypes.find(s => s.id === exception.shift_type_id)
      })) || [];

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
                  officerName: recurring.profiles?.full_name || "Unknown",
                  badgeNumber: recurring.profiles?.badge_number,
                  rank: recurring.profiles?.rank,
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

        const ptoException = combinedExceptions?.find(e => 
          e.officer_id === exception.officer_id && e.date === exception.date && e.is_off
        );
        const defaultAssignment = getDefaultAssignment(exception.officer_id, exception.date);
        const isRegularDay = recurringSchedulesByOfficer.get(exception.officer_id)?.has(parseISO(exception.date).getDay()) || false;

        scheduleByDateAndOfficer[exception.date][exception.officer_id] = {
          officerId: exception.officer_id,
          officerName: exception.profiles?.full_name || "Unknown",
          badgeNumber: exception.profiles?.badge_number,
          rank: exception.profiles?.rank,
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
          scheduleByDateAndOfficer[ptoException.date][ptoException.officer_id] = {
            officerId: ptoException.officer_id,
            officerName: ptoException.profiles?.full_name || "Unknown",
            badgeNumber: ptoException.profiles?.badge_number,
            rank: ptoException.profiles?.rank,
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

      return { 
        dailySchedules, 
        dates,
        recurring: recurringData || [],
        exceptions: combinedExceptions,
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
        minimumStaffing
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

// Event handlers
const handleEditAssignment = (officer: any, dateStr: string) => {
  // Log the officer object to see its structure
  console.log('=== EDIT ASSIGNMENT CLICKED ===');
  console.log('Officer object:', officer);
  console.log('Officer keys:', Object.keys(officer || {}));
  console.log('Date:', dateStr);
  
  // Check for officer ID in various locations
  const officerId = officer?.officerId || officer?.officer_id || officer?.id;
  console.log('Found officerId:', officerId);
  
  setEditingAssignment({ 
    officer: {
      ...officer,
      // Ensure we have the ID
      officerId: officerId
    }, 
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
  
  // Note: The actual PTO assignment logging should happen in the PTO dialog's save handler
  // not here. This function just opens the dialog.
};

// In TheBook.tsx - Replace the handleRemovePTO function with this:

const handleRemovePTO = async (schedule: ShiftInfo, date: string, officerId: string) => {
  console.log('🔄 Removing PTO from MonthlyView:', { schedule, date, officerId });
  
  // Check if we have the required data
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

  // Get officer name from schedule data for audit logging
  let officerName = "Unknown Officer";
  try {
    // Try to find the officer in the current schedule data
    const daySchedule = schedules?.dailySchedules?.find(s => s.date === date);
    if (daySchedule) {
      const officerData = daySchedule.officers.find((o: any) => o.officerId === officerId);
      officerName = officerData?.officerName || officerName;
    }
  } catch (error) {
    console.error("Error getting officer name:", error);
  }

  // Prepare the data for the mutation
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

  removePTOMutation.mutate(ptoMutationData, {
    onSuccess: () => {
      // AUDIT LOGGING - Use the correct method from your audit logger
      try {
        // Use logPTORemoval which exists in your audit logger
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
        // Fallback to console logging
        console.log('PTO removed (audit logging failed):', {
          officerId,
          officerName,
          date,
          ptoType: ptoMutationData.ptoType,
          user: userEmail
        });
      }
      
      toast.success(`PTO (${ptoMutationData.ptoType}) removed successfully`);
    },
    onError: (error) => {
      console.error('❌ Error removing PTO:', error);
      toast.error(`Failed to remove PTO: ${error.message}`);
    }
  });
};

// In TheBook.tsx - Update the onSuccess callback in handleSaveAssignment:

const handleSaveAssignment = () => {
  if (!editingAssignment) return;

  const { officer, dateStr } = editingAssignment;
  
  // DEBUG: Log the officer object to confirm structure
  console.log('Officer object in handleSaveAssignment:', officer);
  
  // Extract officer ID - try multiple possibilities
  const officerId = officer?.officerId || 
                    officer?.officer_id || 
                    officer?.id ||
                    'unknown-id';
  
  const officerName = officer?.officerName || 
                      officer?.full_name || 
                      officer?.profiles?.full_name ||
                      'Unknown Officer';
  
  const currentPosition = officer?.shiftInfo?.position || '';
  
  console.log('Extracted values:', { officerId, officerName, currentPosition });
  
  if (!officerId || officerId === 'unknown-id') {
    console.error('Could not find officer ID in:', officer);
    toast.error("Cannot save: Officer ID not found");
    return;
  }
  
  updatePositionMutation.mutate({
    scheduleId: officer.shiftInfo?.scheduleId,
    type: officer.shiftInfo?.scheduleType,
    positionName: officer.shiftInfo?.position,
    date: dateStr,
    officerId: officerId,
    shiftTypeId: selectedShiftId,
    currentPosition: currentPosition
  }, {
    onSuccess: () => {
      // AUDIT LOGGING - Use logPositionChange which exists in your audit logger
      try {
        auditLogger.logPositionChange(
          officerId,
          officerName,
          currentPosition,
          officer.shiftInfo?.position || currentPosition,
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
      console.error('Error updating assignment:', error);
      toast.error("Failed to update assignment");
    }
  });
};

const handleRemoveOfficer = (scheduleId: string, type: 'recurring' | 'exception', officerData?: any) => {
  removeOfficerMutation.mutate({
    scheduleId,
    type,
    officerData
  }, {
    onSuccess: () => {
      if (officerData) {
        // AUDIT LOGGING - Log officer removal
        // Extract officer ID safely
        const officerId = officerData?.officerId || officerData?.officer_id || officerData?.id;
        const officerName = officerData?.officerName || officerData?.full_name || 'Unknown Officer';
        
        auditLogger.logOfficerRemoval(
          officerId,
          officerName,
          userEmail,
          `Removed ${officerName} from schedule`
        );
      }
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
  onDateChange: (date: Date) => { // Add this callback
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
    removeOfficerMutation: safeRemoveOfficerMutation,  // Use the safe version
    removePTOMutation: safeRemovePTOMutation,          // Use the safe version
  },
  navigateToDailySchedule,
  getLastName,
  getRankAbbreviation,
  getRankPriority,
  isSupervisorByRank,
};

// In TheBook.tsx - Update the renderView function
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
        isAdminOrSupervisor={isAdminOrSupervisor} // ADD THIS
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
      {/* Your existing desktop JSX - KEEP EVERYTHING EXACTLY AS IS */}
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
          
          {/* Tabs for different views */}
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

    {/* Dialogs - Keep these outside so they work for both */}
    <AssignmentEditDialog
      editingAssignment={editingAssignment}
      onClose={() => setEditingAssignment(null)}
      onSave={handleSaveAssignment}
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
            queryClient.invalidateQueries({ queryKey });
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
