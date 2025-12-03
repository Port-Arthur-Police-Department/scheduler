// src/components/schedule/the-book/TheBook.tsx
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarIcon, Download, ChevronLeft, ChevronRight, CalendarDays, Users, Plane, MapPin } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, isSameMonth, isSameDay } from "date-fns";
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

  // Main schedule query for weekly/monthly views
  const { data: schedules, isLoading: schedulesLoading, error } = useQuery<ScheduleData>({
    queryKey: ['schedule-data', activeView, selectedShiftId, currentWeekStart, currentMonth],
    queryFn: async () => {
      // This will be implemented in each view component's data fetching
      // For now, return null - views will handle their own data
      return null as any;
    },
    enabled: false, // Each view will handle its own data fetching
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
    // This will be handled by the MonthlyView component
  };

  const handleSaveAssignment = () => {
    if (!editingAssignment) return;

    const { officer, dateStr } = editingAssignment;
    
    updatePositionMutation.mutate({
      scheduleId: officer.shiftInfo.scheduleId,
      type: officer.shiftInfo.scheduleType,
      positionName: "Position", // This will come from the dialog
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
          "Position", // This will come from the dialog
          userEmail,
          `Changed position from "${officer.shiftInfo.position}" to "Position" for ${officer.officerName} on ${dateStr}`
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
