// src/components/schedule/the-book/utils.ts
import { RANK_ORDER, PREDEFINED_POSITIONS } from "@/constants/positions";
import { getLastName as getLastNameFromUtils } from "@/utils/scheduleUtils";

// Re-export from scheduleUtils
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

export const categorizeAndSortOfficers = (officers: any[]) => {
  const supervisors = officers
    .filter(officer => 
      officer.shiftInfo?.position?.toLowerCase().includes('supervisor') ||
      officer.position?.toLowerCase().includes('supervisor') ||
      isSupervisorByRank(officer)
    );
  
  const ppos = officers.filter(officer => officer.rank?.toLowerCase() === 'probationary');
  
  const regularOfficers = officers.filter(officer => {
    const rank = officer.rank?.toLowerCase() || '';
    const position = officer.shiftInfo?.position?.toLowerCase() || '';
    const isSup = isSupervisorByRank(officer) || position.includes('supervisor');
    
    return !isSup && rank !== 'probationary';
  });

  return { supervisors, officers: regularOfficers, ppos };
};
