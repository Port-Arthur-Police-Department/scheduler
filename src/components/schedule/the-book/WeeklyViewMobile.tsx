import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
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

// Helper function to calculate service credit with promotion date support
const calculateServiceCredit = (hireDate: string | null, 
                               override: number = 0,
                               promotionDateSergeant: string | null = null,
                               promotionDateLieutenant: string | null = null,
                               currentRank: string | null = null) => {
  if (override && override > 0) {
    return override;
  }
  
  let relevantDate: Date | null = null;
  
  if (currentRank) {
    const rankLower = currentRank.toLowerCase();
    
    if ((rankLower.includes('sergeant') || rankLower.includes('sgt')) && promotionDateSergeant) {
      relevantDate = new Date(promotionDateSergeant);
    } else if ((rankLower.includes('lieutenant') || rankLower.includes('lt')) && promotionDateLieutenant) {
      relevantDate = new Date(promotionDateLieutenant);
    } else if (rankLower.includes('chief') && promotionDateLieutenant) {
      relevantDate = new Date(promotionDateLieutenant);
    }
  }
  
  if (!relevantDate && hireDate) {
    relevantDate = new Date(hireDate);
  }
  
  if (!relevantDate) return 0;
  
  try {
    const now = new Date();
    const years = now.getFullYear() - relevantDate.getFullYear();
    const months = now.getMonth() - relevantDate.getMonth();
    const days = now.getDate() - relevantDate.getDate();
    const totalYears = years + (months / 12) + (days / 365);
    return Math.max(0, Math.round(totalYears * 10) / 10);
  } catch (error) {
    console.error('Error calculating service credit:', error);
    return 0;
  }
};

const getRelevantPromotionDate = (
  rank: string | undefined, 
  sergeantDate: string | null, 
  lieutenantDate: string | null
): string | null => {
  if (!rank) return null;
  const rankLower = rank.toLowerCase();
  
  if (rankLower.includes('lieutenant') || rankLower.includes('chief')) {
    return lieutenantDate || sergeantDate || null;
  }
  if (rankLower.includes('sergeant') || rankLower.includes('sgt')) {
    return sergeantDate || null;
  }
  return null;
};

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

  const { data: scheduleData, isLoading, error } = useQuery({
    queryKey: ['weekly-schedule-mobile', selectedShiftId, currentWeekStart.toISOString()],
// Replace the entire query function in WeeklyViewMobile.tsx with this:
queryFn: async () => {
  console.log('🔍 Mobile query started for shift:', selectedShiftId, 'week:', format(currentWeekStart, 'yyyy-MM-dd'));
  
  if (!selectedShiftId) {
    console.log('❌ No shift ID selected');
    return null;
  }

  const startStr = format(currentWeekStart, "yyyy-MM-dd");
  const endStr = format(endOfWeek(currentWeekStart, { weekStartsOn: 0 }), "yyyy-MM-dd");

  console.log('📅 Fetching data for date range:', startStr, 'to', endStr);

  try {
    // Fetch ALL schedule exceptions (including PTO)
    console.log('🔄 Fetching ALL schedule exceptions...');
    const { data: allExceptions, error: exceptionsError } = await supabase
      .from("schedule_exceptions")
      .select(`
        *,
        profiles:officer_id (
          id, full_name, badge_number, rank, hire_date, 
          promotion_date_sergeant, promotion_date_lieutenant,
          service_credit_override
        )
      `)
      .eq("shift_type_id", selectedShiftId)
      .gte("date", startStr)
      .lte("date", endStr)
      .order("date", { ascending: true });

    if (exceptionsError) throw exceptionsError;
    console.log('✅ All exceptions fetched:', allExceptions?.length, 'records');

    // Log all PTO records found
    const ptoExceptions = allExceptions?.filter(e => e.is_off === true && e.reason);
    console.log('📋 PTO Exceptions found:', ptoExceptions?.length);
    ptoExceptions?.forEach(ptoe => {
      console.log('   -', ptoe.profiles?.full_name, 'on', ptoe.date, ':', ptoe.reason);
    });

    // Fetch recurring schedules
    console.log('🔄 Fetching recurring schedules...');
    const { data: recurringSchedules, error: recurringError } = await supabase
      .from("recurring_schedules")
      .select(`
        *,
        profiles:officer_id (
          id, full_name, badge_number, rank, hire_date,
          promotion_date_sergeant, promotion_date_lieutenant,
          service_credit_override
        )
      `)
      .eq("shift_type_id", selectedShiftId)
      .or(`end_date.is.null,end_date.gte.${startStr}`);

    if (recurringError) throw recurringError;
    console.log('✅ Recurring fetched:', recurringSchedules?.length, 'records');

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

    // Organize data - SIMPLER APPROACH
    const allOfficers = new Map();
    
    // Process each day of the week
    weekDays.forEach(day => {
      // Find exceptions for this day
      const dayExceptions = allExceptions?.filter(e => e.date === day.dateStr) || [];
      
      // Find recurring schedules for this day of week
      const dayRecurring = recurringSchedules?.filter(r => r.day_of_week === day.dayOfWeek) || [];
      
      // Process exceptions first (they override recurring)
      dayExceptions.forEach(exception => {
        const officerId = exception.officer_id;
        const profile = exception.profiles;
        
        const serviceCredit = calculateServiceCredit(
          profile?.hire_date,
          profile?.service_credit_override || 0,
          profile?.promotion_date_sergeant,
          profile?.promotion_date_lieutenant,
          profile?.rank
        );
        
        if (!allOfficers.has(officerId)) {
          const relevantPromotionDate = getRelevantPromotionDate(
            profile?.rank,
            profile?.promotion_date_sergeant,
            profile?.promotion_date_lieutenant
          );
          
          allOfficers.set(officerId, {
            officerId: officerId,
            officerName: profile?.full_name || "Unknown",
            badgeNumber: profile?.badge_number || '9999',
            rank: profile?.rank || "Officer",
            service_credit: serviceCredit,
            hire_date: profile?.hire_date,
            promotion_date_sergeant: profile?.promotion_date_sergeant,
            promotion_date_lieutenant: profile?.promotion_date_lieutenant,
            promotion_date: relevantPromotionDate || profile?.hire_date,
            recurringDays: new Set(), // Will be filled later
            weeklySchedule: {} as Record<string, any>
          });
        }
        
        // Check if this is PTO (is_off AND has a reason)
        const hasPTO = exception.is_off === true && !!exception.reason;
        
        const daySchedule = {
          officerId: officerId,
          officerName: profile?.full_name || "Unknown",
          badgeNumber: profile?.badge_number || '9999',
          rank: profile?.rank || "Officer",
          service_credit: serviceCredit,
          date: day.dateStr,
          dayOfWeek: day.dayOfWeek,
          isRegularRecurringDay: false, // Exceptions override recurring
          shiftInfo: {
            scheduleId: exception.id,
            scheduleType: "exception",
            position: exception.position_name,
            isOff: exception.is_off,
            hasPTO: hasPTO,
            ptoData: hasPTO ? {
              ptoType: exception.reason,
              isFullShift: true // Most PTO is full shift
            } : undefined,
            reason: exception.reason
          }
        };
        
        if (hasPTO) {
          console.log('✅ PTO assigned to', profile?.full_name, 'on', day.dateStr, ':', exception.reason);
        }
        
        allOfficers.get(officerId).weeklySchedule[day.dateStr] = daySchedule;
      });
      
      // Process recurring schedules ONLY if no exception exists for that officer/day
      dayRecurring.forEach(recurring => {
        const officerId = recurring.officer_id;
        const profile = recurring.profiles;
        
        // Skip if we already have an exception for this officer on this day
        const hasException = dayExceptions.some(e => e.officer_id === officerId);
        if (hasException) return;
        
        const serviceCredit = calculateServiceCredit(
          profile?.hire_date,
          profile?.service_credit_override || 0,
          profile?.promotion_date_sergeant,
          profile?.promotion_date_lieutenant,
          profile?.rank
        );
        
        if (!allOfficers.has(officerId)) {
          const relevantPromotionDate = getRelevantPromotionDate(
            profile?.rank,
            profile?.promotion_date_sergeant,
            profile?.promotion_date_lieutenant
          );
          
          allOfficers.set(officerId, {
            officerId: officerId,
            officerName: profile?.full_name || "Unknown",
            badgeNumber: profile?.badge_number || '9999',
            rank: profile?.rank || "Officer",
            service_credit: serviceCredit,
            hire_date: profile?.hire_date,
            promotion_date_sergeant: profile?.promotion_date_sergeant,
            promotion_date_lieutenant: profile?.promotion_date_lieutenant,
            promotion_date: relevantPromotionDate || profile?.hire_date,
            recurringDays: new Set(),
            weeklySchedule: {} as Record<string, any>
          });
        }
        
        // Track that this officer has a recurring schedule on this day
        allOfficers.get(officerId).recurringDays.add(day.dayOfWeek);
        
        const daySchedule = {
          officerId: officerId,
          officerName: profile?.full_name || "Unknown",
          badgeNumber: profile?.badge_number || '9999',
          rank: profile?.rank || "Officer",
          service_credit: serviceCredit,
          date: day.dateStr,
          dayOfWeek: day.dayOfWeek,
          isRegularRecurringDay: true,
          shiftInfo: {
            scheduleId: recurring.id,
            scheduleType: "recurring",
            position: recurring.position_name,
            isOff: false,
            hasPTO: false,
            ptoData: undefined
          }
        };
        
        allOfficers.get(officerId).weeklySchedule[day.dateStr] = daySchedule;
      });
    });
    
    console.log('📊 Total unique officers found:', allOfficers.size);

    // Categorize officers
    const allSupervisors = Array.from(allOfficers.values())
      .filter(o => isSupervisorByRank(o));

    const lieutenants = allSupervisors.filter(o => 
      o.rank?.toLowerCase().includes('lieutenant') || 
      o.rank?.toLowerCase().includes('lt') ||
      o.rank?.toLowerCase().includes('chief')
    ).sort((a, b) => {
      const aCredit = a.service_credit || 0;
      const bCredit = b.service_credit || 0;
      if (bCredit !== aCredit) return bCredit - aCredit;
      return getLastName(a.officerName).localeCompare(getLastName(b.officerName));
    });

    const sergeants = allSupervisors.filter(o => 
      o.rank?.toLowerCase().includes('sergeant') || 
      o.rank?.toLowerCase().includes('sgt')
    ).sort((a, b) => {
      const aCredit = a.service_credit || 0;
      const bCredit = b.service_credit || 0;
      if (bCredit !== aCredit) return bCredit - aCredit;
      return getLastName(a.officerName).localeCompare(getLastName(b.officerName));
    });

    const supervisors = [...lieutenants, ...sergeants];

    const allOfficersList = Array.from(allOfficers.values())
      .filter(o => !isSupervisorByRank(o));

    const ppos = allOfficersList
      .filter(o => o.rank?.toLowerCase() === 'probationary')
      .sort((a, b) => {
        const aCredit = a.service_credit || 0;
        const bCredit = b.service_credit || 0;
        if (bCredit !== aCredit) return bCredit - aCredit;
        const aBadge = parseInt(a.badgeNumber) || 9999;
        const bBadge = parseInt(b.badgeNumber) || 9999;
        return aBadge - bBadge;
      });

    const regularOfficers = allOfficersList
      .filter(o => o.rank?.toLowerCase() !== 'probationary')
      .sort((a, b) => {
        const aCredit = a.service_credit || 0;
        const bCredit = b.service_credit || 0;
        if (bCredit !== aCredit) return bCredit - aCredit;
        const aBadge = parseInt(a.badgeNumber) || 9999;
        const bBadge = parseInt(b.badgeNumber) || 9999;
        return aBadge - bBadge;
      });

    console.log('✅ Data processing complete');

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

  } catch (error) {
    console.error('❌ Error in mobile schedule query:', error);
    throw error;
  }
},
    enabled: !!selectedShiftId,
    retry: 1,
  });

  // Helper function to check if an assignment is a special assignment
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

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-3/4 mx-auto" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    console.error('Query error details:', error);
    return (
      <div className="text-center py-8 text-destructive">
        <p className="font-semibold mb-2">Error loading schedule</p>
        <p className="text-sm text-muted-foreground mb-4">
          {error.message || 'Unknown error occurred'}
        </p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Retry
        </Button>
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

      {/* Weekly Table */}
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
              {weekDays.map(({ dateStr }) => {
                const dayOfficer = officer.weeklySchedule[dateStr];
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
                    />
                  </div>
                );
              })}
            </div>
          ))}

          {/* Officer Count Row */}
          <div className="grid grid-cols-9 border-b bg-gray-200">
            <div className="p-2 border-r text-sm"></div>
            <div className="p-2 border-r text-sm font-medium">OFFICERS</div>
            {weekDays.map(({ dateStr, dayOfWeek }) => {
              const daySchedule = scheduleData.dailySchedules?.find(s => s.date === dateStr);
              const minStaffingForDay = scheduleData.minimumStaffing?.get(dayOfWeek)?.get(selectedShiftId);
              const minimumOfficers = minStaffingForDay?.minimumOfficers || 0;
              
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
              {weekDays.map(({ dateStr }) => {
                const dayOfficer = officer.weeklySchedule[dateStr];
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
                    />
                  </div>
                );
              })}
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
                  {weekDays.map(({ dateStr }) => {
                    const dayOfficer = officer.weeklySchedule[dateStr];
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
                        />
                      </div>
                    );
                  })}
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
        <div className="w-4 h-4 rounded bg-gray-100 border-l-2 border-gray-300"></div>
        <span>Not Scheduled</span>
      </div>
    </div>
  </CardContent>
</Card>
    </div>
  );
};
