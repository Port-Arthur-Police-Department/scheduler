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
import { CalendarIcon, Download, ChevronLeft, ChevronRight, CalendarDays, Users, Plane, MapPin } from "lucide-react";
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth, isSameDay, eachDayOfInterval, parseISO } from "date-fns";
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
import type { TheBookProps, TheBookView, ScheduleData } from "./types";
import { getLastName, getRankAbbreviation, getRankPriority, isSupervisorByRank } from "./utils";
import { PREDEFINED_POSITIONS } from "@/constants/positions";

const TheBook = ({  
  userRole = 'officer', 
  isAdminOrSupervisor = false 
}: TheBookProps) => {
  const { userEmail } = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { data: websiteSettings } = useWebsiteSettings();
  const { weekly: weeklyColors } = useColorSettings();
  
  // State management
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeView, setActiveView] = useState<TheBookView>("weekly");
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [ptoDialogOpen, setPtoDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [editingAssignment, setEditingAssignment] = useState<{ officer: any; dateStr: string } | null>(null);

  // Use consolidated mutations hook
  const {
    updatePositionMutation,
    removeOfficerMutation,
    removePTOMutation,
    queryKey
  } = useWeeklyScheduleMutations(currentWeekStart, currentMonth, activeView, selectedShiftId);

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
        
        // Categorize officers
        const supervisors = officers.filter(officer => {
          const rank = officer.rank?.toLowerCase() || '';
          return rank.includes('sergeant') || rank.includes('lieutenant') || 
                 rank.includes('chief') || rank.includes('sgt') || rank.includes('lt');
        });
        
        const ppos = officers.filter(officer => officer.rank?.toLowerCase() === 'probationary');
        const regularOfficers = officers.filter(officer => {
          const rank = officer.rank?.toLowerCase() || '';
          return !(rank.includes('sergeant') || rank.includes('lieutenant') || 
                  rank.includes('chief') || rank.includes('sgt') || rank.includes('lt') ||
                  rank === 'probationary');
        });

        const { supervisorCount, officerCount } = calculateStaffingCounts({
          supervisors,
          officers: [...regularOfficers, ...ppos]
        });

        return {
          date,
          dayOfWeek: parseISO(date).getDay(),
          officers,
          categorizedOfficers: {
            supervisors,
            officers: regularOfficers,
            ppos
          },
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
    setEditingAssignment({ officer, dateStr });
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
    // This will be handled by the view components
  };

  const handleSaveAssignment = () => {
    if (!editingAssignment) return;

    const { officer, dateStr } = editingAssignment;
    
    updatePositionMutation.mutate({
      scheduleId: officer.shiftInfo.scheduleId,
      type: officer.shiftInfo.scheduleType,
      positionName: officer.shiftInfo.position,
      date: dateStr,
      officerId: officer.officerId,
      shiftTypeId: selectedShiftId,
      currentPosition: officer.shiftInfo.position
    }, {
      onSuccess: () => {
        auditLogger.logPositionChange(
          officer.officerId,
          officer.officerName,
          officer.shiftInfo.position,
          officer.shiftInfo.position,
          userEmail,
          `Changed position for ${officer.officerName} on ${dateStr}`
        );
        
        setEditingAssignment(null);
      }
    });
  };

  const handleRemoveOfficer = (scheduleId: string, type: 'recurring' | 'exception', officerData?: any) => {
    removeOfficerMutation.mutate({
      scheduleId,
      type,
      officerData
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
      removeOfficerMutation,
      removePTOMutation,
    },
    navigateToDailySchedule,
    getLastName,
    getRankAbbreviation,
    getRankPriority,
    isSupervisorByRank,
  };

  const renderView = () => {
    switch (activeView) {
      case "weekly":
        return <WeeklyView {...viewProps} />;
      case "monthly":
        return <MonthlyView {...viewProps} />;
      case "force-list":
        return <ForceListView />;
      case "vacation-list":
        return <VacationListView />;
      case "beat-preferences":
        return <BeatPreferencesView />;
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
          
          {/* Date Navigation - only show for weekly/monthly views */}
          {(activeView === "weekly" || activeView === "monthly") && (
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={viewProps.onDateNavigation.goToPrevious}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="text-center">
                  <h3 className="text-lg font-semibold">
                    {activeView === "weekly" 
                      ? `${format(currentWeekStart, "MMM d")} - ${format(addDays(currentWeekStart, 6), "MMM d, yyyy")}`
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
                  onClick={viewProps.onDateNavigation.goToNext}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={viewProps.onDateNavigation.goToCurrent}
                >
                  Today
                </Button>
              </div>
            </div>
          )}
          
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

      {/* Dialogs */}
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
