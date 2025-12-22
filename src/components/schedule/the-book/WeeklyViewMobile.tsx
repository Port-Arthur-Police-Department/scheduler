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

// Helper function to calculate service credit with promotion date support
const calculateServiceCredit = (hireDate: string | null, 
                               override: number = 0,
                               promotionDateSergeant: string | null = null,
                               promotionDateLieutenant: string | null = null,
                               currentRank: string | null = null) => {
  // If there's an override, use it
  if (override && override > 0) {
    return override;
  }
  
  // Determine which date to use based on rank and promotion dates
  let relevantDate: Date | null = null;
  
  if (currentRank) {
    const rankLower = currentRank.toLowerCase();
    
    // Check if officer is a supervisor rank
    if ((rankLower.includes('sergeant') || rankLower.includes('sgt')) && promotionDateSergeant) {
      relevantDate = new Date(promotionDateSergeant);
    } else if ((rankLower.includes('lieutenant') || rankLower.includes('lt')) && promotionDateLieutenant) {
      relevantDate = new Date(promotionDateLieutenant);
    } else if (rankLower.includes('chief') && promotionDateLieutenant) {
      // Chiefs usually come from Lieutenant rank
      relevantDate = new Date(promotionDateLieutenant);
    }
  }
  
  // If no relevant promotion date found, use hire date
  if (!relevantDate && hireDate) {
    relevantDate = new Date(hireDate);
  }
  
  if (!relevantDate) return 0;
  
  try {
    const now = new Date();
    const years = now.getFullYear() - relevantDate.getFullYear();
    const months = now.getMonth() - relevantDate.getMonth();
    const days = now.getDate() - relevantDate.getDate();
    
    // Calculate decimal years
    const totalYears = years + (months / 12) + (days / 365);
    
    // Round to 1 decimal place
    return Math.max(0, Math.round(totalYears * 10) / 10);
  } catch (error) {
    console.error('Error calculating service credit:', error);
    return 0;
  }
};

// Helper to get the relevant promotion date for sorting
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

  // Add debug state
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
  // Fetch schedule data
  const { data: scheduleData, isLoading, error } = useQuery({
    queryKey: ['weekly-schedule-mobile', selectedShiftId, currentWeekStart.toISOString()],
    queryFn: async () => {
      console.log('Mobile query started for shift:', selectedShiftId, 'week:', currentWeekStart);
      
      if (!selectedShiftId) {
        console.log('No shift ID selected');
        return null;
      }

      const startStr = format(currentWeekStart, "yyyy-MM-dd");
      const endStr = format(endOfWeek(currentWeekStart, { weekStartsOn: 0 }), "yyyy-MM-dd");

      console.log('Fetching data for date range:', startStr, 'to', endStr);

      try {
        // Fetch schedule exceptions
        console.log('Fetching exceptions...');
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

        if (exceptionsError) {
          console.error('Exceptions error:', exceptionsError);
          throw exceptionsError;
        }
        console.log('Exceptions fetched:', exceptions?.length);

        // Fetch recurring schedules
        console.log('Fetching recurring schedules...');
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

        if (recurringError) {
          console.error('Recurring error:', recurringError);
          throw recurringError;
        }
        console.log('Recurring fetched:', recurringSchedules?.length);

        // Fetch minimum staffing
        console.log('Fetching minimum staffing...');
        const { data: minStaffingData, error: minStaffingError } = await supabase
          .from("minimum_staffing")
          .select("*")
          .eq("shift_type_id", selectedShiftId);

        if (minStaffingError) {
          console.error("Error fetching minimum staffing:", minStaffingError);
          // Don't throw - minimum staffing is optional
        }
        console.log('Minimum staffing fetched:', minStaffingData?.length);

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

        console.log('Minimum staffing map created');

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

        console.log('Recurring patterns extracted for', recurringSchedulesByOfficer.size, 'officers');

        // Process weekly data
        weekDays.forEach(day => {
          // Find exceptions for this day
          const dayExceptions = exceptions?.filter(e => e.date === day.dateStr) || [];
          
          // Find recurring for this day of week
          const dayRecurring = recurringSchedules?.filter(r => r.day_of_week === day.dayOfWeek) || [];
          
          // Combine all officers for this day
          const allDayOfficers = [...dayExceptions, ...dayRecurring];
          
          console.log(`Day ${day.dateStr}: ${allDayOfficers.length} officer assignments`);
          
          allDayOfficers.forEach(item => {
            const officerId = item.officer_id;
            const hireDate = item.profiles?.hire_date;
            const promotionDateSergeant = item.profiles?.promotion_date_sergeant;
            const promotionDateLieutenant = item.profiles?.promotion_date_lieutenant;
            const overrideCredit = item.profiles?.service_credit_override || 0;
            const badgeNumber = item.profiles?.badge_number || '9999';
            
            // Calculate service credit WITH promotion dates
            const serviceCredit = calculateServiceCredit(
              hireDate, 
              overrideCredit,
              promotionDateSergeant,
              promotionDateLieutenant,
              item.profiles?.rank
            );
            
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
                service_credit: serviceCredit,
                hire_date: hireDate,
                promotion_date_sergeant: promotionDateSergeant,
                promotion_date_lieutenant: promotionDateLieutenant,
                // For sorting, use the relevant promotion date or hire date
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
              service_credit: serviceCredit,
              date: day.dateStr,
              dayOfWeek: day.dayOfWeek,
              isRegularRecurringDay: recurringSchedulesByOfficer.get(officerId)?.has(day.dayOfWeek) || false,
              shiftInfo: {
                scheduleId: item.id,
                scheduleType: item.date ? "exception" : "recurring",
                position: item.position_name,
                isOff: item.is_off || false,
                hasPTO: !!item.pto_type,
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

        console.log('Total unique officers found:', allOfficers.size);

        // Categorize officers with promotion date sorting for supervisors
        const supervisors = Array.from(allOfficers.values())
          .filter(o => isSupervisorByRank(o))
          .sort((a, b) => {
            // First, sort by rank priority (Lieutenant before Sergeant)
            const aPriority = getRankPriority(a.rank);
            const bPriority = getRankPriority(b.rank);
            
            // If different ranks, sort by rank priority
            if (aPriority !== bPriority) {
              return aPriority - bPriority; // Lower number = higher rank
            }
            
            // If same rank, sort by promotion date (most recent first)
            // Parse dates safely
            const parseDate = (dateStr: string | null) => {
              if (!dateStr) return new Date(0); // Very old date for sorting
              try {
                return new Date(dateStr);
              } catch {
                return new Date(0);
              }
            };
            
            const aPromotion = parseDate(a.promotion_date);
            const bPromotion = parseDate(b.promotion_date);
            
            // Most recent promotion first (descending)
            if (bPromotion.getTime() !== aPromotion.getTime()) {
              return bPromotion.getTime() - aPromotion.getTime();
            }
            
            // Same promotion date, sort by service credit (from promotion date)
            const aCredit = a.service_credit || 0;
            const bCredit = b.service_credit || 0;
            if (bCredit !== aCredit) {
              return bCredit - aCredit; // Descending: highest service credit first
            }
            
            // Same service credit, sort by last name
            return getLastName(a.officerName).localeCompare(getLastName(b.officerName));
          });

        console.log('Supervisors found:', supervisors.length);

        const allOfficersList = Array.from(allOfficers.values())
          .filter(o => !isSupervisorByRank(o));

        const ppos = allOfficersList
          .filter(o => o.rank?.toLowerCase() === 'probationary')
          .sort((a, b) => {
            // Sort PPOs by service credit DESCENDING (highest first), then by badge number
            const aCredit = a.service_credit || 0;
            const bCredit = b.service_credit || 0;
            if (bCredit !== aCredit) {
              return bCredit - aCredit; // Descending: b - a
            }
            // If same service credit, sort by badge number (ascending)
            const aBadge = parseInt(a.badgeNumber) || 9999;
            const bBadge = parseInt(b.badgeNumber) || 9999;
            return aBadge - bBadge;
          });

        console.log('PPOs found:', ppos.length);

        const regularOfficers = allOfficersList
          .filter(o => o.rank?.toLowerCase() !== 'probationary')
          .sort((a, b) => {
            // Sort regular officers by service credit DESCENDING (highest first), then by badge number
            const aCredit = a.service_credit || 0;
            const bCredit = b.service_credit || 0;
            if (bCredit !== aCredit) {
              return bCredit - aCredit; // Descending: b - a
            }
            // If same service credit, sort by badge number (ascending)
            const aBadge = parseInt(a.badgeNumber) || 9999;
            const bBadge = parseInt(b.badgeNumber) || 9999;
            return aBadge - bBadge;
          });

        console.log('Regular officers found:', regularOfficers.length);

        // Set debug info for inspection
        setDebugInfo({
          allOfficersCount: allOfficers.size,
          supervisorsCount: supervisors.length,
          regularOfficersCount: regularOfficers.length,
          pposCount: ppos.length,
          exceptionsCount: exceptions?.length,
          recurringCount: recurringSchedules?.length,
          sampleSupervisors: supervisors.slice(0, 3).map((s: any) => ({
            name: s.officerName,
            rank: s.rank,
            serviceCredit: s.service_credit,
            promotionDate: s.promotion_date
          }))
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
        console.error('Error in mobile schedule query:', error);
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

  // Add error handling
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
    // Add debug info display
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-muted-foreground">
          <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No schedule data available</p>
          {debugInfo && (
            <div className="mt-4 p-4 border rounded-lg bg-muted/50 text-left">
              <h4 className="font-semibold mb-2">Debug Information:</h4>
              <pre className="text-xs overflow-auto">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          )}
        </div>
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
                {/* Show relevant promotion date if available */}
                {officer.promotion_date && officer.promotion_date !== officer.hire_date && (
                  <div className="text-xs text-muted-foreground">
                    Promo: {format(new Date(officer.promotion_date), 'MM/dd/yyyy')}
                  </div>
                )}
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
                    isSpecialAssignment={isSpecialAssignment}
                  />
                </div>
              ))}
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
              {weekDays.map(({ dateStr }) => (
                <div key={dateStr} className="p-2 border-r">
                  <ScheduleCellMobile
                    officer={officer.weeklySchedule[dateStr]}
                    dateStr={dateStr}
                    officerId={officer.officerId}
                    officerName={officer.officerName}
                    isAdminOrSupervisor={isAdminOrSupervisor}
                    isRegularRecurringDay={officer.weeklySchedule[dateStr]?.isRegularRecurringDay || false}
                    isSpecialAssignment={isSpecialAssignment}
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
                    <div className="text-xs text-muted-foreground">
                      SC: {officer.service_credit?.toFixed(1) || '0.0'}
                    </div>
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
                        isSpecialAssignment={isSpecialAssignment}
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
              <div className="w-3 h-3 rounded bg-green-50 border-l-2 border-green-400"></div>
              <span>Recurring Day</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-white border"></div>
              <span>Ad-hoc Assignment</span>
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <div className="w-3 h-3 rounded bg-purple-50 border-l-2 border-purple-400"></div>
              <span>Special Assignment</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
            <p className="font-medium mb-1">Supervisor Sorting:</p>
            <p>1. Rank (Lieutenant → Sergeant)</p>
            <p>2. Promotion Date (Most Recent First)</p>
            <p>3. Service Credit in Current Rank</p>
            <p>4. Last Name</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
