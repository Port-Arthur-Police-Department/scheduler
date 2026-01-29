import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isSameDay, startOfWeek, endOfWeek } from "date-fns";
import { getLastName, getRankAbbreviation, isSupervisorByRank } from "./utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ScheduleCellMobile } from "./ScheduleCellMobile";
import { PREDEFINED_POSITIONS } from "@/constants/positions";
import { 
  sortOfficersConsistently, 
  type OfficerForSorting 
} from "@/utils/sortingUtils";

interface WeeklyViewMobileProps {
  currentWeekStart: Date;
  selectedShiftId: string;
  shiftTypes: any[];
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
  onAssignPTO,
  onRemovePTO,
  onEditAssignment,
  onRemoveOfficer,
  isUpdating = false,
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
        // Fetch schedule exceptions
        console.log('🔄 Fetching exceptions...');
        const { data: exceptions, error: exceptionsError } = await supabase
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
        console.log('✅ Exceptions fetched:', exceptions?.length, 'records');
        
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

        // NEW: Fetch all recurring schedules to determine primary shifts
        console.log('🔄 Fetching all recurring schedules for primary shift determination...');
        const { data: allRecurringSchedules, error: allRecurringError } = await supabase
          .from("recurring_schedules")
          .select("officer_id, shift_type_id, day_of_week")
          .order("officer_id");

        if (allRecurringError) {
          console.error("Error fetching all recurring schedules:", allRecurringError);
        }

        // Determine primary shifts from recurring schedules
        const primaryShifts = new Map();
        if (allRecurringSchedules) {
          const shiftCountsByOfficer = new Map();
          
          allRecurringSchedules.forEach(schedule => {
            const officerId = schedule.officer_id;
            const shiftId = schedule.shift_type_id;
            
            if (!shiftCountsByOfficer.has(officerId)) {
              shiftCountsByOfficer.set(officerId, new Map());
            }
            
            const officerShifts = shiftCountsByOfficer.get(officerId);
            officerShifts.set(shiftId, (officerShifts.get(shiftId) || 0) + 1);
          });
          
          shiftCountsByOfficer.forEach((shiftCounts, officerId) => {
            let maxCount = 0;
            let primaryShiftId = null;
            
            shiftCounts.forEach((count, shiftId) => {
              if (count > maxCount) {
                maxCount = count;
                primaryShiftId = shiftId;
              }
            });
            
            if (primaryShiftId) {
              primaryShifts.set(officerId, primaryShiftId);
            }
          });
        }

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

        // Organize data
        const allOfficers = new Map();
        const recurringSchedulesByOfficer = new Map();
        const exceptionsByOfficerAndDate = new Map();

        // Extract recurring schedule patterns
        recurringSchedules?.forEach((recurring: any) => {
          if (!recurringSchedulesByOfficer.has(recurring.officer_id)) {
            recurringSchedulesByOfficer.set(recurring.officer_id, new Set());
          }
          recurringSchedulesByOfficer.get(recurring.officer_id).add(recurring.day_of_week);
        });

        // Map exceptions by officer and date for quick lookup
        exceptions?.forEach((exception: any) => {
          const key = `${exception.officer_id}-${exception.date}`;
          exceptionsByOfficerAndDate.set(key, exception);
        });

        console.log('🗺️ Processing weekly data...');

        // Process weekly data
        weekDays.forEach(day => {
          const dayExceptions = exceptions?.filter(e => e.date === day.dateStr) || [];
          const dayRecurring = recurringSchedules?.filter(r => r.day_of_week === day.dayOfWeek) || [];
          
          // Prioritize exceptions over recurring
          const processedOfficers = new Set();
          
          // First, process exceptions
          dayExceptions.forEach(item => {
            const officerId = item.officer_id;
            processedOfficers.add(officerId);
            
            const hireDate = item.profiles?.hire_date;
            const promotionDateSergeant = item.profiles?.promotion_date_sergeant;
            const promotionDateLieutenant = item.profiles?.promotion_date_lieutenant;
            const overrideCredit = item.profiles?.service_credit_override || 0;
            const badgeNumber = item.profiles?.badge_number || '9999';
            
            // Check if this is an extra shift (overtime)
            const primaryShiftId = primaryShifts.get(officerId);
            const isExtraShift = primaryShiftId && primaryShiftId !== selectedShiftId;
            
            if (!allOfficers.has(officerId)) {
              const relevantPromotionDate = getRelevantPromotionDate(
                item.profiles?.rank,
                promotionDateSergeant,
                promotionDateLieutenant
              );
              
              allOfficers.set(officerId, {
                officerId: officerId,
                officerName: item.profiles?.full_name || "Unknown",
                badgeNumber: badgeNumber,
                rank: item.profiles?.rank || "Officer",
                service_credit: 0,
                hire_date: hireDate,
                promotion_date_sergeant: promotionDateSergeant,
                promotion_date_lieutenant: promotionDateLieutenant,
                service_credit_override: overrideCredit,
                promotion_date: relevantPromotionDate || hireDate,
                recurringDays: recurringSchedulesByOfficer.get(officerId) || new Set(),
                weeklySchedule: {} as Record<string, any>,
                primaryShiftId: primaryShiftId,
                isExtraShift: isExtraShift
              });
            }
            
            // CRITICAL: Properly set PTO data
            const hasPTO = item.is_off === true && !!item.reason;
            const daySchedule = {
              officerId: officerId,
              officerName: item.profiles?.full_name || "Unknown",
              badgeNumber: badgeNumber,
              rank: item.profiles?.rank || "Officer",
              service_credit: 0,
              date: day.dateStr,
              dayOfWeek: day.dayOfWeek,
              isRegularRecurringDay: false,
              isExtraShift: isExtraShift,
              shiftInfo: {
                scheduleId: item.id,
                scheduleType: "exception",
                position: item.position_name,
                isOff: item.is_off || false,
                hasPTO: hasPTO,
                ptoData: hasPTO ? {
                  ptoType: item.reason,
                  isFullShift: true
                } : undefined,
                reason: item.reason,
                isExtraShift: isExtraShift,
                custom_start_time: item.custom_start_time,
                custom_end_time: item.custom_end_time
              }
            };
            
            if (hasPTO) {
              console.log('🎯 PTO Found for', item.profiles?.full_name, 'on', day.dateStr, ':', {
                ptoType: item.reason
              });
            }
            
            allOfficers.get(officerId).weeklySchedule[day.dateStr] = daySchedule;
          });
          
          // Then, process recurring ONLY if no exception exists
          dayRecurring.forEach(item => {
            const officerId = item.officer_id;
            
            // Skip if we already processed an exception for this officer on this day
            if (processedOfficers.has(officerId)) {
              return;
            }
            
            const hireDate = item.profiles?.hire_date;
            const promotionDateSergeant = item.profiles?.promotion_date_sergeant;
            const promotionDateLieutenant = item.profiles?.promotion_date_lieutenant;
            const overrideCredit = item.profiles?.service_credit_override || 0;
            const badgeNumber = item.profiles?.badge_number || '9999';
            
            // Check if this is an extra shift (overtime)
            const primaryShiftId = primaryShifts.get(officerId);
            const isExtraShift = primaryShiftId && primaryShiftId !== selectedShiftId;
            
            if (!allOfficers.has(officerId)) {
              const relevantPromotionDate = getRelevantPromotionDate(
                item.profiles?.rank,
                promotionDateSergeant,
                promotionDateLieutenant
              );
              
              allOfficers.set(officerId, {
                officerId: officerId,
                officerName: item.profiles?.full_name || "Unknown",
                badgeNumber: badgeNumber,
                rank: item.profiles?.rank || "Officer",
                service_credit: 0,
                hire_date: hireDate,
                promotion_date_sergeant: promotionDateSergeant,
                promotion_date_lieutenant: promotionDateLieutenant,
                service_credit_override: overrideCredit,
                promotion_date: relevantPromotionDate || hireDate,
                recurringDays: recurringSchedulesByOfficer.get(officerId) || new Set(),
                weeklySchedule: {} as Record<string, any>,
                primaryShiftId: primaryShiftId,
                isExtraShift: isExtraShift
              });
            }
            
            const daySchedule = {
              officerId: officerId,
              officerName: item.profiles?.full_name || "Unknown",
              badgeNumber: badgeNumber,
              rank: item.profiles?.rank || "Officer",
              service_credit: 0,
              date: day.dateStr,
              dayOfWeek: day.dayOfWeek,
              isRegularRecurringDay: true,
              isExtraShift: isExtraShift,
              shiftInfo: {
                scheduleId: item.id,
                scheduleType: "recurring",
                position: item.position_name,
                isOff: item.is_off || false,
                hasPTO: false,
                ptoData: undefined,
                reason: item.reason,
                isExtraShift: isExtraShift
              }
            };
            
            allOfficers.get(officerId).weeklySchedule[day.dateStr] = daySchedule;
          });
        });

        console.log('📊 Total unique officers found:', allOfficers.size);

        // Fetch service credits for all officers via RPC
        console.log('🔄 Fetching service credits via RPC...');
        const officerIds = Array.from(allOfficers.values()).map(o => o.officerId);
        const uniqueOfficerIds = [...new Set(officerIds)];
        const serviceCreditsMap = new Map();

        if (uniqueOfficerIds.length > 0) {
          for (const officerId of uniqueOfficerIds) {
            try {
              const { data, error } = await supabase
                .rpc('get_service_credit', { profile_id: officerId });
              
              if (!error && data !== null) {
                const creditValue = parseFloat(data);
                serviceCreditsMap.set(officerId, isNaN(creditValue) ? 0 : creditValue);
              } else {
                console.log(`No service credit data for officer ${officerId}:`, error);
                serviceCreditsMap.set(officerId, 0);
              }
            } catch (error) {
              console.error(`Error fetching service credit for officer ${officerId}:`, error);
              serviceCreditsMap.set(officerId, 0);
            }
          }
        }

        // Update officers with fetched service credits
        allOfficers.forEach(officer => {
          officer.service_credit = serviceCreditsMap.get(officer.officerId) || 0;
          Object.values(officer.weeklySchedule).forEach((daySchedule: any) => {
            daySchedule.service_credit = officer.service_credit;
          });
        });

        // Separate regular officers from overtime officers
        const regularOfficersArray = Array.from(allOfficers.values()).filter(officer => 
          !officer.isExtraShift
        );
        
        const overtimeOfficersArray = Array.from(allOfficers.values()).filter(officer => 
          officer.isExtraShift
        );

        // Convert regular officers to OfficerForSorting format
        const regularOfficersForSorting: OfficerForSorting[] = regularOfficersArray.map(officer => ({
          id: officer.officerId,
          full_name: officer.officerName,
          officerName: officer.officerName,
          badge_number: officer.badgeNumber,
          badgeNumber: officer.badgeNumber,
          rank: officer.rank,
          service_credit: officer.service_credit,
          serviceCredit: officer.service_credit,
          hire_date: officer.hire_date,
          service_credit_override: officer.service_credit_override || 0,
          promotion_date_sergeant: officer.promotion_date_sergeant,
          promotion_date_lieutenant: officer.promotion_date_lieutenant
        }));

        // Sort officers consistently
        console.log('🔄 Sorting officers consistently...');
        const sortedOfficers = sortOfficersConsistently(regularOfficersForSorting);

        // Map back to original structure and categorize
        const supervisors = sortedOfficers
          .filter(officer => isSupervisorByRank({ rank: officer.rank }))
          .map(officer => {
            const originalOfficer = regularOfficersArray.find(o => o.officerId === officer.id);
            if (originalOfficer) {
              originalOfficer.service_credit = officer.service_credit;
            }
            return originalOfficer;
          })
          .filter(Boolean);

        const regularOfficers = sortedOfficers
          .filter(officer => 
            !isSupervisorByRank({ rank: officer.rank }) && 
            officer.rank?.toLowerCase() !== 'probationary'
          )
          .map(officer => {
            const originalOfficer = regularOfficersArray.find(o => o.officerId === officer.id);
            if (originalOfficer) {
              originalOfficer.service_credit = officer.service_credit;
            }
            return originalOfficer;
          })
          .filter(Boolean);

        const ppos = sortedOfficers
          .filter(officer => officer.rank?.toLowerCase() === 'probationary')
          .map(officer => {
            const originalOfficer = regularOfficersArray.find(o => o.officerId === officer.id);
            if (originalOfficer) {
              originalOfficer.service_credit = officer.service_credit;
            }
            return originalOfficer;
          })
          .filter(Boolean);

        // Group overtime officers by date
        const overtimeByDate: Record<string, any[]> = {};
        weekDays.forEach(day => {
          overtimeByDate[day.dateStr] = [];
        });
        
        overtimeOfficersArray.forEach(officer => {
          Object.entries(officer.weeklySchedule || {}).forEach(([dateStr, schedule]: [string, any]) => {
            if (overtimeByDate[dateStr]) {
              overtimeByDate[dateStr].push(schedule);
            }
          });
        });

        console.log('✅ Data processing complete:', {
          supervisors: supervisors.length,
          regularOfficers: regularOfficers.length,
          ppos: ppos.length,
          overtimeOfficers: overtimeOfficersArray.length
        });

        return {
          supervisors,
          regularOfficers,
          ppos,
          overtimeOfficers: overtimeOfficersArray,
          overtimeByDate,
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

  const hasOvertime = scheduleData.overtimeOfficers && scheduleData.overtimeOfficers.length > 0;

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
                <div className="text-xs text-muted-foreground">
                  SC: {officer.service_credit?.toFixed(1) || '0.0'}
                </div>
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
                <div className="text-xs text-muted-foreground">
                  SC: {officer.service_credit?.toFixed(1) || '0.0'}
                </div>
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
                    <div className="text-xs text-muted-foreground">
                      SC: {officer.service_credit?.toFixed(1) || '0.0'}
                    </div>
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
              ))}
            </>
          )}

          {/* OVERTIME SECTION - NEW */}
          {hasOvertime && (
            <>
              {/* Overtime Count Row */}
              <div className="grid grid-cols-9 border-t-2 border-orange-300 bg-orange-50">
                <div className="p-2 border-r text-sm"></div>
                <div className="p-2 border-r text-sm font-medium">OVERTIME</div>
                {weekDays.map(({ dateStr }) => {
                  const overtimeCount = scheduleData.overtimeByDate?.[dateStr]?.length || 0;
                  return (
                    <div key={dateStr} className="p-2 text-center border-r text-sm font-medium bg-orange-50">
                      {overtimeCount}
                    </div>
                  );
                })}
              </div>

              {/* Overtime Row */}
              <div className="grid grid-cols-9 border-b hover:bg-orange-50/50 bg-orange-50/30">
                <div className="p-2 border-r text-sm font-mono">OT</div>
                <div className="p-2 border-r font-medium text-sm flex items-center gap-2">
                  Overtime
                </div>
                {weekDays.map(({ dateStr }) => {
                  const overtimeOfficers = scheduleData.overtimeByDate?.[dateStr] || [];
                  
                  return (
                    <div key={dateStr} className="p-2 border-r">
                      {overtimeOfficers.length > 0 ? (
                        <div className="space-y-1">
                          {overtimeOfficers.map((officer: any) => (
                            <div key={`${officer.officerId}-${dateStr}`} 
                              className="text-xs p-1 bg-orange-100 rounded border border-orange-200">
                              <div className="font-medium truncate">
                                {getLastName(officer.officerName)}
                              </div>
                              <div className="text-xs text-orange-700 truncate">
                                {officer.shiftInfo?.position || 'Extra'}
                              </div>
                              {officer.shiftInfo?.custom_start_time && (
                                <div className="text-xs text-orange-600">
                                  {officer.shiftInfo.custom_start_time}-{officer.shiftInfo.custom_end_time}
                                </div>
                              )}
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
              <span>Overtime</span>
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
  // New action props
  onAssignPTO,
  onRemovePTO,
  onEditAssignment,
  onRemoveOfficer,
  isUpdating = false,
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
      // Fetch schedule exceptions
      console.log('🔄 Fetching exceptions...');
      const { data: exceptions, error: exceptionsError } = await supabase
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
      console.log('✅ Exceptions fetched:', exceptions?.length, 'records');
      
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

      // Organize data
      const allOfficers = new Map();
      const recurringSchedulesByOfficer = new Map();
      const exceptionsByOfficerAndDate = new Map();

      // Extract recurring schedule patterns
      recurringSchedules?.forEach((recurring: any) => {
        if (!recurringSchedulesByOfficer.has(recurring.officer_id)) {
          recurringSchedulesByOfficer.set(recurring.officer_id, new Set());
        }
        recurringSchedulesByOfficer.get(recurring.officer_id).add(recurring.day_of_week);
      });

      // Map exceptions by officer and date for quick lookup
      exceptions?.forEach((exception: any) => {
        const key = `${exception.officer_id}-${exception.date}`;
        exceptionsByOfficerAndDate.set(key, exception);
      });

      console.log('🗺️ Processing weekly data...');

      // Process weekly data
      weekDays.forEach(day => {
        const dayExceptions = exceptions?.filter(e => e.date === day.dateStr) || [];
        const dayRecurring = recurringSchedules?.filter(r => r.day_of_week === day.dayOfWeek) || [];
        
        // Prioritize exceptions over recurring
        const processedOfficers = new Set();
        
        // First, process exceptions
        dayExceptions.forEach(item => {
          const officerId = item.officer_id;
          processedOfficers.add(officerId);
          
          const hireDate = item.profiles?.hire_date;
          const promotionDateSergeant = item.profiles?.promotion_date_sergeant;
          const promotionDateLieutenant = item.profiles?.promotion_date_lieutenant;
          const overrideCredit = item.profiles?.service_credit_override || 0;
          const badgeNumber = item.profiles?.badge_number || '9999';
          
          // We'll fetch service credit via RPC later, but store basic data
          if (!allOfficers.has(officerId)) {
            const relevantPromotionDate = getRelevantPromotionDate(
              item.profiles?.rank,
              promotionDateSergeant,
              promotionDateLieutenant
            );
            
            allOfficers.set(officerId, {
              officerId: officerId,
              officerName: item.profiles?.full_name || "Unknown",
              badgeNumber: badgeNumber,
              rank: item.profiles?.rank || "Officer",
              // We'll fetch service credit via RPC
              service_credit: 0, // Initialize as 0, will be updated via RPC
              hire_date: hireDate,
              promotion_date_sergeant: promotionDateSergeant,
              promotion_date_lieutenant: promotionDateLieutenant,
              service_credit_override: overrideCredit,
              promotion_date: relevantPromotionDate || hireDate,
              recurringDays: recurringSchedulesByOfficer.get(officerId) || new Set(),
              weeklySchedule: {} as Record<string, any>
            });
          }
          
          // CRITICAL: Properly set PTO data - Use 'reason' field for PTO type
          const hasPTO = item.is_off === true && !!item.reason;
          const daySchedule = {
            officerId: officerId,
            officerName: item.profiles?.full_name || "Unknown",
            badgeNumber: badgeNumber,
            rank: item.profiles?.rank || "Officer",
            service_credit: 0, // Will be updated via RPC
            date: day.dateStr,
            dayOfWeek: day.dayOfWeek,
            isRegularRecurringDay: false, // Exceptions are never "regular recurring"
            shiftInfo: {
              scheduleId: item.id,
              scheduleType: "exception",
              position: item.position_name,
              isOff: item.is_off || false,
              hasPTO: hasPTO,
              ptoData: hasPTO ? {
                ptoType: item.reason,
                isFullShift: true
              } : undefined,
              reason: item.reason
            }
          };
          
          if (hasPTO) {
            console.log('🎯 PTO Found for', item.profiles?.full_name, 'on', day.dateStr, ':', {
              ptoType: item.reason
            });
          }
          
          allOfficers.get(officerId).weeklySchedule[day.dateStr] = daySchedule;
        });
        
        // Then, process recurring ONLY if no exception exists
        dayRecurring.forEach(item => {
          const officerId = item.officer_id;
          
          // Skip if we already processed an exception for this officer on this day
          if (processedOfficers.has(officerId)) {
            return;
          }
          
          const hireDate = item.profiles?.hire_date;
          const promotionDateSergeant = item.profiles?.promotion_date_sergeant;
          const promotionDateLieutenant = item.profiles?.promotion_date_lieutenant;
          const overrideCredit = item.profiles?.service_credit_override || 0;
          const badgeNumber = item.profiles?.badge_number || '9999';
          
          if (!allOfficers.has(officerId)) {
            const relevantPromotionDate = getRelevantPromotionDate(
              item.profiles?.rank,
              promotionDateSergeant,
              promotionDateLieutenant
            );
            
            allOfficers.set(officerId, {
              officerId: officerId,
              officerName: item.profiles?.full_name || "Unknown",
              badgeNumber: badgeNumber,
              rank: item.profiles?.rank || "Officer",
              service_credit: 0, // Initialize as 0, will be updated via RPC
              hire_date: hireDate,
              promotion_date_sergeant: promotionDateSergeant,
              promotion_date_lieutenant: promotionDateLieutenant,
              service_credit_override: overrideCredit,
              promotion_date: relevantPromotionDate || hireDate,
              recurringDays: recurringSchedulesByOfficer.get(officerId) || new Set(),
              weeklySchedule: {} as Record<string, any>
            });
          }
          
          const daySchedule = {
            officerId: officerId,
            officerName: item.profiles?.full_name || "Unknown",
            badgeNumber: badgeNumber,
            rank: item.profiles?.rank || "Officer",
            service_credit: 0, // Will be updated via RPC
            date: day.dateStr,
            dayOfWeek: day.dayOfWeek,
            isRegularRecurringDay: true, // This is a regular recurring day
            shiftInfo: {
              scheduleId: item.id,
              scheduleType: "recurring",
              position: item.position_name,
              isOff: item.is_off || false,
              hasPTO: false, // Recurring schedules don't have PTO
              ptoData: undefined,
              reason: item.reason
            }
          };
          
          allOfficers.get(officerId).weeklySchedule[day.dateStr] = daySchedule;
        });
      });

      console.log('📊 Total unique officers found:', allOfficers.size);

      // Fetch service credits for all officers via RPC (same as ForceListView)
      console.log('🔄 Fetching service credits via RPC...');
      const officerIds = Array.from(allOfficers.values()).map(o => o.officerId);
      const uniqueOfficerIds = [...new Set(officerIds)];
      const serviceCreditsMap = new Map();

      if (uniqueOfficerIds.length > 0) {
        for (const officerId of uniqueOfficerIds) {
          try {
            const { data, error } = await supabase
              .rpc('get_service_credit', { profile_id: officerId });
            
            if (!error && data !== null) {
              const creditValue = parseFloat(data);
              serviceCreditsMap.set(officerId, isNaN(creditValue) ? 0 : creditValue);
            } else {
              console.log(`No service credit data for officer ${officerId}:`, error);
              serviceCreditsMap.set(officerId, 0);
            }
          } catch (error) {
            console.error(`Error fetching service credit for officer ${officerId}:`, error);
            serviceCreditsMap.set(officerId, 0);
          }
        }
      }

      // Update officers with fetched service credits
      allOfficers.forEach(officer => {
        officer.service_credit = serviceCreditsMap.get(officer.officerId) || 0;
        // Also update the weekly schedule entries
        Object.values(officer.weeklySchedule).forEach((daySchedule: any) => {
          daySchedule.service_credit = officer.service_credit;
        });
      });

      // Convert to OfficerForSorting format for consistent sorting
      const officersForSorting: OfficerForSorting[] = Array.from(allOfficers.values()).map(officer => ({
        id: officer.officerId,
        full_name: officer.officerName,
        officerName: officer.officerName,
        badge_number: officer.badgeNumber,
        badgeNumber: officer.badgeNumber,
        rank: officer.rank,
        service_credit: officer.service_credit,
        serviceCredit: officer.service_credit,
        hire_date: officer.hire_date,
        service_credit_override: officer.service_credit_override || 0,
        promotion_date_sergeant: officer.promotion_date_sergeant,
        promotion_date_lieutenant: officer.promotion_date_lieutenant
      }));

      // Sort officers consistently using the centralized utility
      console.log('🔄 Sorting officers consistently...');
      const sortedOfficers = sortOfficersConsistently(officersForSorting);

      // Map back to original structure and categorize
      const supervisors = sortedOfficers
        .filter(officer => isSupervisorByRank({ rank: officer.rank }))
        .map(officer => {
          const originalOfficer = allOfficers.get(officer.id);
          if (originalOfficer) {
            originalOfficer.service_credit = officer.service_credit;
          }
          return originalOfficer;
        })
        .filter(Boolean);

      const regularOfficers = sortedOfficers
        .filter(officer => 
          !isSupervisorByRank({ rank: officer.rank }) && 
          officer.rank?.toLowerCase() !== 'probationary'
        )
        .map(officer => {
          const originalOfficer = allOfficers.get(officer.id);
          if (originalOfficer) {
            originalOfficer.service_credit = officer.service_credit;
          }
          return originalOfficer;
        })
        .filter(Boolean);

      const ppos = sortedOfficers
        .filter(officer => officer.rank?.toLowerCase() === 'probationary')
        .map(officer => {
          const originalOfficer = allOfficers.get(officer.id);
          if (originalOfficer) {
            originalOfficer.service_credit = officer.service_credit;
          }
          return originalOfficer;
        })
        .filter(Boolean);

      console.log('✅ Data processing complete with consistent sorting:', {
        supervisors: supervisors.length,
        regularOfficers: regularOfficers.length,
        ppos: ppos.length
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
                <div className="text-xs text-muted-foreground">
                  SC: {officer.service_credit?.toFixed(1) || '0.0'}
                </div>
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
                      // Add action handlers
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
                <div className="text-xs text-muted-foreground">
                  SC: {officer.service_credit?.toFixed(1) || '0.0'}
                </div>
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
                      // Add action handlers
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
                    <div className="text-xs text-muted-foreground">
                      SC: {officer.service_credit?.toFixed(1) || '0.0'}
                    </div>
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
                          // Add action handlers
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
