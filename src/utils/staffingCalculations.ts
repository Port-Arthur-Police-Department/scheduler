// src/utils/staffingCalculations.ts
import { isSupervisorByRank } from "@/components/schedule/the-book/utils";

// List of PTO types that should NOT count toward staffing
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

// Check if an officer has a special assignment that should exclude them
const isExcludedSpecialAssignment = (position: string): boolean => {
  if (!position) return false;
  
  const positionLower = position.toLowerCase();
  
  // Special assignments that should NOT count toward staffing
  const excludedAssignments = [
    'training',
    'court',
    'detail',
    'special assignment',
    'other assignment',
    'admin',
    'office',
    'desk',
    'light duty',
    'modified duty'
  ];
  
  return excludedAssignments.some(assignment => 
    positionLower.includes(assignment)
  );
};

/**
 * Calculate total staffing including ALL officers (regular + overtime)
 * EXCLUDES: Officers on PTO (vacation, holiday, sick, comp, other) and special assignments
 */
export const calculateTotalStaffing = (daySchedule: any) => {
  if (!daySchedule?.officers) return { supervisorCount: 0, officerCount: 0, ppoCount: 0 };
  
  let supervisorCount = 0;
  let officerCount = 0;
  let ppoCount = 0;
  
  daySchedule.officers.forEach((officer: any) => {
    // Check if officer is on duty (not off)
    const isOff = officer.shiftInfo?.isOff === true;
    if (isOff) return;
    
    // Check if officer is on excluded PTO
    if (isExcludedPTO(officer)) {
      console.log(`❌ Excluding ${officer.officerName} from staffing: PTO type`, 
        officer.shiftInfo?.ptoData?.ptoType || officer.shiftInfo?.reason);
      return;
    }
    
    // Check if officer has an excluded special assignment
    const position = officer.shiftInfo?.position || '';
    if (isExcludedSpecialAssignment(position)) {
      console.log(`❌ Excluding ${officer.officerName} from staffing: Special assignment`, position);
      return;
    }
    
    // Check if officer is actually working (not just assigned)
    const hasFullDayPTO = officer.shiftInfo?.hasPTO === true;
    if (hasFullDayPTO) {
      // Double-check this isn't an excluded PTO type (should have been caught above)
      return;
    }
    
    // Officer is working and should count toward staffing
    const isSupervisor = isSupervisorByRank({ rank: officer.rank });
    const isPPO = officer.rank?.toLowerCase() === 'probationary';
    
    // Check if supervisor is assigned to a district (counts as officer)
    const isDistrictAssignment = position.toLowerCase().includes('district') || 
                                 position.toLowerCase().includes('beat') ||
                                 position.match(/^\d+/); // Starts with numbers (like "1A", "2B")
    
    // If supervisor is assigned to a district, count them as an officer
    if (isSupervisor && isDistrictAssignment) {
      officerCount++;
      console.log(`✅ Counting ${officer.officerName} as OFFICER (supervisor in district): ${position}`);
    } else if (isSupervisor) {
      supervisorCount++;
      console.log(`✅ Counting ${officer.officerName} as SUPERVISOR: ${position}`);
    } else if (isPPO) {
      ppoCount++;
      console.log(`✅ Counting ${officer.officerName} as PPO: ${position}`);
    } else {
      officerCount++;
      console.log(`✅ Counting ${officer.officerName} as OFFICER: ${position}`);
    }
  });
  
  // Debug logging
  const workingOfficers = daySchedule.officers.filter((o: any) => 
    !o.shiftInfo?.isOff && 
    !isExcludedPTO(o) &&
    !isExcludedSpecialAssignment(o.shiftInfo?.position || '')
  ).length;
  
  const overtimeCount = daySchedule.officers.filter((o: any) => 
    o.shiftInfo?.is_extra_shift === true && 
    !o.shiftInfo?.isOff && 
    !isExcludedPTO(o) &&
    !isExcludedSpecialAssignment(o.shiftInfo?.position || '')
  ).length;
  
  console.log('📊 FINAL Staffing calculation for', daySchedule.date, {
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
 * Also excludes PTO and special assignments
 */
export const calculateRegularStaffing = (daySchedule: any) => {
  if (!daySchedule?.officers) return { supervisorCount: 0, officerCount: 0, ppoCount: 0 };
  
  let supervisorCount = 0;
  let officerCount = 0;
  let ppoCount = 0;
  
  daySchedule.officers.forEach((officer: any) => {
    // EXCLUDE overtime officers
    const isOvertime = officer.shiftInfo?.is_extra_shift === true;
    if (isOvertime) return;
    
    // Check if officer is on duty (not off)
    const isOff = officer.shiftInfo?.isOff === true;
    if (isOff) return;
    
    // Check if officer is on excluded PTO
    if (isExcludedPTO(officer)) return;
    
    // Check if officer has an excluded special assignment
    const position = officer.shiftInfo?.position || '';
    if (isExcludedSpecialAssignment(position)) return;
    
    // Officer is working and should count toward staffing
    const isSupervisor = isSupervisorByRank({ rank: officer.rank });
    const isPPO = officer.rank?.toLowerCase() === 'probationary';
    
    const isDistrictAssignment = position.toLowerCase().includes('district') || 
                                 position.toLowerCase().includes('beat') ||
                                 position.match(/^\d+/);
    
    if (isSupervisor && isDistrictAssignment) {
      officerCount++;
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
 * Also excludes PTO and special assignments
 */
export const calculateOvertimeStaffing = (daySchedule: any) => {
  if (!daySchedule?.officers) return { supervisorCount: 0, officerCount: 0, ppoCount: 0 };
  
  let supervisorCount = 0;
  let officerCount = 0;
  let ppoCount = 0;
  
  daySchedule.officers.forEach((officer: any) => {
    // INCLUDE only overtime officers
    const isOvertime = officer.shiftInfo?.is_extra_shift === true;
    if (!isOvertime) return;
    
    // Check if officer is on duty (not off)
    const isOff = officer.shiftInfo?.isOff === true;
    if (isOff) return;
    
    // Check if officer is on excluded PTO
    if (isExcludedPTO(officer)) return;
    
    // Check if officer has an excluded special assignment
    const position = officer.shiftInfo?.position || '';
    if (isExcludedSpecialAssignment(position)) return;
    
    // Officer is working and should count toward staffing
    const isSupervisor = isSupervisorByRank({ rank: officer.rank });
    const isPPO = officer.rank?.toLowerCase() === 'probationary';
    
    const isDistrictAssignment = position.toLowerCase().includes('district') || 
                                 position.toLowerCase().includes('beat') ||
                                 position.match(/^\d+/);
    
    if (isSupervisor && isDistrictAssignment) {
      officerCount++;
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
 * Check if an officer should be counted for staffing
 * Now also checks for excluded PTO types and special assignments
 */
export const shouldCountForStaffing = (officer: any): boolean => {
  if (!officer) return false;
  
  // Check basic conditions
  const isOff = officer.shiftInfo?.isOff === true;
  const hasFullDayPTO = officer.shiftInfo?.hasPTO === true;
  
  if (isOff || hasFullDayPTO) return false;
  
  // Check for excluded PTO types
  if (isExcludedPTO(officer)) return false;
  
  // Check for excluded special assignments
  const position = officer.shiftInfo?.position || '';
  if (isExcludedSpecialAssignment(position)) return false;
  
  return true;
};

/**
 * Get detailed breakdown of why an officer is excluded (for debugging)
 */
export const getExclusionReason = (officer: any): string | null => {
  if (!officer) return "No officer data";
  
  if (officer.shiftInfo?.isOff === true) return "Officer is marked as OFF";
  
  if (isExcludedPTO(officer)) {
    const ptoType = officer.shiftInfo?.ptoData?.ptoType || officer.shiftInfo?.reason;
    return `Excluded PTO type: ${ptoType}`;
  }
  
  const position = officer.shiftInfo?.position || '';
  if (isExcludedSpecialAssignment(position)) {
    return `Excluded special assignment: ${position}`;
  }
  
  return null; // Officer should be counted
};
