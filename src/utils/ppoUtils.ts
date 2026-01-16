// In src/utils/ppoUtils.ts
export const isPPOByRank = (rank: any): boolean => {
  if (!rank) return false;
  
  // Convert to string if it's an enum/object
  const rankString = typeof rank === 'string' ? rank : rank?.toString?.() || '';
  const rankLower = rankString.toLowerCase().trim();
  
  return (
    rankLower === 'probationary' ||
    rankLower.includes('probationary') ||
    rankLower.includes('ppo') ||
    rankLower === 'ppo'
  );
};
