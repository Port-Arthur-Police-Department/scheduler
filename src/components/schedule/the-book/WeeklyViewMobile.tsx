import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays, MoreVertical, Edit, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, addDays, isSameDay, startOfWeek, endOfWeek } from "date-fns";
import { getLastName, getRankAbbreviation } from "./utils";
import type { ViewProps } from "./types";

interface WeeklyViewMobileProps extends ViewProps {
  currentWeekStart: Date;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
}

export const WeeklyViewMobile: React.FC<WeeklyViewMobileProps> = ({
  currentWeekStart,
  schedules,
  isAdminOrSupervisor,
  weeklyColors,
  onEventHandlers,
  mutations,
  getLastName,
  onPreviousWeek,
  onNextWeek,
  onToday,
}) => {
  if (!schedules) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No schedule data available
      </div>
    );
  }

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

  // Group officers by date for easy lookup
  const officersByDate = new Map();
  schedules.dailySchedules?.forEach(day => {
    officersByDate.set(day.date, day.officers);
  });

  const currentDateStr = format(new Date(), "yyyy-MM-dd");
  const todayOfficers = officersByDate.get(currentDateStr) || [];

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
            const dayOfficers = officersByDate.get(day.dateStr) || [];
            const supervisorCount = dayOfficers.filter((o: any) => 
              o.rank?.toLowerCase().includes('sergeant') || 
              o.rank?.toLowerCase().includes('lieutenant') ||
              o.rank?.toLowerCase().includes('chief')
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
