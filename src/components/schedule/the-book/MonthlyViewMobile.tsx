import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, parseISO } from "date-fns";
import type { ViewProps } from "./types";

interface MonthlyViewMobileProps extends ViewProps {
  currentMonth: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

export const MonthlyViewMobile: React.FC<MonthlyViewMobileProps> = ({
  currentMonth,
  schedules,
  weeklyColors,
  onPreviousMonth,
  onNextMonth,
  onToday,
}) => {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  const startDay = monthStart.getDay();
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Group schedule data by date
  const scheduleByDate = new Map();
  schedules?.dailySchedules?.forEach(day => {
    scheduleByDate.set(day.date, {
      officerCount: day.officers.length,
      ptoCount: day.officers.filter((o: any) => o.shiftInfo?.hasPTO).length
    });
  });

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
              const dayData = scheduleByDate.get(dateStr);
              const isCurrentDay = isToday(day);
              const isCurrentMonthDay = isSameMonth(day, currentMonth);
              
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
                  {dayData && dayData.officerCount > 0 && (
                    <div className="text-[8px] mt-1">
                      <Badge variant="outline" className="h-3 px-1">
                        {dayData.officerCount}
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
      {schedules && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Month Summary</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-blue-50 rounded">
                <div className="text-lg font-bold">
                  {schedules.dailySchedules.reduce((sum, day) => 
                    sum + day.officers.filter((o: any) => 
                      o.rank?.toLowerCase().includes('sergeant') || 
                      o.rank?.toLowerCase().includes('lieutenant')
                    ).length, 0
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Supervisors</div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-lg font-bold">
                  {schedules.dailySchedules.reduce((sum, day) => 
                    sum + day.officers.filter((o: any) => 
                      !o.rank?.toLowerCase().includes('sergeant') && 
                      !o.rank?.toLowerCase().includes('lieutenant') &&
                      !o.rank?.toLowerCase().includes('probationary')
                    ).length, 0
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Officers</div>
              </div>
              <div className="p-2 bg-green-50 rounded">
                <div className="text-lg font-bold">
                  {schedules.dailySchedules.reduce((sum, day) => 
                    sum + day.officers.filter((o: any) => 
                      o.shiftInfo?.hasPTO
                    ).length, 0
                  )}
                </div>
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
