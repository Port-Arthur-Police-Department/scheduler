// src/utils/staffingCalculations.ts
import { isSupervisorByRank } from "@/components/schedule/the-book/utils";
import { PREDEFINED_POSITIONS } from "@/constants/positions";

// Debug flag - enable by running localStorage.setItem('debugStaffing', 'true') in browser console
const DEBUG_STAFFING = typeof window !== 'undefined' &&
  process.env.NODE_ENV === 'development' &&
  localStorage.getItem('debugStaffing') === 'true';

// Helper function for conditional debug logging
const debugLog = (...args: any[]) => {
  if (DEBUG_STAFFING) {
    console.log(...args);
  }
};

// Helper to check if position is "Riding with partner" or similar
export const isRidingWithPartnerPosition = (position: string | undefined | null): boolean => {
  if (!position) return false;
  const positionLower = position.toLowerCase();
  return (
    positionLower.includes('riding with') ||
    positionLower.includes('riding partner') ||
    positionLower.includes('emergency partner') ||
    positionLower === 'other'
  );
};

/**
 * Check if an officer has a special assignment that should be excluded from regular staffing
 */
export const isSpecialAssignment = (position: string | undefined | null): boolean => {
  if (!position) return false;

  // Check if it's a partnership position (these are NOT special assignments)
  if (isRidingWithPartnerPosition(position)) {
    return false;
  }

  const positionLower = position.toLowerCase();
  const isOther = positionLower.includes('other');
  const isPredefined = PREDEFINED_POSITIONS.includes(position);

  // If position contains "other" and is not a partnership position → special assignment
  // If position is not in predefined list and is not a partnership position → special assignment
  return isOther || !isPredefined;
};

/**
 * Check if an officer should be counted for staffing (enhanced version)
 */
export const shouldCountForStaffing = (officer: any): boolean => {
  if (!officer) return false;

  // Check basic conditions from existing function
  const isOff = officer.shiftInfo?.isOff === true;
  const hasFullDayPTO = officer.shiftInfo?.hasPTO === true;

  if (isOff || hasFullDayPTO) return false;

  // Check for excluded PTO types
  if (isExcludedPTO(officer)) return false;

  // Check for "Other (Custom)" assignment
  const position = officer.shiftInfo?.position || '';
  if (isExcludedSpecialAssignment(position)) return false;

  // NEW: Check for special assignments (excluding "Riding with partner")
  if (isSpecialAssignment(position)) return false;

  return true;
};

// PTO types that should NOT count toward staffing
const PTO_TYPES_TO_EXCLUDE = ['vacation', 'holiday', 'sick', 'comp', 'other'];

// Check if an officer is on PTO that should exclude them from staffing
const isExcludedPTO = (officer: any): boolean => {
  if (!officer.shiftInfo?.hasPTO) return false;

  const ptoType = officer.shiftInfo?.ptoData?.ptoType?.toLowerCase() || '';
  const reason = officer.shiftInfo?.reason?.toLowerCase() || '';

  // Check if PTO type is in our exclusion list
  return PTO_TYPES_TO_EXCLUDE.some(excludedType =>
    ptoType.includes(excludedType) || reason.includes(excludedType)
  );
};

// Check if an officer has "Other (Custom)" assignment that should exclude them
const isExcludedSpecialAssignment = (position: string): boolean => {
  if (!position) return false;

  // Only exclude if position is "Other (Custom)" or starts with "Other"
  const positionLower = position.toLowerCase();
  return positionLower.includes('other (custom)') || positionLower.startsWith('other');
};

/**
 * Calculate total staffing including:
 * - Regular shift officers (from recurring_schedule)
 * - Overtime officers (is_extra_shift = true)
 * EXCLUDES:
 * - Officers on PTO (vacation, holiday, sick, comp, other)
 * - Officers assigned to special assignments (not in PREDEFINED_POSITIONS)
 * - Officers marked as off (isOff)
 */
export const calculateTotalStaffing = (daySchedule: any) => {
  if (!daySchedule?.officers) return { supervisorCount: 0, officerCount: 0, ppoCount: 0 };

  let supervisorCount = 0;
  let officerCount = 0;
  let ppoCount = 0;

  daySchedule.officers.forEach((officer: any) => {
    const position = officer.shiftInfo?.position || '';

    // Check if officer is on duty (not off)
    if (officer.shiftInfo?.isOff === true) return;

    // Skip full-day PTO
    if (officer.shiftInfo?.hasPTO === true) return;

    // Skip excluded PTO types
    if (isExcludedPTO(officer)) return;

    // Skip special assignments
    if (isSpecialAssignment(position)) return;

    // Officer is working and should count toward staffing
    const isSupervisor = isSupervisorByRank({ rank: officer.rank });
    const isPPO = officer.rank?.toLowerCase() === 'probationary';

    const isDistrictAssignment = position.toLowerCase().includes('district') ||
      position.toLowerCase().includes('city-wide');

    if (isSupervisor && isDistrictAssignment) {
      officerCount++;
      debugLog(`✅ Counting ${officer.officerName} as OFFICER (supervisor in district/city-wide): ${position}`);
    } else if (isSupervisor && position === 'Supervisor') {
      supervisorCount++;
      debugLog(`✅ Counting ${officer.officerName} as SUPERVISOR: ${position}`);
    } else if (isSupervisor) {
      supervisorCount++;
      debugLog(`✅ Counting ${officer.officerName} as SUPERVISOR (non-district): ${position}`);
    } else if (isPPO) {
      ppoCount++;
      debugLog(`✅ Counting ${officer.officerName} as PPO: ${position}`);
    } else {
      officerCount++;
      debugLog(`✅ Counting ${officer.officerName} as OFFICER: ${position}`);
    }
  });

  // Debug logging only when enabled
  const workingOfficers = daySchedule.officers.filter((o: any) =>
    !o.shiftInfo?.isOff &&
    !isExcludedPTO(o) &&
    !isSpecialAssignment(o.shiftInfo?.position || '')
  ).length;

  const overtimeCount = daySchedule.officers.filter((o: any) =>
    o.shiftInfo?.is_extra_shift === true &&
    !o.shiftInfo?.isOff &&
    !isExcludedPTO(o) &&
    !isSpecialAssignment(o.shiftInfo?.position || '')
  ).length;

  debugLog('📊 FINAL Staffing calculation for', daySchedule.date, {
    totalOfficers: daySchedule.officers.length,
    workingOfficers,
    supervisorCount,
    officerCount,
    ppoCount,
    overtimeOfficersCounted: overtimeCount,
    totalCounted: supervisorCount + officerCount + ppoCount
  });

  return { supervisorCount, officerCount, ppoCount };
};

/**
 * Calculate only regular staffing (excluding overtime)
 */
export const calculateRegularStaffing = (daySchedule: any) => {
  if (!daySchedule?.officers) return { supervisorCount: 0, officerCount: 0, ppoCount: 0 };

  let supervisorCount = 0;
  let officerCount = 0;
  let ppoCount = 0;

  daySchedule.officers.forEach((officer: any) => {
    // EXCLUDE overtime officers for regular count only
    if (officer.shiftInfo?.is_extra_shift === true) return;

    // Check if officer is on duty (not off)
    if (officer.shiftInfo?.isOff === true) return;

    // Skip full-day PTO
    if (officer.shiftInfo?.hasPTO === true) return;

    // Check if officer is on excluded PTO
    if (isExcludedPTO(officer)) return;

    const position = officer.shiftInfo?.position || '';

    // Skip special assignments
    if (isSpecialAssignment(position)) return;

    // Officer is working and should count toward staffing
    const isSupervisor = isSupervisorByRank({ rank: officer.rank });
    const isPPO = officer.rank?.toLowerCase() === 'probationary';

    const isDistrictAssignment = position.toLowerCase().includes('district') ||
      position.toLowerCase().includes('city-wide');

    if (isSupervisor && isDistrictAssignment) {
      officerCount++;
    } else if (isSupervisor && position === 'Supervisor') {
      supervisorCount++;
    } else if (isSupervisor) {
      supervisorCount++;
    } else if (isPPO) {
      ppoCount++;
    } else {
      officerCount++;
    }
  });

  return { supervisorCount, officerCount, ppoCount };
};

/**
 * Calculate only overtime staffing
 */
export const calculateOvertimeStaffing = (daySchedule: any) => {
  if (!daySchedule?.officers) return { supervisorCount: 0, officerCount: 0, ppoCount: 0 };

  let supervisorCount = 0;
  let officerCount = 0;
  let ppoCount = 0;

  daySchedule.officers.forEach((officer: any) => {
    // INCLUDE only overtime officers
    if (officer.shiftInfo?.is_extra_shift !== true) return;

    // Check if officer is on duty (not off)
    if (officer.shiftInfo?.isOff === true) return;

    // Skip full-day PTO
    if (officer.shiftInfo?.hasPTO === true) return;

    // Check if officer is on excluded PTO
    if (isExcludedPTO(officer)) return;

    const position = officer.shiftInfo?.position || '';

    // Skip special assignments
    if (isSpecialAssignment(position)) return;

    // Officer is working and should count toward staffing
    const isSupervisor = isSupervisorByRank({ rank: officer.rank });
    const isPPO = officer.rank?.toLowerCase() === 'probationary';

    const isDistrictAssignment = position.toLowerCase().includes('district') ||
      position.toLowerCase().includes('city-wide');

    if (isSupervisor && isDistrictAssignment) {
      officerCount++;
    } else if (isSupervisor && position === 'Supervisor') {
      supervisorCount++;
    } else if (isSupervisor) {
      supervisorCount++;
    } else if (isPPO) {
      ppoCount++;
    } else {
      officerCount++;
    }
  });

  return { supervisorCount, officerCount, ppoCount };
};

/**
 * Alias for backward compatibility
 */
export const calculateDailyStaffing = calculateTotalStaffing;

export const getStaffingMinimums = (minimumStaffing: any, dayOfWeek: number, shiftTypeId: string) => {
  if (!minimumStaffing) {
    return { minimumOfficers: 0, minimumSupervisors: 0 };
  }

  // Handle Map structure
  if (minimumStaffing instanceof Map) {
    const dayStaffing = minimumStaffing.get(dayOfWeek);
    if (dayStaffing instanceof Map) {
      const shiftStaffing = dayStaffing.get(shiftTypeId);
      return shiftStaffing || { minimumOfficers: 0, minimumSupervisors: 0 };
    }
  }

  // Handle object structure (fallback)
  const dayStaffing = minimumStaffing[dayOfWeek];
  if (dayStaffing && typeof dayStaffing === 'object') {
    const shiftStaffing = dayStaffing[shiftTypeId];
    return shiftStaffing || { minimumOfficers: 0, minimumSupervisors: 0 };
  }

  return { minimumOfficers: 0, minimumSupervisors: 0 };
};

/**
 * Get the staffing category for an officer based on position
 */
export const getStaffingCategory = (officer: any): 'supervisor' | 'officer' | 'ppo' => {
  const isSupervisor = isSupervisorByRank({ rank: officer.rank });
  const isPPO = officer.rank?.toLowerCase() === 'probationary';

  if (isPPO) return 'ppo';

  const position = officer.shiftInfo?.position || '';
  const isDistrictAssignment = position.toLowerCase().includes('district') ||
    position.toLowerCase().includes('city-wide');

  // Supervisors in district/city-wide positions count as officers
  if (isSupervisor && isDistrictAssignment) {
    return 'officer';
  }

  return isSupervisor ? 'supervisor' : 'officer';
};
