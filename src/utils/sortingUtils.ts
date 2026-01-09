// src/utils/sortingUtils.ts
// ... (all your other code above)

/**
 * Sort officers for Force List (least service credit first, then force count)
 */
export const sortForForceList = (officers: OfficerForSorting[], getForceCount: (officerId: string) => number): OfficerForSorting[] => {
  if (!officers || officers.length === 0) return [];
  
  console.log('=== Sorting for Force List ===');
  
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

  console.log('Force List Categories:', {
    supervisors: supervisors.length,
    regularOfficers: regularOfficers.length,
    ppos: ppos.length
  });

  // Sort function for Force List (LEAST service credit first)
  const sortForceList = (a: OfficerForSorting, b: OfficerForSorting): number => {
    // Primary: service credit (LEAST to most)
    const aCredit = getServiceCreditForSorting(a);
    const bCredit = getServiceCreditForSorting(b);
    if (aCredit !== bCredit) {
      console.log(`Force List - Comparing credits: ${a.full_name || a.officerName} (${aCredit}) vs ${b.full_name || b.officerName} (${bCredit}) -> ${aCredit - bCredit}`);
      return aCredit - bCredit;
    }
    
    // Secondary: force count (least to most)
    const aForceCount = getForceCount(a.id);
    const bForceCount = getForceCount(b.id);
    if (aForceCount !== bForceCount) {
      console.log(`Force List - Equal credits, comparing force count: ${aForceCount} vs ${bForceCount} -> ${aForceCount - bForceCount}`);
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

  console.log('=== Force List Sorting Complete ===');
  
  return [...supervisors, ...regularOfficers, ...ppos];
};

// Make sure you export it at the end
export { sortOfficersConsistently, sortForForceList };
