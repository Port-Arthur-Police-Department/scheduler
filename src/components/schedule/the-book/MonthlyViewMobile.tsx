import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { isSupervisorByRank } from "./utils";

interface MonthlyViewMobileProps {
  currentMonth: Date;
  selectedShiftId: string;
  shiftTypes: any[];
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

export const MonthlyViewMobile: React.FC<MonthlyViewMobileProps> = ({
  currentMonth,
  selectedShiftId,
  shiftTypes,
  onPreviousMonth,
  onNextMonth,
  onToday,
}) => {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  const startDay = monthStart.getDay();
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Fetch schedule data for the month
  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ['mobile-monthly-schedule', selectedShiftId, currentMonth.toISOString()],
    queryFn: async () => {
      if (!selectedShiftId) return null;

      const startStr = format(monthStart, "yyyy-MM-dd");
      const endStr = format(monthEnd, "yyyy-MM-dd");

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
      const scheduleByDate: Record<string, { officerCount: number; supervisorCount: number; ptoCount: number }> = {};

      // Initialize each day
      days.forEach(day => {
        const dateStr = format(day, "yyyy-MM-dd");
        scheduleByDate[dateStr] = {
          officerCount: 0,
          supervisorCount: 0,
          ptoCount: 0
        };
      });

      // Add recurring schedules
      recurringSchedules?.forEach(schedule => {
        days.forEach(day => {
          if (day.getDay() === schedule.day_of_week) {
            const dateStr = format(day, "yyyy-MM-dd");
            if (scheduleByDate[dateStr]) {
              const isSupervisor = isSupervisorByRank({ rank: schedule.profiles?.rank });
              scheduleByDate[dateStr].officerCount += 1;
              if (isSupervisor) {
                scheduleByDate[dateStr].supervisorCount += 1;
              }
              if (schedule.pto_type) {
                scheduleByDate[dateStr].ptoCount += 1;
              }
            }
          }
        });
      });

      // Add exceptions (override recurring)
      exceptions?.forEach(exception => {
        const dateStr = exception.date;
        if (scheduleByDate[dateStr]) {
          const isSupervisor = isSupervisorByRank({ rank: exception.profiles?.rank });
          scheduleByDate[dateStr].officerCount += 1;
          if (isSupervisor) {
            scheduleByDate[dateStr].supervisorCount += 1;
          }
          if (exception.pto_type) {
            scheduleByDate[dateStr].ptoCount += 1;
          }
        }
      });

      return scheduleByDate;
    },
    enabled: !!selectedShiftId,
  });

  // Calculate monthly totals
  const monthlyTotals = scheduleData ? {
    totalOfficers: Object.values(scheduleData).reduce((sum, day) => sum + day.officerCount, 0),
    totalSupervisors: Object.values(scheduleData).reduce((sum, day) => sum + day.supervisorCount, 0),
    totalPTO: Object.values(scheduleData).reduce((sum, day) => sum + day.ptoCount, 0)
  } : null;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-3/4 mx-auto" />
        <Skeleton className="h-64 w-full" />
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

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={onPreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="text-center">
              <div className="font-semibold text-lg">
                {format(currentMonth, "MMMM yyyy")}
              </div>
              <Button variant="ghost" size="sm" onClick={onToday}>
                Today
              </Button>
            </div>
            
            <Button variant="outline" size="icon" onClick={onNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground p-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before month start */}
            {Array.from({ length: startDay }).map((_, index) => (
              <div key={`empty-${index}`} className="h-10" />
            ))}
            
            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const dayData = scheduleData?.[dateStr];
              const isCurrentDay = isToday(day);
              const isCurrentMonthDay = isSameMonth(day, currentMonth);
              const totalCount = dayData ? dayData.officerCount : 0;
              
              return (
                <div
                  key={dateStr}
                  className={`
                    h-10 flex flex-col items-center justify-center rounded-lg text-sm
                    ${isCurrentDay 
                      ? 'bg-primary text-primary-foreground font-semibold' 
                      : 'bg-background hover:bg-muted'
                    }
                    ${!isCurrentMonthDay ? 'opacity-30' : ''}
                  `}
                >
                  <div>{format(day, "d")}</div>
                  {dayData && totalCount > 0 && (
                    <div className="text-[8px] mt-1">
                      <Badge variant="outline" className="h-3 px-1">
                        {totalCount}
                      </Badge>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Month Summary */}
      {monthlyTotals && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Month Summary</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-blue-50 rounded">
                <div className="text-lg font-bold">{monthlyTotals.totalSupervisors}</div>
                <div className="text-xs text-muted-foreground">Supervisors</div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-lg font-bold">{monthlyTotals.totalOfficers - monthlyTotals.totalSupervisors}</div>
                <div className="text-xs text-muted-foreground">Officers</div>
              </div>
              <div className="p-2 bg-green-50 rounded">
                <div className="text-lg font-bold">{monthlyTotals.totalPTO}</div>
                <div className="text-xs text-muted-foreground">PTO Days</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-3">Legend</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span>Today</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-4">
                3
              </Badge>
              <span>Number of officers scheduled</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-muted" />
              <span>Other month</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
