// src/components/schedule/the-book/TheBookMobile.tsx
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, ChevronLeft, ChevronRight, CalendarDays, Users, Plane, MapPin, MoreVertical, Edit, Trash2, Download } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth } from "date-fns";
import MonthlyViewMobile from "./MonthlyViewMobile";
import VacationListViewMobile from "./VacationListViewMobile";
import BeatPreferencesViewMobile from "./BeatPreferencesViewMobile";
import ForceListViewMobile from "./ForceListViewMobile";

interface TheBookMobileProps {
  userRole?: string;
  isAdminOrSupervisor?: boolean;
}

const TheBookMobile = ({ userRole = 'officer', isAdminOrSupervisor = false }: TheBookMobileProps) => {
  const [activeView, setActiveView] = useState<"weekly" | "monthly" | "force-list" | "vacation-list" | "beat-preferences">("weekly");
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { userEmail } = useUser();
  const queryClient = useQueryClient();

  // Get shift types (same as desktop)
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

  // Fetch schedule data for mobile (simplified version of desktop logic)
  const { data: scheduleData, isLoading: scheduleLoading } = useQuery({
    queryKey: ['mobile-schedule', activeView, selectedShiftId, currentWeekStart.toISOString(), currentMonth.toISOString()],
    queryFn: async () => {
      if (!selectedShiftId || !shiftTypes) return [];

      try {
        const startDate = activeView === "weekly" ? currentWeekStart : startOfMonth(currentMonth);
        const endDate = activeView === "weekly" ? endOfWeek(currentWeekStart, { weekStartsOn: 0 }) : endOfMonth(currentMonth);
        
        // Fetch recurring schedules for the selected shift
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

        // Transform data for mobile display
        const officers = recurringData?.map(schedule => ({
          id: schedule.officer_id,
          name: schedule.profiles?.full_name || "Unknown",
          emplId: schedule.profiles?.badge_number || "N/A",
          shift: schedule.shift_types?.name || "Unknown",
          rank: schedule.profiles?.rank || "Officer",
          position: schedule.position_name || "Not assigned",
          schedule: ["A", "B", "Off", "A", "B", "Off", "Off"], // Simplified for now
          ptoBalance: 0, // You can fetch this if needed
          status: "Regular",
          scheduleId: schedule.id,
          scheduleType: "recurring" as const
        })) || [];

        return officers;
      } catch (error) {
        console.error("Error fetching mobile schedule:", error);
        return [];
      }
    },
    enabled: !!selectedShiftId && !!shiftTypes,
  });

  const goToPreviousWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const goToNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
  const goToPreviousMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goToNextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const handleEditAssignment = (officerId: string, scheduleId: string) => {
    toast.info("Edit assignment functionality coming soon");
    // Add your edit logic here
  };

  const handleRemoveOfficer = (scheduleId: string, officerName: string) => {
    if (window.confirm(`Remove ${officerName} from schedule?`)) {
      toast.success(`${officerName} removed from schedule`);
      // Add your removal logic here
    }
  };

  const renderWeeklyView = () => {
    if (scheduleLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-3" />
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return (
      <div className="space-y-3">
        {scheduleData?.map((officer) => (
          <Card key={officer.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{officer.name}</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {officer.rank}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    #{officer.emplId} • {officer.shift} • {officer.position}
                  </div>
                </div>
                
                {isAdminOrSupervisor && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        className="text-sm"
                        onClick={() => handleEditAssignment(officer.id, officer.scheduleId)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Assignment
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-sm text-destructive"
                        onClick={() => handleRemoveOfficer(officer.scheduleId, officer.name)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-3">
                {days.map((day, index) => (
                  <div key={day} className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">{day}</div>
                    <div className={`text-sm font-medium p-1 rounded ${
                      officer.schedule[index] === "Off" 
                        ? "bg-gray-100 text-gray-600"
                        : "bg-blue-50 text-blue-700"
                    }`}>
                      {officer.schedule[index] || "-"}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <span className="ml-2 font-medium">{officer.status}</span>
                </div>
                <Badge variant={officer.rank.includes("Sergeant") ? "default" : "secondary"}>
                  {officer.rank.includes("Sergeant") ? "Supervisor" : "Officer"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!scheduleData || scheduleData.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No officers scheduled for this shift</p>
          </div>
        )}
      </div>
    );
  };

  const renderMonthlyView = () => (
    <div className="text-center py-8">
      <CalendarDays className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <h3 className="font-semibold mb-2">Monthly Calendar View</h3>
      <p className="text-sm text-muted-foreground mb-4">
        {format(currentMonth, "MMMM yyyy")}
      </p>
      <div className="flex justify-center gap-2">
        <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
          Today
        </Button>
        <Button variant="outline" size="sm" onClick={goToNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderForceListView = () => (
    <div className="space-y-3">
      {shiftTypes?.map((shift) => (
        <Card key={shift.id}>
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold">{shift.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {shift.start_time} - {shift.end_time}
                </p>
              </div>
              <Button variant="ghost" size="sm">
                View Roster
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderVacationListView = () => (
    <div className="text-center py-8">
      <Plane className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <h3 className="font-semibold mb-2">PTO & Vacation Requests</h3>
      <p className="text-sm text-muted-foreground">
        View and manage time-off requests
      </p>
      {isAdminOrSupervisor && (
        <Button className="mt-4">Manage PTO Requests</Button>
      )}
    </div>
  );

  const renderBeatPreferencesView = () => (
    <div className="text-center py-8">
      <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <h3 className="font-semibold mb-2">Beat & Assignment Preferences</h3>
      <p className="text-sm text-muted-foreground">
        Officer preferences for assignments and beats
      </p>
      {isAdminOrSupervisor && (
        <Button className="mt-4">View Preferences</Button>
      )}
    </div>
  );

  const renderView = () => {
    switch (activeView) {
      case "weekly":
        return renderWeeklyView();
      case "monthly":
        return renderMonthlyView();
      case "force-list":
        return renderForceListView();
      case "vacation-list":
        return renderVacationListView();
      case "beat-preferences":
        return renderBeatPreferencesView();
      default:
        return renderWeeklyView();
    }
  };

  if (shiftsLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-24"> {/* Extra padding for bottom nav */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {shiftTypes?.find(s => s.id === selectedShiftId)?.name || "Schedule"}
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {isAdminOrSupervisor && activeView === "weekly" && (
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4" />
                </Button>
              )}
              <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Select Shift" />
                </SelectTrigger>
                <SelectContent>
                  {shiftTypes?.map((shift) => (
                    <SelectItem key={shift.id} value={shift.id}>
                      {shift.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Mobile tabs */}
          <div className="mt-3">
            <Tabs value={activeView} onValueChange={(v: any) => setActiveView(v)}>
              <TabsList className="w-full grid grid-cols-3 h-auto p-1">
                <TabsTrigger value="weekly" className="flex-col h-auto py-2 text-xs">
                  <CalendarIcon className="h-4 w-4 mb-1" />
                  Weekly
                </TabsTrigger>
                <TabsTrigger value="monthly" className="flex-col h-auto py-2 text-xs">
                  <CalendarDays className="h-4 w-4 mb-1" />
                  Monthly
                </TabsTrigger>
                
                <Sheet>
                  <SheetTrigger asChild>
                    <TabsTrigger value="more" className="flex-col h-auto py-2 text-xs">
                      <Users className="h-4 w-4 mb-1" />
                      More
                    </TabsTrigger>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[60vh] rounded-t-xl">
                    <div className="pt-6 space-y-4">
                      <h3 className="font-semibold text-lg mb-4">Schedule Views</h3>
                      <div className="space-y-2">
                        <Button
                          variant={activeView === "force-list" ? "default" : "ghost"}
                          className="w-full justify-start"
                          onClick={() => setActiveView("force-list")}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Force List
                        </Button>
                        <Button
                          variant={activeView === "vacation-list" ? "default" : "ghost"}
                          className="w-full justify-start"
                          onClick={() => setActiveView("vacation-list")}
                        >
                          <Plane className="h-4 w-4 mr-2" />
                          Vacation List
                        </Button>
                        <Button
                          variant={activeView === "beat-preferences" ? "default" : "ghost"}
                          className="w-full justify-start"
                          onClick={() => setActiveView("beat-preferences")}
                        >
                          <MapPin className="h-4 w-4 mr-2" />
                          Beat Preferences
                        </Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        
        <CardContent>
          {selectedShiftId ? (
            <div className="space-y-4">
              {(activeView === "weekly" || activeView === "monthly") && (
                <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={activeView === "weekly" ? goToPreviousWeek : goToPreviousMonth}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-center">
                    <div className="font-semibold">
                      {activeView === "weekly" 
                        ? `Week ${format(currentWeekStart, "w")}`
                        : format(currentMonth, "MMMM yyyy")
                      }
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {activeView === "weekly"
                        ? `${format(currentWeekStart, "MMM d")} - ${format(endOfWeek(currentWeekStart), "MMM d, yyyy")}`
                        : format(currentMonth, "yyyy")
                      }
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={activeView === "weekly" ? goToNextWeek : goToNextMonth}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              {renderView()}
              
              {activeView === "weekly" && isAdminOrSupervisor && (
                <Card className="border-dashed">
                  <CardContent className="p-4 text-center">
                    <Button variant="outline" className="w-full">
                      + Add Officer to Schedule
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Please select a shift to view schedule</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TheBookMobile;
