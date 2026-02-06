// src/utils/staffingCalculations.ts

// Helper function to check if an officer is a supervisor based on rank
export const isSupervisorByRank = (rank: string | undefined): boolean => {
  if (!rank) return false;
  
  const rankLower = rank.toLowerCase();
  return (
    rankLower.includes('lieutenant') ||
    rankLower.includes('sergeant') ||
    rankLower.includes('sgt') ||
    rankLower.includes('chief') ||
    rankLower.includes('captain') ||
    rankLower.includes('supervisor')
  );
};

export const calculateDailyStaffing = (daySchedule: any) => {
  if (!daySchedule?.officers) return { supervisorCount: 0, officerCount: 0, ppoCount: 0 };
  
  let supervisorCount = 0;
  let officerCount = 0;
  let ppoCount = 0;
  
  daySchedule.officers.forEach((officer: any) => {
    // Skip overtime officers in regular counts
    const isOvertime = officer.shiftInfo?.is_extra_shift === true;
    if (isOvertime) return;
    
    // Check if officer is scheduled (not off and not on PTO)
    const isOff = officer.shiftInfo?.isOff === true;
    const hasFullDayPTO = officer.shiftInfo?.hasPTO === true;
    
    if (!isOff && !hasFullDayPTO) {
      const isSupervisor = isSupervisorByRank(officer.rank);
      const isPPO = officer.rank?.toLowerCase() === 'probationary';
      
      if (isSupervisor) {
        supervisorCount++;
      } else if (isPPO) {
        ppoCount++;
      } else {
        officerCount++;
      }
    }
  });
  
  return { supervisorCount, officerCount, ppoCount };
};

export const getStaffingMinimums = (minimumStaffing: any, dayOfWeek: number, shiftTypeId: string) => {
  if (!minimumStaffing) {
    return { minimumOfficers: 0, minimumSupervisors: 0 };
  }
  
  // Handle Map structure
  if (minimumStaffing instanceof Map) {
    const dayStaffing = minimumStaffing.get(dayOfWeek);
    if (dayStaffing instanceof Map) {
      const shiftStaffing = dayStaffing.get(shiftTypeId);
      return shiftStaffing || { minimumOfficers: 0, minimumSupervisors: 0 };
    }
  }
  
  // Handle object structure (fallback)
  const dayStaffing = minimumStaffing[dayOfWeek];
  if (dayStaffing && typeof dayStaffing === 'object') {
    const shiftStaffing = dayStaffing[shiftTypeId];
    return shiftStaffing || { minimumOfficers: 0, minimumSupervisors: 0 };
  }
  
  return { minimumOfficers: 0, minimumSupervisors: 0 };
};
