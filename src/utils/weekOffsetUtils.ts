// src/utils/weekOffsetUtils.ts

import { supabase } from "@/integrations/supabase/client";

// Cache for cycle start dates by shift type
const cycleStartDateCache = new Map<string, Date>();

/**
 * Get the cycle start date for a specific shift type based on its recurring schedules
 * It finds the earliest week_offset: 0 schedule and uses its start_date as the cycle start
 * 
 * @param shiftTypeId - The ID of the shift type (e.g., Dispatch A, Dispatch B)
 * @returns The cycle start date, or null if not found
 */
export const getCycleStartDateForShift = async (shiftTypeId: string): Promise<Date | null> => {
  // Check cache first
  if (cycleStartDateCache.has(shiftTypeId)) {
    return cycleStartDateCache.get(shiftTypeId)!;
  }

  try {
    // Find the earliest recurring schedule with week_offset = 0 for this shift
    const { data, error } = await supabase
      .from("recurring_schedules")
      .select("start_date, week_offset")
      .eq("shift_type_id", shiftTypeId)
      .eq("week_offset", 0)
      .order("start_date", { ascending: true })
      .limit(1);

    if (error) {
      console.error("Error fetching cycle start date:", error);
      return null;
    }

    if (!data || data.length === 0) {
      console.warn(`No week_offset: 0 schedule found for shift ${shiftTypeId}`);
      return null;
    }

    // Parse the date without timezone issues
    const startDateStr = data[0].start_date;
    const [year, month, day] = startDateStr.split('-').map(Number);
    const cycleStartDate = new Date(year, month - 1, day);
    
    // Cache the result
    cycleStartDateCache.set(shiftTypeId, cycleStartDate);
    
    console.log(`📅 Cycle start date for shift ${shiftTypeId}: ${cycleStartDate.toDateString()}`);
    return cycleStartDate;
    
  } catch (error) {
    console.error("Error getting cycle start date:", error);
    return null;
  }
};

/**
 * Clear the cache for a specific shift (useful when schedules are updated)
 */
export const clearCycleStartDateCache = (shiftTypeId?: string) => {
  if (shiftTypeId) {
    cycleStartDateCache.delete(shiftTypeId);
  } else {
    cycleStartDateCache.clear();
  }
};

/**
 * Calculate which week of the 4-week cycle a given date falls into
 * @param date - The date to check
 * @param shiftTypeId - The shift type ID (to get the correct cycle start date)
 * @returns 0, 1, 2, or 3 representing weeks 1-4 of the cycle, or -1 if cycle start not found
 */
export const getWeekOffsetForDate = async (date: Date, shiftTypeId: string): Promise<number> => {
  const cycleStartDate = await getCycleStartDateForShift(shiftTypeId);
  
  if (!cycleStartDate) {
    console.warn(`No cycle start date found for shift ${shiftTypeId}, defaulting to 0`);
    return 0;
  }
  
  // Calculate days since cycle start
  const diffTime = date.getTime() - cycleStartDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // If date is before cycle start, treat as week 0
  if (diffDays < 0) return 0;
  
  const weeksPassed = Math.floor(diffDays / 7);
  const weekOffset = weeksPassed % 4;
  
  return weekOffset;
};

/**
 * Synchronous version for when you already have the cycle start date
 */
export const getWeekOffsetForDateSync = (date: Date, cycleStartDate: Date): number => {
  const diffTime = date.getTime() - cycleStartDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 0;
  
  const weeksPassed = Math.floor(diffDays / 7);
  const weekOffset = weeksPassed % 4;
  
  return weekOffset;
};

/**
 * Check if a schedule should be included for a given date based on its week_offset
 * @param weekOffset - The schedule's week_offset (0,1,2,3, or null for every week)
 * @param date - The date to check
 * @param cycleStartDate - The cycle start date for this shift
 * @returns true if the schedule should be included for this date
 */
export const shouldIncludeScheduleForDateSync = (
  weekOffset: number | null | undefined,
  date: Date,
  cycleStartDate: Date | null
): boolean => {
  // If no cycle start date, include all schedules (fallback)
  if (!cycleStartDate) return true;
  
  // NULL week_offset means every week - always include
  if (weekOffset === null || weekOffset === undefined) return true;
  
  // Only include if the week_offset matches the current week
  const currentWeekOffset = getWeekOffsetForDateSync(date, cycleStartDate);
  return weekOffset === currentWeekOffset;
};

/**
 * Filter recurring schedules based on week offset for a given date range
 * @param recurringSchedules - Array of recurring schedules
 * @param startDate - Start of the date range
 * @param endDate - End of the date range
 * @param cycleStartDate - The cycle start date for this shift
 * @returns Filtered recurring schedules that apply to the date range
 */
export const filterRecurringSchedulesByWeekOffsetSync = (
  recurringSchedules: any[],
  startDate: Date,
  endDate: Date,
  cycleStartDate: Date | null
): any[] => {
  // If no cycle start date, return all schedules unchanged
  if (!cycleStartDate) return recurringSchedules;
  
  // If no schedules, return empty array
  if (!recurringSchedules || recurringSchedules.length === 0) return [];
  
  // Generate all dates in the range
  const datesInRange: Date[] = [];
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    datesInRange.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()));
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
        const currentWeekOffset = getWeekOffsetForDateSync(date, cycleStartDate);
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

/**
 * Get the week offset label
 */
export const getWeekOffsetLabel = (weekOffset: number | null | undefined): string => {
  if (weekOffset === null || weekOffset === undefined) return "Every Week";
  return `Week ${weekOffset + 1}`;
};

/**
 * Get the current week offset for a shift
 */
export const getCurrentWeekOffsetForShift = async (shiftTypeId: string): Promise<number> => {
  return await getWeekOffsetForDate(new Date(), shiftTypeId);
};
