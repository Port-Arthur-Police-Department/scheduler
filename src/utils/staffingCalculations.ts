// src/utils/staffingCalculations.ts
import { isSupervisorByRank } from "@/components/schedule/the-book/utils";

/**
 * Calculate total staffing including ALL officers (regular + overtime)
 * This is the function that should be used for staffing requirement checks
 */
export const calculateTotalStaffing = (daySchedule: any) => {
  if (!daySchedule?.officers) return { supervisorCount: 0, officerCount: 0, ppoCount: 0 };
  
  let supervisorCount = 0;
  let officerCount = 0;
  let ppoCount = 0;
  
  daySchedule.officers.forEach((officer: any) => {
    // Check if officer is scheduled (not off and not on PTO)
    const isOff = officer.shiftInfo?.isOff === true;
    const hasFullDayPTO = officer.shiftInfo?.hasPTO === true;
    
    if (!isOff && !hasFullDayPTO) {
      const isSupervisor = isSupervisorByRank({ rank: officer.rank });
      const isPPO = officer.rank?.toLowerCase() === 'probationary';
      
      // KEY LOGIC: Check if supervisor is assigned to a district
      const position = officer.shiftInfo?.position || '';
      const isDistrictAssignment = position.toLowerCase().includes('district') || 
                                   position.toLowerCase().includes('beat') ||
                                   position.match(/^\d+/); // Starts with numbers (like "1A", "2B")
      
      // If supervisor is assigned to a district, count them as an officer
      if (isSupervisor && isDistrictAssignment) {
        officerCount++;
      } else if (isSupervisor) {
        supervisorCount++;
      } else if (isPPO) {
        ppoCount++;
      } else {
        officerCount++;
      }
    }
  });
  
  // Debug logging
  const overtimeCount = daySchedule.officers.filter((o: any) => 
    o.shiftInfo?.is_extra_shift === true && 
    !o.shiftInfo?.isOff && 
    !o.shiftInfo?.hasPTO
  ).length;
  
  console.log('📊 Total staffing calculation for', daySchedule.date, {
    supervisorCount,
    officerCount,
    ppoCount,
    totalOfficers: daySchedule.officers.length,
    overtimeOfficersCounted: overtimeCount
  });
  
  return { supervisorCount, officerCount, ppoCount };
};

/**
 * Calculate only regular staffing (excluding overtime)
 * Use this if you need to separate regular vs overtime for display purposes
 */
export const calculateRegularStaffing = (daySchedule: any) => {
  if (!daySchedule?.officers) return { supervisorCount: 0, officerCount: 0, ppoCount: 0 };
  
  let supervisorCount = 0;
  let officerCount = 0;
  let ppoCount = 0;
  
  daySchedule.officers.forEach((officer: any) => {
    // EXCLUDE overtime officers
    const isOvertime = officer.shiftInfo?.is_extra_shift === true;
    if (isOvertime) return;
    
    // Check if officer is scheduled (not off and not on PTO)
    const isOff = officer.shiftInfo?.isOff === true;
    const hasFullDayPTO = officer.shiftInfo?.hasPTO === true;
    
    if (!isOff && !hasFullDayPTO) {
      const isSupervisor = isSupervisorByRank({ rank: officer.rank });
      const isPPO = officer.rank?.toLowerCase() === 'probationary';
      
      const position = officer.shiftInfo?.position || '';
      const isDistrictAssignment = position.toLowerCase().includes('district') || 
                                   position.toLowerCase().includes('beat') ||
                                   position.match(/^\d+/);
      
      if (isSupervisor && isDistrictAssignment) {
        officerCount++;
      } else if (isSupervisor) {
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

/**
 * Calculate only overtime staffing
 */
export const calculateOvertimeStaffing = (daySchedule: any) => {
  if (!daySchedule?.officers) return { supervisorCount: 0, officerCount: 0, ppoCount: 0 };
  
  let supervisorCount = 0;
  let officerCount = 0;
  let ppoCount = 0;
  
  daySchedule.officers.forEach((officer: any) => {
    // INCLUDE only overtime officers
    const isOvertime = officer.shiftInfo?.is_extra_shift === true;
    if (!isOvertime) return;
    
    // Check if officer is scheduled (not off)
    const isOff = officer.shiftInfo?.isOff === true;
    const hasFullDayPTO = officer.shiftInfo?.hasPTO === true;
    
    if (!isOff && !hasFullDayPTO) {
      const isSupervisor = isSupervisorByRank({ rank: officer.rank });
      const isPPO = officer.rank?.toLowerCase() === 'probationary';
      
      const position = officer.shiftInfo?.position || '';
      const isDistrictAssignment = position.toLowerCase().includes('district') || 
                                   position.toLowerCase().includes('beat') ||
                                   position.match(/^\d+/);
      
      if (isSupervisor && isDistrictAssignment) {
        officerCount++;
      } else if (isSupervisor) {
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

/**
 * Alias for backward compatibility - now includes overtime officers
 */
export const calculateDailyStaffing = calculateTotalStaffing;

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

/**
 * Check if officer should be counted toward staffing (for display purposes)
 */
export const shouldCountForStaffing = (officer: any): boolean => {
  if (!officer) return false;
  
  const isOff = officer.shiftInfo?.isOff === true;
  const hasFullDayPTO = officer.shiftInfo?.hasPTO === true;
  
  // Count if officer is working (not off, not on PTO)
  return !isOff && !hasFullDayPTO;
};
