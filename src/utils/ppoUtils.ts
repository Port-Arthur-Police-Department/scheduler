export const isPPOByRank = (rank: any): boolean => {
  if (!rank) return false;
  
  // Convert to string if it's an enum
  const rankString = typeof rank === 'string' ? rank : rank?.toString() || '';
  
  // Since it's an enum, we can do exact comparison
  return rankString === 'Probationary';
};
