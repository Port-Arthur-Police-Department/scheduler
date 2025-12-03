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
  
  return position.toLowerCase().includes('other') ||
         !PREDEFINED_POSITIONS.includes(position);
};

export const calculateStaffingCounts = (categorizedOfficers: any) => {
  const supervisorCount = categorizedOfficers.supervisors?.filter(
    (officer: any) => !officer.shiftInfo?.hasPTO
  ).length || 0;

  const officerCount = categorizedOfficers.officers?.filter((officer: any) => {
    const position = officer.shiftInfo?.position;
    return !officer.shiftInfo?.hasPTO && !isSpecialAssignment(position);
  }).length || 0;

  return { supervisorCount, officerCount };
};
