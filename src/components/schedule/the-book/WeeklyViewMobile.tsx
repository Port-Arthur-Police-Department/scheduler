// src/components/schedule/the-book/WeeklyViewMobile.tsx - REFACTORED
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { format, addDays, isSameDay, startOfWeek, endOfWeek } from "date-fns";
import { getLastName, getRankAbbreviation } from "./utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ScheduleCellMobile } from "./ScheduleCellMobile";
import { PREDEFINED_POSITIONS } from "@/constants/positions";
import { getScheduleData } from "../DailyScheduleView";
import { 
  isShiftUnderstaffed,
  hasMinimumRequirements,
  formatStaffingCount 
} from "@/utils/staffingUtils";

interface WeeklyViewMobileProps {
  currentWeekStart: Date;
  selectedShiftId: string;
  shiftTypes: any[];
  weeklyData: Array<{
    date: string;
    data: any; // Direct from getScheduleData (same as desktop)
    dayOfWeek: number;
    formattedDate: string;
  }>;
  isAdminOrSupervisor: boolean;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onAssignPTO?: (schedule: any, dateStr: string, officerId: string, officerName: string) => void;
  onRemovePTO?: (schedule: any, dateStr: string, officerId: string) => void;
  onEditAssignment?: (officer: any, dateStr: string) => void;
  onRemoveOfficer?: (scheduleId: string, type: 'recurring' | 'exception', officerData?: any) => void;
  isUpdating?: boolean;
}

export const WeeklyViewMobile: React.FC<WeeklyViewMobileProps> = ({
  currentWeekStart,
  selectedShiftId,
  shiftTypes,
  weeklyData,
  isAdminOrSupervisor,
  onPreviousWeek,
  onNextWeek,
  onToday,
  onAssignPTO,
  onRemovePTO,
  onEditAssignment,
  onRemoveOfficer,
  isUpdating = false,
}) => {
  const weekDays = React.useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
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
  }, [currentWeekStart]);

  // Helper function to check if position is a supervisor position
  const isSupervisorPosition = (position: string) => {
    if (!position) return false;
    const positionLower = position.toLowerCase();
    return positionLower.includes('supervisor') || 
           positionLower.includes('sgt') ||
           positionLower.includes('sergeant') ||
           positionLower.includes('lieutenant') ||
           positionLower.includes('chief') ||
           positionLower.includes('captain');
  };

  const isSpecialAssignment = (position: string) => {
    return position && (
      position.toLowerCase().includes('other') ||
      position.toLowerCase().includes('special') ||
      position.toLowerCase().includes('training') ||
      position.toLowerCase().includes('detail') ||
      position.toLowerCase().includes('court') ||
      position.toLowerCase().includes('extra') ||
      (position && !PREDEFINED_POSITIONS.includes(position))
    );
  };

 // Extract officer data from weeklyData - SIMPLIFIED VERSION
const { supervisors, regularOfficers, ppoOfficers, overtimeOfficers, dailyStats } = React.useMemo(() => {
  console.log('🔄 Processing weekly data in mobile view...');
  
  const supervisors: any[] = [];
  const regularOfficers: any[] = [];
  const ppoOfficers: any[] = [];
  const overtimeOfficers: any[] = [];
  const dailyStats: Record<string, any> = {};
  const seenOfficers = new Set();

  // Initialize daily stats
  weekDays.forEach(day => {
    dailyStats[day.dateStr] = {
      supervisorCount: 0,
      officerCount: 0,
      ppoCount: 0,
      overtimeCount: 0,
      minSupervisors: 0,
      minOfficers: 0
    };
  });

  if (!weeklyData || weeklyData.length === 0) {
    console.log('⚠️ No weekly data to process');
    return { supervisors, regularOfficers, ppoOfficers, overtimeOfficers, dailyStats };
  }

  // Process each day's data
  weeklyData.forEach(dayData => {
    const { date, data } = dayData;
    
    if (!data) {
      console.log(`⚠️ No data for date ${date}`);
      return;
    }

    console.log(`📅 Processing date ${date}:`, {
      supervisorsCount: data.supervisors?.length || 0,
      officersCount: data.officers?.length || 0,
      hasOvertime: !!data.overtimeByDate?.[date]
    });

    // Get staffing minimums
    dailyStats[date].minSupervisors = data.minSupervisors || 0;
    dailyStats[date].minOfficers = data.minOfficers || 0;

    // Process supervisors
    if (data.supervisors && Array.isArray(data.supervisors)) {
      data.supervisors.forEach((officer: any) => {
        const officerId = officer.officerId || officer.id;
        
        if (!officerId) {
          console.log('⚠️ Officer has no ID:', officer);
          return;
        }

        if (!seenOfficers.has(officerId)) {
          seenOfficers.add(officerId);
          supervisors.push(officer);
        }
        
        // Check if officer is scheduled on this day
        const daySchedule = officer.weeklySchedule?.[date];
        if (daySchedule) {
          const hasPTO = daySchedule.shiftInfo?.hasPTO || 
                        daySchedule.shiftInfo?.isOff ||
                        daySchedule.ptoData;
          const isOvertime = daySchedule.is_extra_shift === true || 
                           daySchedule.shiftInfo?.is_extra_shift === true;
          
          if (!hasPTO && !isOvertime) {
            dailyStats[date].supervisorCount++;
          }
        }
      });
    }

    // Process officers (regular and PPO)
    if (data.officers && Array.isArray(data.officers)) {
      data.officers.forEach((officer: any) => {
        const officerId = officer.officerId || officer.id;
        
        if (!officerId) {
          console.log('⚠️ Officer has no ID:', officer);
          return;
        }

        const isPPO = officer.rank?.toLowerCase() === 'probationary';
        const targetArray = isPPO ? ppoOfficers : regularOfficers;
        
        if (!seenOfficers.has(officerId)) {
          seenOfficers.add(officerId);
          targetArray.push(officer);
        }
        
        // Check if officer is scheduled on this day
        const daySchedule = officer.weeklySchedule?.[date];
        if (daySchedule) {
          const hasPTO = daySchedule.shiftInfo?.hasPTO || 
                        daySchedule.shiftInfo?.isOff ||
                        daySchedule.ptoData;
          const isOvertime = daySchedule.is_extra_shift === true || 
                           daySchedule.shiftInfo?.is_extra_shift === true;
          
          if (!hasPTO && !isOvertime) {
            if (isPPO) {
              dailyStats[date].ppoCount++;
            } else {
              dailyStats[date].officerCount++;
            }
          }
        }
      });
    }

    // Process overtime officers
    if (data.overtimeByDate?.[date]) {
      data.overtimeByDate[date].forEach((officer: any) => {
        const officerId = officer.officerId || officer.id;
        
        if (officerId && !seenOfficers.has(officerId)) {
          seenOfficers.add(officerId);
          overtimeOfficers.push(officer);
        }
        
        dailyStats[date].overtimeCount++;
      });
    }
  });

  console.log('✅ Processed data summary:', {
    supervisors: supervisors.length,
    regularOfficers: regularOfficers.length,
    ppoOfficers: ppoOfficers.length,
    overtimeOfficers: overtimeOfficers.length
  });

  return {
    supervisors,
    regularOfficers,
    ppoOfficers,
    overtimeOfficers,
    dailyStats
  };
}, [weeklyData, weekDays]);

// Check if we have data
const hasData = weeklyData && weeklyData.length > 0 && weeklyData.some(day => day.data);
const isLoading = false; // Data is passed from parent, loading handled there

if (!hasData && selectedShiftId) {
  console.log('📱 No data but shift selected:', {
    weeklyDataLength: weeklyData?.length,
    shiftId: selectedShiftId
  });
  
  return (
    <div className="text-center py-8 text-muted-foreground">
      <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p>Loading schedule data...</p>
      <p className="text-xs mt-2">Shift: {selectedShiftId}</p>
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
        No schedule data available for this week
      </div>
    );
  }

  const hasOvertime = overtimeOfficers.length > 0;

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

      {/* Weekly Table */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="min-w-[800px]">
          {/* Table Header */}
          <div className="grid grid-cols-9 bg-muted/50 border rounded-t-lg">
            <div className="p-2 font-semibold border-r text-sm">Empl#</div>
            <div className="p-2 font-semibold border-r text-sm">NAME</div>
            {weekDays.map(({ dateStr, dayName, formattedDate, isToday, dayOfWeek }) => {
              const stats = dailyStats[dateStr];
              const minSupervisors = stats?.minSupervisors || 0;
              const minOfficers = stats?.minOfficers || 0;
              
              const supervisorCount = stats?.supervisorCount || 0;
              const officerCount = stats?.officerCount || 0;
              
              // Use utility functions
              const isSupervisorsUnderstaffed = minSupervisors > 0 && supervisorCount < minSupervisors;
              const isOfficersUnderstaffed = minOfficers > 0 && officerCount < minOfficers;
              const hasRequirements = hasMinimumRequirements(minSupervisors, minOfficers);
              
              return (
                <div key={dateStr} className={`p-2 text-center font-semibold border-r text-sm ${isToday ? 'bg-primary/10' : ''}`}>
                  <div>{dayName}</div>
                  <div className="text-xs text-muted-foreground mb-1">{formattedDate}</div>
                  
                  {hasRequirements ? (
                    <>
                      <Badge 
                        variant={isSupervisorsUnderstaffed ? "destructive" : "outline"} 
                        className="text-xs mb-1"
                      >
                        {supervisorCount} / {minSupervisors} Sup
                      </Badge>
                      <Badge 
                        variant={isOfficersUnderstaffed ? "destructive" : "outline"} 
                        className="text-xs"
                      >
                        {officerCount} / {minOfficers} Ofc
                      </Badge>
                    </>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      No minimums
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          {/* Supervisor Count Row */}
          <div className="grid grid-cols-9 border-b bg-gray-100">
            <div className="p-2 border-r text-sm"></div>
            <div className="p-2 border-r text-sm font-medium">SUPERVISORS</div>
            {weekDays.map(({ dateStr }) => {
              const stats = dailyStats[dateStr];
              const minSupervisors = stats?.minSupervisors || 0;
              const supervisorCount = stats?.supervisorCount || 0;
              
              const isSupervisorsUnderstaffed = minSupervisors > 0 && supervisorCount < minSupervisors;
              
              return (
                <div key={dateStr} className="p-2 text-center border-r text-sm bg-gray-100">
                  <div className={`font-medium ${isSupervisorsUnderstaffed ? 'text-red-600' : ''}`}>
                    {supervisorCount} {minSupervisors > 0 ? `/ ${minSupervisors}` : ''}
                  </div>
                  {minSupervisors === 0 && (
                    <div className="text-xs text-muted-foreground">No min</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Supervisors */}
          {supervisors.map((officer: any) => {
            return (
              <div key={officer.officerId} className="grid grid-cols-9 border-b hover:bg-muted/30">
                <div className="p-2 border-r text-sm font-mono">{officer.badgeNumber}</div>
                <div className="p-2 border-r font-medium text-sm">
                  {getLastName(officer.officerName)}
                  <div className="text-xs opacity-80">{getRankAbbreviation(officer.rank)}</div>
                  <div className="text-xs text-muted-foreground">
                    SC: {officer.service_credit?.toFixed(1) || '0.0'}
                  </div>
                </div>
                {weekDays.map(({ dateStr }) => {
                  const dayOfficer = officer.weeklySchedule?.[dateStr];
                  return (
                    <div key={dateStr} className="p-2 border-r">
                      <ScheduleCellMobile
                        officer={dayOfficer}
                        dateStr={dateStr}
                        officerId={officer.officerId}
                        officerName={officer.officerName}
                        isAdminOrSupervisor={isAdminOrSupervisor}
                        isSupervisor={true}
                        isRegularRecurringDay={dayOfficer?.isRegularRecurringDay || false}
                        isSpecialAssignment={isSpecialAssignment}
                        onAssignPTO={onAssignPTO}
                        onRemovePTO={onRemovePTO}
                        onEditAssignment={onEditAssignment}
                        onRemoveOfficer={onRemoveOfficer}
                        isUpdating={isUpdating}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Officer Count Row */}
          <div className="grid grid-cols-9 border-b bg-gray-200">
            <div className="p-2 border-r text-sm"></div>
            <div className="p-2 border-r text-sm font-medium">OFFICERS</div>
            {weekDays.map(({ dateStr }) => {
              const stats = dailyStats[dateStr];
              const minOfficers = stats?.minOfficers || 0;
              const officerCount = stats?.officerCount || 0;
              
              const isOfficersUnderstaffed = minOfficers > 0 && officerCount < minOfficers;
              
              return (
                <div key={dateStr} className="p-2 text-center border-r text-sm font-medium bg-gray-200">
                  <div className={`font-medium ${isOfficersUnderstaffed ? 'text-red-600' : ''}`}>
                    {officerCount} {minOfficers > 0 ? `/ ${minOfficers}` : ''}
                  </div>
                  {minOfficers === 0 && (
                    <div className="text-xs text-muted-foreground">No min</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Regular Officers */}
          {regularOfficers.map((officer: any) => {
            return (
              <div key={officer.officerId} className="grid grid-cols-9 border-b hover:bg-muted/30">
                <div className="p-2 border-r text-sm font-mono">{officer.badgeNumber}</div>
                <div className="p-2 border-r font-medium text-sm">
                  {getLastName(officer.officerName)}
                  <div className="text-xs text-muted-foreground">
                    SC: {officer.service_credit?.toFixed(1) || '0.0'}
                  </div>
                </div>
                {weekDays.map(({ dateStr }) => {
                  const dayOfficer = officer.weeklySchedule?.[dateStr];
                  return (
                    <div key={dateStr} className="p-2 border-r">
                      <ScheduleCellMobile
                        officer={dayOfficer}
                        dateStr={dateStr}
                        officerId={officer.officerId}
                        officerName={officer.officerName}
                        isAdminOrSupervisor={isAdminOrSupervisor}
                        isRegularRecurringDay={dayOfficer?.isRegularRecurringDay || false}
                        isSpecialAssignment={isSpecialAssignment}
                        onAssignPTO={onAssignPTO}
                        onRemovePTO={onRemovePTO}
                        onEditAssignment={onEditAssignment}
                        onRemoveOfficer={onRemoveOfficer}
                        isUpdating={isUpdating}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* PPO Section */}
          {ppoOfficers.length > 0 && (
            <>
              {/* PPO Count Row */}
              <div className="grid grid-cols-9 border-t-2 border-blue-200 bg-blue-50">
                <div className="p-2 border-r text-sm"></div>
                <div className="p-2 border-r text-sm font-medium">PPO</div>
                {weekDays.map(({ dateStr }) => {
                  const stats = dailyStats[dateStr];
                  const ppoCount = stats?.ppoCount || 0;
                  
                  return (
                    <div key={dateStr} className="p-2 text-center border-r text-sm font-medium bg-blue-50">
                      {ppoCount}
                    </div>
                  );
                })}
              </div>

              {/* PPO Officers */}
              {ppoOfficers.map((officer: any) => {
                return (
                  <div key={officer.officerId} className="grid grid-cols-9 border-b hover:bg-blue-50/50 bg-blue-50/30">
                    <div className="p-2 border-r text-sm font-mono">{officer.badgeNumber}</div>
                    <div className="p-2 border-r font-medium text-sm flex items-center gap-2">
                      {getLastName(officer.officerName)}
                      <Badge variant="outline" className="text-xs border-blue-300 bg-blue-100">
                        PPO
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        SC: {officer.service_credit?.toFixed(1) || '0.0'}
                      </div>
                    </div>
                    {weekDays.map(({ dateStr }) => {
                      const dayOfficer = officer.weeklySchedule?.[dateStr];
                      return (
                        <div key={dateStr} className="p-2 border-r">
                          <ScheduleCellMobile
                            officer={dayOfficer}
                            dateStr={dateStr}
                            officerId={officer.officerId}
                            officerName={officer.officerName}
                            isAdminOrSupervisor={isAdminOrSupervisor}
                            isPPO={true}
                            isRegularRecurringDay={dayOfficer?.isRegularRecurringDay || false}
                            isSpecialAssignment={isSpecialAssignment}
                            onAssignPTO={onAssignPTO}
                            onRemovePTO={onRemovePTO}
                            onEditAssignment={onEditAssignment}
                            onRemoveOfficer={onRemoveOfficer}
                            isUpdating={isUpdating}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

          {/* OVERTIME SECTION */}
          {hasOvertime && (
            <>
              {/* Overtime Count Row */}
              <div className="grid grid-cols-9 border-t-2 border-orange-300 bg-orange-50">
                <div className="p-2 border-r text-sm"></div>
                <div className="p-2 border-r text-sm font-medium">OVERTIME</div>
                {weekDays.map(({ dateStr }) => {
                  const stats = dailyStats[dateStr];
                  const overtimeCount = stats?.overtimeCount || 0;
                  return (
                    <div key={dateStr} className="p-2 text-center border-r text-sm font-medium bg-orange-50">
                      {overtimeCount}
                    </div>
                  );
                })}
              </div>

              {/* Overtime Row - Single consolidated row showing all overtime assignments */}
              <div className="grid grid-cols-9 border-b hover:bg-orange-50/50 bg-orange-50/30">
                <div className="p-2 border-r text-sm font-mono">OT</div>
                <div className="p-2 border-r font-medium text-sm flex items-center gap-2">
                  Overtime Assignments
                </div>
                {weekDays.map(({ dateStr }) => {
                  // Find overtime assignments for this date
                  const dayData = weeklyData.find(d => d.date === dateStr);
                  const overtimeOfficers = dayData?.data?.overtimeByDate?.[dateStr] || [];
                  
                  return (
                    <div key={dateStr} className="p-2 border-r">
                      {overtimeOfficers.length > 0 ? (
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {overtimeOfficers.map((officer: any) => (
                            <div key={`${officer.officerId}-${dateStr}`} 
                              className="text-xs p-1 bg-orange-100 rounded border border-orange-200">
                              <div className="font-medium truncate">
                                {getLastName(officer.officerName || '')}
                              </div>
                              <div className="text-xs text-orange-700 truncate">
                                {officer.shiftInfo?.position || 'Extra Duty'}
                              </div>
                              {officer.shiftInfo?.custom_start_time && (
                                <div className="text-xs text-orange-600">
                                  {officer.shiftInfo.custom_start_time}-{officer.shiftInfo.custom_end_time}
                                </div>
                              )}
                              {officer.shiftInfo?.reason && (
                                <div className="text-xs text-orange-500 italic">
                                  {officer.shiftInfo.reason}
                                </div>
                              )}
                              <div className="text-xs text-orange-800 mt-1">
                                🕒 Overtime Shift
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground text-center">-</div>
                      )}
                    </div>
                  );
                })}
              </div>
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
              <div className="w-4 h-4 rounded bg-green-50 border-l-2 border-green-400"></div>
              <span>Recurring Day</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-50 border-l-2 border-blue-400"></div>
              <span>Vacation (Vac)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-50 border-l-2 border-orange-400"></div>
              <span>Holiday (Hol)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-50 border-l-2 border-red-400"></div>
              <span>Sick (Sick)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-purple-50 border-l-2 border-purple-400"></div>
              <span>Comp (Comp)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-purple-50 border-l-2 border-purple-400"></div>
              <span>Special Assignment</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-50 border-l-2 border-orange-400"></div>
              <span>Overtime (is_extra_shift)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-100 border-l-2 border-gray-300"></div>
              <span>Not Scheduled</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
