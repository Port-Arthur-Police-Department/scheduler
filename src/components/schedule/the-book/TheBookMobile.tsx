// src/components/schedule/the-book/TheBookMobile.tsx
import MonthlyViewMobile from "./MonthlyViewMobile";
import VacationListViewMobile from "./VacationListViewMobile";
import BeatPreferencesViewMobile from "./BeatPreferencesViewMobile";
import ForceListViewMobile from "./ForceListViewMobile";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, ChevronLeft, ChevronRight, CalendarDays, Users, Plane, MapPin, MoreVertical, Edit, Trash2, Download } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, addMonths, subMonths, isToday, parseISO } from "date-fns";

// Import your desktop components for data fetching and processing
import { getLastName, getRankAbbreviation, isSupervisorByRank, categorizeAndSortOfficers } from "./utils";
import { ForceListView } from "./ForceListView";
import { VacationListView } from "./VacationListView";
import { BeatPreferencesView } from "./BeatPreferencesView";
import type { TheBookView, ScheduleData } from "./types";

interface TheBookMobileProps {
  userRole?: string;
  isAdminOrSupervisor?: boolean;
}

const TheBookMobile = ({ userRole = 'officer', isAdminOrSupervisor = false }: TheBookMobileProps) => {
  const [activeView, setActiveView] = useState<TheBookView>("weekly");
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [currentMonth, setCurrentMonth] = useState(new Date());
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

  // Fetch schedule data for current view
  const { data: scheduleData, isLoading: scheduleLoading } = useQuery({
    queryKey: ['schedule-data', activeView, selectedShiftId, currentWeekStart.toISOString(), currentMonth.toISOString()],
    queryFn: async () => {
      if (!selectedShiftId) return null;

      const startDate = activeView === "weekly" 
        ? currentWeekStart 
        : startOfMonth(currentMonth);
      const endDate = activeView === "weekly" 
        ? endOfWeek(currentWeekStart, { weekStartsOn: 0 }) 
        : endOfMonth(currentMonth);

      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      // Fetch schedule exceptions for the date range
      const { data: exceptions, error: exceptionsError } = await supabase
        .from("schedule_exceptions")
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
        .gte("date", startStr)
        .lte("date", endStr)
        .order("date", { ascending: true });

      if (exceptionsError) throw exceptionsError;

      // Fetch recurring schedules for the selected shift
      const { data: recurringSchedules, error: recurringError } = await supabase
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
        .or(`end_date.is.null,end_date.gte.${startStr}`);

      if (recurringError) throw recurringError;

      // Generate daily schedules
      const dailySchedules: any[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = format(currentDate, "yyyy-MM-dd");
        const dayOfWeek = currentDate.getDay();
        
        // Get exceptions for this date
        const dateExceptions = exceptions?.filter(e => e.date === dateStr) || [];
        
        // Get recurring schedules for this day of week
        const dateRecurring = recurringSchedules?.filter(r => r.day_of_week === dayOfWeek) || [];
        
        // Combine and deduplicate officers
        const allOfficers = [...dateExceptions, ...dateRecurring];
        const officerMap = new Map();
        
        allOfficers.forEach(item => {
          const officerId = item.officer_id;
          if (!officerMap.has(officerId) || item.date === dateStr) {
            // Prefer exceptions over recurring
            officerMap.set(officerId, {
              officerId: item.officer_id,
              officerName: item.profiles?.full_name || "Unknown",
              badgeNumber: item.profiles?.badge_number,
              rank: item.profiles?.rank || "Officer",
              date: dateStr,
              dayOfWeek,
              shiftInfo: {
                scheduleId: item.id,
                scheduleType: item.date ? "exception" : "recurring",
                position: item.position_name,
                isOff: item.is_off || false,
                hasPTO: item.pto_type ? true : false,
                ptoData: item.pto_type ? {
                  ptoType: item.pto_type,
                  isFullShift: item.pto_full_day || false
                } : undefined
              }
            });
          }
        });

        const officers = Array.from(officerMap.values());
        const categorized = categorizeAndSortOfficers(officers);

        dailySchedules.push({
          date: dateStr,
          dayOfWeek,
          officers,
          categorizedOfficers: categorized
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return {
        dailySchedules,
        recurring: recurringSchedules || [],
        exceptions: exceptions || [],
        startDate: startStr,
        endDate: endStr
      } as ScheduleData;
    },
    enabled: !!selectedShiftId && (activeView === "weekly" || activeView === "monthly"),
  });

  const goToPreviousWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const goToNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
  const goToPreviousMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const goToToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
    setCurrentMonth(new Date());
  };

  const renderWeeklyView = () => {
    if (scheduleLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      );
    }

    if (!scheduleData) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No schedule data available</p>
        </div>
      );
    }

    const days = scheduleData.dailySchedules.slice(0, 7); // First week
    
    return (
      <div className="space-y-3">
        {days.map((day) => (
          <Card key={day.date} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {format(parseISO(day.date), "EEEE")}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {format(parseISO(day.date), "MMM d, yyyy")}
                    {isToday(parseISO(day.date)) && (
                      <Badge variant="outline" className="ml-2">Today</Badge>
                    )}
                  </p>
                </div>
                <Badge variant="outline">
                  {day.officers.length} officers
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-2">
                {/* Supervisors */}
                {day.categorizedOfficers.supervisors.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Supervisors</div>
                    <div className="space-y-1">
                      {day.categorizedOfficers.supervisors.map((officer) => (
                        <div key={officer.officerId} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                          <div>
                            <div className="font-medium text-sm">
                              {getLastName(officer.officerName)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {getRankAbbreviation(officer.rank)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              {officer.shiftInfo.position || "Unassigned"}
                            </div>
                            {officer.shiftInfo.hasPTO && (
                              <Badge variant="outline" className="text-xs">
                                PTO
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Officers */}
                {day.categorizedOfficers.officers.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Officers</div>
                    <div className="space-y-1">
                      {day.categorizedOfficers.officers.slice(0, 3).map((officer) => (
                        <div key={officer.officerId} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                          <div>
                            <div className="font-medium text-sm">
                              {getLastName(officer.officerName)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {officer.badgeNumber}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm">
                              {officer.shiftInfo.position || "Unassigned"}
                            </div>
                            {officer.shiftInfo.hasPTO && (
                              <Badge variant="outline" className="text-xs">
                                PTO
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                      {day.categorizedOfficers.officers.length > 3 && (
                        <div className="text-center text-sm text-muted-foreground pt-1">
                          +{day.categorizedOfficers.officers.length - 3} more officers
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* PPOs */}
                {day.categorizedOfficers.ppos.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">PPOs</div>
                    <div className="space-y-1">
                      {day.categorizedOfficers.ppos.map((officer) => (
                        <div key={officer.officerId} className="flex items-center justify-between p-2 bg-green-50 rounded">
                          <div>
                            <div className="font-medium text-sm">
                              {getLastName(officer.officerName)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {officer.badgeNumber}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm">
                              {officer.shiftInfo.position || "Training"}
                            </div>
                            <Badge variant="outline" className="text-xs bg-green-100">
                              PPO
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderMonthlyView = () => {
    if (scheduleLoading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-64 w-full" />
        </div>
      );
    }

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = monthEnd.getDate();
    
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4">
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map(day => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground p-1">
                  {day}
                </div>
              ))}
              
              {Array.from({ length: monthStart.getDay() }).map((_, index) => (
                <div key={`empty-${index}`} className="h-10" />
              ))}
              
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1;
                const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                const dateStr = format(date, "yyyy-MM-dd");
                const daySchedule = scheduleData?.dailySchedules?.find(s => s.date === dateStr);
                const isCurrentDay = isToday(date);
                
                return (
                  <div
                    key={day}
                    className={`h-10 flex flex-col items-center justify-center rounded-lg text-sm cursor-pointer
                      ${isCurrentDay 
                        ? 'bg-primary text-primary-foreground font-semibold' 
                        : 'bg-background hover:bg-muted'
                      }`}
                    onClick={() => {
                      // Navigate to daily view
                      toast.info(`Viewing schedule for ${format(date, "MMM d")}`);
                    }}
                  >
                    <div>{day}</div>
                    {daySchedule && daySchedule.officers.length > 0 && (
                      <div className="text-[8px] opacity-75">
                        {daySchedule.officers.length}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        
        {/* Month summary */}
        {scheduleData && (
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-blue-50 rounded">
                  <div className="text-lg font-bold">
                    {scheduleData.dailySchedules.reduce((sum, day) => 
                      sum + day.categorizedOfficers.supervisors.length, 0
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">Supervisors</div>
                </div>
                <div className="p-2 bg-gray-50 rounded">
                  <div className="text-lg font-bold">
                    {scheduleData.dailySchedules.reduce((sum, day) => 
                      sum + day.categorizedOfficers.officers.length, 0
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">Officers</div>
                </div>
                <div className="p-2 bg-green-50 rounded">
                  <div className="text-lg font-bold">
                    {scheduleData.dailySchedules.reduce((sum, day) => 
                      sum + day.categorizedOfficers.ppos.length, 0
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">PPOs</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderForceListView = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="font-semibold mb-2">Force List</h3>
        <p className="text-sm text-muted-foreground mb-4">
          View force assignments and availability
        </p>
      </div>
      {selectedShiftId ? (
        <ForceListView
          selectedShiftId={selectedShiftId}
          setSelectedShiftId={setSelectedShiftId}
          shiftTypes={shiftTypes || []}
          isAdminOrSupervisor={isAdminOrSupervisor}
        />
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Please select a shift first</p>
        </div>
      )}
    </div>
  );

  const renderVacationListView = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="font-semibold mb-2">Vacation List</h3>
        <p className="text-sm text-muted-foreground mb-4">
          View and manage time-off requests
        </p>
      </div>
      {selectedShiftId ? (
        <VacationListView
          selectedShiftId={selectedShiftId}
          setSelectedShiftId={setSelectedShiftId}
          shiftTypes={shiftTypes || []}
        />
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Plane className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Please select a shift first</p>
        </div>
      )}
    </div>
  );

  const renderBeatPreferencesView = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="font-semibold mb-2">Beat Preferences</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Officer preferences for assignments
        </p>
      </div>
      {selectedShiftId ? (
        <BeatPreferencesView
          isAdminOrSupervisor={isAdminOrSupervisor}
          selectedShiftId={selectedShiftId}
          setSelectedShiftId={setSelectedShiftId}
          shiftTypes={shiftTypes || []}
        />
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Please select a shift first</p>
        </div>
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

  // Update the shift selection automatically if not set
  useEffect(() => {
    if (shiftTypes && shiftTypes.length > 0 && !selectedShiftId) {
      setSelectedShiftId(shiftTypes[0].id);
    }
  }, [shiftTypes]);

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
    <div className="space-y-4 pb-20">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {shiftTypes?.find(s => s.id === selectedShiftId)?.name || "Schedule"}
            </CardTitle>
            
            {selectedShiftId && (
              <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {shiftTypes?.map((shift) => (
                    <SelectItem key={shift.id} value={shift.id}>
                      {shift.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Mobile tabs */}
          <Tabs value={activeView} onValueChange={(v: TheBookView) => setActiveView(v)} className="mt-3">
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
                        onClick={() => {
                          setActiveView("force-list");
                          const sheet = document.querySelector('[data-state="open"]');
                          (sheet as any)?.click?.(); // Close sheet
                        }}
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Force List
                      </Button>
                      <Button
                        variant={activeView === "vacation-list" ? "default" : "ghost"}
                        className="w-full justify-start"
                        onClick={() => {
                          setActiveView("vacation-list");
                          const sheet = document.querySelector('[data-state="open"]');
                          (sheet as any)?.click?.();
                        }}
                      >
                        <Plane className="h-4 w-4 mr-2" />
                        Vacation List
                      </Button>
                      <Button
                        variant={activeView === "beat-preferences" ? "default" : "ghost"}
                        className="w-full justify-start"
                        onClick={() => {
                          setActiveView("beat-preferences");
                          const sheet = document.querySelector('[data-state="open"]');
                          (sheet as any)?.click?.();
                        }}
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        Beat Preferences
                      </Button>
                    </div>
                    
                    {/* Export option for admins */}
                    {isAdminOrSupervisor && (
                      <div className="pt-4 border-t">
                        <Button variant="outline" className="w-full justify-start">
                          <Download className="h-4 w-4 mr-2" />
                          Export Schedule
                        </Button>
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </TabsList>
            
            <TabsContent value="weekly" className="mt-4">
              <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg mb-4">
                <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                  <div className="font-semibold">
                    Week of {format(currentWeekStart, "MMM d")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(currentWeekStart, "MMM d")} - {format(endOfWeek(currentWeekStart), "MMM d, yyyy")}
                  </div>
                </div>
                <Button variant="outline" size="icon" onClick={goToNextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="monthly" className="mt-4">
              <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg mb-4">
                <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                  <div className="font-semibold">
                    {format(currentMonth, "MMMM yyyy")}
                  </div>
                  <Button variant="ghost" size="sm" onClick={goToToday}>
                    Today
                  </Button>
                </div>
                <Button variant="outline" size="icon" onClick={goToNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardHeader>
        
        <CardContent>
          {selectedShiftId ? (
            renderView()
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
