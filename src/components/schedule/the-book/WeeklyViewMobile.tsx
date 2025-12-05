import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays, MoreVertical, Edit, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isSameDay, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { getLastName, getRankAbbreviation, isSupervisorByRank } from "./utils";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface WeeklyViewMobileProps {
  currentWeekStart: Date;
  selectedShiftId: string;
  shiftTypes: any[];
  isAdminOrSupervisor: boolean;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
}

export const WeeklyViewMobile: React.FC<WeeklyViewMobileProps> = ({
  currentWeekStart,
  selectedShiftId,
  shiftTypes,
  isAdminOrSupervisor,
  onPreviousWeek,
  onNextWeek,
  onToday,
}) => {
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(currentWeekStart, i);
    return {
      date,
      dateStr: format(date, "yyyy-MM-dd"),
      dayName: format(date, "EEE"),
      formattedDate: format(date, "MMM d"),
      isToday: isSameDay(date, new Date()),
      dayOfWeek: date.getDay()
    };
  });

  // Fetch schedule data for the week
  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ['mobile-weekly-schedule', selectedShiftId, currentWeekStart.toISOString()],
    queryFn: async () => {
      if (!selectedShiftId) return null;

      const startStr = format(currentWeekStart, "yyyy-MM-dd");
      const endStr = format(endOfWeek(currentWeekStart, { weekStartsOn: 0 }), "yyyy-MM-dd");

      // Fetch schedule exceptions for the date range
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

      // Fetch recurring schedules for the selected shift
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

      // Organize data by date
      const scheduleByDate: Record<string, any[]> = {};

      // Initialize each day
      weekDays.forEach(day => {
        scheduleByDate[day.dateStr] = [];
      });

      // Add recurring schedules
      recurringSchedules?.forEach(schedule => {
        weekDays.forEach(day => {
          if (day.dayOfWeek === schedule.day_of_week) {
            scheduleByDate[day.dateStr].push({
              officerId: schedule.officer_id,
              officerName: schedule.profiles?.full_name || "Unknown",
              badgeNumber: schedule.profiles?.badge_number,
              rank: schedule.profiles?.rank || "Officer",
              shiftInfo: {
                scheduleId: schedule.id,
                scheduleType: "recurring",
                position: schedule.position_name,
                isOff: schedule.is_off || false,
                hasPTO: schedule.pto_type ? true : false
              }
            });
          }
        });
      });

      // Add exceptions (override recurring)
      exceptions?.forEach(exception => {
        const dateStr = exception.date;
        if (scheduleByDate[dateStr]) {
          // Remove any recurring for this officer on this date
          scheduleByDate[dateStr] = scheduleByDate[dateStr].filter(
            o => o.officerId !== exception.officer_id
          );
          
          // Add the exception
          scheduleByDate[dateStr].push({
            officerId: exception.officer_id,
            officerName: exception.profiles?.full_name || "Unknown",
            badgeNumber: exception.profiles?.badge_number,
            rank: exception.profiles?.rank || "Officer",
            shiftInfo: {
              scheduleId: exception.id,
              scheduleType: "exception",
              position: exception.position_name,
              isOff: exception.is_off || false,
              hasPTO: exception.pto_type ? true : false
            }
          });
        }
      });

      return scheduleByDate;
    },
    enabled: !!selectedShiftId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!selectedShiftId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Please select a shift to view schedule</p>
      </div>
    );
  }

  const currentDateStr = format(new Date(), "yyyy-MM-dd");
  const todayOfficers = scheduleData?.[currentDateStr] || [];

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={onPreviousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="text-center">
              <div className="font-semibold">
                {format(currentWeekStart, "MMM d")} - {format(addDays(currentWeekStart, 6), "MMM d")}
              </div>
              <div className="text-sm text-muted-foreground">
                {format(currentWeekStart, "yyyy")}
              </div>
            </div>
            
            <Button variant="outline" size="icon" onClick={onNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={onToday}>
              Today
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Today's Schedule (Featured) */}
      <div>
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Today's Schedule
        </h3>
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              {todayOfficers.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No officers scheduled today
                </div>
              ) : (
                todayOfficers.slice(0, 5).map((officer: any) => (
                  <div key={`${officer.officerId}-today`} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">
                        {getLastName(officer.officerName)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {officer.badgeNumber} • {getRankAbbreviation(officer.rank)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {officer.shiftInfo?.position || "Unassigned"}
                      </div>
                      {officer.shiftInfo?.hasPTO && (
                        <Badge variant="outline" className="text-xs mt-1">
                          PTO
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
              {todayOfficers.length > 5 && (
                <div className="text-center text-sm text-muted-foreground">
                  +{todayOfficers.length - 5} more officers today
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Breakdown */}
      <div>
        <h3 className="font-semibold mb-2">Week Overview</h3>
        <div className="space-y-3">
          {weekDays.map((day) => {
            const dayOfficers = scheduleData?.[day.dateStr] || [];
            const supervisorCount = dayOfficers.filter((o: any) => 
              isSupervisorByRank(o)
            ).length;
            
            const officerCount = dayOfficers.length - supervisorCount;

            return (
              <Card key={day.dateStr}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className={`font-semibold ${day.isToday ? 'text-primary' : ''}`}>
                        {day.dayName}, {day.formattedDate}
                      </div>
                      {day.isToday && (
                        <Badge variant="outline" className="text-xs mt-1">
                          Today
                        </Badge>
                      )}
                    </div>
                    <Badge variant="secondary">
                      {dayOfficers.length} officers
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    {/* Supervisor summary */}
                    {supervisorCount > 0 && (
                      <div className="flex items-center text-sm">
                        <Badge variant="outline" className="mr-2 bg-blue-50">
                          Sup
                        </Badge>
                        <span>{supervisorCount} supervisor(s)</span>
                      </div>
                    )}

                    {/* Officer summary */}
                    {officerCount > 0 && (
                      <div className="flex items-center text-sm">
                        <Badge variant="outline" className="mr-2">
                          Ofc
                        </Badge>
                        <span>{officerCount} officer(s)</span>
                      </div>
                    )}

                    {/* Sample officers */}
                    {dayOfficers.slice(0, 3).map((officer: any) => (
                      <div key={officer.officerId} className="text-sm flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{getLastName(officer.officerName)}</span>
                          {officer.rank?.toLowerCase() === 'probationary' && (
                            <Badge variant="outline" className="text-xs bg-green-50">
                              PPO
                            </Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground">
                          {officer.shiftInfo?.position?.substring(0, 15) || 'Unassigned'}
                          {officer.shiftInfo?.position && officer.shiftInfo.position.length > 15 && '...'}
                        </div>
                      </div>
                    ))}

                    {dayOfficers.length > 3 && (
                      <div className="text-center text-sm text-muted-foreground pt-2">
                        +{dayOfficers.length - 3} more
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
