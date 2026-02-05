// src/utils/scheduleUtils.ts
import { RANK_ORDER, PREDEFINED_POSITIONS } from "@/constants/positions";

/**
 * Get last name from full name
 */
export const getLastName = (fullName: string): string => {
  return fullName?.split(' ').pop() || fullName;
};

/**
 * Sort supervisors by rank, then by last name
 */
export const sortSupervisorsByRank = (supervisors: any[]) => {
  return supervisors.sort((a, b) => {
    const rankA = a.rank || 'Officer';
    const rankB = b.rank || 'Officer';
    const rankComparison = 
      (RANK_ORDER[rankA as keyof typeof RANK_ORDER] || 99) - 
      (RANK_ORDER[rankB as keyof typeof RANK_ORDER] || 99);
    
    if (rankComparison === 0) {
      return getLastName(a.officerName || a.name || '').localeCompare(
        getLastName(b.officerName || b.name || '')
      );
    }
    
    return rankComparison;
  });
};

/**
 * Categorize and sort officers into supervisors and regular officers
 */
export const categorizeAndSortOfficers = (officers: any[]) => {
  const supervisors = officers
    .filter(officer => 
      officer.shiftInfo?.position?.toLowerCase().includes('supervisor') ||
      officer.position?.toLowerCase().includes('supervisor')
    );
  
  const sortedSupervisors = sortSupervisorsByRank(supervisors);

  const regularOfficers = officers
    .filter(officer => 
      !(officer.shiftInfo?.position?.toLowerCase().includes('supervisor') ||
        officer.position?.toLowerCase().includes('supervisor'))
    )
    .sort((a, b) => 
      getLastName(a.officerName || a.name || '').localeCompare(
        getLastName(b.officerName || b.name || '')
      )
    );

  return { supervisors: sortedSupervisors, regularOfficers };
};

/**
 * Check if position is a special assignment
 */
export const isSpecialAssignment = (position: string | undefined): boolean => {
  if (!position) return false;
  
  return position.toLowerCase().includes('other') ||
         !PREDEFINED_POSITIONS.includes(position);
};

/**
 * Calculate staffing counts excluding PTO and special assignments
 */
export const calculateStaffingCounts = (
  categorizedOfficers: { supervisors: any[]; regularOfficers: any[] }
) => {
  const supervisorCount = categorizedOfficers.supervisors.filter(
    officer => !officer.shiftInfo?.hasPTO
  ).length;

  const officerCount = categorizedOfficers.regularOfficers.filter(officer => {
    const position = officer.shiftInfo?.position;
    return !officer.shiftInfo?.hasPTO && !isSpecialAssignment(position);
  }).length;

  return { supervisorCount, officerCount };
};

// REMOVED: Hardcoded minimum staffing values since we use the database table
// export const MINIMUM_STAFFING = { ... };
// export const MINIMUM_SUPERVISORS = 1;
