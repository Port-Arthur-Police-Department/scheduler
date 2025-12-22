import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays, MoreVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isSameDay, startOfWeek, endOfWeek } from "date-fns";
import { getLastName, getRankAbbreviation, isSupervisorByRank, getRankPriority } from "./utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ScheduleCellMobile } from "./ScheduleCellMobile";
import { PREDEFINED_POSITIONS } from "@/constants/positions";

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
      dayName: format(date, "EEE").toUpperCase(),
      formattedDate: format(date, "MMM d"),
      isToday: isSameDay(date, new Date()),
      dayOfWeek: date.getDay()
    };
  });

  // Fetch schedule data
  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ['weekly-schedule-mobile', selectedShiftId, currentWeekStart.toISOString()],
    queryFn: async () => {
      if (!selectedShiftId) return null;

      const startStr = format(currentWeekStart, "yyyy-MM-dd");
      const endStr = format(endOfWeek(currentWeekStart, { weekStartsOn: 0 }), "yyyy-MM-dd");

      // Fetch schedule exceptions
      const { data: exceptions, error: exceptionsError } = await supabase
        .from("schedule_exceptions")
        .select(`
          *,
          profiles:officer_id (
            id, full_name, badge_number, rank, hire_date, service_credit_override
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
            id, full_name, badge_number, rank, hire_date, service_credit_override
          )
        `)
        .eq("shift_type_id", selectedShiftId)
        .or(`end_date.is.null,end_date.gte.${startStr}`);

      if (recurringError) throw recurringError;

      // Fetch minimum staffing
      const { data: minStaffingData, error: minStaffingError } = await supabase
        .from("minimum_staffing")
        .select("*")
        .eq("shift_type_id", selectedShiftId);

      if (minStaffingError) {
        console.error("Error fetching minimum staffing:", minStaffingError);
      }

      // Create minimum staffing map
      const minimumStaffing = new Map();
      minStaffingData?.forEach(staffing => {
        if (!minimumStaffing.has(staffing.day_of_week)) {
          minimumStaffing.set(staffing.day_of_week, new Map());
        }
        minimumStaffing.get(staffing.day_of_week).set(staffing.shift_type_id, {
          minimumOfficers: staffing.minimum_officers,
          minimumSupervisors: staffing.minimum_supervisors
        });
      });

      // Organize data similar to desktop version
      const allOfficers = new Map();
      const recurringSchedulesByOfficer = new Map();

      // Extract recurring schedule patterns
      recurringSchedules?.forEach((recurring: any) => {
        if (!recurringSchedulesByOfficer.has(recurring.officer_id)) {
          recurringSchedulesByOfficer.set(recurring.officer_id, new Set());
        }
        recurringSchedulesByOfficer.get(recurring.officer_id).add(recurring.day_of_week);
      });

      // Process weekly data
      weekDays.forEach(day => {
        // Find exceptions for this day
        const dayExceptions = exceptions?.filter(e => e.date === day.dateStr) || [];
        
        // Find recurring for this day of week
        const dayRecurring = recurringSchedules?.filter(r => r.day_of_week === day.dayOfWeek) || [];
        
        // Combine all officers for this day
        const allDayOfficers = [...dayExceptions, ...dayRecurring];
        
        allDayOfficers.forEach(item => {
          const officerId = item.officer_id;
          if (!allOfficers.has(officerId)) {
            allOfficers.set(officerId, {
              officerId: officerId,
              officerName: item.profiles?.full_name || "Unknown",
              badgeNumber: item.profiles?.badge_number,
              rank: item.profiles?.rank || "Officer",
              service_credit: item.profiles?.service_credit_override || 0,
              recurringDays: recurringSchedulesByOfficer.get(officerId) || new Set(),
              weeklySchedule: {} as Record<string, any>
            });
          }
          
          const daySchedule = {
            officerId: officerId,
            officerName: item.profiles?.full_name || "Unknown",
            badgeNumber: item.profiles?.badge_number,
            rank: item.profiles?.rank || "Officer",
            service_credit: item.profiles?.service_credit_override || 0,
            date: day.dateStr,
            dayOfWeek: day.dayOfWeek,
            isRegularRecurringDay: recurringSchedulesByOfficer.get(officerId)?.has(day.dayOfWeek) || false,
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
          };
          
          allOfficers.get(officerId).weeklySchedule[day.dateStr] = daySchedule;
        });
      });

      // Categorize officers
      const supervisors = Array.from(allOfficers.values())
        .filter(o => isSupervisorByRank(o))
        .sort((a, b) => {
          const aPriority = getRankPriority(a.rank);
          const bPriority = getRankPriority(b.rank);
          
          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }
          
          return getLastName(a.officerName).localeCompare(getLastName(b.officerName));
        });

      const allOfficersList = Array.from(allOfficers.values())
        .filter(o => !isSupervisorByRank(o));

      const ppos = allOfficersList
        .filter(o => o.rank?.toLowerCase() === 'probationary')
        .sort((a, b) => {
          const aCredit = a.service_credit || 0;
          const bCredit = b.service_credit || 0;
          if (bCredit !== aCredit) {
            return bCredit - aCredit;
          }
          return getLastName(a.officerName).localeCompare(getLastName(b.officerName));
        });

      const regularOfficers = allOfficersList
        .filter(o => o.rank?.toLowerCase() !== 'probationary')
        .sort((a, b) => {
          const aCredit = a.service_credit || 0;
          const bCredit = b.service_credit || 0;
          if (bCredit !== aCredit) {
            return bCredit - aCredit;
          }
          return getLastName(a.officerName).localeCompare(getLastName(b.officerName));
        });

      return {
        supervisors,
        regularOfficers,
        ppos,
        minimumStaffing,
        dailySchedules: weekDays.map(day => ({
          date: day.dateStr,
          dayOfWeek: day.dayOfWeek,
          officers: Array.from(allOfficers.values())
            .map(officer => officer.weeklySchedule[day.dateStr])
            .filter(Boolean)
        }))
      };
    },
    enabled: !!selectedShiftId,
  });

  // Helper function to check if an assignment is a special assignment
  const isSpecialAssignment = (position: string) => {
    return position && (
      position.toLowerCase().includes('other') ||
      (position && !PREDEFINED_POSITIONS.includes(position))
    );
  };

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

  if (!scheduleData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No schedule data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Week Header */}
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

      {/* Weekly Table - Horizontal Scroll on Mobile */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="min-w-[800px]">
          {/* Table Header */}
          <div className="grid grid-cols-9 bg-muted/50 border rounded-t-lg">
            <div className="p-2 font-semibold border-r text-sm">Empl#</div>
            <div className="p-2 font-semibold border-r text-sm">NAME</div>
            {weekDays.map(({ dateStr, dayName, formattedDate, isToday }) => (
              <div key={dateStr} className={`p-2 text-center font-semibold border-r text-sm ${isToday ? 'bg-primary/10' : ''}`}>
                <div>{dayName}</div>
                <div className="text-xs text-muted-foreground">{formattedDate}</div>
              </div>
            ))}
          </div>

          {/* Supervisor Count Row */}
          <div className="grid grid-cols-9 border-b bg-gray-100">
            <div className="p-2 border-r text-sm"></div>
            <div className="p-2 border-r text-sm font-medium">SUPERVISORS</div>
            {weekDays.map(({ dateStr, dayOfWeek }) => {
              const daySchedule = scheduleData.dailySchedules?.find(s => s.date === dateStr);
              const minStaffingForDay = scheduleData.minimumStaffing?.get(dayOfWeek)?.get(selectedShiftId);
              const minimumSupervisors = minStaffingForDay?.minimumSupervisors || 1;
              
              // *** FIXED: Exclude special assignments from count ***
              const supervisorCount = daySchedule?.officers?.filter((officer: any) => {
                const isSupervisor = isSupervisorByRank(officer);
                const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
                const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
                const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
                return isSupervisor && isScheduled;
              }).length || 0;
              
              return (
                <div key={dateStr} className="p-2 text-center border-r text-sm bg-gray-100">
                  {supervisorCount} / {minimumSupervisors}
                </div>
              );
            })}
          </div>

          {/* Supervisors */}
          {scheduleData.supervisors.map((officer: any) => (
            <div key={officer.officerId} className="grid grid-cols-9 border-b hover:bg-muted/30">
              <div className="p-2 border-r text-sm font-mono">{officer.badgeNumber}</div>
              <div className="p-2 border-r font-medium text-sm">
                {getLastName(officer.officerName)}
                <div className="text-xs opacity-80">{getRankAbbreviation(officer.rank)}</div>
              </div>
              {weekDays.map(({ dateStr }) => (
                <div key={dateStr} className="p-2 border-r">
                  <ScheduleCellMobile
                    officer={officer.weeklySchedule[dateStr]}
                    dateStr={dateStr}
                    officerId={officer.officerId}
                    officerName={officer.officerName}
                    isAdminOrSupervisor={isAdminOrSupervisor}
                    isSupervisor={true}
                    isRegularRecurringDay={officer.weeklySchedule[dateStr]?.isRegularRecurringDay || false}
                  />
                </div>
              ))}
            </div>
          ))}

          {/* Officer Count Row - FIXED */}
          <div className="grid grid-cols-9 border-b bg-gray-200">
            <div className="p-2 border-r text-sm"></div>
            <div className="p-2 border-r text-sm font-medium">OFFICERS</div>
            {weekDays.map(({ dateStr, dayOfWeek }) => {
              const daySchedule = scheduleData.dailySchedules?.find(s => s.date === dateStr);
              const minStaffingForDay = scheduleData.minimumStaffing?.get(dayOfWeek)?.get(selectedShiftId);
              const minimumOfficers = minStaffingForDay?.minimumOfficers || 0;
              
              // *** FIXED: Exclude special assignments from count ***
              const officerCount = daySchedule?.officers?.filter((officer: any) => {
                const isOfficer = !isSupervisorByRank(officer);
                const isNotPPO = officer.rank?.toLowerCase() !== 'probationary';
                const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
                const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
                const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
                return isOfficer && isNotPPO && isScheduled;
              }).length || 0;
              
              return (
                <div key={dateStr} className="p-2 text-center border-r text-sm font-medium bg-gray-200">
                  {officerCount} / {minimumOfficers}
                </div>
              );
            })}
          </div>

          {/* Regular Officers */}
          {scheduleData.regularOfficers.map((officer: any) => (
            <div key={officer.officerId} className="grid grid-cols-9 border-b hover:bg-muted/30">
              <div className="p-2 border-r text-sm font-mono">{officer.badgeNumber}</div>
              <div className="p-2 border-r font-medium text-sm">
                {getLastName(officer.officerName)}
              </div>
              {weekDays.map(({ dateStr }) => (
                <div key={dateStr} className="p-2 border-r">
                  <ScheduleCellMobile
                    officer={officer.weeklySchedule[dateStr]}
                    dateStr={dateStr}
                    officerId={officer.officerId}
                    officerName={officer.officerName}
                    isAdminOrSupervisor={isAdminOrSupervisor}
                    isRegularRecurringDay={officer.weeklySchedule[dateStr]?.isRegularRecurringDay || false}
                  />
                </div>
              ))}
            </div>
          ))}

          {/* PPO Section */}
          {scheduleData.ppos.length > 0 && (
            <>
              {/* PPO Count Row */}
              <div className="grid grid-cols-9 border-t-2 border-blue-200 bg-blue-50">
                <div className="p-2 border-r text-sm"></div>
                <div className="p-2 border-r text-sm font-medium">PPO</div>
                {weekDays.map(({ dateStr }) => {
                  const daySchedule = scheduleData.dailySchedules?.find(s => s.date === dateStr);
                  const ppoCount = daySchedule?.officers?.filter((officer: any) => {
                    const isOfficer = !isSupervisorByRank(officer);
                    const isPPO = officer.rank?.toLowerCase() === 'probationary';
                    const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
                    const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO;
                    return isOfficer && isPPO && isScheduled;
                  }).length || 0;
                  
                  return (
                    <div key={dateStr} className="p-2 text-center border-r text-sm font-medium bg-blue-50">
                      {ppoCount}
                    </div>
                  );
                })}
              </div>

              {/* PPO Officers */}
              {scheduleData.ppos.map((officer: any) => (
                <div key={officer.officerId} className="grid grid-cols-9 border-b hover:bg-blue-50/50 bg-blue-50/30">
                  <div className="p-2 border-r text-sm font-mono">{officer.badgeNumber}</div>
                  <div className="p-2 border-r font-medium text-sm flex items-center gap-2">
                    {getLastName(officer.officerName)}
                    <Badge variant="outline" className="text-xs border-blue-300 bg-blue-100">
                      PPO
                    </Badge>
                  </div>
                  {weekDays.map(({ dateStr }) => (
                    <div key={dateStr} className="p-2 border-r">
                      <ScheduleCellMobile
                        officer={officer.weeklySchedule[dateStr]}
                        dateStr={dateStr}
                        officerId={officer.officerId}
                        officerName={officer.officerName}
                        isAdminOrSupervisor={isAdminOrSupervisor}
                        isPPO={true}
                        isRegularRecurringDay={officer.weeklySchedule[dateStr]?.isRegularRecurringDay || false}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

{/* Legend */}
<Card>
  <CardContent className="p-4">
    <h3 className="font-semibold mb-3 text-sm">Quick Legend</h3>
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-gray-100 border"></div>
        <span>Supervisor</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-blue-50 border border-blue-200"></div>
        <span>PPO</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="h-4 text-xs">PTO</Badge>
        <span>Paid Time Off</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="destructive" className="h-4 text-xs">Off</Badge>
        <span>Day Off</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-white border"></div>
        <span>Regular Scheduled Day</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-gray-900 border border-gray-700"></div>
        <span>Ad-hoc Assignment</span>
      </div>
    </div>
  </CardContent>
</Card>
    </div>
  );
};
