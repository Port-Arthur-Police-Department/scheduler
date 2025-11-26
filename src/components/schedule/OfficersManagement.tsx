//this is the officer tab for officer weekly and monthly schedules
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfWeek, addDays, addWeeks, subWeeks, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from "date-fns";
import { Calendar, Plus, Edit2, Clock, Trash2, ChevronLeft, ChevronRight, Grid, Calendar as CalendarIcon } from "lucide-react";
import { ScheduleManagementDialog } from "./ScheduleManagementDialog";
import { PTOAssignmentDialog } from "./PTOAssignmentDialog";
import { PositionEditor } from "./PositionEditor";
import { usePositionMutation } from "@/hooks/usePositionMutation";
import { toast } from "sonner";
import { auditLogger } from "@/lib/auditLogger";
import { useUser } from "@/contexts/UserContext";

interface OfficersManagementProps {
  userId: string;
  isAdminOrSupervisor: boolean;
}

export const OfficersManagement = ({ userId, isAdminOrSupervisor }: OfficersManagementProps) => {
  console.log("🔍 OfficersManagement props:", { userId, isAdminOrSupervisor });
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ptoDialogOpen, setPtoDialogOpen] = useState(false);
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>("");
  const [selectedSchedule, setSelectedSchedule] = useState<{
    scheduleId: string;
    type: "recurring" | "exception";
    date: string;
    shift: any;
    existingPTO?: {
      id: string;
      ptoType: string;
      startTime: string;
      endTime: string;
      isFullShift: boolean;
    };
  } | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [activeView, setActiveView] = useState<"weekly" | "monthly">("weekly");
  const queryClient = useQueryClient();
  const { userEmail } = useUser();

  // Initialize selectedOfficerId when component mounts or props change
  useEffect(() => {
    console.log("🔍 useEffect - Initializing officer ID:", { userId, isAdminOrSupervisor, selectedOfficerId });
    
    if (!isAdminOrSupervisor && userId && selectedOfficerId === "") {
      // For regular officers, use their own ID
      console.log("👮 Setting officer ID to user ID:", userId);
      setSelectedOfficerId(userId);
    }
  }, [userId, isAdminOrSupervisor, selectedOfficerId]);

  // Week navigation functions
  const goToPreviousWeek = () => {
    setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  };

  // Month navigation functions
  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const goToCurrentMonth = () => {
    setCurrentMonth(new Date());
  };

  // Function to extract last name from full name
  const getLastName = (fullName: string) => {
    const names = fullName.trim().split(/\s+/);
    return names[names.length - 1] || fullName;
  };

  // Fetch all profiles for admin/supervisor selection
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      console.log("🔍 Fetching profiles...");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, badge_number")
        .order("full_name");
      if (error) throw error;
      
      // Sort by last name alphabetically
      return data.sort((a, b) => {
        const lastNameA = getLastName(a.full_name || "").toLowerCase();
        const lastNameB = getLastName(b.full_name || "").toLowerCase();
        return lastNameA.localeCompare(lastNameB);
      });
    },
    enabled: isAdminOrSupervisor,
  });

  // Set default officer for admins when profiles load
  useEffect(() => {
    if (isAdminOrSupervisor && profiles && profiles.length > 0 && selectedOfficerId === "") {
      const firstOfficerId = profiles[0].id;
      console.log("👨‍💼 Setting default officer for admin:", firstOfficerId);
      setSelectedOfficerId(firstOfficerId);
    }
  }, [profiles, isAdminOrSupervisor, selectedOfficerId]);

  // Enhanced query to fetch schedule data for both weekly and monthly views
  const { data: schedules, isLoading: schedulesLoading, error, refetch } = useQuery({
    queryKey: ["schedule", selectedOfficerId, currentWeekStart.toISOString(), currentMonth.toISOString(), activeView],
    queryFn: async () => {
      console.log("🔍 Fetching schedules for officer:", selectedOfficerId);
      
      // Don't fetch if no officer is selected
      if (!selectedOfficerId) {
        console.log("❌ No officer selected, skipping schedule fetch");
        return { 
          dailySchedules: [], 
          dates: [],
          recurring: [],
          exceptions: [],
          startDate: "",
          endDate: ""
        };
      }

      const targetUserId = isAdminOrSupervisor ? selectedOfficerId : userId;
      console.log("🎯 Target user ID:", targetUserId);
      
      // Determine date range based on active view
      let startDate: Date;
      let endDate: Date;
      let dates: string[];

      if (activeView === "weekly") {
        // FIX: Ensure we're always starting from Sunday
        const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 0 });
        startDate = weekStart;
        endDate = addDays(weekStart, 6);
        dates = Array.from({ length: 7 }, (_, i) => 
          format(addDays(weekStart, i), "yyyy-MM-dd")
        );
        
        console.log("📅 WEEKLY - Start:", format(startDate, "EEE yyyy-MM-dd"), 
                    "End:", format(endDate, "EEE yyyy-MM-dd"));
      } else {
        // Monthly view
        startDate = startOfMonth(currentMonth);
        endDate = endOfMonth(currentMonth);
        const monthDays = eachDayOfInterval({ start: startDate, end: endDate });
        dates = monthDays.map(day => format(day, "yyyy-MM-dd"));
        
        console.log("📅 MONTHLY - Start:", format(startDate, "EEE yyyy-MM-dd"), 
                    "End:", format(endDate, "EEE yyyy-MM-dd"),
                    "Days:", dates.length);
      }

      // Get recurring schedules - filter by active schedules for the current period
      const { data: recurringData, error: recurringError } = await supabase
        .from("recurring_schedules")
        .select(`
          *,
          shift_types(name, start_time, end_time)
        `)
        .eq("officer_id", targetUserId)
        // Filter recurring schedules that are active during the current period
        .lte("start_date", format(endDate, "yyyy-MM-dd"))
        .or(`end_date.is.null,end_date.gte.${format(startDate, "yyyy-MM-dd")}`);

      if (recurringError) {
        console.error("Recurring error:", recurringError);
        throw recurringError;
      }

      // Get exceptions for the specific period
      const { data: exceptionsData, error: exceptionsError } = await supabase
        .from("schedule_exceptions")
        .select(`
          *,
          shift_types(name, start_time, end_time)
        `)
        .eq("officer_id", targetUserId)
        .in("date", dates);

      if (exceptionsError) {
        console.error("Exceptions error:", exceptionsError);
        throw exceptionsError;
      }

      console.log("✅ Schedule data fetched successfully");
      
      // Build schedule for each day
      const dailySchedules = dates.map((date, idx) => {
        const currentDate = parseISO(date);        // parse ISO (yyyy-MM-dd) safely
        const dayOfWeek = currentDate.getDay();
        
        const exception = exceptionsData?.find(e => e.date === date);
        
        // Find recurring schedule for this day of week that's active on this date
        const recurring = recurringData?.find(r => {
          if (r.day_of_week !== dayOfWeek) return false;
          
          // Check if the recurring schedule is active on this specific date
          const scheduleStartDate = parseISO(r.start_date);
          const scheduleEndDate = r.end_date ? parseISO(r.end_date) : null;
          
          const isAfterStart = currentDate >= scheduleStartDate;
          const isBeforeEnd = !scheduleEndDate || currentDate <= scheduleEndDate;
          
          return isAfterStart && isBeforeEnd;
        });

        let shiftInfo = null;
        
        if (exception) {
          shiftInfo = {
            type: exception.is_off ? "Off" : (exception.shift_types?.name || "Custom"),
            time: exception.is_off ? "" : (
              exception.custom_start_time && exception.custom_end_time
                ? `${exception.custom_start_time} - ${exception.custom_end_time}`
                : `${exception.shift_types?.start_time} - ${exception.shift_types?.end_time}`
            ),
            position: exception.position_name,
            scheduleId: exception.id,
            scheduleType: "exception" as const,
            shift: exception.shift_types,
            isOff: exception.is_off,
            reason: exception.reason,
            // Add PTO detection
            hasPTO: exception.is_off,
            ptoData: exception.is_off ? {
              id: exception.id,
              ptoType: exception.reason,
              startTime: exception.custom_start_time || exception.shift_types?.start_time || '00:00',
              endTime: exception.custom_end_time || exception.shift_types?.end_time || '23:59',
              isFullShift: !exception.custom_start_time && !exception.custom_end_time,
              shiftTypeId: exception.shift_type_id
            } : undefined
          };
        } else if (recurring) {
          // For recurring schedules, check if there's a PTO exception for this date
          const ptoException = exceptionsData?.find(e => 
            e.officer_id === targetUserId && 
            e.date === date && 
            e.is_off
          );
          
          shiftInfo = {
            type: recurring.shift_types?.name,
            time: `${recurring.shift_types?.start_time} - ${recurring.shift_types?.end_time}`,
            position: recurring.position_name,
            scheduleId: recurring.id,
            scheduleType: "recurring" as const,
            shift: recurring.shift_types,
            isOff: false,
            // Add PTO detection
            hasPTO: !!ptoException,
            ptoData: ptoException ? {
              id: ptoException.id,
              ptoType: ptoException.reason,
              startTime: ptoException.custom_start_time || recurring.shift_types?.start_time,
              endTime: ptoException.custom_end_time || recurring.shift_types?.end_time,
              isFullShift: !ptoException.custom_start_time && !ptoException.custom_end_time,
              shiftTypeId: ptoException.shift_type_id
            } : undefined
          };
        }

        return {
          date,
          dayOfWeek,
          shiftInfo,
          hasSchedule: !!shiftInfo,
          isCurrentMonth: activeView === "monthly" ? isSameMonth(currentDate, currentMonth) : true
        };
      });

      return { 
        dailySchedules, 
        dates,
        recurring: recurringData,
        exceptions: exceptionsData,
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd")
      };
    },
    enabled: !!selectedOfficerId, // Only fetch when we have a valid officer ID
  });

  // Rest of the component remains the same...
  const updatePositionMutation = usePositionMutation();

  // Add mutation for removing PTO
  const removePTOMutation = useMutation({
  mutationFn: async (ptoData: { id: string; officerId: string; date: string; shiftTypeId: string; ptoType: string; startTime: string; endTime: string }) => {
    // Get current user for audit logging
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    // Calculate hours to restore
    const calculateHours = (start: string, end: string) => {
      const [startHour, startMin] = start.split(":").map(Number);
      const [endHour, endMin] = end.split(":").map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      return (endMinutes - startMinutes) / 60;
    };

    const hoursUsed = calculateHours(ptoData.startTime, ptoData.endTime);

    // Restore PTO balance
    const PTO_TYPES = [
      { value: "vacation", label: "Vacation", column: "vacation_hours" },
      { value: "holiday", label: "Holiday", column: "holiday_hours" },
      { value: "sick", label: "Sick", column: "sick_hours" },
      { value: "comp", label: "Comp", column: "comp_hours" },
    ];

    const ptoColumn = PTO_TYPES.find((t) => t.value === ptoData.ptoType)?.column;
    if (ptoColumn) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", ptoData.officerId)
        .single();

      if (profileError) throw profileError;

      const currentBalance = profile[ptoColumn as keyof typeof profile] as number;
      
      const { error: restoreError } = await supabase
        .from("profiles")
        .update({
          [ptoColumn]: currentBalance + hoursUsed,
        })
        .eq("id", ptoData.officerId);

      if (restoreError) throw restoreError;
    }

    // Delete the PTO exception
    const { error: deleteError } = await supabase
      .from("schedule_exceptions")
      .delete()
      .eq("id", ptoData.id);

    if (deleteError) throw deleteError;

    // AUDIT LOGGING: Log PTO removal
    if (currentUser) {
      await auditLogger.log({
        user_id: currentUser.id,
        user_email: currentUser.email!,
        action_type: 'pto_removed',
        table_name: 'schedule_exceptions',
        record_id: ptoData.id,
        description: `PTO removed for officer ${ptoData.officerId} on ${ptoData.date}: ${ptoData.ptoType} (${hoursUsed} hours restored)`,
      });
    }

    // Also delete any associated working time exception
    await supabase
      .from("schedule_exceptions")
      .delete()
      .eq("officer_id", ptoData.officerId)
      .eq("date", ptoData.date)
      .eq("shift_type_id", ptoData.shiftTypeId)
      .eq("is_off", false);
  },
    onSuccess: () => {
      toast.success("PTO removed and balance restored");
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove PTO");
    },
  });

  const handleSavePosition = (scheduleId: string, type: "recurring" | "exception", positionName: string) => {
    updatePositionMutation.mutate(
      { scheduleId, type, positionName },
      {
        onSuccess: () => {
          // Force refresh the schedule data
          queryClient.invalidateQueries({ 
            queryKey: ["schedule", selectedOfficerId, currentWeekStart.toISOString(), currentMonth.toISOString(), activeView] 
          });
          setEditingSchedule(null);
        }
      }
    );
  };

  const handleEditClick = (shiftInfo: any) => {
    const scheduleKey = `${shiftInfo.scheduleId}-${shiftInfo.scheduleType}`;
    setEditingSchedule(scheduleKey);
  };

  const handleAssignPTO = (schedule: any, date: string) => {
    setSelectedSchedule({
      scheduleId: schedule.scheduleId,
      type: schedule.scheduleType,
      date: date,
      shift: schedule.shift,
      // Pass existing PTO data if available
      ...(schedule.hasPTO && schedule.ptoData ? { existingPTO: schedule.ptoData } : {})
    });
    setPtoDialogOpen(true);
  };

const handleRemovePTO = async (schedule: any, date: string) => {
  if (!schedule.hasPTO || !schedule.ptoData) {
    console.error("❌ No PTO data found in schedule:", schedule);
    return;
  }

  try {
    console.log("🔄 handleRemovePTO called with:", { schedule, date });
    
    
    // Get officer name from the schedule
    const officerName = schedule.name || schedule.officerName || 'Unknown Officer';
    console.log("👤 Officer name for audit:", officerName);
    
    // STRATEGY 1: Try to get shift ID from multiple possible sources
    let shiftTypeId = schedule.shift?.id || 
                     schedule.ptoData.shiftTypeId || 
                     schedule.originalShiftId;
    
    // STRATEGY 2: If we still don't have a shift ID, try to infer it from the officer's schedule
    if (!shiftTypeId) {
      console.log("🔍 No direct shift ID found, inferring from officer's schedule...");
      
      // Get the officer's schedule for this date to find their shift
      const { data: officerSchedule, error } = await supabase
        .from("schedule_exceptions")
        .select("shift_type_id")
        .eq("officer_id", selectedOfficerId)
        .eq("date", date)
        .eq("is_off", false)
        .single();

      if (!error && officerSchedule?.shift_type_id) {
        shiftTypeId = officerSchedule.shift_type_id;
        console.log("📊 Found shift_type_id from working schedule:", shiftTypeId);
      } else {
        // STRATEGY 3: Try to get from recurring schedule
        const dayOfWeek = parseISO(date).getDay();
        const { data: recurringSchedule, error: recurringError } = await supabase
          .from("recurring_schedules")
          .select("shift_type_id")
          .eq("officer_id", selectedOfficerId)
          .eq("day_of_week", dayOfWeek)
          .or(`end_date.is.null,end_date.gte.${date}`);

        if (!recurringError && recurringSchedule?.length > 0) {
          shiftTypeId = recurringSchedule[0]?.shift_type_id;
          console.log("📊 Found shift_type_id from recurring schedule:", shiftTypeId);
        }
      }
    }

    if (!shiftTypeId) {
      console.error("❌ No shift_type_id found after all attempts");
      toast.error("Cannot remove PTO: Unable to determine shift");
      return;
    }

    const ptoData = {
      id: schedule.ptoData.id,
      officerId: selectedOfficerId,
      date: date,
      shiftTypeId: shiftTypeId,
      ptoType: schedule.ptoData.ptoType,
      startTime: schedule.ptoData.startTime,
      endTime: schedule.ptoData.endTime
    };

    console.log("✅ Calling removePTOMutation with:", ptoData);
    
    removePTOMutation.mutate(ptoData, {
      onSuccess: () => {
        console.log("✅ PTO removal successful, calling auditLogger...");
        
        // Log PTO removal to audit log - NOW INCLUDING OFFICER NAME
        auditLogger.logPTORemoval(
          selectedOfficerId,
          schedule.ptoData.ptoType,
          date,
          userEmail,
          `Removed ${schedule.ptoData.ptoType} PTO from ${officerName}` // Include officer name
        ).then(() => {
          console.log("📝 Audit log entry created successfully");
        }).catch((error) => {
          console.error("❌ Failed to create audit log entry:", error);
        });
      },
      onError: (error) => {
        console.error("❌ PTO removal mutation failed:", error);
      }
    });
    
  } catch (error) {
    console.error("❌ Error in handleRemovePTO:", error);
    toast.error("Unexpected error while removing PTO");
  }
};

  // Function to refresh the schedule data
  const refreshSchedule = () => {
    queryClient.invalidateQueries({ 
      queryKey: ["schedule", selectedOfficerId, currentWeekStart.toISOString(), currentMonth.toISOString(), activeView] 
    });
  };

  const isLoading = schedulesLoading || (isAdminOrSupervisor && profilesLoading) || !selectedOfficerId;

  console.log("🔍 Component state:", { 
    isLoading, 
    schedulesLoading, 
    profilesLoading, 
    selectedOfficerId,
    hasSchedules: !!schedules,
    error 
  });

  if (isLoading) {
    console.log("🔍 Rendering loading state");
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Officer Schedule Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    console.log("🔍 Rendering error state:", error);
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Officer Schedule Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Error loading schedule: {(error as Error).message}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Please check the console for more details.
          </p>
        </CardContent>
      </Card>
    );
  }

  console.log("🔍 Rendering main component with schedules:", schedules);

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekEnd = addDays(currentWeekStart, 6);
  const isCurrentWeek = startOfWeek(new Date(), { weekStartsOn: 0 }).getTime() === currentWeekStart.getTime();
  const isCurrentMonth = isSameMonth(currentMonth, new Date());

  // For monthly view - get all days in month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Get days from previous and next month to fill the calendar grid
  const startDay = monthStart.getDay(); // 0 = Sunday
  const endDay = monthEnd.getDay(); // 0 = Sunday
  
  const previousMonthDays = Array.from({ length: startDay }, (_, i) => 
    addDays(monthStart, -startDay + i)
  );
  
  const nextMonthDays = Array.from({ length: 6 - endDay }, (_, i) => 
    addDays(monthEnd, i + 1)
  );

  const allCalendarDays = [...previousMonthDays, ...monthDays, ...nextMonthDays];

  // Render weekly schedule view
  const renderWeeklyView = () => (
    <div className="space-y-4">
      {schedules?.dailySchedules?.map(({ date, dayOfWeek, shiftInfo }) => (
        <div
          key={date}
          className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
        >
          <div className="space-y-1 flex-1">
            <p className="font-medium">{daysOfWeek[dayOfWeek]}</p>
            <p className="text-sm text-muted-foreground">{format(parseISO(date), "MMM d")}</p>
          </div>
          
          {shiftInfo ? (
            <div className="flex items-center gap-4">
              {editingSchedule === `${shiftInfo.scheduleId}-${shiftInfo.scheduleType}` ? (
                <PositionEditor
                  currentPosition={shiftInfo.position || ""}
                  onSave={(positionName) => handleSavePosition(shiftInfo.scheduleId, shiftInfo.scheduleType, positionName)}
                  onCancel={() => setEditingSchedule(null)}
                  isSaving={updatePositionMutation.isPending}
                />
              ) : (
                <>
                  <div className="text-right">
                    <p className="font-medium">{shiftInfo.type}</p>
                    {shiftInfo.time && <p className="text-sm text-muted-foreground">{shiftInfo.time}</p>}
                    {shiftInfo.position && (
                      <Badge variant="secondary" className="mt-1">
                        {shiftInfo.position}
                      </Badge>
                    )}
                    {shiftInfo.isOff && (
                      <Badge variant="destructive" className="mt-1">
                        {shiftInfo.reason || "Time Off"}
                      </Badge>
                    )}
                  </div>
                  
                  {isAdminOrSupervisor && (
                    <div className="flex items-center gap-2">
                      {!shiftInfo.isOff && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditClick(shiftInfo)}
                          title="Edit Position"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                      {shiftInfo.hasPTO ? (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleAssignPTO(shiftInfo, date)}
                            title="Edit PTO"
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemovePTO(shiftInfo, date)}
                            disabled={removePTOMutation.isPending}
                            title="Remove PTO"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAssignPTO(shiftInfo, date)}
                          title="Assign PTO"
                        >
                          <Clock className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <p className="text-sm text-muted-foreground">No shift scheduled</p>
              {isAdminOrSupervisor && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toast.info("Add schedule feature coming soon")}
                >
                  Add Shift
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // Render monthly schedule view
  const renderMonthlyView = () => (
    <div className="space-y-4">
      {/* Calendar header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {daysOfWeek.map(day => (
          <div key={day} className="text-center font-medium text-sm py-2">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {allCalendarDays.map((day, index) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const daySchedule = schedules?.dailySchedules?.find(s => s.date === dateStr);
          const isCurrentMonthDay = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());
          
          return (
            <div
              key={day.toISOString()}
              className={`
                min-h-24 p-2 border rounded-lg text-sm
                ${isCurrentMonthDay ? 'bg-card' : 'bg-muted/30 text-muted-foreground'}
                ${isToday ? 'border-primary ring-1 ring-primary' : 'border-border'}
                hover:bg-accent/50 transition-colors
              `}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`
                  text-xs font-medium
                  ${isToday ? 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center' : ''}
                `}>
                  {format(day, "d")}
                </span>
                {isAdminOrSupervisor && daySchedule?.shiftInfo && (
                  <div className="flex gap-1">
                    {!daySchedule.shiftInfo.isOff && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={() => handleEditClick(daySchedule.shiftInfo)}
                        title="Edit Position"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    )}
                    {daySchedule.shiftInfo.hasPTO ? (
                      <>
                        <Button
                          size="icon"
                          variant="default"
                          className="h-5 w-5"
                          onClick={() => handleAssignPTO(daySchedule.shiftInfo, dateStr)}
                          title="Edit PTO"
                        >
                          <Clock className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => handleRemovePTO(daySchedule.shiftInfo, dateStr)}
                          disabled={removePTOMutation.isPending}
                          title="Remove PTO"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={() => handleAssignPTO(daySchedule.shiftInfo, dateStr)}
                        title="Assign PTO"
                      >
                        <Clock className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
              
              {daySchedule?.shiftInfo && (
                <div className="space-y-1 text-xs">
                  <div className="font-medium truncate">{daySchedule.shiftInfo.type}</div>
                  {daySchedule.shiftInfo.time && (
                    <div className="text-muted-foreground truncate">{daySchedule.shiftInfo.time}</div>
                  )}
                  {daySchedule.shiftInfo.position && (
                    <Badge variant="secondary" className="text-xs">
                      {daySchedule.shiftInfo.position}
                    </Badge>
                  )}
                  {daySchedule.shiftInfo.isOff && (
                    <Badge variant="destructive" className="text-xs">
                      {daySchedule.shiftInfo.reason || "Off"}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Officer Schedule Management
            </CardTitle>
            {isAdminOrSupervisor && (
              <div className="flex items-center gap-3">
                <Select 
                  value={selectedOfficerId} 
                  onValueChange={(value) => setSelectedOfficerId(value)}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select officer" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles?.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name} (Badge: {profile.badge_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => setDialogOpen(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Schedule
                </Button>
              </div>
            )}
          </div>
          
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
          
          {/* Navigation */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={activeView === "weekly" ? goToPreviousWeek : goToPreviousMonth}
                title={activeView === "weekly" ? "Previous Week" : "Previous Month"}
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
                title={activeView === "weekly" ? "Next Week" : "Next Month"}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <Button
              variant={(activeView === "weekly" && isCurrentWeek) || (activeView === "monthly" && isCurrentMonth) ? "outline" : "default"}
              size="sm"
              onClick={activeView === "weekly" ? goToCurrentWeek : goToCurrentMonth}
              disabled={(activeView === "weekly" && isCurrentWeek) || (activeView === "monthly" && isCurrentMonth)}
            >
              Today
            </Button>
          </div>

          {isAdminOrSupervisor && selectedOfficerId && (
            <p className="text-sm text-muted-foreground mt-2">
              Viewing schedule for: {profiles?.find(p => p.id === selectedOfficerId)?.full_name}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {activeView === "weekly" ? renderWeeklyView() : renderMonthlyView()}
        </CardContent>
      </Card>

      {isAdminOrSupervisor && (
        <>
          <ScheduleManagementDialog open={dialogOpen} onOpenChange={setDialogOpen} />
          {selectedSchedule && (
            <PTOAssignmentDialog
              open={ptoDialogOpen}
              onOpenChange={(open) => {
                setPtoDialogOpen(open);
                // Refresh the schedule when the PTO dialog closes
                if (!open) {
                  refreshSchedule();
                }
              }}
              officer={{
                officerId: selectedOfficerId,
                name: profiles?.find(p => p.id === selectedOfficerId)?.full_name || "Unknown",
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
