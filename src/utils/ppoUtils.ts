export const isPPOByRank = (rank: any): boolean => {
  if (!rank) return false;
  
  // Convert to string if it's an enum
  const rankString = typeof rank === 'string' ? rank : rank?.toString() || '';
  
  // Clean up the string for comparison
  const rankLower = rankString.toLowerCase().trim();
  
  // Comprehensive PPO detection
  return (
    rankLower === 'probationary' ||
    rankLower.includes('probationary') ||
    rankLower.includes('ppo') ||
    rankLower === 'ppo' ||
    rankLower.includes('probation') ||
    rankLower.includes('probationary officer') ||
    rankLower.includes('probationary peace officer')
  );
};
