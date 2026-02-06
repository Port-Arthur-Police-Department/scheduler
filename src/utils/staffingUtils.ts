// src/utils/staffingUtils.ts

/**
 * Types for staffing calculations
 */
export interface StaffingDeficit {
  supervisorsNeeded: number;
  officersNeeded: number;
}

export interface StaffingCheckResult {
  isUnderstaffed: boolean;
  supervisorsUnderstaffed: boolean;
  officersUnderstaffed: boolean;
  deficit: StaffingDeficit;
  hasRequirements: boolean;
  description: string;
}

export interface StaffingComparison {
  currentSupervisors: number;
  minSupervisors: number;
  currentOfficers: number;
  minOfficers: number;
}

// Add to src/utils/staffingUtils.ts

/**
 * Check if a position is a district/beat assignment
 * @param position The position name
 * @returns True if it's a district/beat assignment
 */
export const isDistrictAssignment = (position: string): boolean => {
  if (!position) return false;
  
  const positionLower = position.toLowerCase();
  return (
    positionLower.includes('district') ||
    positionLower.includes('beat') ||
    positionLower.includes('patrol') ||
    positionLower.match(/^\d+/) !== null // Starts with numbers
  );
};

/**
 * Categorize an officer for staffing purposes
 * @param officer The officer object
 * @returns Object with categorization flags
 */
export const categorizeOfficerForStaffing = (
  officer: any,
  isSupervisorByRank: (officer: any) => boolean
) => {
  const isSupervisor = isSupervisorByRank(officer);
  const isPPO = officer.rank?.toLowerCase() === 'probationary';
  const isDistrict = isDistrictAssignment(officer.shiftInfo?.position || '');
  
  return {
    isSupervisor,
    isPPO,
    isDistrict,
    countsAsSupervisor: isSupervisor && !isDistrict,
    countsAsOfficer: (!isSupervisor && !isPPO) || (isSupervisor && isDistrict),
    countsAsPPO: isPPO
  };
};

/**
 * Calculate staffing with district supervisor logic
 * @param officers Array of officer objects
 * @param isSupervisorByRank Function to check if officer is supervisor by rank
 * @returns Object with counts
 */
export const calculateStaffingWithDistricts = (
  officers: any[],
  isSupervisorByRank: (officer: any) => boolean
) => {
  let supervisorCount = 0;
  let officerCount = 0;
  let ppoCount = 0;
  
  officers.forEach((officer) => {
    // Skip if officer is off or on PTO
    const isOff = officer.shiftInfo?.isOff === true;
    const hasFullDayPTO = officer.shiftInfo?.hasPTO === true;
    
    if (!isOff && !hasFullDayPTO) {
      const { countsAsSupervisor, countsAsOfficer, countsAsPPO } = 
        categorizeOfficerForStaffing(officer, isSupervisorByRank);
      
      if (countsAsSupervisor) supervisorCount++;
      if (countsAsOfficer) officerCount++;
      if (countsAsPPO) ppoCount++;
    }
  });
  
  return { supervisorCount, officerCount, ppoCount };
};

/**
 * Check if a shift has minimum requirements configured
 * @param minSupervisors Minimum supervisors required (0 means no requirement)
 * @param minOfficers Minimum officers required (0 means no requirement)
 * @returns True if either supervisors or officers have a minimum requirement > 0
 */
export const hasMinimumRequirements = (
  minSupervisors: number,
  minOfficers: number
): boolean => {
  return minSupervisors > 0 || minOfficers > 0;
};

/**
 * Check if a shift is considered understaffed based on current staffing vs minimum requirements
 * This handles the case where minimum requirements are 0 (no requirement)
 * @param currentSupervisors Current number of supervisors on shift
 * @param minSupervisors Minimum supervisors required (0 means no requirement)
 * @param currentOfficers Current number of officers on shift
 * @param minOfficers Minimum officers required (0 means no requirement)
 * @returns True if understaffed in either category
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
 * @param currentSupervisors Current number of supervisors on shift
 * @param minSupervisors Minimum supervisors required (0 means no requirement)
 * @param currentOfficers Current number of officers on shift
 * @param minOfficers Minimum officers required (0 means no requirement)
 * @returns Object with supervisorsNeeded and officersNeeded (both will be 0 or positive)
 */
export const calculateStaffingDeficit = (
  currentSupervisors: number,
  minSupervisors: number,
  currentOfficers: number,
  minOfficers: number
): StaffingDeficit => {
  // Only calculate deficit if there's a minimum requirement (> 0)
  const supervisorsNeeded = minSupervisors > 0 ? Math.max(0, minSupervisors - currentSupervisors) : 0;
  const officersNeeded = minOfficers > 0 ? Math.max(0, minOfficers - currentOfficers) : 0;
  
  return { supervisorsNeeded, officersNeeded };
};

/**
 * Get a human-readable description of staffing needs
 * @param currentSupervisors Current number of supervisors on shift
 * @param minSupervisors Minimum supervisors required (0 means no requirement)
 * @param currentOfficers Current number of officers on shift
 * @param minOfficers Minimum officers required (0 means no requirement)
 * @returns Human-readable description of staffing status
 */
export const getStaffingDescription = (
  currentSupervisors: number,
  minSupervisors: number,
  currentOfficers: number,
  minOfficers: number
): string => {
  // If no minimum requirements are set
  if (minSupervisors === 0 && minOfficers === 0) {
    return "No minimum requirements configured";
  }
  
  const deficit = calculateStaffingDeficit(currentSupervisors, minSupervisors, currentOfficers, minOfficers);
  
  if (deficit.supervisorsNeeded > 0 && deficit.officersNeeded > 0) {
    return `Understaffed: Need ${deficit.supervisorsNeeded} supervisor(s) and ${deficit.officersNeeded} officer(s)`;
  } else if (deficit.supervisorsNeeded > 0) {
    return `Understaffed: Need ${deficit.supervisorsNeeded} supervisor(s)`;
  } else if (deficit.officersNeeded > 0) {
    return `Understaffed: Need ${deficit.officersNeeded} officer(s)`;
  } else if (currentSupervisors >= minSupervisors && currentOfficers >= minOfficers) {
    return "Adequately staffed";
  }
  
  return "Staffing status unknown";
};

/**
 * Get a concise summary of staffing requirements (for badges, tooltips, etc.)
 * @param minSupervisors Minimum supervisors required
 * @param minOfficers Minimum officers required
 * @returns Short summary string
 */
export const getRequirementsSummary = (
  minSupervisors: number,
  minOfficers: number
): string => {
  if (minSupervisors === 0 && minOfficers === 0) {
    return "No minimum";
  }
  
  const parts: string[] = [];
  if (minSupervisors > 0) parts.push(`${minSupervisors} sup`);
  if (minOfficers > 0) parts.push(`${minOfficers} off`);
  
  return parts.join(", ");
};

/**
 * Get staffing status with severity level for UI indicators
 * @param currentSupervisors Current number of supervisors on shift
 * @param minSupervisors Minimum supervisors required (0 means no requirement)
 * @param currentOfficers Current number of officers on shift
 * @param minOfficers Minimum officers required (0 means no requirement)
 * @returns Severity level: "none", "warning", or "danger"
 */
export const getStaffingSeverity = (
  currentSupervisors: number,
  minSupervisors: number,
  currentOfficers: number,
  minOfficers: number
): "none" | "warning" | "danger" => {
  const deficit = calculateStaffingDeficit(currentSupervisors, minSupervisors, currentOfficers, minOfficers);
  
  // If no requirements, always "none"
  if (minSupervisors === 0 && minOfficers === 0) {
    return "none";
  }
  
  // If missing more than 2 total staff, it's dangerous
  const totalDeficit = deficit.supervisorsNeeded + deficit.officersNeeded;
  if (totalDeficit >= 3) {
    return "danger";
  }
  
  // If missing any staff, it's a warning
  if (totalDeficit > 0) {
    return "warning";
  }
  
  return "none";
};

/**
 * Comprehensive staffing check that returns all relevant information
 * @param params Staffing comparison parameters
 * @returns Complete staffing check result
 */
export const performStaffingCheck = ({
  currentSupervisors,
  minSupervisors,
  currentOfficers,
  minOfficers
}: StaffingComparison): StaffingCheckResult => {
  const hasRequirements = hasMinimumRequirements(minSupervisors, minOfficers);
  const isUnderstaffed = isShiftUnderstaffed(currentSupervisors, minSupervisors, currentOfficers, minOfficers);
  const deficit = calculateStaffingDeficit(currentSupervisors, minSupervisors, currentOfficers, minOfficers);
  const description = getStaffingDescription(currentSupervisors, minSupervisors, currentOfficers, minOfficers);
  
  const supervisorsUnderstaffed = minSupervisors > 0 && currentSupervisors < minSupervisors;
  const officersUnderstaffed = minOfficers > 0 && currentOfficers < minOfficers;
  
  return {
    isUnderstaffed,
    supervisorsUnderstaffed,
    officersUnderstaffed,
    deficit,
    hasRequirements,
    description
  };
};

/**
 * Format staffing numbers for display
 * @param current Current count
 * @param min Minimum required (0 means no requirement)
 * @param label Type of staff (e.g., "Supervisors", "Officers")
 * @returns Formatted string
 */
export const formatStaffingCount = (
  current: number,
  min: number,
  label: string
): string => {
  if (min === 0) {
    return `${current} ${label}`;
  }
  
  if (current < min) {
    return `${current}/${min} ${label} ⚠️`;
  }
  
  return `${current}/${min} ${label}`;
};

/**
 * Calculate staffing percentage (for progress bars, etc.)
 * @param current Current count
 * @param min Minimum required (0 means no requirement)
 * @returns Percentage (0-100) or null if no minimum
 */
export const calculateStaffingPercentage = (
  current: number,
  min: number
): number | null => {
  if (min === 0) {
    return null; // No percentage if no requirement
  }
  
  if (current >= min) {
    return 100;
  }
  
  return Math.round((current / min) * 100);
};

/**
 * Check if a specific type of staff is understaffed
 * @param current Current count
 * @param min Minimum required
 * @returns True if understaffed
 */
export const isCategoryUnderstaffed = (
  current: number,
  min: number
): boolean => {
  return min > 0 && current < min;
};

/**
 * Get recommendations for staffing improvement
 * @param deficit Staffing deficit
 * @param shiftName Name of the shift (optional)
 * @returns Array of recommendation strings
 */
export const getStaffingRecommendations = (
  deficit: StaffingDeficit,
  shiftName?: string
): string[] => {
  const recommendations: string[] = [];
  const shiftPrefix = shiftName ? `${shiftName}: ` : "";
  
  if (deficit.supervisorsNeeded > 0) {
    recommendations.push(`${shiftPrefix}Assign ${deficit.supervisorsNeeded} additional supervisor(s)`);
  }
  
  if (deficit.officersNeeded > 0) {
    recommendations.push(`${shiftPrefix}Assign ${deficit.officersNeeded} additional officer(s)`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push(`${shiftPrefix}Staffing levels are adequate`);
  }
  
  return recommendations;
};
