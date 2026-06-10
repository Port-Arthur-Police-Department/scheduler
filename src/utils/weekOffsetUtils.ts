// src/utils/weekOffsetUtils.ts

/**
 * Get the cycle start date for 4-week rotation schedules
 * Adjust this date to match your department's 4-week cycle start
 */
export const getCycleStartDate = (): Date => {
  // IMPORTANT: Change this to your actual cycle start date
  // Example: If your 4-week cycle started on January 1, 2025:
  return new Date(2025, 0, 1); // Jan 1, 2025
};

/**
 * Calculate which week of the 4-week cycle a given date falls into
 * @param date - The date to check
 * @returns 0, 1, 2, or 3 representing weeks 1-4 of the cycle
 */
export const getWeekOffsetForDate = (date: Date): number => {
  const cycleStartDate = getCycleStartDate();
  
  // Calculate days since cycle start
  const diffTime = date.getTime() - cycleStartDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 0;
  
  const weeksPassed = Math.floor(diffDays / 7);
  const weekOffset = weeksPassed % 4;
  
  return weekOffset;
};

/**
 * Check if a shift should be included for a given date based on its week_offset
 */
export const shouldIncludeScheduleForDate = (
  weekOffset: number | null | undefined,
  date: Date,
  isDispatchShift: boolean
): boolean => {
  if (!isDispatchShift) return true;
  if (weekOffset === null || weekOffset === undefined) return true;
  
  const currentWeekOffset = getWeekOffsetForDate(date);
  return weekOffset === currentWeekOffset;
};

/**
 * Filter recurring schedules based on week offset for a given date range
 */
export const filterRecurringSchedulesByWeekOffset = (
  recurringSchedules: any[],
  startDate: Date,
  endDate: Date,
  isDispatchShift: boolean
): any[] => {
  if (!isDispatchShift) return recurringSchedules;
  if (!recurringSchedules || recurringSchedules.length === 0) return [];
  
  // Generate all dates in the range
  const datesInRange: Date[] = [];
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    datesInRange.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  const filteredSchedules: any[] = [];
  
  for (const schedule of recurringSchedules) {
    // NULL week_offset means every week - always include
    if (schedule.week_offset === null || schedule.week_offset === undefined) {
      filteredSchedules.push(schedule);
      continue;
    }
    
    // Check if this schedule should be included for any date in the range
    let shouldInclude = false;
    for (const date of datesInRange) {
      if (schedule.day_of_week === date.getDay()) {
        const currentWeekOffset = getWeekOffsetForDate(date);
        if (schedule.week_offset === currentWeekOffset) {
          shouldInclude = true;
          break;
        }
      }
    }
    
    if (shouldInclude) {
      filteredSchedules.push(schedule);
    }
  }
  
  return filteredSchedules;
};
