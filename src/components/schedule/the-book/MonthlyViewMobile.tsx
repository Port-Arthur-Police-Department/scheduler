// src/components/schedule/the-book/MonthlyViewMobile.tsx - REFACTORED
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { getScheduleData } from "../DailyScheduleView";

interface MonthlyViewMobileProps {
  currentMonth: Date;
  selectedShiftId: string;
  shiftTypes: any[];
  monthlyData: Array<{
    date: string;
    data: any;
    dayOfWeek: number;
    formattedDate: string;
    isCurrentMonth: boolean;
  }>;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onAssignPTO?: (schedule: any, dateStr: string, officerId: string, officerName: string) => void;
  onRemovePTO?: (schedule: any, dateStr: string, officerId: string) => void;
  onEditAssignment?: (officer: any, dateStr: string) => void;
}

export const MonthlyViewMobile: React.FC<MonthlyViewMobileProps> = ({
  currentMonth,
  selectedShiftId,
  shiftTypes,
  monthlyData,
  onPreviousMonth,
  onNextMonth,
  onToday,
}) => {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  const startDay = monthStart.getDay();
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Calculate monthly totals from monthlyData
  const monthlyTotals = React.useMemo(() => {
    let totalOfficers = 0;
    let totalSupervisors = 0;
    let totalPTO = 0;

    monthlyData.forEach(day => {
      if (day.data) {
        // Count supervisors
        if (day.data.supervisors) {
          totalSupervisors += day.data.supervisors.length;
        }
        
        // Count officers
        if (day.data.officers) {
          totalOfficers += day.data.officers.length;
        }
        
        // Count PTO records
        if (day.data.ptoRecords) {
          totalPTO += day.data.ptoRecords.length;
        }
      }
    });

    return {
      totalOfficers,
      totalSupervisors,
      totalPTO
    };
  }, [monthlyData]);

  // Map monthly data by date for easy lookup
  const scheduleByDate = React.useMemo(() => {
    const result: Record<string, { officerCount: number; supervisorCount: number; ptoCount: number }> = {};
    
    monthlyData.forEach(day => {
      result[day.date] = {
        officerCount: (day.data?.officers?.length || 0) + (day.data?.supervisors?.length || 0),
        supervisorCount: day.data?.supervisors?.length || 0,
        ptoCount: day.data?.ptoRecords?.length || 0
      };
    });
    
    return result;
  }, [monthlyData]);

  // Check if we have data
  const hasData = monthlyData.length > 0;
  const isLoading = !monthlyData; // Data is passed from parent

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

  if (!hasData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No schedule data available for this month
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
              const dayData = scheduleByDate[dateStr];
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
