import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, ChevronLeft, ChevronRight, CalendarDays, Users, Plane, MapPin, Download } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";

// Import mobile view components
import { WeeklyViewMobile } from "./WeeklyViewMobile";
import { MonthlyViewMobile } from "./MonthlyViewMobile";
import { ForceListViewMobile } from "./ForceListViewMobile";
import { VacationListViewMobile } from "./VacationListViewMobile";
import { BeatPreferencesViewMobile } from "./BeatPreferencesViewMobile";

// Import utilities
import { getLastName, getRankPriority, isSupervisorByRank } from "./utils";
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

  // Fetch schedule data
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

      // Fetch schedule exceptions
      const { data: exceptions, error: exceptionsError } = await supabase
        .from("schedule_exceptions")
        .select(`
          *,
          profiles:officer_id (
            id, full_name, badge_number, rank, hire_date
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
            id, full_name, badge_number, rank, hire_date
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
        
        const dateExceptions = exceptions?.filter(e => e.date === dateStr) || [];
        const dateRecurring = recurringSchedules?.filter(r => r.day_of_week === dayOfWeek) || [];
        
        const allOfficers = [...dateExceptions, ...dateRecurring];
        const officerMap = new Map();
        
        allOfficers.forEach(item => {
          const officerId = item.officer_id;
          if (!officerMap.has(officerId) || item.date === dateStr) {
            officerMap.set(officerId, {
              officerId: item.officer_id,
              officerName: item.profiles?.full_name || "Unknown",
              badgeNumber: item.profiles?.badge_number,
              rank: item.profiles?.rank || "Officer",
              service_credit: 0, // You might want to fetch this
              date: dateStr,
              dayOfWeek,
              isRegularRecurringDay: !item.date, // No date means recurring
              shiftInfo: {
                scheduleId: item.id,
                scheduleType: item.date ? "exception" : "recurring",
                position: item.position_name,
                isOff: item.is_off || false,
                hasPTO: item.pto_type ? true : false,
                ptoData: item.pto_type ? {
                  ptoType: item.pto_type,
                  isFullShift: item.pto_full_day || false
                } : undefined,
                reason: item.reason
              }
            });
          }
        });

        const officers = Array.from(officerMap.values());
        
        // Categorize officers
        const supervisors = officers.filter(o => isSupervisorByRank(o));
        const ppos = officers.filter(o => o.rank?.toLowerCase() === 'probationary');
        const regularOfficers = officers.filter(o => {
          const rank = o.rank?.toLowerCase() || '';
          const isSup = isSupervisorByRank(o) || rank.includes('supervisor');
          return !isSup && rank !== 'probationary';
        });

        dailySchedules.push({
          date: dateStr,
          dayOfWeek,
          officers,
          categorizedOfficers: {
            supervisors,
            officers: regularOfficers,
            ppos
          },
          staffing: {
            supervisors: supervisors.length,
            officers: regularOfficers.length,
            total: officers.length
          }
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

  // Navigation functions
  const goToPreviousWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const goToNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
  const goToPreviousMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const goToToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
    setCurrentMonth(new Date());
  };

  // Initialize with first shift
  useEffect(() => {
    if (shiftTypes && shiftTypes.length > 0 && !selectedShiftId) {
      setSelectedShiftId(shiftTypes[0].id);
    }
  }, [shiftTypes]);

  // Event handlers (simplified for mobile)
  const onEventHandlers = {
    onAssignPTO: () => {
      toast.info("Use the desktop version for detailed PTO management");
    },
    onRemovePTO: () => {
      toast.info("Use the desktop version for detailed PTO management");
    },
    onEditAssignment: () => {
      toast.info("Use the desktop version for editing assignments");
    },
    onRemoveOfficer: () => {
      toast.info("Use the desktop version for removing officers");
    }
  };

  const mutations = {
    removeOfficerMutation: { isPending: false },
    removePTOMutation: { isPending: false }
  };

  const weeklyColors = {
    supervisor: { bg: "bg-blue-50", text: "text-blue-900" },
    officer: { bg: "bg-gray-50", text: "text-gray-900" },
    ppo: { bg: "bg-green-50", text: "text-green-900" },
    pto: { bg: "bg-yellow-50", text: "text-yellow-900" },
    vacation: { bg: "bg-purple-50", text: "text-purple-900" },
    holiday: { bg: "bg-red-50", text: "text-red-900" },
    sick: { bg: "bg-orange-50", text: "text-orange-900" },
    comp: { bg: "bg-pink-50", text: "text-pink-900" }
  };

  const renderContentView = () => {
    switch (activeView) {
      case "weekly":
        return (
          <WeeklyViewMobile
            currentWeekStart={currentWeekStart}
            schedules={scheduleData}
            isAdminOrSupervisor={isAdminOrSupervisor}
            weeklyColors={weeklyColors}
            onEventHandlers={onEventHandlers}
            mutations={mutations}
            getLastName={getLastName}
            onPreviousWeek={goToPreviousWeek}
            onNextWeek={goToNextWeek}
            onToday={goToToday}
          />
        );
      
      case "monthly":
        return (
          <MonthlyViewMobile
            currentMonth={currentMonth}
            schedules={scheduleData}
            weeklyColors={weeklyColors}
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
        return null;
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
    <div className="space-y-4 pb-20">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              The Book
            </CardTitle>
            
            {selectedShiftId && shiftTypes && (
              <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {shiftTypes.map((shift) => (
                    <SelectItem key={shift.id} value={shift.id}>
                      {shift.name} ({shift.start_time} - {shift.end_time})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Main Tabs */}
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
                <SheetContent side="bottom" className="h-[50vh] rounded-t-xl">
                  <div className="pt-6 space-y-4">
                    <h3 className="font-semibold text-lg mb-4">Additional Views</h3>
                    <div className="space-y-2">
                      <Button
                        variant={activeView === "force-list" ? "default" : "ghost"}
                        className="w-full justify-start"
                        onClick={() => {
                          setActiveView("force-list");
                          const sheet = document.querySelector('[data-state="open"]');
                          (sheet as any)?.click?.();
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

                    {/* Admin actions */}
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
          </Tabs>
        </CardHeader>
        
        <CardContent>
          {selectedShiftId ? (
            <div className="space-y-4">
              {scheduleLoading && (activeView === "weekly" || activeView === "monthly") ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : (
                renderContentView()
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
