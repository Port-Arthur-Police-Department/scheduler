// sortingUtils.ts
import { getLastName } from "./utils";

export interface OfficerForSorting {
  // Common properties from different components
  id: string;
  full_name?: string;
  officerName?: string; // Some components use officerName
  badge_number?: string;
  badgeNumber?: string; // Some components use badgeNumber
  rank?: string;
  service_credit?: number;
  serviceCredit?: number; // Some components use serviceCredit
  hire_date?: string | null;
  promotion_date_sergeant?: string | null;
  promotion_date_lieutenant?: string | null;
  service_credit_override?: number;
}

/**
 * Get badge number for sorting (handles different property names)
 */
export const getBadgeNumberForSorting = (officer: OfficerForSorting): number => {
  const badgeNum = officer.badge_number || officer.badgeNumber;
  if (!badgeNum) return 9999;
  
  const parsed = parseInt(badgeNum);
  return isNaN(parsed) ? 9999 : parsed;
};

/**
 * Get service credit for sorting (handles different property names)
 */
export const getServiceCreditForSorting = (officer: OfficerForSorting): number => {
  const credit = officer.service_credit !== undefined ? officer.service_credit : officer.serviceCredit;
  return credit || 0;
};

/**
 * Check if officer is a supervisor
 */
export const isSupervisor = (officer: OfficerForSorting): boolean => {
  const rank = officer.rank?.toLowerCase() || '';
  return rank.includes('lieutenant') || 
         rank.includes('lt') ||
         rank.includes('chief') ||
         rank.includes('sergeant') ||
         rank.includes('sgt');
};

/**
 * Check if officer is a PPO
 */
export const isPPO = (officer: OfficerForSorting): boolean => {
  const rank = officer.rank?.toLowerCase() || '';
  return rank === 'probationary' || rank.includes('ppo');
};

/**
 * Sort officers with consistent logic:
 * 1. Supervisors first (Lieutenants/Chiefs → Sergeants)
 * 2. Regular officers
 * 3. PPOs
 * Within each group: Sort by service credit DESC, then badge number ASC
 */
export const sortOfficersConsistently = (officers: OfficerForSorting[]): OfficerForSorting[] => {
  // Separate officers into categories
  const lieutenantsAndChiefs: OfficerForSorting[] = [];
  const sergeants: OfficerForSorting[] = [];
  const regularOfficers: OfficerForSorting[] = [];
  const ppos: OfficerForSorting[] = [];

  officers.forEach(officer => {
    const rank = officer.rank?.toLowerCase() || '';
    
    if (rank.includes('probationary') || rank.includes('ppo')) {
      ppos.push(officer);
    } else if (rank.includes('lieutenant') || rank.includes('lt') || rank.includes('chief')) {
      lieutenantsAndChiefs.push(officer);
    } else if (rank.includes('sergeant') || rank.includes('sgt')) {
      sergeants.push(officer);
    } else {
      regularOfficers.push(officer);
    }
  });

  // Sort function for each category
  const sortCategory = (a: OfficerForSorting, b: OfficerForSorting): number => {
    // First by service credit (DESCENDING - highest first)
    const aCredit = getServiceCreditForSorting(a);
    const bCredit = getServiceCreditForSorting(b);
    if (bCredit !== aCredit) {
      return bCredit - aCredit;
    }
    
    // Then by badge number (ASCENDING - lower number = higher seniority)
    const aBadge = getBadgeNumberForSorting(a);
    const bBadge = getBadgeNumberForSorting(b);
    if (aBadge !== bBadge) {
      return aBadge - bBadge;
    }
    
    // Finally by last name (A-Z)
    const aLastName = getLastName(a.full_name || a.officerName || '');
    const bLastName = getLastName(b.full_name || b.officerName || '');
    return aLastName.localeCompare(bLastName);
  };

  // Sort each category
  lieutenantsAndChiefs.sort(sortCategory);
  sergeants.sort(sortCategory);
  regularOfficers.sort(sortCategory);
  ppos.sort(sortCategory);

  // Combine in correct order
  return [...lieutenantsAndChiefs, ...sergeants, ...regularOfficers, ...ppos];
};

/**
 * Sort officers for Force List (least service credit first, then force count)
 */
export const sortForForceList = (officers: OfficerForSorting[], getForceCount: (officerId: string) => number): OfficerForSorting[] => {
  // Categorize first
  const supervisors: OfficerForSorting[] = [];
  const regularOfficers: OfficerForSorting[] = [];
  const ppos: OfficerForSorting[] = [];

  officers.forEach(officer => {
    const rank = officer.rank?.toLowerCase() || '';
    
    if (rank.includes('probationary') || rank.includes('ppo')) {
      ppos.push(officer);
    } else if (rank.includes('sergeant') || rank.includes('sgt')) {
      supervisors.push(officer); // Force list only includes Sergeants as supervisors
    } else if (!rank.includes('lieutenant') && !rank.includes('lt') && !rank.includes('chief')) {
      regularOfficers.push(officer);
    }
  });

  // Sort function for Force List (LEAST service credit first)
  const sortForceList = (a: OfficerForSorting, b: OfficerForSorting): number => {
    // Primary: service credit (LEAST to most)
    const aCredit = getServiceCreditForSorting(a);
    const bCredit = getServiceCreditForSorting(b);
    if (aCredit !== bCredit) {
      return aCredit - bCredit;
    }
    
    // Secondary: force count (least to most)
    const aForceCount = getForceCount(a.id);
    const bForceCount = getForceCount(b.id);
    if (aForceCount !== bForceCount) {
      return aForceCount - bForceCount;
    }
    
    // Tertiary: last name (A-Z)
    const aLastName = getLastName(a.full_name || a.officerName || '');
    const bLastName = getLastName(b.full_name || b.officerName || '');
    return aLastName.localeCompare(bLastName);
  };

  supervisors.sort(sortForceList);
  regularOfficers.sort(sortForceList);
  ppos.sort(sortForceList);

  return [...supervisors, ...regularOfficers, ...ppos];
};
