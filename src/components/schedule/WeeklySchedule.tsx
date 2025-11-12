// components/schedule/WeeklySchedule.tsx - REFACTORED VERSION WITH PDF EXPORT
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Grid, Download, CalendarRange } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays, addWeeks, subWeeks, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay, isSameMonth, parseISO, eachWeekOfInterval, addYears, subYears } from "date-fns";
import { toast } from "sonner";
import { PREDEFINED_POSITIONS, RANK_ORDER } from "@/constants/positions";
import { ScheduleCell } from "./ScheduleCell";
import { useWeeklyScheduleMutations } from "@/hooks/useWeeklyScheduleMutations";
import { useWeeklyPDFExport } from "@/hooks/useWeeklyPDFExport";
import { PTOAssignmentDialog } from "./PTOAssignmentDialog";
import { 
  getLastName, 
  categorizeAndSortOfficers,
  calculateStaffingCounts
} from "@/utils/scheduleUtils";
import { cn } from "@/lib/utils";

interface WeeklyScheduleProps {
  userRole?: 'officer' | 'supervisor' | 'admin';
  isAdminOrSupervisor?: boolean;
}

interface ExportOptions {
  startDate: Date;
  endDate: Date;
  shiftName: string;
  scheduleData: any[];
}

const WeeklySchedule = ({ 
  userRole = 'officer', 
  isAdminOrSupervisor = false 
}: WeeklyScheduleProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeView, setActiveView] = useState<"weekly" | "monthly">("weekly");
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<{ officer: any; dateStr: string } | null>(null);
  const [editPosition, setEditPosition] = useState("");
  const [customPosition, setCustomPosition] = useState("");
  const [ptoDialogOpen, setPtoDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>({
    from: startOfWeek(new Date(), { weekStartsOn: 0 }),
    to: addWeeks(startOfWeek(new Date(), { weekStartsOn: 0 }), 4) // Default 4 weeks
  });

  // Use consolidated mutations hook
  const {
    updatePositionMutation,
    removeOfficerMutation,
    removePTOMutation,
    queryKey
  } = useWeeklyScheduleMutations(currentWeekStart, currentMonth, activeView, selectedShiftId);

  const { exportWeeklyPDF } = useWeeklyPDFExport();

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
    enabled: !!selectedShiftId,
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

// UPDATED handleExportPDF function for WeeklySchedule.tsx
// Replace your existing handleExportPDF function with this:

const handleExportPDF = async () => {
  if (!dateRange?.from || !dateRange?.to) {
    toast.error("Please select a date range");
    return;
  }

  if (!selectedShiftId) {
    toast.error("Please select a shift");
    return;
  }

  try {
    toast.info("Generating PDF export...");
    
    const startDate = dateRange.from;
    const endDate = dateRange.to;
    
    const dates = eachDayOfInterval({ start: startDate, end: endDate }).map(date => 
      format(date, "yyyy-MM-dd")
    );

    // Fetch schedule data for the date range
    const scheduleDataResponse = await fetchScheduleDataForRange(startDate, endDate, dates);
    
    const shiftName = shiftTypes?.find(s => s.id === selectedShiftId)?.name || "Unknown Shift";
    
    // Use the appropriate export hook based on active view
    if (activeView === "weekly") {
      // Dynamically import the weekly PDF export hook
      const { useWeeklyPDFExport } = await import("@/hooks/useWeeklyPDFExport");
      const { exportWeeklyPDF } = useWeeklyPDFExport();
      
      const result = await exportWeeklyPDF({
        startDate,
        endDate,
        shiftName,
        scheduleData: scheduleDataResponse.dailySchedules || [],
        viewType: "weekly",
        minimumStaffing: schedules?.minimumStaffing, // Pass minimum staffing
        selectedShiftId
      });

      if (result.success) {
        toast.success("Weekly PDF exported successfully");
        setExportDialogOpen(false);
      } else {
        toast.error("Failed to export weekly PDF");
      }
    } else {
      // Monthly view - use the monthly export hook
      const { useMonthlyPDFExport } = await import("@/hooks/useMonthlyPDFExport");
      const { exportMonthlyPDF } = useMonthlyPDFExport();
      
      const result = await exportMonthlyPDF({
        month: startDate, // For monthly, we use the start of the range as the month
        shiftName,
        scheduleData: scheduleDataResponse.dailySchedules || [],
        minimumStaffing: schedules?.minimumStaffing,
        selectedShiftId
      });

      if (result.success) {
        toast.success("Monthly PDF exported successfully");
        setExportDialogOpen(false);
      } else {
        toast.error("Failed to export monthly PDF");
      }
    }
  } catch (error) {
    console.error("Export error:", error);
    toast.error("Error generating PDF export");
  }
};


  // Function to fetch schedule data for a date range - FIXED VERSION
  const fetchScheduleDataForRange = async (startDate: Date, endDate: Date, dates: string[]) => {
    try {
      // Get recurring schedules
      const { data: recurringData, error: recurringError } = await supabase
        .from("recurring_schedules")
        .select(`
          *,
          profiles:profiles!recurring_schedules_officer_id_fkey (
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

      // Process recurring schedules for the range
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

      // Process working exceptions for the range
      combinedExceptions?.filter(e => !e.is_off).forEach(exception => {
        if (!scheduleByDateAndOfficer[exception.date]) {
          scheduleByDateAndOfficer[exception.date] = {};
        }

        const ptoException = combinedExceptions?.find(e => 
          e.officer_id === exception.officer_id && e.date === exception.date && e.is_off
        );
        const defaultAssignment = getDefaultAssignment(exception.officer_id, exception.date);

        scheduleByDateAndOfficer[exception.date][exception.officer_id] = {
          officerId: exception.officer_id,
          officerName: exception.profiles?.full_name || "Unknown",
          badgeNumber: exception.profiles?.badge_number,
          rank: exception.profiles?.rank,
          service_credit: serviceCredits.get(exception.officer_id) || 0,
          date: exception.date,
          dayOfWeek: parseISO(exception.date).getDay(),
          isRegularRecurringDay: false,
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

      // Convert to array format
      const dailySchedules = dates.map(date => {
        const officers = Object.values(scheduleByDateAndOfficer[date] || {});
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
          }
        };
      });

      // FIX: Return the correct structure that matches what the export function expects
      return { 
        dailySchedules, 
        dates,
        recurring: recurringData,
        exceptions: combinedExceptions
      };
    } catch (error) {
      console.error("Error in fetchScheduleDataForRange:", error);
      throw error;
    }
  };

  // Main schedule query - UPDATED to fetch service credits AND minimum staffing
  const { data: schedules, isLoading: schedulesLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
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

      // Get recurring schedules - FIXED: Explicit relationship
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
        recurring: recurringData,
        exceptions: combinedExceptions,
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
        minimumStaffing // ADD THIS
      };
    },
    enabled: !!selectedShiftId,
  });

  // Event handlers
  const handleEditAssignment = (officer: any, dateStr: string) => {
    setEditingAssignment({ officer, dateStr });
    const currentPosition = officer.shiftInfo?.position;
    const isCustomPosition = currentPosition && !PREDEFINED_POSITIONS.includes(currentPosition);
    
    if (isCustomPosition) {
      setEditPosition("Other (Custom)");
      setCustomPosition(currentPosition);
    } else {
      setEditPosition(currentPosition || "");
      setCustomPosition("");
    }
  };

  const handleSaveAssignment = () => {
    if (!editingAssignment) return;

    const { officer, dateStr } = editingAssignment;
    const finalPosition = editPosition === "Other (Custom)" ? customPosition : editPosition;
    
    if (!finalPosition) {
      toast.error("Please select or enter a position");
      return;
    }

    updatePositionMutation.mutate({
      scheduleId: officer.shiftInfo.scheduleId,
      type: officer.shiftInfo.scheduleType,
      positionName: finalPosition,
      date: dateStr,
      officerId: officer.officerId,
      shiftTypeId: selectedShiftId,
      currentPosition: officer.shiftInfo.position
    }, {
      onSuccess: () => {
        setEditingAssignment(null);
        setEditPosition("");
        setCustomPosition("");
      }
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

  const handleRemovePTO = async (schedule: any, date: string, officerId: string) => {
    if (!schedule.hasPTO || !schedule.ptoData) return;

    try {
      let shiftTypeId = schedule.shift?.id || schedule.ptoData.shiftTypeId;
      
      if (!shiftTypeId) {
        const { data: officerSchedule } = await supabase
          .from("schedule_exceptions")
          .select("shift_type_id")
          .eq("officer_id", officerId)
          .eq("date", date)
          .eq("is_off", false)
          .single();

        if (officerSchedule?.shift_type_id) {
          shiftTypeId = officerSchedule.shift_type_id;
        } else {
          const dayOfWeek = parseISO(date).getDay();
          const { data: recurringSchedule } = await supabase
            .from("recurring_schedules")
            .select("shift_type_id")
            .eq("officer_id", officerId)
            .eq("day_of_week", dayOfWeek)
            .is("end_date", null)
            .single();

          if (recurringSchedule?.shift_type_id) {
            shiftTypeId = recurringSchedule.shift_type_id;
          }
        }
      }

      if (!shiftTypeId) {
        toast.error("Cannot remove PTO: Unable to determine shift");
        return;
      }

      removePTOMutation.mutate({
        id: schedule.ptoData.id,
        officerId,
        date,
        shiftTypeId,
        ptoType: schedule.ptoData.ptoType,
        startTime: schedule.ptoData.startTime,
        endTime: schedule.ptoData.endTime
      });
    } catch (error) {
      toast.error("Unexpected error while removing PTO");
    }
  };

  const renderExcelStyleWeeklyView = () => {
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(currentWeekStart, i);
      const dayOfWeek = date.getDay();
      return {
        date,
        dateStr: format(date, "yyyy-MM-dd"),
        dayName: format(date, "EEE").toUpperCase(),
        formattedDate: format(date, "MMM d"),
        isToday: isSameDay(date, new Date()),
        dayOfWeek: dayOfWeek
      };
    });

    const allOfficers = new Map();
    const recurringSchedulesByOfficer = new Map();

    schedules?.recurring?.forEach(recurring => {
      if (!recurringSchedulesByOfficer.has(recurring.officer_id)) {
        recurringSchedulesByOfficer.set(recurring.officer_id, new Set());
      }
      recurringSchedulesByOfficer.get(recurring.officer_id).add(recurring.day_of_week);
    });

    schedules?.dailySchedules?.forEach(day => {
      day.officers.forEach((officer: any) => {
        if (!allOfficers.has(officer.officerId)) {
          allOfficers.set(officer.officerId, {
            ...officer,
            recurringDays: recurringSchedulesByOfficer.get(officer.officerId) || new Set(),
            weeklySchedule: {} as Record<string, any>
          });
        }
        
        const daySchedule = {
          ...officer,
          isRegularRecurringDay: recurringSchedulesByOfficer.get(officer.officerId)?.has(day.dayOfWeek) || false
        };
        
        allOfficers.get(officer.officerId).weeklySchedule[day.date] = daySchedule;
      });
    });

    // Function to get rank priority using RANK_ORDER constant
    const getRankPriority = (rank: string) => {
      if (!rank) return 99; // Default to lowest priority if no rank
      
      // Find the rank in RANK_ORDER (case-insensitive)
      const rankKey = Object.keys(RANK_ORDER).find(
        key => key.toLowerCase() === rank.toLowerCase()
      );
      
      return rankKey ? RANK_ORDER[rankKey as keyof typeof RANK_ORDER] : 99;
    };

    // Function to check if officer is supervisor based on rank (not assignment)
    const isSupervisorByRank = (officer: any) => {
      const rank = officer.rank?.toLowerCase() || '';
      
      // Check if rank exists in RANK_ORDER and has a priority higher than Officer
      const rankPriority = getRankPriority(officer.rank);
      return rankPriority < RANK_ORDER.Officer; // Chiefs, Lieutenants, Sergeants are supervisors
    };

    // Categorize officers by their profile rank, not their assignment
    const supervisors = Array.from(allOfficers.values())
      .filter(o => isSupervisorByRank(o))
      .sort((a, b) => {
        const aPriority = getRankPriority(a.rank);
        const bPriority = getRankPriority(b.rank);
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority; // Lower number = higher rank
        }
        
        // If same rank, sort by last name
        return getLastName(a.officerName).localeCompare(getLastName(b.officerName));
      });

    // Separate officers into regular officers and PPOs (non-supervisors)
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

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="text-lg font-bold">
            {format(currentWeekStart, "MMM d")} - {format(addDays(currentWeekStart, 6), "MMM d, yyyy")}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToCurrentWeek}>Today</Button>
            <Button variant="outline" size="sm" onClick={goToNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mobile-scroll overflow-x-auto">
          <div className="border rounded-lg overflow-hidden min-w-[900px]">
            <div className="grid grid-cols-9 bg-muted/50 border-b">
            <div className="p-2 font-semibold border-r">Empl#</div>
            <div className="p-2 font-semibold border-r">NAME</div>
            {weekDays.map(({ dateStr, dayName, formattedDate, isToday, dayOfWeek }) => {
              const daySchedule = schedules?.dailySchedules?.find(s => s.date === dateStr);
              
              // Get minimum staffing for this day of week and shift
              const minStaffingForDay = schedules?.minimumStaffing?.get(dayOfWeek)?.get(selectedShiftId);
              const minimumOfficers = minStaffingForDay?.minimumOfficers || 0;
              const minimumSupervisors = minStaffingForDay?.minimumSupervisors || 1; // Default to 1 if not found
              
              // Helper function to check if an assignment is a special assignment
              const isSpecialAssignment = (position: string) => {
                return position && (
                  position.toLowerCase().includes('other') ||
                  (position && !PREDEFINED_POSITIONS.includes(position))
                );
              };
              
              // Calculate counts excluding full-day PTO AND special assignments
              const supervisorCount = daySchedule?.officers?.filter(officer => {
                const isSupervisor = isSupervisorByRank(officer);
                const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
                const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
                const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
                return isSupervisor && isScheduled;
              }).length || 0;

              const officerCount = daySchedule?.officers?.filter(officer => {
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
              const daySchedule = schedules?.dailySchedules?.find(s => s.date === dateStr);
              
              // Get minimum staffing from database
              const minStaffingForDay = schedules?.minimumStaffing?.get(dayOfWeek)?.get(selectedShiftId);
              const minimumSupervisors = minStaffingForDay?.minimumSupervisors || 1;
              
              // Helper function to check if an assignment is a special assignment
              const isSpecialAssignment = (position: string) => {
                return position && (
                  position.toLowerCase().includes('other') ||
                  (position && !PREDEFINED_POSITIONS.includes(position))
                );
              };
              
              // Count supervisors, excluding full-day PTO AND special assignments
              const supervisorCount = daySchedule?.officers?.filter(officer => {
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

          {supervisors.map((officer) => (
            <div key={officer.officerId} className="grid grid-cols-9 border-b hover:bg-muted/30">
              <div className="p-2 border-r text-sm font-mono">{officer.badgeNumber}</div>
              <div className="p-2 border-r font-medium">
                {getLastName(officer.officerName)}
                <div className="text-xs text-muted-foreground">{officer.rank || 'Officer'}</div>
              </div>
              {weekDays.map(({ dateStr }) => (
                <ScheduleCell
                  key={dateStr}
                  officer={officer.weeklySchedule[dateStr]}
                  dateStr={dateStr}
                  officerId={officer.officerId}
                  officerName={officer.officerName}
                  isAdminOrSupervisor={isAdminOrSupervisor}
                  onAssignPTO={handleAssignPTO}
                  onRemovePTO={handleRemovePTO}
                  onEditAssignment={handleEditAssignment}
                  onRemoveOfficer={removeOfficerMutation.mutate}
                  isUpdating={removeOfficerMutation.isPending}
                />
              ))}
            </div>
          ))}

          {/* SEPARATION ROW WITH OFFICER COUNT (EXCLUDING PPOS) */}
          <div className="grid grid-cols-9 border-b bg-muted/30">
            <div className="p-2 border-r"></div>
            <div className="p-2 border-r text-sm font-medium">OFFICERS</div>
            {weekDays.map(({ dateStr, dayOfWeek }) => {
              const daySchedule = schedules?.dailySchedules?.find(s => s.date === dateStr);
              
              // Get minimum staffing from database
              const minStaffingForDay = schedules?.minimumStaffing?.get(dayOfWeek)?.get(selectedShiftId);
              const minimumOfficers = minStaffingForDay?.minimumOfficers || 0;
              
              // Count only non-PPO officers, excluding only full-day PTO
              const officerCount = daySchedule?.officers?.filter(officer => {
                const isOfficer = !isSupervisorByRank(officer);
                const isNotPPO = officer.rank?.toLowerCase() !== 'probationary';
                // Only exclude if they have full-day PTO
                const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
                const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO;
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
            {regularOfficers.map((officer) => (
              <div key={officer.officerId} className="grid grid-cols-9 border-b hover:bg-muted/30">
                <div className="p-2 border-r text-sm font-mono">{officer.badgeNumber}</div>
                <div className="p-2 border-r font-medium">{getLastName(officer.officerName)}</div>
                {weekDays.map(({ dateStr }) => (
                  <ScheduleCell
                    key={dateStr}
                    officer={officer.weeklySchedule[dateStr]}
                    dateStr={dateStr}
                    officerId={officer.officerId}
                    officerName={officer.officerName}
                    isAdminOrSupervisor={isAdminOrSupervisor}
                    onAssignPTO={handleAssignPTO}
                    onRemovePTO={handleRemovePTO}
                    onEditAssignment={handleEditAssignment}
                    onRemoveOfficer={removeOfficerMutation.mutate}
                    isUpdating={removeOfficerMutation.isPending}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* PPO SECTION */}
          {ppos.length > 0 && (
            <div className="border-t-2 border-blue-200">
              {/* PPO COUNT ROW */}
              <div className="grid grid-cols-9 border-b bg-blue-50">
                <div className="p-2 border-r"></div>
                <div className="p-2 border-r text-sm font-medium">PPO</div>
                {weekDays.map(({ dateStr }) => {
                  const daySchedule = schedules?.dailySchedules?.find(s => s.date === dateStr);
                  
                  // Count PPOs, excluding only full-day PTO
                  const ppoCount = daySchedule?.officers?.filter(officer => {
                    const isOfficer = !isSupervisorByRank(officer);
                    const isPPO = officer.rank?.toLowerCase() === 'probationary';
                    // Only exclude if they have full-day PTO
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
              {ppos.map((officer) => (
                <div key={officer.officerId} className="grid grid-cols-9 border-b hover:bg-blue-50/30">
                  <div className="p-2 border-r text-sm font-mono">{officer.badgeNumber}</div>
                  <div className="p-2 border-r font-medium flex items-center gap-2">
                    {getLastName(officer.officerName)}
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 text-xs">
                      PPO
                    </Badge>
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
                        onAssignPTO={handleAssignPTO}
                        onRemovePTO={handleRemovePTO}
                        onEditAssignment={handleEditAssignment}
                        onRemoveOfficer={removeOfficerMutation.mutate}
                        isUpdating={removeOfficerMutation.isPending}
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

  const renderMonthlyView = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
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

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
            <div key={day} className="text-center font-medium text-sm py-2 bg-muted/50 rounded">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {allCalendarDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayOfWeek = day.getDay();
            const daySchedule = schedules?.dailySchedules?.find(s => s.date === dateStr);
            const isCurrentMonthDay = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());
            
            // Get minimum staffing from database
            const minStaffingForDay = schedules?.minimumStaffing?.get(dayOfWeek)?.get(selectedShiftId);
            const minimumOfficers = minStaffingForDay?.minimumOfficers || 0;
            const minimumSupervisors = minStaffingForDay?.minimumSupervisors || 1;
            
            // Get ONLY full-day PTO officers for display
            const ptoOfficers = daySchedule?.officers?.filter((officer: any) => 
              officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift
            ) || [];

            // Calculate staffing counts for the badges (but don't show all officers)
            const { supervisorCount, officerCount } = isCurrentMonthDay && daySchedule
              ? calculateStaffingCounts(daySchedule.categorizedOfficers || { supervisors: [], officers: [], ppos: [] })
              : { supervisorCount: 0, officerCount: 0 };

            const isOfficersUnderstaffed = isCurrentMonthDay && (officerCount < minimumOfficers);
            const isSupervisorsUnderstaffed = isCurrentMonthDay && (supervisorCount < minimumSupervisors);
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
                      <Badge variant="outline" className="text-xs h-4 bg-green-50 text-green-800 border-green-200">
                        {ptoOfficers.length} PTO
                      </Badge>
                    )}
                    {isCurrentMonthDay && !isUnderstaffed && (
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="text-xs h-4">
                          {supervisorCount}/{minimumSupervisors} Sup
                        </Badge>
                        <Badge variant="outline" className="text-xs h-4">
                          {officerCount}/{minimumOfficers} Ofc
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-1 flex-1 overflow-y-auto">
                  {ptoOfficers.length > 0 ? (
                    <div className="space-y-1">
                      {/* Only show full-day PTO officers - all in green to match weekly view */}
                      {ptoOfficers.map((officer: any) => {
                        // Determine officer category for badges only
                        const isSupervisor = officer.rank?.toLowerCase().includes('lieutenant') || 
                                           officer.rank?.toLowerCase().includes('sergeant') ||
                                           officer.rank?.toLowerCase().includes('sgt') ||
                                           officer.rank?.toLowerCase().includes('lt');
                        const isPPO = officer.rank?.toLowerCase() === 'probationary';
                        
                        return (
                          <div 
                            key={officer.officerId} 
                            className="text-xs p-1 rounded border flex items-center justify-between bg-green-50 border-green-200"
                          >
                            <div className="flex items-center gap-1">
                              <div className={`font-medium truncate ${!isCurrentMonthDay ? 'text-muted-foreground' : ''}`}>
                                {getLastName(officer.officerName)}
                              </div>
                              {isPPO && (
                                <Badge variant="outline" className="h-3 text-[8px] px-1 bg-blue-100 text-blue-800 border-blue-300">
                                  PPO
                                </Badge>
                              )}
                              {isSupervisor && (
                                <Badge variant="outline" className="h-3 text-[8px] px-1 bg-yellow-100 text-yellow-800 border-yellow-300">
                                  {officer.rank || 'SUP'}
                                </Badge>
                              )}
                            </div>
                            <div className={`text-[10px] ${!isCurrentMonthDay ? 'text-green-500' : 'text-green-600'}`}>
                              {officer.shiftInfo?.ptoData?.ptoType || 'PTO'}
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

  const weekEnd = addDays(currentWeekStart, 6);
  const isCurrentWeek = startOfWeek(new Date(), { weekStartsOn: 0 }).getTime() === currentWeekStart.getTime();
  const isCurrentMonthView = isSameMonth(currentMonth, new Date());
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
              <Button onClick={() => setExportDialogOpen(true)} size="sm" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
          
          {!isAdminOrSupervisor && (
            <div className="flex items-center gap-3">
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
          
          <Tabs value={activeView} onValueChange={(value) => setActiveView(value as "weekly" | "monthly")}>
            <TabsList className="grid w-full max-w-xs grid-cols-2">
              <TabsTrigger value="weekly" className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Weekly
              </TabsTrigger>
              <TabsTrigger value="monthly" className="flex items-center gap-2">
                <Grid className="h-4 w-4" />
                Monthly
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={activeView === "weekly" ? goToPreviousWeek : goToPreviousMonth}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="text-center">
                <h3 className="text-lg font-semibold">
                  {activeView === "weekly" 
                    ? `${format(currentWeekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`
                    : format(currentMonth, "MMMM yyyy")
                  }
                </h3>
                <p className="text-sm text-muted-foreground">
                  {activeView === "weekly" 
                    ? `Week of ${format(currentWeekStart, "MMMM d, yyyy")}`
                    : `Month of ${format(currentMonth, "MMMM yyyy")}`
                  }
                </p>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={activeView === "weekly" ? goToNextWeek : goToNextMonth}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <Button
              variant={(activeView === "weekly" && isCurrentWeek) || (activeView === "monthly" && isCurrentMonthView) ? "outline" : "default"}
              size="sm"
              onClick={activeView === "weekly" ? goToCurrentWeek : goToCurrentMonth}
              disabled={(activeView === "weekly" && isCurrentWeek) || (activeView === "monthly" && isCurrentMonthView)}
            >
              Today
            </Button>
          </div>

          {selectedShiftId !== "all" && (
            <p className="text-sm text-muted-foreground mt-2">
              Viewing officers assigned to: {shiftTypes?.find(s => s.id === selectedShiftId)?.name}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {!selectedShiftId ? (
            <div className="text-center py-8 text-muted-foreground">
              Please select a shift to view the schedule
            </div>
          ) : activeView === "weekly" ? renderExcelStyleWeeklyView() : renderMonthlyView()}
        </CardContent>
      </Card>

      {/* Assignment Editing Dialog */}
      <Dialog open={!!editingAssignment} onOpenChange={(open) => !open && setEditingAssignment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="position-select">Position</Label>
              <Select value={editPosition} onValueChange={setEditPosition}>
                <SelectTrigger id="position-select">
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  {PREDEFINED_POSITIONS.map((pos) => (
                    <SelectItem key={pos} value={pos}>
                      {pos}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editPosition === "Other (Custom)" && (
                <Input
                  placeholder="Custom position"
                  value={customPosition}
                  onChange={(e) => setCustomPosition(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>
            <Button
              className="w-full"
              onClick={handleSaveAssignment}
              disabled={updatePositionMutation.isPending}
            >
              {updatePositionMutation.isPending ? "Saving..." : "Save Assignment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF Export Dialog - ONLY RENDERS WHEN DIALOG IS OPEN */}
      {exportDialogOpen && (
        <Dialog open={exportDialogOpen} onOpenChange={(open) => {
          setExportDialogOpen(open);
          if (!open) {
            setCalendarOpen(false);
            setDateRange(undefined);
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Schedule to PDF
              </DialogTitle>
              <DialogDescription>
                Export recurring schedules and assignments for a specific time period.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date-range">Date Range</Label>
                {/* UPDATED POPOVER WITH calendarOpen STATE */}
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="date-range"
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarRange className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd, y")} -{" "}
                            {format(dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={(range) => {
                        setDateRange(range);
                        // Close the calendar when a range is selected
                        if (range?.from && range?.to) {
                          setCalendarOpen(false);
                        }
                      }}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="export-shift">Shift</Label>
                <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select shift" />
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

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleExportPDF} disabled={!dateRange?.from || !dateRange?.to || !selectedShiftId}>
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Schedule Management Dialog */}
      {isAdminOrSupervisor && (
        <>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Schedule</DialogTitle>
                <DialogDescription>
                  This feature is not implemented yet.
                </DialogDescription>
              </DialogHeader>
              <Button onClick={() => setDialogOpen(false)}>Close</Button>
            </DialogContent>
          </Dialog>

          {/* PTO Assignment Dialog - Import from your existing component */}
          {selectedSchedule && (
            <PTOAssignmentDialog
              open={ptoDialogOpen}
              onOpenChange={(open) => {
                setPtoDialogOpen(open);
                if (!open) {
                  queryClient.invalidateQueries({ queryKey });
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
            />
          )}
        </>
      )}
    </>
  );
};

export default WeeklySchedule;
