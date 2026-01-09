// Update src/utils/sortingUtils.ts with better error handling:

/**
 * Sort officers with consistent logic:
 * 1. Supervisors first (Lieutenants/Chiefs → Sergeants)
 * 2. Regular officers
 * 3. PPOs
 * Within each group: Sort by service credit DESC, then badge number ASC
 */
export const sortOfficersConsistently = (officers: OfficerForSorting[]): OfficerForSorting[] => {
  if (!officers || officers.length === 0) return [];
  
  // Debug: Log all officers with their data
  console.log('=== Sorting Officers ===');
  officers.forEach(officer => {
    console.log(`Officer: ${officer.full_name || officer.officerName}`, {
      rank: officer.rank,
      serviceCredit: getServiceCreditForSorting(officer),
      badgeNumber: getBadgeNumberForSorting(officer),
      rawData: officer
    });
  });
  
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

  console.log('Categories:', {
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
      console.log(`Comparing credits: ${a.full_name || a.officerName} (${aCredit}) vs ${b.full_name || b.officerName} (${bCredit}) -> ${bCredit - aCredit}`);
      return bCredit - aCredit;
    }
    
    // Then by badge number (ASCENDING - lower number = higher seniority)
    const aBadge = getBadgeNumberForSorting(a);
    const bBadge = getBadgeNumberForSorting(b);
    if (aBadge !== bBadge) {
      console.log(`Equal credits, comparing badges: ${aBadge} vs ${bBadge} -> ${aBadge - bBadge}`);
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
