// utils/staffingUtils.ts
/**
 * Check if a shift is considered understaffed based on current staffing vs minimum requirements
 * This handles the case where minimum requirements are 0 (no requirement)
 */
export const isShiftUnderstaffed = (
  currentSupervisors: number,
  minSupervisors: number,
  currentOfficers: number,
  minOfficers: number
): boolean => {
  // If minimum is 0, never understaffed (0 means no minimum requirement)
  const supervisorsUnderstaffed = minSupervisors > 0 && currentSupervisors < minSupervisors;
  const officersUnderstaffed = minOfficers > 0 && currentOfficers < minOfficers;
  
  return supervisorsUnderstaffed || officersUnderstaffed;
};

/**
 * Calculate how many additional staff are needed
 */
export const calculateStaffingDeficit = (
  currentSupervisors: number,
  minSupervisors: number,
  currentOfficers: number,
  minOfficers: number
): { supervisorsNeeded: number; officersNeeded: number } => {
  const supervisorsNeeded = minSupervisors > 0 ? Math.max(0, minSupervisors - currentSupervisors) : 0;
  const officersNeeded = minOfficers > 0 ? Math.max(0, minOfficers - currentOfficers) : 0;
  
  return { supervisorsNeeded, officersNeeded };
};

/**
 * Get a human-readable description of staffing needs
 */
export const getStaffingDescription = (
  currentSupervisors: number,
  minSupervisors: number,
  currentOfficers: number,
  minOfficers: number
): string => {
  if (minSupervisors === 0 && minOfficers === 0) {
    return "No minimum requirements set";
  }
  
  const deficit = calculateStaffingDeficit(currentSupervisors, minSupervisors, currentOfficers, minOfficers);
  
  if (deficit.supervisorsNeeded > 0 && deficit.officersNeeded > 0) {
    return `Need ${deficit.supervisorsNeeded} supervisor(s) and ${deficit.officersNeeded} officer(s)`;
  } else if (deficit.supervisorsNeeded > 0) {
    return `Need ${deficit.supervisorsNeeded} supervisor(s)`;
  } else if (deficit.officersNeeded > 0) {
    return `Need ${deficit.officersNeeded} officer(s)`;
  } else if (currentSupervisors >= minSupervisors && currentOfficers >= minOfficers) {
    return "Adequately staffed";
  }
  
  return "Staffing check required";
};

/**
 * Check if shift has any minimum requirements
 */
export const hasMinimumRequirements = (
  minSupervisors: number,
  minOfficers: number
): boolean => {
  return minSupervisors > 0 || minOfficers > 0;
};
