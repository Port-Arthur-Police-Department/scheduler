// src/utils/ppoUtils.ts
export const isPPOByRank = (rank: string | undefined | null): boolean => {
  if (!rank) return false;
  
  const rankLower = rank.toLowerCase().trim();
  
  return (
    rankLower === 'probationary' ||
    rankLower.includes('probationary') ||
    rankLower.includes('ppo') ||
    rankLower.includes('probation') ||
    rankLower === 'ppo' ||
    rankLower.includes('probationary officer') ||
    rankLower.includes('probationary peace officer') ||
    rankLower.includes('probationary police officer')
  );
};

export const isPPOFromOfficer = (officer: any): boolean => {
  const rank = officer?.rank || officer?.officer_rank || '';
  return isPPOByRank(rank);
};
