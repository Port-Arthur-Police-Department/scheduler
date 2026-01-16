// src/utils/sortingUtils.ts

// Helper function to extract last name
const getLastName = (fullName: string = ""): string => {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] || "";
};

// In src/utils/sortingUtils.ts, update the calculateServiceCredit function:

const calculateServiceCredit = (
  hireDate: string | null,
  override: number = 0,
  promotionDateSergeant: string | null = null,
  promotionDateLieutenant: string | null = null,
  currentRank: string | null = null
): number => {
  console.log('calculateServiceCredit called with:', { 
    hireDate, 
    override, 
    hasOverride: override !== undefined && override !== null && override > 0,
    promotionDateSergeant, 
    promotionDateLieutenant, 
    currentRank 
  });
  
  // If there's an override and it's greater than 0, use it
  if (override !== undefined && override !== null && override > 0) {
    console.log(`Using override: ${override} (instead of calculating)`);
    return override;
  }
  
  console.log('No override or override is 0, calculating from dates...');
  
  // Determine which date to use based on rank and promotion dates
  let relevantDate: Date | null = null;
  
  if (currentRank) {
    const rankLower = currentRank.toLowerCase();
    
    // Check if officer is a supervisor rank
    if ((rankLower.includes('sergeant') || rankLower.includes('sgt')) && promotionDateSergeant) {
      relevantDate = new Date(promotionDateSergeant);
    } else if ((rankLower.includes('lieutenant') || rankLower.includes('lt')) && promotionDateLieutenant) {
      relevantDate = new Date(promotionDateLieutenant);
    } else if (rankLower.includes('chief') && promotionDateLieutenant) {
      // Chiefs usually come from Lieutenant rank
      relevantDate = new Date(promotionDateLieutenant);
    }
  }
  
  // If no relevant promotion date found, use hire date
  if (!relevantDate && hireDate) {
    relevantDate = new Date(hireDate);
  }
  
  if (!relevantDate) {
    console.log('No relevant date found, returning 0');
    return 0;
  }
  
  try {
    const now = new Date();
    const years = now.getFullYear() - relevantDate.getFullYear();
    const months = now.getMonth() - relevantDate.getMonth();
    const days = now.getDate() - relevantDate.getDate();
    
    // Calculate decimal years
    const totalYears = years + (months / 12) + (days / 365);
    
    // Round to 1 decimal place
    const result = Math.max(0, Math.round(totalYears * 10) / 10);
    console.log(`Calculated service credit: ${result} from date: ${relevantDate.toISOString().split('T')[0]}`);
    return result;
  } catch (error) {
    console.error('Error calculating service credit:', error);
    return 0;
  }
};

export interface OfficerForSorting {
  id: string;
  full_name?: string;
  officerName?: string;
  badge_number?: string;
  badgeNumber?: string;
  rank?: string;
  service_credit?: number;
  serviceCredit?: number;
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
 * Uses existing value if available, otherwise calculates it
 */
export const getServiceCreditForSorting = (officer: OfficerForSorting): number => {
  console.log('getServiceCreditForSorting called for:', {
    name: officer.full_name || officer.officerName,
    existingServiceCredit: officer.service_credit,
    existingServiceCreditAlt: officer.serviceCredit,
    override: officer.service_credit_override,
    hasOverride: officer.service_credit_override !== undefined && officer.service_credit_override !== null && officer.service_credit_override > 0
  });
  
  // First check if service_credit or serviceCredit is already provided
  if (officer.service_credit !== undefined) {
    console.log(`Using existing service_credit: ${officer.service_credit}`);
    return officer.service_credit;
  }
  if (officer.serviceCredit !== undefined) {
    console.log(`Using existing serviceCredit: ${officer.serviceCredit}`);
    return officer.serviceCredit;
  }
  
  // If not provided, calculate it using the available data
  const calculated = calculateServiceCredit(
    officer.hire_date || null,
    officer.service_credit_override || 0,
    officer.promotion_date_sergeant || null,
    officer.promotion_date_lieutenant || null,
    officer.rank || null
  );
  
  console.log(`Final calculated service credit: ${calculated} for ${officer.full_name || officer.officerName}`);
  return calculated;
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

// Add to src/utils/sortingUtils.ts

/**
 * Comprehensive PPO detection function
 * Use this consistently across the entire application
 */
export const isPPOByRank = (rank: string | undefined | null): boolean => {
  if (!rank) return false;
  
  const rankLower = rank.toLowerCase().trim();
  
  // Comprehensive PPO matching patterns
  return (
    rankLower === 'probationary' ||
    rankLower.includes('probationary') ||
    rankLower.includes('ppo') ||
    rankLower.includes('probation') ||
    rankLower === 'ppo' ||
    rankLower.includes('probationary officer') ||
    rankLower.includes('probationary peace officer') ||
    rankLower.includes('probationary police officer') ||
    rankLower.includes('probationary patrol officer')
  );
};

/**
 * Get officer type with consistent logic
 */
export const getOfficerType = (officer: any): 'ppo' | 'regular' | 'supervisor' => {
  const rank = officer?.rank || '';
  const position = officer?.position?.toLowerCase() || '';
  
  if (isPPOByRank(rank)) return 'ppo';
  
  // Use existing isSupervisor function
  if (isSupervisor(officer)) return 'supervisor';
  
  return 'regular';
};

/**
 * Sort officers with consistent logic:
 * 1. Supervisors first (Lieutenants/Chiefs → Sergeants)
 * 2. Regular officers
 * 3. PPOs
 * Within each group: Sort by service credit DESC, then badge number ASC, then last name A-Z
 */
export const sortOfficersConsistently = (officers: OfficerForSorting[]): OfficerForSorting[] => {
  if (!officers || officers.length === 0) return [];
  
  // Debug logging (remove in production)
  console.log('=== Sorting Officers Consistently ===');
  console.log('Total officers to sort:', officers.length);
  
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

  console.log('Categories found:', {
    lieutenantsAndChiefs: lieutenantsAndChiefs.length,
    sergeants: sergeants.length,
    regularOfficers: regularOfficers.length,
    ppos: ppos.length
  });

  // Sort function for each category
  const sortCategory = (a: OfficerForSorting, b: OfficerForSorting): number => {
    // First by service credit (DESCENDING - highest first)
    const aCredit = getServiceCreditForSorting(a);
    const bCredit = getServiceCreditForSorting(b);
    
    if (bCredit !== aCredit) {
      console.log(`Service credit sort: ${a.full_name || a.officerName} (${aCredit}) vs ${b.full_name || b.officerName} (${bCredit}) -> ${bCredit - aCredit}`);
      return bCredit - aCredit;
    }
    
    // Then by badge number (ASCENDING - lower number = higher seniority)
    const aBadge = getBadgeNumberForSorting(a);
    const bBadge = getBadgeNumberForSorting(b);
    if (aBadge !== bBadge) {
      console.log(`Badge sort (equal credits): ${a.full_name || a.officerName} (${aBadge}) vs ${b.full_name || b.officerName} (${bBadge}) -> ${aBadge - bBadge}`);
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

  console.log('=== Sorting Complete ===');
  
  // Combine in correct order
  return [...lieutenantsAndChiefs, ...sergeants, ...regularOfficers, ...ppos];
};

/**
 * Sort officers for Force List (least service credit first, then force count)
 * Force List only includes Sergeants as supervisors, not Lieutenants/Chiefs
 */
export const sortForForceList = (officers: OfficerForSorting[], getForceCount: (officerId: string) => number): OfficerForSorting[] => {
  if (!officers || officers.length === 0) return [];
  
  // Categorize first
  const supervisors: OfficerForSorting[] = []; // Only Sergeants
  const regularOfficers: OfficerForSorting[] = [];
  const ppos: OfficerForSorting[] = [];

  officers.forEach(officer => {
    const rank = officer.rank?.toLowerCase() || '';
    
    if (rank.includes('probationary') || rank.includes('ppo')) {
      ppos.push(officer);
    } else if (rank.includes('sergeant') || rank.includes('sgt')) {
      supervisors.push(officer); // Force list only includes Sergeants as supervisors
    } else if (!rank.includes('lieutenant') && !rank.includes('lt') && !rank.includes('chief')) {
      // Exclude Lieutenants, Chiefs, etc.
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
