// src/utils/weekUtils.ts

/**
 * Get the start of the week (Sunday) for a given date
 */
export const getStartOfWeek = (date: Date = new Date(), weekStartsOn: number = 0): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Get the end of the week for a given date
 */
export const getEndOfWeek = (date: Date = new Date(), weekStartsOn: number = 0): Date => {
  const start = getStartOfWeek(date, weekStartsOn);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

/**
 * Format a week range string (e.g. "Oct 12 - Oct 18, 2026")
 */
export const formatWeekRange = (date: Date = new Date()): string => {
  const start = getStartOfWeek(date);
  const end = getEndOfWeek(date);

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const startDay = start.getDate();
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const endDay = end.getDate();
  const year = end.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
};

/**
 * Get YYYY-MM-DD string for start of week
 */
export const getWeekStartDateString = (date: Date = new Date()): string => {
  const start = getStartOfWeek(date);
  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, '0');
  const day = String(start.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parse a YYYY-MM-DD date string into a local Date object at midnight
 */
export const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};
