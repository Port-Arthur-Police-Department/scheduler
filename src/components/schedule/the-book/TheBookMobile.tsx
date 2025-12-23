// TheBookMobile.tsx - Mobile version of JUST The Book tab
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, ChevronLeft, ChevronRight, CalendarDays, Users, Plane, MapPin, Download } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { useWeeklyScheduleMutations } from "@/hooks/useWeeklyScheduleMutations";
import { useUser } from "@/contexts/UserContext";
import { auditLogger } from "@/lib/auditLogger";

// Import mobile view components
import { WeeklyViewMobile } from "./WeeklyViewMobile";
import { MonthlyViewMobile } from "./MonthlyViewMobile";
import { ForceListViewMobile } from "./ForceListViewMobile";
import { VacationListViewMobile } from "./VacationListViewMobile";
import { BeatPreferencesViewMobile } from "./BeatPreferencesViewMobile";
// Import PTO Dialog
import { PTODialogMobile } from "./PTODialogMobile";

interface TheBookMobileProps {
  userRole?: 'officer' | 'supervisor' | 'admin';
  isAdminOrSupervisor?: boolean;
}

const TheBookMobile = ({ userRole = 'officer', isAdminOrSupervisor = false }: TheBookMobileProps) => {
  const [activeView, setActiveView] = useState<"weekly" | "monthly" | "force-list" | "vacation-list" | "beat-preferences">("weekly");
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // PTO Dialog state
  const [ptoDialogOpen, setPtoDialogOpen] = useState(false);
  const [selectedOfficer, setSelectedOfficer] = useState<{
    id: string;
    name: string;
    date: string;
    schedule: any;
  } | null>(null);

  // Get user context for audit logging
  const { userEmail } = useUser();

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

  // Initialize with first shift
  useEffect(() => {
    if (shiftTypes && shiftTypes.length > 0 && !selectedShiftId) {
      setSelectedShiftId(shiftTypes[0].id);
    }
  }, [shiftTypes]);

  // Setup mutations
  const mutationsResult = useWeeklyScheduleMutations(
    currentWeekStart,
    currentMonth,
    activeView,
    selectedShiftId
  );

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

  // Add PTO Assignment Mutation
  const assignPTOMutation = useMutation({
    mutationFn: async (ptoData: any) => {
      console.log('🎯 Assigning PTO on mobile:', ptoData);

      // Check if there's already a schedule exception for this officer on this date
      const { data: existingExceptions, error: checkError } = await supabase
        .from("schedule_exceptions")
        .select("id")
        .eq("officer_id", ptoData.officerId)
        .eq("date", ptoData.date)
        .eq("shift_type_id", ptoData.shiftTypeId);

      if (checkError) throw checkError;

      let exceptionId;

      if (existingExceptions && existingExceptions.length > 0) {
        // Update existing exception
        const { error: updateError } = await supabase
          .from("schedule_exceptions")
          .update({
            is_off: true,
            reason: ptoData.ptoType,
            custom_start_time: ptoData.startTime,
            custom_end_time: ptoData.endTime,
            position_name: null,
            unit_number: null,
            notes: `PTO: ${ptoData.ptoType}`
          })
          .eq("id", existingExceptions[0].id);

        if (updateError) throw updateError;
        exceptionId = existingExceptions[0].id;
      } else {
        // Create new exception
        const { data: newException, error: insertError } = await supabase
          .from("schedule_exceptions")
          .insert({
            officer_id: ptoData.officerId,
            date: ptoData.date,
            shift_type_id: ptoData.shiftTypeId,
            is_off: true,
            reason: ptoData.ptoType,
            custom_start_time: ptoData.startTime,
            custom_end_time: ptoData.endTime,
            position_name: null,
            unit_number: null,
            notes: `PTO: ${ptoData.ptoType}`
          })
          .select("id")
          .single();

        if (insertError) throw insertError;
        exceptionId = newException.id;
      }

      // Deduct from PTO balance (matching desktop logic)
      const ptoColumn = getPTOColumn(ptoData.ptoType);
      if (ptoColumn) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", ptoData.officerId)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
        } else if (profile) {
          const currentBalance = profile[ptoColumn as keyof typeof profile] as number;
          const hoursUsed = calculateHoursUsed(ptoData.startTime, ptoData.endTime);
          
          const { error: updateBalanceError } = await supabase
            .from("profiles")
            .update({
              [ptoColumn]: Math.max(0, (currentBalance || 0) - hoursUsed),
            })
            .eq("id", ptoData.officerId);

          if (updateBalanceError) {
            console.error('Error updating PTO balance:', updateBalanceError);
          }
        }
      }

      return { id: exceptionId, success: true };
    },
    onSuccess: () => {
      toast.success("PTO assigned successfully");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: any) => {
      console.error('❌ Error assigning PTO:', error);
      toast.error(error.message || "Failed to assign PTO");
    },
  });

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
      return 8; // Default to 8 hours
    }
  };

  const { useMutation: useReactQueryMutation, useQueryClient } = require('@tanstack/react-query');
  const queryClient = useQueryClient();

  // Navigation functions
  const goToPreviousWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const goToNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
  const goToPreviousMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const goToToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
    setCurrentMonth(new Date());
  };

  // Event handlers for mobile
  const handleAssignPTO = (schedule: any, date: string, officerId: string, officerName: string) => {
    console.log('📱 Opening PTO dialog for:', officerName, date);
    
    setSelectedOfficer({
      id: officerId,
      name: officerName,
      date: date,
      schedule: schedule
    });
    setPtoDialogOpen(true);
  };

  const handleSavePTO = async (ptoData: any) => {
    if (!selectedOfficer || !selectedShiftId) {
      toast.error("Missing required information");
      return;
    }

    console.log('💾 Saving PTO:', ptoData);

    // Call the mutation to assign PTO
    assignPTOMutation.mutate({
      ...ptoData,
      officerId: selectedOfficer.id,
      date: selectedOfficer.date,
      shiftTypeId: selectedShiftId
    }, {
      onSuccess: () => {
        // Log audit trail
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
        
        // Close dialog
        setPtoDialogOpen(false);
        setSelectedOfficer(null);
      }
    });
  };

  const handleRemovePTO = async (schedule: any, date: string, officerId: string) => {
    if (!schedule?.ptoData?.id) {
      console.error('❌ Missing PTO data');
      toast.error("Cannot remove PTO: Missing PTO data");
      return;
    }

    const ptoMutationData = {
      id: schedule.ptoData.id,
      officerId: officerId,
      date: date,
      shiftTypeId: selectedShiftId,
      ptoType: schedule.ptoData.ptoType || "PTO",
      startTime: schedule.ptoData.startTime || "00:00",
      endTime: schedule.ptoData.endTime || "23:59"
    };

    console.log('🔄 Removing PTO on mobile:', ptoMutationData);

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
      },
      onError: (error) => {
        console.error('❌ Error removing PTO:', error);
        toast.error(`Failed to remove PTO`);
      }
    });
  };

  const handleEditAssignment = (officer: any, dateStr: string) => {
    // For mobile, show a toast with info
    toast.info(`To edit assignment for ${officer.officerName} on ${dateStr}, please use the desktop version for now. Mobile editing coming soon.`, {
      duration: 4000,
    });
  };

  const handleRemoveOfficer = (scheduleId: string, type: 'recurring' | 'exception', officerData?: any) => {
    console.log('🔄 Removing officer on mobile:', { scheduleId, type, officerData });

    removeOfficerMutation.mutate({
      scheduleId,
      type,
      officerData
    }, {
      onSuccess: () => {
        if (officerData) {
          const officerId = officerData?.officerId || officerData?.officer_id || officerData?.id;
          const officerName = officerData?.officerName || officerData?.full_name || 'Unknown Officer';
          
          auditLogger.logOfficerRemoval(
            officerId,
            officerName,
            userEmail,
            `Removed ${officerName} from schedule on mobile`
          );
        }
        toast.success("Officer removed from schedule");
      },
      onError: (error) => {
        console.error('Error removing officer:', error);
        toast.error("Failed to remove officer");
      }
    });
  };

  const renderView = () => {
    switch (activeView) {
      case "weekly":
        return (
          <WeeklyViewMobile
            currentWeekStart={currentWeekStart}
            selectedShiftId={selectedShiftId}
            shiftTypes={shiftTypes || []}
            isAdminOrSupervisor={isAdminOrSupervisor}
            onPreviousWeek={goToPreviousWeek}
            onNextWeek={goToNextWeek}
            onToday={goToToday}
            // Pass the action handlers
            onAssignPTO={handleAssignPTO}
            onRemovePTO={handleRemovePTO}
            onEditAssignment={handleEditAssignment}
            onRemoveOfficer={handleRemoveOfficer}
            isUpdating={removeOfficerMutation.isPending || assignPTOMutation.isPending}
          />
        );
      
      case "monthly":
        return (
          <MonthlyViewMobile
            currentMonth={currentMonth}
            selectedShiftId={selectedShiftId}
            shiftTypes={shiftTypes || []}
            onPreviousMonth={goToPreviousMonth}
            onNextMonth={goToNextMonth}
            onToday={goToToday}
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
        return <div>Select a view</div>;
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
            {isAdminOrSupervisor && (
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
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
          onSave={handleSavePTO}
          isUpdating={assignPTOMutation.isPending}
        />
      )}
    </div>
  );
};

export default TheBookMobile;
