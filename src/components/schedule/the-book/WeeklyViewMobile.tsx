// src/components/schedule/the-book/WeeklyViewMobile.tsx - UPDATED WITH NIGHT-SHIFT PTO FIX
import React, { useState, useEffect, useMemo } from 'react';
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
import {
  isShiftUnderstaffed,
  hasMinimumRequirements,
  formatStaffingCount
} from "@/utils/staffingUtils";

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
  overtimeExceptions?: any[];
}

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
  overtimeExceptions = [],
}) => {
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(currentWeekStart, i);
      const dayOfWeek = date.getDay();
      return {
        date,
        dateStr: format(date, "yyyy-MM-dd"),
        dayName: format(date, "EEE").toUpperCase(),
        formattedDate: format(date, "MMM d"),
        isToday: isSameDay(date, new Date()),
        dayOfWeek
      };
    });
  }, [currentWeekStart]);

  const isOfficerOvertime = (officer: any): boolean => {
    if (!officer) return false;
    const isOvertime =
      officer.shiftInfo?.is_extra_shift === true ||
      officer.is_extra_shift === true;
    return isOvertime;
  };

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
        // Fetch schedule exceptions (including overtime with is_extra_shift = true)
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
        let { data: recurringSchedules, error: recurringError } = await supabase
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
        console.log('✅ Recurring fetched (pre-filter):', recurringSchedules?.length, 'records');

        // Get shift type to check if it's Dispatch
        const { data: shiftType, error: shiftTypeError } = await supabase
          .from("shift_types")
          .select("name")
          .eq("id", selectedShiftId)
          .single();

        const isDispatchShift = !shiftTypeError && shiftType?.name?.toLowerCase()?.includes('dispatch') || false;

        // Get the cycle start date for this shift (only if Dispatch)
        let cycleStartDate: Date | null = null;
        if (isDispatchShift) {
          const { data: cycleStartData, error: cycleStartError } = await supabase
            .from("recurring_schedules")
            .select("start_date")
            .eq("shift_type_id", selectedShiftId)
            .eq("week_offset", 0)
            .order("start_date", { ascending: true })
            .limit(1)
            .single();

          if (!cycleStartError && cycleStartData) {
            const [year, month, day] = cycleStartData.start_date.split('-').map(Number);
            cycleStartDate = new Date(year, month - 1, day);
            console.log(`📅 Cycle start date for ${shiftType.name}: ${cycleStartDate.toDateString()}`);
          }
        }

        // Dispatch week_offset filter — uses only the current week
        if (isDispatchShift && recurringSchedules && recurringSchedules.length > 0 && cycleStartDate) {
          const originalCount = recurringSchedules.length;

          recurringSchedules = recurringSchedules.filter((schedule: any) => {
            // Weekly view: only the current week matters
            const currentDate = currentWeekStart;
            const scheduleStartDate = new Date(schedule.start_date + 'T00:00:00');
            const scheduleEndDate = schedule.end_date ? new Date(schedule.end_date + 'T00:00:00') : null;

            if (currentDate < scheduleStartDate) return false;
            if (scheduleEndDate && currentDate > scheduleEndDate) return false;

            // Week offset calculation
            const diffTime = currentDate.getTime() - scheduleStartDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const weeksPassed = Math.max(0, Math.floor(diffDays / 7));
            const weekOffset = weeksPassed % 4;

            if (schedule.week_offset === null || schedule.week_offset === undefined) {
              return true; // every week
            }
            return schedule.week_offset === weekOffset;
          });

          console.log(`✅ Dispatch shift - Filtered recurring schedules: ${originalCount} → ${recurringSchedules.length}`);
        }

        // Fetch all recurring schedules for primary shift determination
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

        const minimumStaffing = new Map();
        minStaffingData?.forEach(staffing => {
          if (!minimumStaffing.has(staffing.day_of_week)) {
            minimumStaffing.set(staffing.day_of_week, new Map());
          }
          minimumStaffing.get(staffing.day_of_week).set(staffing.shift_type_id, {
            minimumOfficers: staffing.minimum_officers || 0,
            minimumSupervisors: staffing.minimum_supervisors || 0
          });
        });

        // Organize data
        const recurringSchedulesByOfficer = new Map();
        const exceptionsByOfficerAndDate = new Map();

        recurringSchedules?.forEach((recurring: any) => {
          if (!recurringSchedulesByOfficer.has(recurring.officer_id)) {
            recurringSchedulesByOfficer.set(recurring.officer_id, new Set());
          }
          recurringSchedulesByOfficer.get(recurring.officer_id).add(recurring.day_of_week);
        });

        exceptions?.forEach((exception: any) => {
          const key = `${exception.officer_id}-${exception.date}`;
          exceptionsByOfficerAndDate.set(key, exception);
        });

        console.log('🗺️ Processing weekly data...');

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

        const regularOfficersMap = new Map();
        const overtimeOfficersMap = new Map();

        weekDays.forEach(day => {
          const dayExceptions = exceptions?.filter(e => e.date === day.dateStr) || [];
          const dayRecurring = recurringSchedules?.filter(r => r.day_of_week === day.dayOfWeek) || [];

          const processedOfficers = new Set();

          // First, process exceptions
          dayExceptions.forEach(item => {
            const officerId = item.officer_id;
            processedOfficers.add(officerId);

            const profile = item.profiles || {};
            const hireDate = profile.hire_date;
            const promotionDateSergeant = profile.promotion_date_sergeant;
            const promotionDateLieutenant = profile.promotion_date_lieutenant;
            const overrideCredit = profile.service_credit_override || 0;
            const badgeNumber = profile.badge_number || '9999';
            const officerName = profile.full_name || "Unknown";
            const rank = profile.rank || "Officer";

            const isExtraShift = item.is_extra_shift === true;

            console.log('MOBILE OVERTIME CHECK for officer:', {
              officerName: profile.full_name,
              isExtraShift: item.is_extra_shift,
              exceptionId: item.id,
              date: day.dateStr,
              assignedToTargetMap: isExtraShift ? 'overtime' : 'regular'
            });

            const targetMap = isExtraShift ? overtimeOfficersMap : regularOfficersMap;

            if (!targetMap.has(officerId)) {
              const relevantPromotionDate = getRelevantPromotionDate(
                rank,
                promotionDateSergeant,
                promotionDateLieutenant
              );

              targetMap.set(officerId, {
                officerId: officerId,
                officerName: officerName,
                badgeNumber: badgeNumber,
                rank: rank,
                service_credit: 0,
                hire_date: hireDate,
                promotion_date_sergeant: promotionDateSergeant,
                promotion_date_lieutenant: promotionDateLieutenant,
                service_credit_override: overrideCredit,
                promotion_date: relevantPromotionDate || hireDate,
                recurringDays: recurringSchedulesByOfficer.get(officerId) || new Set(),
                weeklySchedule: {} as Record<string, any>,
                primaryShiftId: primaryShifts.get(officerId),
                isExtraShift: isExtraShift
              });
            }

            const hasPTO = item.is_off === true && !!item.reason;
            const daySchedule = {
              officerId: officerId,
              officerName: officerName,
              badgeNumber: badgeNumber,
              rank: rank,
              service_credit: 0,
              date: item.date || day.dateStr, // canonical shift date from DB
              dayOfWeek: day.dayOfWeek,
              isRegularRecurringDay: false,
              isExtraShift: isExtraShift,
              is_extra_shift: item.is_extra_shift || false,
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
                is_extra_shift: item.is_extra_shift || false,
                custom_start_time: item.custom_start_time,
                custom_end_time: item.custom_end_time,
                date: item.date || day.dateStr
              }
            };

            if (hasPTO) {
              console.log('🎯 PTO Found for', officerName, 'on', day.dateStr, ':', {
                ptoType: item.reason
              });
            }

            const officerData = targetMap.get(officerId);
            if (officerData) {
              officerData.weeklySchedule[day.dateStr] = daySchedule;
            } else {
              console.error(`❌ Officer data is undefined for ID: ${officerId}`);
              console.error(`❌ Item causing error:`, item);
            }
          });

          // Then, process recurring ONLY if no exception exists
          dayRecurring.forEach(item => {
            const officerId = item.officer_id;

            if (processedOfficers.has(officerId)) {
              return;
            }

            const profile = item.profiles || {};
            const hireDate = profile.hire_date;
            const promotionDateSergeant = profile.promotion_date_sergeant;
            const promotionDateLieutenant = profile.promotion_date_lieutenant;
            const overrideCredit = profile.service_credit_override || 0;
            const badgeNumber = profile.badge_number || '9999';
            const officerName = profile.full_name || "Unknown";
            const rank = profile.rank || "Officer";

            const isExtraShift = false;

            const targetMap = regularOfficersMap;

            if (!targetMap.has(officerId)) {
              const relevantPromotionDate = getRelevantPromotionDate(
                rank,
                promotionDateSergeant,
                promotionDateLieutenant
              );

              targetMap.set(officerId, {
                officerId: officerId,
                officerName: officerName,
                badgeNumber: badgeNumber,
                rank: rank,
                service_credit: 0,
                hire_date: hireDate,
                promotion_date_sergeant: promotionDateSergeant,
                promotion_date_lieutenant: promotionDateLieutenant,
                service_credit_override: overrideCredit,
                promotion_date: relevantPromotionDate || hireDate,
                recurringDays: recurringSchedulesByOfficer.get(officerId) || new Set(),
                weeklySchedule: {} as Record<string, any>,
                primaryShiftId: primaryShifts.get(officerId),
                isExtraShift: isExtraShift
              });
            }

            // Recurring schedules: the canonical shift date is the column date
            // (the shift starts on the day it's listed). Store it explicitly.
            const daySchedule = {
              officerId: officerId,
              officerName: officerName,
              badgeNumber: badgeNumber,
              rank: rank,
              service_credit: 0,
              date: day.dateStr,
              dayOfWeek: day.dayOfWeek,
              isRegularRecurringDay: true,
              isExtraShift: isExtraShift,
              is_extra_shift: false,
              shiftInfo: {
                scheduleId: item.id,
                scheduleType: "recurring",
                position: item.position_name,
                isOff: item.is_off || false,
                hasPTO: false,
                ptoData: undefined,
                reason: item.reason,
                isExtraShift: isExtraShift,
                is_extra_shift: false,
                date: day.dateStr
              }
            };

            const officerData = targetMap.get(officerId);
            if (officerData) {
              officerData.weeklySchedule[day.dateStr] = daySchedule;
            } else {
              console.error(`❌ Officer data is undefined for ID: ${officerId}`);
              console.error(`❌ Item causing error:`, item);
            }
          });
        });

        console.log('📊 Total unique officers found:', {
          regular: regularOfficersMap.size,
          overtime: overtimeOfficersMap.size,
          total: regularOfficersMap.size + overtimeOfficersMap.size
        });

        // Fetch service credits
        console.log('🔄 Fetching service credits via RPC...');
        const allOfficerIds = [
          ...Array.from(regularOfficersMap.keys()),
          ...Array.from(overtimeOfficersMap.keys())
        ];
        const uniqueOfficerIds = [...new Set(allOfficerIds)];
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
                serviceCreditsMap.set(officerId, 0);
              }
            } catch (error) {
              console.error(`Error fetching service credit for officer ${officerId}:`, error);
              serviceCreditsMap.set(officerId, 0);
            }
          }
        }

        regularOfficersMap.forEach(officer => {
          officer.service_credit = serviceCreditsMap.get(officer.officerId) || 0;
          Object.values(officer.weeklySchedule).forEach((daySchedule: any) => {
            daySchedule.service_credit = officer.service_credit;
          });
        });

        overtimeOfficersMap.forEach(officer => {
          officer.service_credit = serviceCreditsMap.get(officer.officerId) || 0;
          Object.values(officer.weeklySchedule).forEach((daySchedule: any) => {
            daySchedule.service_credit = officer.service_credit;
          });
        });

        const regularOfficersArray = Array.from(regularOfficersMap.values());
        const overtimeOfficersArray = Array.from(overtimeOfficersMap.values());

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

        console.log('🔄 Sorting officers consistently...');
        const sortedOfficers = sortOfficersConsistently(regularOfficersForSorting);

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

        // Group overtime officers by date - ONLY those with is_extra_shift = true
        const overtimeByDate: Record<string, any[]> = {};
        weekDays.forEach(day => {
          overtimeByDate[day.dateStr] = [];
        });

        overtimeOfficersArray.forEach(officer => {
          Object.entries(officer.weeklySchedule || {}).forEach(([dateStr, schedule]: [string, any]) => {
            if (schedule?.is_extra_shift === true && overtimeByDate[dateStr]) {
              overtimeByDate[dateStr].push(schedule);
            }
          });
        });

        console.log('✅ Data processing complete:', {
          supervisors: supervisors.length,
          regularOfficers: regularOfficers.length,
          ppos: ppos.length,
          overtimeOfficers: overtimeOfficersArray.length,
          overtimeDaysWithAssignments: Object.entries(overtimeByDate)
            .filter(([_, officers]) => officers.length > 0)
            .map(([date, officers]) => ({ date, count: officers.length }))
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
            officers: [
              ...Array.from(regularOfficersMap.values())
                .map(officer => officer.weeklySchedule[day.dateStr])
                .filter(Boolean),
              ...Array.from(overtimeOfficersMap.values())
                .map(officer => officer.weeklySchedule[day.dateStr])
                .filter(Boolean)
            ]
          }))
        };

      } catch (error) {
        console.error('❌ Error in mobile schedule query:', error);
        throw error;
      }
    },
    enabled: !!selectedShiftId,
    retry: 1,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
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

  const getMinimumStaffing = (dayOfWeek: number) => {
    if (!scheduleData?.minimumStaffing) {
      return { minimumOfficers: 0, minimumSupervisors: 0 };
    }

    if (scheduleData.minimumStaffing instanceof Map) {
      const dayStaffing = scheduleData.minimumStaffing.get(dayOfWeek);
      if (dayStaffing instanceof Map) {
        const shiftStaffing = dayStaffing.get(selectedShiftId);
        return shiftStaffing || { minimumOfficers: 0, minimumSupervisors: 0 };
      }
    }

    const dayStaffing = scheduleData.minimumStaffing[dayOfWeek];
    if (dayStaffing && typeof dayStaffing === 'object') {
      const shiftStaffing = dayStaffing[selectedShiftId];
      return shiftStaffing || { minimumOfficers: 0, minimumSupervisors: 0 };
    }

    return { minimumOfficers: 0, minimumSupervisors: 0 };
  };

  // FIXED: Get the officer's canonical shift date (used for PTO writes on night shifts)
  const getEffectivePTODate = (dayOfficer: any, columnDateStr: string): string => {
    return dayOfficer?.date ?? dayOfficer?.shiftInfo?.date ?? columnDateStr;
  };

  // FIXED: wrap PTO handlers so they always receive the canonical date
  const handleAssignPTOWithEffectiveDate = (
    schedule: any,
    columnDateStr: string,
    dayOfficer: any,
    officerId: string,
    officerName: string
  ) => {
    if (!onAssignPTO) return;
    const effectiveDate = getEffectivePTODate(dayOfficer, columnDateStr);
    onAssignPTO(schedule, effectiveDate, officerId, officerName);
  };

  const handleRemovePTOWithEffectiveDate = (
    schedule: any,
    columnDateStr: string,
    dayOfficer: any,
    officerId: string
  ) => {
    if (!onRemovePTO) return;
    const effectiveDate = getEffectivePTODate(dayOfficer, columnDateStr);
    onRemovePTO(schedule, effectiveDate, officerId);
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
            {weekDays.map(({ dateStr, dayName, formattedDate, isToday, dayOfWeek }) => {
              const minStaffing = getMinimumStaffing(dayOfWeek);
              const minimumSupervisors = minStaffing.minimumSupervisors || 0;
              const minimumOfficers = minStaffing.minimumOfficers || 0;

              const daySchedule = scheduleData.dailySchedules?.find(s => s.date === dateStr);

              const overtimeForDay = scheduleData.overtimeByDate?.[dateStr] || [];
              const overtimeSupervisorCount = overtimeForDay.filter((officer: any) => {
                const position = officer.shiftInfo?.position || "";
                return isSupervisorPosition(position);
              }).length || 0;

              const regularSupervisorCount = daySchedule?.officers?.filter((officer: any) => {
                const isSupervisor = isSupervisorByRank(officer);
                const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
                const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
                const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
                const isOvertime = officer.shiftInfo?.is_extra_shift === true || officer.is_extra_shift === true;
                return isSupervisor && isScheduled && !isOvertime;
              }).length || 0;

              const supervisorCount = regularSupervisorCount + overtimeSupervisorCount;

              const overtimeOfficerCount = overtimeForDay.filter((officer: any) => {
                const position = officer.shiftInfo?.position || "";
                return !isSupervisorPosition(position) && !isSpecialAssignment(position);
              }).length || 0;

              const regularOfficerCount = daySchedule?.officers?.filter((officer: any) => {
                const isOfficer = !isSupervisorByRank(officer);
                const isNotPPO = officer.rank?.toLowerCase() !== 'probationary';
                const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
                const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
                const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
                const isOvertime = officer.shiftInfo?.is_extra_shift === true || officer.is_extra_shift === true;
                return isOfficer && isNotPPO && isScheduled && !isOvertime;
              }).length || 0;

              const officerCount = regularOfficerCount + overtimeOfficerCount;

              const isSupervisorsUnderstaffed = minimumSupervisors > 0 && supervisorCount < minimumSupervisors;
              const isOfficersUnderstaffed = minimumOfficers > 0 && officerCount < minimumOfficers;
              const hasRequirements = hasMinimumRequirements(minimumSupervisors, minimumOfficers);

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
                        {supervisorCount} / {minimumSupervisors} Sup
                      </Badge>
                      <Badge
                        variant={isOfficersUnderstaffed ? "destructive" : "outline"}
                        className="text-xs"
                      >
                        {officerCount} / {minimumOfficers} Ofc
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
            {weekDays.map(({ dateStr, dayOfWeek }) => {
              const daySchedule = scheduleData.dailySchedules?.find(s => s.date === dateStr);
              const minStaffing = getMinimumStaffing(dayOfWeek);
              const minimumSupervisors = minStaffing.minimumSupervisors || 0;

              const overtimeForDay = scheduleData.overtimeByDate?.[dateStr] || [];
              const overtimeSupervisorCount = overtimeForDay.filter((officer: any) => {
                const position = officer.shiftInfo?.position || "";
                return isSupervisorPosition(position);
              }).length || 0;

              const regularSupervisorCount = daySchedule?.officers?.filter((officer: any) => {
                const isSupervisor = isSupervisorByRank(officer);
                const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
                const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
                const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
                const isOvertime = officer.shiftInfo?.is_extra_shift === true || officer.is_extra_shift === true;
                return isSupervisor && isScheduled && !isOvertime;
              }).length || 0;

              const supervisorCount = regularSupervisorCount + overtimeSupervisorCount;
              const isSupervisorsUnderstaffed = minimumSupervisors > 0 && supervisorCount < minimumSupervisors;

              return (
                <div key={dateStr} className="p-2 text-center border-r text-sm bg-gray-100">
                  <div className={`font-medium ${isSupervisorsUnderstaffed ? 'text-red-600' : ''}`}>
                    {supervisorCount} {minimumSupervisors > 0 ? `/ ${minimumSupervisors}` : ''}
                  </div>
                  {minimumSupervisors === 0 && (
                    <div className="text-xs text-muted-foreground">No min</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Supervisors */}
          {scheduleData.supervisors.map((officer: any) => {
            const hasOvertimeInSchedule = weekDays.some(({ dateStr }) => {
              const dayOfficer = officer.weeklySchedule[dateStr];
              return dayOfficer?.is_extra_shift === true || dayOfficer?.shiftInfo?.is_extra_shift === true;
            });

            if (hasOvertimeInSchedule) {
              console.log('Skipping supervisor officer with overtime shifts from regular rows:', officer.officerName);
              return null;
            }

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
                  const dayOfficer = officer.weeklySchedule[dateStr];
                  const effectiveDate = getEffectivePTODate(dayOfficer, dateStr);
                  return (
                    <div key={dateStr} className="p-2 border-r">
                      <ScheduleCellMobile
                        officer={dayOfficer}
                        dateStr={effectiveDate}
                        officerId={officer.officerId}
                        officerName={officer.officerName}
                        isAdminOrSupervisor={isAdminOrSupervisor}
                        isSupervisor={true}
                        isRegularRecurringDay={dayOfficer?.isRegularRecurringDay || false}
                        isSpecialAssignment={isSpecialAssignment}
                        onAssignPTO={onAssignPTO ? ((schedule, _date, officerId, officerName) =>
                          handleAssignPTOWithEffectiveDate(schedule, dateStr, dayOfficer, officerId, officerName)
                        ) : undefined}
                        onRemovePTO={onRemovePTO ? ((schedule, _date, officerId) =>
                          handleRemovePTOWithEffectiveDate(schedule, dateStr, dayOfficer, officerId)
                        ) : undefined}
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
            {weekDays.map(({ dateStr, dayOfWeek }) => {
              const daySchedule = scheduleData.dailySchedules?.find(s => s.date === dateStr);
              const minStaffing = getMinimumStaffing(dayOfWeek);
              const minimumOfficers = minStaffing.minimumOfficers || 0;

              const overtimeForDay = scheduleData.overtimeByDate?.[dateStr] || [];
              const overtimeOfficerCount = overtimeForDay.filter((officer: any) => {
                const position = officer.shiftInfo?.position || "";
                return !isSupervisorPosition(position) && !isSpecialAssignment(position);
              }).length || 0;

              const regularOfficerCount = daySchedule?.officers?.filter((officer: any) => {
                const isOfficer = !isSupervisorByRank(officer);
                const isNotPPO = officer.rank?.toLowerCase() !== 'probationary';
                const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
                const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
                const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
                const isOvertime = officer.shiftInfo?.is_extra_shift === true || officer.is_extra_shift === true;
                return isOfficer && isNotPPO && isScheduled && !isOvertime;
              }).length || 0;

              const officerCount = regularOfficerCount + overtimeOfficerCount;
              const isOfficersUnderstaffed = minimumOfficers > 0 && officerCount < minimumOfficers;

              return (
                <div key={dateStr} className="p-2 text-center border-r text-sm font-medium bg-gray-200">
                  <div className={`font-medium ${isOfficersUnderstaffed ? 'text-red-600' : ''}`}>
                    {officerCount} {minimumOfficers > 0 ? `/ ${minimumOfficers}` : ''}
                  </div>
                  {minimumOfficers === 0 && (
                    <div className="text-xs text-muted-foreground">No min</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Regular Officers */}
          {scheduleData.regularOfficers.map((officer: any) => {
            const hasOvertimeInSchedule = weekDays.some(({ dateStr }) => {
              const dayOfficer = officer.weeklySchedule[dateStr];
              return dayOfficer?.is_extra_shift === true || dayOfficer?.shiftInfo?.is_extra_shift === true;
            });

            if (hasOvertimeInSchedule) {
              console.log('Skipping officer with overtime shifts from regular rows:', officer.officerName);
              return null;
            }

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
                  const dayOfficer = officer.weeklySchedule[dateStr];
                  const effectiveDate = getEffectivePTODate(dayOfficer, dateStr);
                  return (
                    <div key={dateStr} className="p-2 border-r">
                      <ScheduleCellMobile
                        officer={dayOfficer}
                        dateStr={effectiveDate}
                        officerId={officer.officerId}
                        officerName={officer.officerName}
                        isAdminOrSupervisor={isAdminOrSupervisor}
                        isRegularRecurringDay={dayOfficer?.isRegularRecurringDay || false}
                        isSpecialAssignment={isSpecialAssignment}
                        onAssignPTO={onAssignPTO ? ((schedule, _date, officerId, officerName) =>
                          handleAssignPTOWithEffectiveDate(schedule, dateStr, dayOfficer, officerId, officerName)
                        ) : undefined}
                        onRemovePTO={onRemovePTO ? ((schedule, _date, officerId) =>
                          handleRemovePTOWithEffectiveDate(schedule, dateStr, dayOfficer, officerId)
                        ) : undefined}
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
          {scheduleData.ppos.length > 0 && (
            <>
              <div className="grid grid-cols-9 border-t-2 border-blue-200 bg-blue-50">
                <div className="p-2 border-r text-sm"></div>
                <div className="p-2 border-r text-sm font-medium">PPO</div>
                {weekDays.map(({ dateStr, dayOfWeek }) => {
                  const daySchedule = scheduleData.dailySchedules?.find(s => s.date === dateStr);
                  const ppoCount = daySchedule?.officers?.filter((officer: any) => {
                    const isOfficer = !isSupervisorByRank(officer);
                    const isPPO = officer.rank?.toLowerCase() === 'probationary';
                    const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
                    const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO;
                    const isOvertime = officer.shiftInfo?.is_extra_shift === true || officer.is_extra_shift === true;
                    return isOfficer && isPPO && isScheduled && !isOvertime;
                  }).length || 0;

                  return (
                    <div key={dateStr} className="p-2 text-center border-r text-sm font-medium bg-blue-50">
                      {ppoCount}
                    </div>
                  );
                })}
              </div>

              {scheduleData.ppos.map((officer: any) => {
                const hasOvertimeInSchedule = weekDays.some(({ dateStr }) => {
                  const dayOfficer = officer.weeklySchedule[dateStr];
                  return dayOfficer?.is_extra_shift === true || dayOfficer?.shiftInfo?.is_extra_shift === true;
                });

                if (hasOvertimeInSchedule) {
                  console.log('Skipping PPO officer with overtime shifts from regular rows:', officer.officerName);
                  return null;
                }

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
                      const dayOfficer = officer.weeklySchedule[dateStr];
                      const effectiveDate = getEffectivePTODate(dayOfficer, dateStr);
                      return (
                        <div key={dateStr} className="p-2 border-r">
                          <ScheduleCellMobile
                            officer={dayOfficer}
                            dateStr={effectiveDate}
                            officerId={officer.officerId}
                            officerName={officer.officerName}
                            isAdminOrSupervisor={isAdminOrSupervisor}
                            isPPO={true}
                            isRegularRecurringDay={dayOfficer?.isRegularRecurringDay || false}
                            isSpecialAssignment={isSpecialAssignment}
                            onAssignPTO={onAssignPTO ? ((schedule, _date, officerId, officerName) =>
                              handleAssignPTOWithEffectiveDate(schedule, dateStr, dayOfficer, officerId, officerName)
                            ) : undefined}
                            onRemovePTO={onRemovePTO ? ((schedule, _date, officerId) =>
                              handleRemovePTOWithEffectiveDate(schedule, dateStr, dayOfficer, officerId)
                            ) : undefined}
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

          {/* Overtime Section */}
          {hasOvertime && (
            <>
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

              <div className="grid grid-cols-9 border-b hover:bg-orange-50/50 bg-orange-50/30">
                <div className="p-2 border-r text-sm font-mono">OT</div>
                <div className="p-2 border-r font-medium text-sm flex items-center gap-2">
                  Overtime Assignments
                </div>
                {weekDays.map(({ dateStr }) => {
                  const overtimeOfficers = scheduleData.overtimeByDate?.[dateStr] || [];

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