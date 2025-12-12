// src/components/admin/settings/alertHelpers.ts

/**
 * Helper function to parse time string to minutes since midnight
 */
export const parseTimeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0];
  const minutes = parts[1] || 0;
  
  return hours * 60 + minutes;
};

/**
 * Helper to format time for display (24h to 12h)
 */
export const formatTimeForDisplay = (timeStr: string): string => {
  const minutes = parseTimeToMinutes(timeStr);
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  
  return `${hours12}:${mins.toString().padStart(2, '0')} ${period}`;
};

/**
 * Main function to check if officer is on shift NOW
 */
export const isOfficerCurrentlyOnShift = (shiftType: any): boolean => {
  if (!shiftType) return false;
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const startMinutes = parseTimeToMinutes(shiftType.start_time);
  const endMinutes = parseTimeToMinutes(shiftType.end_time);
  const crossesMidnight = shiftType.crosses_midnight || endMinutes < startMinutes;
  
  if (crossesMidnight) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  } else {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
};

/**
 * Get which shifts are currently active based on time
 */
export const getCurrentlyActiveShifts = (shiftTypes: any[]): string[] => {
  const activeShifts: string[] = [];
  
  shiftTypes?.forEach(shift => {
    if (isOfficerCurrentlyOnShift(shift)) {
      activeShifts.push(shift.name);
    }
  });
  
  return activeShifts;
};

/**
 * Check if a date is within schedule period
 */
export const isDateWithinSchedulePeriod = (
  startDate: string, 
  endDate: string | null, 
  checkDate: string
): boolean => {
  const check = new Date(checkDate);
  const start = new Date(startDate);
  
  if (check < start) return false;
  
  if (endDate) {
    const end = new Date(endDate);
    return check <= end;
  }
  
  return true; // No end date means indefinite
};
