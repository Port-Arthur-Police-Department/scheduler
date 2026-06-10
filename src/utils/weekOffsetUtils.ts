// src/utils/weekOffsetUtils.ts

/**
 * Get the cycle start date for 4-week rotation schedules
 * This should be stored in website_settings for consistency
 */
export const getCycleStartDate = (): Date => {
  // You can modify this to fetch from settings or use a fixed date
  // For now, use a fixed date - adjust to your department's cycle start
  // Example: If your 4-week cycle started on Jan 1, 2025:
  return new Date(2025, 0, 1); // Jan 1, 2025 - CHANGE THIS AS NEEDED
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
 * @param weekOffset - The schedule's week_offset (0,1,2,3, or null for every week)
 * @param date - The date to check
 * @param isDispatchShift - Whether this is a Dispatch shift (4-week cycle)
 * @returns true if the schedule should be included for this date
 */
export const shouldIncludeScheduleForDate = (
  weekOffset: number | null | undefined,
  date: Date,
  isDispatchShift: boolean
): boolean => {
  // If not a Dispatch shift, always include (standard weekly schedule)
  if (!isDispatchShift) return true;
  
  // NULL week_offset means every week - always include
  if (weekOffset === null || weekOffset === undefined) return true;
  
  // For Dispatch shifts, only include if the week_offset matches the current week
  const currentWeekOffset = getWeekOffsetForDate(date);
  return weekOffset === currentWeekOffset;
};

/**
 * Filter recurring schedules based on week offset for a given date range
 * @param recurringSchedules - Array of recurring schedules
 * @param startDate - Start of the date range
 * @param endDate - End of the date range
 * @param isDispatchShift - Whether this is a Dispatch shift
 * @returns Filtered recurring schedules
 */
export const filterRecurringSchedulesByWeekOffset = (
  recurringSchedules: any[],
  startDate: Date,
  endDate: Date,
  isDispatchShift: boolean
): any[] => {
  if (!isDispatchShift) return recurringSchedules;
  if (!recurringSchedules || recurringSchedules.length === 0) return [];
  
  // For Dispatch shifts, we need to include schedules that match the week_offset
  // for ANY day in the date range
  const filteredSchedules: any[] = [];
  
  // Generate all dates in the range
  const datesInRange: Date[] = [];
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    datesInRange.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
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
