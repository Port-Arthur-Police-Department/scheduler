// src/components/schedule/the-book/utils.ts
import { RANK_ORDER, PREDEFINED_POSITIONS } from "@/constants/positions";
import { getLastName as getLastNameFromUtils } from "@/utils/sortingUtils"; // FIXED: Import from sortingUtils
import { isPPOByRank } from "@/utils/ppoUtils";
import { 
  sortOfficersConsistently, 
  getServiceCreditForSorting,
  type OfficerForSorting,
  isSupervisor as isSupervisorFromSortingUtils 
} from "@/utils/sortingUtils";

// Re-export from sortingUtils (not scheduleUtils)
export { getLastNameFromUtils as getLastName };

export const getRankAbbreviation = (rank: string): string => {
  if (!rank) return 'Ofc';
  
  const rankLower = rank.toLowerCase();
  if (rankLower.includes('sergeant') || rankLower.includes('sgt')) return 'Sgt';
  if (rankLower.includes('lieutenant') || rankLower.includes('lt')) return 'LT';
  if (rankLower.includes('deputy') || rankLower.includes('deputy chief')) return 'DC';
  if (rankLower.includes('chief') && !rankLower.includes('deputy')) return 'CHIEF';
  return 'Ofc';
};

export const getRankPriority = (rank: string): number => {
  if (!rank) return 99;
  
  const rankKey = Object.keys(RANK_ORDER).find(
    key => key.toLowerCase() === rank.toLowerCase()
  );
  
  return rankKey ? RANK_ORDER[rankKey as keyof typeof RANK_ORDER] : 99;
};

export const isSupervisorByRank = (officer: any): boolean => {
  const rank = officer.rank?.toLowerCase() || '';
  const rankPriority = getRankPriority(officer.rank);
  return rankPriority < RANK_ORDER.Officer;
};

// Alias to use the sorting utils version
export const isSupervisor = (officer: any): boolean => {
  return isSupervisorFromSortingUtils(officer);
};

// Use the centralized isPPOByRank from ppoUtils
export const isPPO = (officer: any): boolean => {
  const rank = officer.rank || officer.officer_rank || '';
  return isPPOByRank(rank);
};

// Add this helper function for OfficerForSorting objects
export const isOfficerForSortingPPO = (officer: OfficerForSorting): boolean => {
  const rank = officer.rank || '';
  return isPPOByRank(rank);
};

export const isSpecialAssignment = (position: string | undefined): boolean => {
  if (!position) return false;
  
  const positionLower = position.toLowerCase();
  return positionLower.includes('other') ||
         !PREDEFINED_POSITIONS.includes(position);
};

export const calculateStaffingCounts = (categorizedOfficers: any) => {
  if (!categorizedOfficers) return { supervisorCount: 0, officerCount: 0 };
  
  // Count supervisors EXCLUDING those on special assignments AND PTO
  const supervisorCount = categorizedOfficers.supervisors?.filter((officer: any) => {
    const position = officer.shiftInfo?.position;
    const hasPTO = officer.shiftInfo?.hasPTO;
    const isOff = officer.shiftInfo?.isOff;
    
    // Don't count if: on PTO, is off duty, or on special assignment
    return !hasPTO && !isOff && !isSpecialAssignment(position);
  }).length || 0;

  // Count officers EXCLUDING those on special assignments, PTO, and PPOs
  const officerCount = categorizedOfficers.officers?.filter((officer: any) => {
    const position = officer.shiftInfo?.position;
    const hasPTO = officer.shiftInfo?.hasPTO;
    const isOff = officer.shiftInfo?.isOff;
    const isPPO = officer.rank?.toLowerCase() === 'probationary';
    
    // Don't count if: on PTO, is off duty, on special assignment, or is PPO
    return !hasPTO && !isOff && !isSpecialAssignment(position) && !isPPO;
  }).length || 0;

  return { supervisorCount, officerCount };
};

// DEPRECATED: Use sortOfficersConsistently from sortingUtils.ts instead
// Keeping for backward compatibility but marking as deprecated
export const categorizeAndSortOfficers = (officers: any[]) => {
  console.warn('categorizeAndSortOfficers is deprecated. Use sortOfficersConsistently from sortingUtils.ts instead.');
  
  // Convert to OfficerForSorting format and use the centralized utility
  const officersForSorting: OfficerForSorting[] = officers.map(officer => ({
    id: officer.id || officer.officerId,
    full_name: officer.full_name || officer.officerName,
    officerName: officer.officerName || officer.full_name,
    badge_number: officer.badge_number || officer.badgeNumber,
    badgeNumber: officer.badgeNumber || officer.badge_number,
    rank: officer.rank,
    service_credit: officer.service_credit || officer.serviceCredit,
    serviceCredit: officer.serviceCredit || officer.service_credit,
    hire_date: officer.hire_date,
    service_credit_override: officer.service_credit_override || 0,
    promotion_date_sergeant: officer.promotion_date_sergeant,
    promotion_date_lieutenant: officer.promotion_date_lieutenant
  }));
  
  const sortedOfficers = sortOfficersConsistently(officersForSorting);
  
  // Map back and categorize - USE THE NEW HELPER FUNCTION
  const supervisors = sortedOfficers
    .filter(officer => isSupervisorFromSortingUtils(officer))
    .map(officer => {
      const originalOfficer = officers.find(o => 
        o.id === officer.id || o.officerId === officer.id
      );
      return originalOfficer ? { ...originalOfficer, service_credit: officer.service_credit } : null;
    })
    .filter(Boolean);
  
  const ppos = sortedOfficers
    .filter(officer => isOfficerForSortingPPO(officer)) // USE THE NEW HELPER
    .map(officer => {
      const originalOfficer = officers.find(o => 
        o.id === officer.id || o.officerId === officer.id
      );
      return originalOfficer ? { ...originalOfficer, service_credit: officer.service_credit } : null;
    })
    .filter(Boolean);
  
  const regularOfficers = sortedOfficers
    .filter(officer => 
      !isSupervisorFromSortingUtils(officer) && 
      !isOfficerForSortingPPO(officer) // USE THE NEW HELPER
    )
    .map(officer => {
      const originalOfficer = officers.find(o => 
        o.id === officer.id || o.officerId === officer.id
      );
      return originalOfficer ? { ...originalOfficer, service_credit: officer.service_credit } : null;
    })
    .filter(Boolean);

  return { supervisors, officers: regularOfficers, ppos };
};

// Helper to convert any officer object to OfficerForSorting format
export const toOfficerForSorting = (officer: any): OfficerForSorting => ({
  id: officer.id || officer.officerId || officer.profile?.id,
  full_name: officer.full_name || officer.officerName || officer.profile?.full_name,
  officerName: officer.officerName || officer.full_name || officer.profile?.full_name,
  badge_number: officer.badge_number || officer.badgeNumber || officer.profile?.badge_number,
  badgeNumber: officer.badgeNumber || officer.badge_number || officer.profile?.badge_number,
  rank: officer.rank || officer.profile?.rank,
  service_credit: officer.service_credit || officer.serviceCredit || officer.profile?.service_credit,
  serviceCredit: officer.serviceCredit || officer.service_credit || officer.profile?.service_credit,
  hire_date: officer.hire_date || officer.profile?.hire_date,
  service_credit_override: officer.service_credit_override || officer.profile?.service_credit_override || 0,
  promotion_date_sergeant: officer.promotion_date_sergeant || officer.profile?.promotion_date_sergeant,
  promotion_date_lieutenant: officer.promotion_date_lieutenant || officer.profile?.promotion_date_lieutenant
});

// New function: categorize sorted officers (use after sortOfficersConsistently)
export const categorizeSortedOfficers = (sortedOfficers: OfficerForSorting[]) => {
  const supervisors = sortedOfficers.filter(officer => isSupervisorFromSortingUtils(officer));
  const ppos = sortedOfficers.filter(officer => isOfficerForSortingPPO(officer)); // USE THE NEW HELPER
  const regularOfficers = sortedOfficers.filter(officer => 
    !isSupervisorFromSortingUtils(officer) && !isOfficerForSortingPPO(officer) // USE THE NEW HELPER
  );
  
  return { supervisors, regularOfficers, ppos };
};
