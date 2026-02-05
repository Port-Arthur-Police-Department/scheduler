// src/utils/scheduleUtils.ts - UPDATED VERSION
import { RANK_ORDER, PREDEFINED_POSITIONS } from "@/constants/positions";
import { isPPOByRank } from "@/utils/ppoUtils";
import { getLastName, sortSupervisorsByRank } from "@/utils/sortingUtils";

export interface OfficerData {
  scheduleId: string;
  officerId: string;
  name: string;
  badge?: string;
  rank?: string;
  isPPO: boolean;
  position?: string;
  unitNumber?: string;
  notes?: string;
  type: "recurring" | "exception";
  hasPTO: boolean;
  ptoData?: {
    id: string;
    ptoType: string;
    startTime: string;
    endTime: string;
    isFullShift: boolean;
  };
  isPartnership: boolean;
  partnerOfficerId?: string;
  partnershipSuspended: boolean;
  isExtraShift: boolean;
  shift: any;
  date?: string;
  dayOfWeek?: number;
}

/**
 * Check if officer is a supervisor by rank (matching DailyScheduleView logic)
 */
export const isSupervisorByRank = (rank: string | undefined | null): boolean => {
  if (!rank) return false;
  const rankLower = rank.toLowerCase();
  return (
    rankLower.includes('sergeant') ||
    rankLower.includes('lieutenant') ||
    rankLower.includes('captain') ||
    rankLower.includes('chief') ||
    rankLower.includes('commander') ||
    rankLower.includes('supervisor')
  );
};

/**
 * Sort supervisors by rank (matching DailyScheduleView logic)
 */
export const sortSupervisorsByRank = (supervisors: any[]): any[] => {
  if (!supervisors || supervisors.length === 0) return [];
  
  return [...supervisors].sort((a, b) => {
    const rankA = a.rank || 'Officer';
    const rankB = b.rank || 'Officer';
    
    // Get rank priority from RANK_ORDER
    const rankComparison = 
      (RANK_ORDER[rankA as keyof typeof RANK_ORDER] || 99) - 
      (RANK_ORDER[rankB as keyof typeof RANK_ORDER] || 99);
    
    // If same rank, sort by last name
    if (rankComparison === 0) {
      const lastNameA = getLastName(a.name || a.officerName || '');
      const lastNameB = getLastName(b.name || b.officerName || '');
      return lastNameA.localeCompare(lastNameB);
    }
    
    return rankComparison;
  });
};

/**
 * Check if position is "Riding with partner" or similar
 */
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
 * Check if officer should be counted in staffing calculations (matches DailyScheduleView)
 */
export const shouldCountOfficerForStaffing = (officer: OfficerData): boolean => {
  // Exclude officers with full day PTO
  if (officer.hasPTO && officer.ptoData?.isFullShift) {
    return false;
  }
  
  // Exclude PPOs from officer counts (but supervisors can be PPOs)
  const isSupervisor = isSupervisorByRank(officer.rank);
  if (!isSupervisor && officer.isPPO) {
    return false;
  }
  
  return true;
};

/**
 * Categorize officers (matching DailyScheduleView logic)
 */
export const categorizeOfficers = (
  allOfficers: OfficerData[]
): {
  supervisors: OfficerData[];
  regularOfficers: OfficerData[];
  suspendedPartnershipOfficers: OfficerData[];
  specialAssignmentOfficers: OfficerData[];
} => {
  // 1. Special assignments first (exclude those in partnerships)
  const specialAssignmentOfficers = allOfficers.filter(o => {
    // Skip officers in ANY partnership
    if (o.isPartnership) return false;
    
    const position = o.position?.toLowerCase() || '';
    const isSpecialAssignment = 
      (position.includes('other') && !isRidingWithPartnerPosition(o.position)) || 
      (o.position && !PREDEFINED_POSITIONS.includes(o.position) && !isRidingWithPartnerPosition(o.position));
    
    return isSpecialAssignment;
  });

  // 2. Supervisors (excluding special assignments and partnerships)
  const supervisors = sortSupervisorsByRank(
    allOfficers.filter(o => {
      // Skip special assignment officers
      const position = o.position?.toLowerCase() || '';
      const isSpecialAssignment = 
        (position.includes('other') && !isRidingWithPartnerPosition(o.position)) || 
        (o.position && !PREDEFINED_POSITIONS.includes(o.position) && !isRidingWithPartnerPosition(o.position));
      if (isSpecialAssignment) return false;
      
      // Skip officers in ANY partnership
      if (o.isPartnership) return false;
      
      // Check by position OR by rank
      const hasSupervisorPosition = position.includes('supervisor');
      const hasSupervisorRank = isSupervisorByRank(o.rank);
      
      return hasSupervisorPosition || hasSupervisorRank;
    })
  );

  // 3. Regular officers (everyone else)
  const regularOfficers = allOfficers.filter(o => {
    // Skip officers with full day PTO
    if (o.hasPTO && o.ptoData?.isFullShift) return false;
    
    // Skip special assignment officers
    const position = o.position?.toLowerCase() || '';
    const isSpecialAssignment = 
      (position.includes('other') && !isRidingWithPartnerPosition(o.position)) || 
      (o.position && !PREDEFINED_POSITIONS.includes(o.position) && !isRidingWithPartnerPosition(o.position));
    if (isSpecialAssignment) return false;
    
    // Skip supervisors
    const hasSupervisorPosition = position.includes('supervisor');
    const hasSupervisorRank = isSupervisorByRank(o.rank);
    if (hasSupervisorPosition || hasSupervisorRank) return false;
    
    // Skip suspended partnerships
    if (o.partnershipSuspended) return false;
    
    return true;
  });

  // 4. Suspended partnerships
  const suspendedPartnershipOfficers = allOfficers.filter(o => 
    o.isPartnership && o.partnershipSuspended
  );

  return {
    supervisors,
    regularOfficers,
    suspendedPartnershipOfficers,
    specialAssignmentOfficers
  };
};

/**
 * Calculate staffing counts (matching DailyScheduleView logic)
 */
export const calculateStaffingCounts = (
  categorizedOfficers: ReturnType<typeof categorizeOfficers>
): {
  currentSupervisors: number;
  currentOfficers: number;
} => {
  // Count supervisors (excluding full day PTO)
  const countedSupervisors = categorizedOfficers.supervisors.filter(supervisor => 
    !(supervisor.hasPTO && supervisor.ptoData?.isFullShift)
  );

  // Count officers (excluding PPOs and full day PTO)
  const countedOfficers = categorizedOfficers.regularOfficers.filter(officer => {
    const isPPO = officer.isPPO;
    const hasFullDayPTO = officer.hasPTO && officer.ptoData?.isFullShift;
    return !isPPO && !hasFullDayPTO;
  });

  return {
    currentSupervisors: countedSupervisors.length,
    currentOfficers: countedOfficers.length
  };
};
