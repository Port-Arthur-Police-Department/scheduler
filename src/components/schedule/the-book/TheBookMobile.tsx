// TheBookMobile.tsx - REFACTORED to use shared getScheduleData
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, ChevronLeft, ChevronRight, CalendarDays, Users, Plane, MapPin } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, addMonths, subMonths, addDays, parseISO } from "date-fns";
import { useWeeklyScheduleMutations } from "@/hooks/useWeeklyScheduleMutations";
import { useUser } from "@/contexts/UserContext";
import { auditLogger } from "@/lib/auditLogger";

// Import shared data fetching
import { getScheduleData } from "../DailyScheduleView";

// Import mobile view components
import { WeeklyViewMobile } from "./WeeklyViewMobile";
import { MonthlyViewMobile } from "./MonthlyViewMobile";
import { ForceListViewMobile } from "./ForceListViewMobile";
import { VacationListViewMobile } from "./VacationListViewMobile";
import { BeatPreferencesViewMobile } from "./BeatPreferencesViewMobile";
// Import dialogs
import { PTODialogMobile } from "./PTODialogMobile";
import { AssignmentEditDialogMobile } from "./AssignmentEditDialogMobile";

interface TheBookMobileProps {
  userRole?: 'officer' | 'supervisor' | 'admin';
  isAdminOrSupervisor?: boolean;
  userCurrentShift?: string;
}

const TheBookMobile = ({ userRole = 'officer', isAdminOrSupervisor = false, userCurrentShift }: TheBookMobileProps) => {
  const [activeView, setActiveView] = useState<"weekly" | "monthly" | "force-list" | "vacation-list" | "beat-preferences">("weekly");
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Dialog states
  const [ptoDialogOpen, setPtoDialogOpen] = useState(false);
  const [selectedOfficer, setSelectedOfficer] = useState<{
    id: string;
    name: string;
    date: string;
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

  // Get user context for audit logging
  const { userEmail } = useUser();
  const queryClient = useQueryClient();

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

  // Auto-select user's assigned shift if they have one
  useEffect(() => {
    if (shiftTypes && shiftTypes.length > 0 && !selectedShiftId) {
      if (userCurrentShift && userCurrentShift !== "all") {
        const userShiftExists = shiftTypes.some(shift => shift.id === userCurrentShift);
        if (userShiftExists) {
          console.log("📱 Mobile: Setting user's assigned shift:", userCurrentShift);
          setSelectedShiftId(userCurrentShift);
        } else {
          console.log("⚠️ Mobile: User's assigned shift not found. No auto-selection.");
        }
      }
    }
  }, [shiftTypes, userCurrentShift, selectedShiftId]);

  // SIMPLIFIED: Use shared getScheduleData for weekly view
  const { data: weeklyData, isLoading: weeklyLoading } = useQuery({
    queryKey: ["thebook-weekly-mobile", currentWeekStart.toISOString(), selectedShiftId],
    queryFn: async () => {
      if (!selectedShiftId) return [];

      const weekData = [];
      for (let i = 0; i < 7; i++) {
        const date = addDays(currentWeekStart, i);
        const dailySchedule = await getScheduleData(date, selectedShiftId);
        
        // getScheduleData returns array, take the first (only) shift for this shiftId
        const shiftData = dailySchedule[0] || null;
        
        weekData.push({
          date: format(date, "yyyy-MM-dd"),
          data: shiftData,
          dayOfWeek: date.getDay(),
          formattedDate: format(date, "EEE, MMM d")
        });
      }
      
      return weekData;
    },
    enabled: !!selectedShiftId && activeView === "weekly",
  });

  // SIMPLIFIED: Use shared getScheduleData for monthly view
  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ["thebook-monthly-mobile", currentMonth.toISOString(), selectedShiftId],
    queryFn: async () => {
      if (!selectedShiftId) return [];

      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const daysInMonth = monthEnd.getDate() - monthStart.getDate() + 1;
      
      const monthData = [];
      for (let i = 0; i < daysInMonth; i++) {
        const date = new Date(monthStart);
        date.setDate(date.getDate() + i);
        
        const dailySchedule = await getScheduleData(date, selectedShiftId);
        const shiftData = dailySchedule[0] || null;
        
        monthData.push({
          date: format(date, "yyyy-MM-dd"),
          data: shiftData,
          dayOfWeek: date.getDay(),
          formattedDate: format(date, "MMM d"),
          isCurrentMonth: true
        });
      }
      
      return monthData;
    },
    enabled: !!selectedShiftId && activeView === "monthly",
  });

  // Setup mutations
  const mutationsResult = useWeeklyScheduleMutations(
    currentWeekStart,
    currentMonth,
    activeView,
    selectedShiftId
  );

  const {
    updatePositionMutation,
    removeOfficerMutation,
    removePTOMutation,
    queryKey: mutationQueryKey
  } = mutationsResult;

  // Navigation functions
  const goToPreviousWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const goToNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
  const goToPreviousMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const goToToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
    setCurrentMonth(new Date());
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

  // Add PTO Assignment Mutation
  const assignPTOMutation = useMutation({
    mutationFn: async (ptoData: any) => {
      console.log('🎯 Assigning PTO on mobile:', ptoData);

      const startTime = ptoData.isFullShift 
        ? (ptoData.startTime || "00:00") 
        : ptoData.startTime;
      
      const endTime = ptoData.isFullShift 
        ? (ptoData.endTime || "23:59") 
        : ptoData.endTime;

      const { data: existingExceptions, error: checkError } = await supabase
        .from("schedule_exceptions")
        .select("id")
        .eq("officer_id", ptoData.officerId)
        .eq("date", ptoData.date)
        .eq("shift_type_id", ptoData.shiftTypeId);

      if (checkError) throw checkError;

      let exceptionId;

      if (existingExceptions && existingExceptions.length > 0) {
        const { error: updateError } = await supabase
          .from("schedule_exceptions")
          .update({
            is_off: true,
            reason: ptoData.ptoType,
            custom_start_time: ptoData.isFullShift ? null : startTime,
            custom_end_time: ptoData.isFullShift ? null : endTime,
            position_name: null,
            unit_number: null,
            notes: `PTO: ${ptoData.ptoType}`
          })
          .eq("id", existingExceptions[0].id);

        if (updateError) throw updateError;
        exceptionId = existingExceptions[0].id;
      } else {
        const { data: newException, error: insertError } = await supabase
          .from("schedule_exceptions")
          .insert({
            officer_id: ptoData.officerId,
            date: ptoData.date,
            shift_type_id: ptoData.shiftTypeId,
            is_off: true,
            reason: ptoData.ptoType,
            custom_start_time: ptoData.isFullShift ? null : startTime,
            custom_end_time: ptoData.isFullShift ? null : endTime,
            position_name: null,
            unit_number: null,
            notes: `PTO: ${ptoData.ptoType}`
          })
          .select("id")
          .single();

        if (insertError) throw insertError;
        exceptionId = newException.id;
      }

      const ptoColumn = getPTOColumn(ptoData.ptoType);
      if (ptoColumn) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", ptoData.officerId)
          .single();

        if (!profileError && profile) {
          let hoursUsed;
          if (ptoData.isFullShift) {
            const currentShift = shiftTypes?.find(shift => shift.id === ptoData.shiftTypeId);
            if (currentShift?.start_time && currentShift?.end_time) {
              hoursUsed = calculateHoursUsed(currentShift.start_time, currentShift.end_time);
            } else {
              hoursUsed = 8;
            }
          } else {
            hoursUsed = calculateHoursUsed(startTime, endTime);
          }
          
          const currentBalance = profile[ptoColumn as keyof typeof profile] as number;
          
          await supabase
            .from("profiles")
            .update({
              [ptoColumn]: Math.max(0, (currentBalance || 0) - hoursUsed),
            })
            .eq("id", ptoData.officerId);
        }
      }

      return { id: exceptionId, success: true };
    },
    onSuccess: () => {
      toast.success("PTO assigned successfully");
      queryClient.invalidateQueries({ queryKey: ['thebook-weekly-mobile'] });
      queryClient.invalidateQueries({ queryKey: ['thebook-monthly-mobile'] });
    },
    onError: (error: any) => {
      console.error('❌ Error assigning PTO:', error);
      toast.error(error.message || "Failed to assign PTO");
    },
  });

  // Event handlers for mobile
  const handleAssignPTO = (schedule: any, date: string, officerId: string, officerName: string) => {
    console.log('📱 Opening PTO dialog for:', officerName, date);
    
    const currentShift = shiftTypes?.find(shift => shift.id === selectedShiftId);
    const shiftStartTime = currentShift?.start_time || "08:00";
    const shiftEndTime = currentShift?.end_time || "17:00";
    
    setSelectedOfficer({
      id: officerId,
      name: officerName,
      date: date,
      shiftStartTime: shiftStartTime,
      shiftEndTime: shiftEndTime
    });
    setPtoDialogOpen(true);
  };

  const handleSavePTO = async (ptoData: any) => {
    if (!selectedOfficer || !selectedShiftId) {
      toast.error("Missing required information");
      return;
    }

    console.log('💾 Saving PTO:', ptoData);

    assignPTOMutation.mutate({
      ...ptoData,
      officerId: selectedOfficer.id,
      date: selectedOfficer.date,
      shiftTypeId: selectedShiftId
    }, {
      onSuccess: () => {
        try {
          auditLogger.logPTOAssignment(
            selectedOfficer.id,
            ptoData.ptoType,
            selectedOfficer.date,
            userEmail,
            `Assigned ${ptoData.ptoType} PTO via mobile`
          );
        } catch (logError) {
          console.error('Failed to log PTO audit:', logError);
        }
        
        setPtoDialogOpen(false);
        setSelectedOfficer(null);
      }
    });
  };

  const handleRemovePTO = async (schedule: any, date: string, officerId: string) => {
    console.log('🔍 Checking PTO schedule data for removal:', {
      schedule,
      date,
      officerId
    });

    let ptoId = schedule?.id || schedule?.ptoData?.id;
    let ptoType = schedule?.reason || schedule?.ptoData?.ptoType || "PTO";
    
    if (!ptoId && (schedule?.hasPTO || schedule?.reason)) {
      console.log('🔄 Searching for PTO record in database...');
      try {
        const { data: ptoRecords, error } = await supabase
          .from("schedule_exceptions")
          .select("id, reason")
          .eq("officer_id", officerId)
          .eq("date", date)
          .eq("shift_type_id", selectedShiftId)
          .eq("is_off", true);

        if (error) {
          console.error('Error searching for PTO:', error);
          toast.error("Could not find PTO record");
          return;
        }

        if (ptoRecords && ptoRecords.length > 0) {
          ptoId = ptoRecords[0].id;
          ptoType = ptoRecords[0].reason || ptoType;
          console.log('✅ Found PTO record:', { ptoId, ptoType });
        }
      } catch (searchError) {
        console.error('Search error:', searchError);
      }
    }

    if (!ptoId && schedule?.scheduleType === "recurring") {
      console.log('⚠️ This appears to be a recurring schedule with PTO...');
      try {
        const { data: exceptionData, error } = await supabase
          .from("schedule_exceptions")
          .select("id, reason")
          .eq("officer_id", officerId)
          .eq("date", date)
          .eq("shift_type_id", selectedShiftId)
          .eq("is_off", true);

        if (!error && exceptionData && exceptionData.length > 0) {
          ptoId = exceptionData[0].id;
          ptoType = exceptionData[0].reason || ptoType;
          console.log('✅ Found overriding PTO exception:', { ptoId, ptoType });
        } else {
          console.log('❌ No PTO exception found for this recurring day');
          toast.error("Cannot remove PTO: No PTO record found");
          return;
        }
      } catch (error) {
        console.error('Error checking for PTO exception:', error);
        toast.error("Error finding PTO data");
        return;
      }
    }

    if (!ptoId) {
      console.error('❌ Missing PTO ID after all attempts');
      toast.error("Cannot remove PTO: Missing PTO data");
      return;
    }

    const ptoMutationData = {
      id: ptoId,
      officerId: officerId,
      date: date,
      shiftTypeId: selectedShiftId,
      ptoType: ptoType,
      startTime: schedule?.ptoData?.startTime || schedule?.custom_start_time || "00:00",
      endTime: schedule?.ptoData?.endTime || schedule?.custom_end_time || "23:59"
    };

    console.log('🔄 Removing PTO with data:', ptoMutationData);

    removePTOMutation.mutate(ptoMutationData, {
      onSuccess: () => {
        try {
          auditLogger.logPTORemoval(
            officerId,
            ptoMutationData.ptoType,
            date,
            userEmail,
            `Removed ${ptoMutationData.ptoType} PTO on mobile`
          );
        } catch (logError) {
          console.error('Failed to log PTO removal audit:', logError);
        }
        
        toast.success(`PTO removed successfully`);
        queryClient.invalidateQueries({ queryKey: ['thebook-weekly-mobile'] });
        queryClient.invalidateQueries({ queryKey: ['thebook-monthly-mobile'] });
      },
      onError: (error) => {
        console.error('❌ Error removing PTO:', error);
        toast.error(`Failed to remove PTO: ${error.message || 'Unknown error'}`);
      }
    });
  };

  const handleEditAssignment = (officer: any, dateStr: string) => {
    console.log('📱 Opening assignment editor for:', officer.officerName, dateStr);
    
    setEditingAssignment({
      officer: officer,
      dateStr: dateStr,
      shiftTypeId: selectedShiftId,
      officerId: officer.officerId,
      officerName: officer.officerName
    });
  };

  const onRemoveOfficer = (scheduleId: string, type: 'recurring' | 'exception', officerData?: any) => {
    console.log('📱 Removing officer on mobile:', { scheduleId, type, officerData });
    
    removeOfficerMutation.mutate({
      scheduleId,
      type,
      officerData
    }, {
      onSuccess: () => {
        toast.success("Officer removed from schedule");
        queryClient.invalidateQueries({ queryKey: ['thebook-weekly-mobile'] });
        queryClient.invalidateQueries({ queryKey: ['thebook-monthly-mobile'] });
      },
      onError: (error) => {
        console.error('❌ Error removing officer:', error);
        toast.error("Failed to remove officer");
      }
    });
  };

  const handleSaveAssignment = (assignmentData: any) => {
    console.log('💾 Saving assignment:', assignmentData);
    
    updatePositionMutation.mutate(assignmentData, {
      onSuccess: () => {
        try {
          auditLogger.logAssignmentUpdate(
            assignmentData.officerId || editingAssignment?.officerId,
            editingAssignment?.officerName || "Unknown Officer",
            assignmentData.positionName,
            editingAssignment?.dateStr || "",
            userEmail,
            `Updated assignment via mobile`
          );
        } catch (logError) {
          console.error('Failed to log assignment audit:', logError);
        }
        
        toast.success("Assignment updated successfully");
        setEditingAssignment(null);
        queryClient.invalidateQueries({ queryKey: ['thebook-weekly-mobile'] });
        queryClient.invalidateQueries({ queryKey: ['thebook-monthly-mobile'] });
      },
      onError: (error) => {
        console.error('❌ Error updating assignment:', error);
        toast.error(error.message || "Failed to update assignment");
      }
    });
  };

  const renderView = () => {
    const isLoading = (activeView === "weekly" && weeklyLoading) || 
                     (activeView === "monthly" && monthlyLoading);

    if (isLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      );
    }

    switch (activeView) {
      case "weekly":
        return (
          <WeeklyViewMobile
            currentWeekStart={currentWeekStart}
            selectedShiftId={selectedShiftId}
            shiftTypes={shiftTypes || []}
            weeklyData={weeklyData || []}
            isAdminOrSupervisor={isAdminOrSupervisor}
            onPreviousWeek={goToPreviousWeek}
            onNextWeek={goToNextWeek}
            onToday={goToToday}
            onAssignPTO={handleAssignPTO}
            onRemovePTO={handleRemovePTO}
            onEditAssignment={handleEditAssignment}
            onRemoveOfficer={onRemoveOfficer}
            isUpdating={assignPTOMutation.isPending || updatePositionMutation.isPending}
          />
        );
      
      case "monthly":
        return (
          <MonthlyViewMobile
            currentMonth={currentMonth}
            selectedShiftId={selectedShiftId}
            shiftTypes={shiftTypes || []}
            monthlyData={monthlyData || []}
            onPreviousMonth={goToPreviousMonth}
            onNextMonth={goToNextMonth}
            onToday={goToToday}
            onAssignPTO={handleAssignPTO}
            onRemovePTO={handleRemovePTO}
            onEditAssignment={handleEditAssignment}
          />
        );
      
      case "force-list":
        return (
          <ForceListViewMobile
            selectedShiftId={selectedShiftId}
            setSelectedShiftId={setSelectedShiftId}
            shiftTypes={shiftTypes || []}
            isAdminOrSupervisor={isAdminOrSupervisor}
          />
        );
      
      case "vacation-list":
        return (
          <VacationListViewMobile
            selectedShiftId={selectedShiftId}
            setSelectedShiftId={setSelectedShiftId}
            shiftTypes={shiftTypes || []}
          />
        );
      
      case "beat-preferences":
        return (
          <BeatPreferencesViewMobile
            isAdminOrSupervisor={isAdminOrSupervisor}
            selectedShiftId={selectedShiftId}
            setSelectedShiftId={setSelectedShiftId}
            shiftTypes={shiftTypes || []}
          />
        );
      
      default:
        return <div className="text-center py-8 text-muted-foreground">Select a view</div>;
    }
  };

  if (shiftsLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-6 w-1/2 mb-4" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Shift Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              <h3 className="font-semibold">The Book</h3>
            </div>
          </div>
          
          <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
            <SelectTrigger>
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
        </CardContent>
      </Card>

      {/* The Book Tabs */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={activeView} onValueChange={(v: any) => setActiveView(v)}>
            <TabsList className="w-full grid grid-cols-5 h-12 rounded-none">
              <TabsTrigger value="weekly" className="flex-col h-full py-2 text-xs">
                <CalendarIcon className="h-4 w-4 mb-1" />
                Weekly
              </TabsTrigger>
              <TabsTrigger value="monthly" className="flex-col h-full py-2 text-xs">
                <CalendarDays className="h-4 w-4 mb-1" />
                Monthly
              </TabsTrigger>
              <TabsTrigger value="force-list" className="flex-col h-full py-2 text-xs">
                <Users className="h-4 w-4 mb-1" />
                Force
              </TabsTrigger>
              <TabsTrigger value="vacation-list" className="flex-col h-full py-2 text-xs">
                <Plane className="h-4 w-4 mb-1" />
                Vacation
              </TabsTrigger>
              <TabsTrigger value="beat-preferences" className="flex-col h-full py-2 text-xs">
                <MapPin className="h-4 w-4 mb-1" />
                Beats
              </TabsTrigger>
            </TabsList>
            
            <div className="p-4">
              {selectedShiftId ? (
                renderView()
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Please select a shift to view schedule</p>
                </div>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* PTO Dialog */}
      {selectedOfficer && (
        <PTODialogMobile
          open={ptoDialogOpen}
          onOpenChange={setPtoDialogOpen}
          officerName={selectedOfficer.name}
          date={selectedOfficer.date}
          officerId={selectedOfficer.id}
          shiftTypeId={selectedShiftId}
          shiftStartTime={selectedOfficer.shiftStartTime}
          shiftEndTime={selectedOfficer.shiftEndTime}
          onSave={handleSavePTO}
          isUpdating={assignPTOMutation.isPending}
        />
      )}

      {/* Assignment Edit Dialog */}
      <AssignmentEditDialogMobile
        editingAssignment={editingAssignment}
        onClose={() => {
          setEditingAssignment(null);
        }}
        onSave={handleSaveAssignment}
        isUpdating={updatePositionMutation.isPending}
      />
    </div>
  );
};

export default TheBookMobile;
