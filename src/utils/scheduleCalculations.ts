// utils/scheduleCalculations.ts
import { format, parseISO } from "date-fns";
import { PREDEFINED_POSITIONS, RANK_ORDER } from "@/constants/positions";
import { isPPOByRank } from "@/utils/ppoUtils";
import { supabase } from "@/integrations/supabase/client";

// Function to check if officer is a supervisor by rank
export const isSupervisorByRank = (rank: string | undefined | null): boolean => {
  if (!rank) return false;
  const rankLower = rank.toLowerCase();
  return (
    rankLower.includes('sergeant') ||
    rankLower.includes('lieutenant') ||
    rankLower.includes('captain') ||
    rankLower.includes('chief') ||
    rankLower.includes('commander') ||
    rankLower.includes('supervisor')
  );
};

// Function to check if position is "Riding with partner" or similar
export const isRidingWithPartnerPosition = (position: string | undefined | null): boolean => {
  if (!position) return false;
  const positionLower = position.toLowerCase();
  return (
    positionLower.includes('riding with') ||
    positionLower.includes('riding partner') ||
    positionLower.includes('emergency partner') ||
    positionLower === 'other'
  );
};

// Function to check if position is special assignment
export const isSpecialAssignmentPosition = (position: string | undefined | null): boolean => {
  if (!position) return false;
  
  // Check if it's a riding with partner position first
  if (isRidingWithPartnerPosition(position)) return false;
  
  const positionLower = position.toLowerCase();
  return (
    positionLower.includes('other') ||
    !PREDEFINED_POSITIONS.includes(position)
  );
};

// Function to calculate staffing counts for a specific shift and date
export const calculateShiftStaffing = async (
  selectedDate: Date,
  shiftId: string,
  filterShiftId: string = "all"
) => {
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const dayOfWeek = selectedDate.getDay();

  // Get all necessary data similar to DailyScheduleView
  const [
    { data: shiftTypes },
    { data: minimumStaffing },
    { data: allDefaultAssignments },
    { data: recurringData },
    { data: exceptionsData }
  ] = await Promise.all([
    supabase.from("shift_types").select("*").eq("id", shiftId).single(),
    supabase
      .from("minimum_staffing")
      .select("minimum_officers, minimum_supervisors, shift_type_id")
      .eq("day_of_week", dayOfWeek)
      .eq("shift_type_id", shiftId),
    supabase
      .from("officer_default_assignments")
      .select("*")
      .or(`end_date.is.null,end_date.gte.${dateStr}`)
      .lte("start_date", dateStr),
    supabase
      .from("recurring_schedules")
      .select(`
        *,
        profiles:profiles!recurring_schedules_officer_id_fkey (
          id, 
          full_name, 
          badge_number, 
          rank
        ),
        shift_types (
          id, 
          name, 
          start_time, 
          end_time
        )
      `)
      .eq("day_of_week", dayOfWeek)
      .eq("shift_type_id", shiftId)
      .lte("start_date", dateStr)
      .or(`end_date.is.null,end_date.gte.${dateStr}`),
    supabase
      .from("schedule_exceptions")
      .select("*")
      .eq("date", dateStr)
      .eq("shift_type_id", shiftId)
  ]);

  // Get officer profiles
  const officerIds = [...new Set([
    ...(recurringData?.map(r => r.officer_id) || []),
    ...(exceptionsData?.map(e => e.officer_id) || [])
  ])].filter(Boolean);

  let officerProfiles = [];
  if (officerIds.length > 0) {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, badge_number, rank")
      .in("id", officerIds);
    officerProfiles = profilesData || [];
  }

  // Create profile map
  const profilesMap = new Map();
  officerProfiles.forEach(p => profilesMap.set(p.id, p));

  // Helper to get default assignment
  const getDefaultAssignment = (officerId: string) => {
    if (!allDefaultAssignments) return null;
    
    const currentDate = parseISO(dateStr);
    
    return allDefaultAssignments.find(da => 
      da.officer_id === officerId &&
      parseISO(da.start_date) <= currentDate &&
      (!da.end_date || parseISO(da.end_date) >= currentDate)
    );
  };

  // Process officers like DailyScheduleView
  const allOfficers = [];

  // Process recurring officers
  recurringData?.forEach(r => {
    const currentDate = parseISO(dateStr);
    const scheduleStartDate = parseISO(r.start_date);
    const scheduleEndDate = r.end_date ? parseISO(r.end_date) : null;
    
    // Validate date range
    if (currentDate < scheduleStartDate || (scheduleEndDate && currentDate > scheduleEndDate)) {
      return;
    }

    const profile = profilesMap.get(r.officer_id);
    const defaultAssignment = getDefaultAssignment(r.officer_id);
    const ptoException = exceptionsData?.find(e => 
      e.officer_id === r.officer_id && e.is_off
    );
    const workingException = exceptionsData?.find(e => 
      e.officer_id === r.officer_id && !e.is_off
    );

    const officerRank = workingException?.rank || profile?.rank || r.profiles?.rank;
    const isProbationary = isPPOByRank(officerRank);

    // Skip if on full day PTO
    if (ptoException && !ptoException.custom_start_time && !ptoException.custom_end_time) {
      return;
    }

    const officerData = {
      officerId: r.officer_id,
      name: profile?.full_name || r.profiles?.full_name || "Unknown",
      rank: officerRank,
      position: workingException?.position_name || 
               r.position_name || 
               defaultAssignment?.position_name || 
               "Officer",
      unitNumber: workingException?.unit_number || 
                  r.unit_number || 
                  defaultAssignment?.unit_number,
      isSupervisor: isSupervisorByRank(officerRank),
      isPPO: isProbationary,
      isSpecialAssignment: false,
      hasPTO: !!ptoException,
      isWorking: !ptoException || (ptoException.custom_start_time && ptoException.custom_end_time),
      scheduleType: workingException ? 'exception' : 'recurring'
    };

    // Check if special assignment
    officerData.isSpecialAssignment = isSpecialAssignmentPosition(officerData.position) && 
                                     !isRidingWithPartnerPosition(officerData.position);

    allOfficers.push(officerData);
  });

  // Process working exceptions (overtime, extra shifts)
  exceptionsData
    ?.filter(e => !e.is_off)
    .forEach(e => {
      // Skip if already processed as recurring
      if (allOfficers.some(o => o.officerId === e.officer_id)) {
        return;
      }

      const profile = profilesMap.get(e.officer_id);
      const defaultAssignment = getDefaultAssignment(e.officer_id);
      const officerRank = profile?.rank || e.rank;
      const isProbationary = isPPOByRank(officerRank);

      const officerData = {
        officerId: e.officer_id,
        name: profile?.full_name || "Unknown",
        rank: officerRank,
        position: e.position_name || 
                 defaultAssignment?.position_name || 
                 "Officer",
        unitNumber: e.unit_number || defaultAssignment?.unit_number,
        isSupervisor: isSupervisorByRank(officerRank),
        isPPO: isProbationary,
        isSpecialAssignment: false,
        hasPTO: false,
        isWorking: true,
        scheduleType: 'exception',
        isExtraShift: e.is_extra_shift || false
      };

      // Check if special assignment
      officerData.isSpecialAssignment = isSpecialAssignmentPosition(officerData.position) && 
                                       !isRidingWithPartnerPosition(officerData.position);

      allOfficers.push(officerData);
    });

  // Calculate counts like DailyScheduleView
  const supervisors = allOfficers.filter(o => 
    o.isSupervisor && 
    o.isWorking && 
    !o.isSpecialAssignment
  );

  const regularOfficers = allOfficers.filter(o => 
    !o.isSupervisor && 
    !o.isPPO && 
    o.isWorking && 
    !o.isSpecialAssignment
  );

  const ppos = allOfficers.filter(o => 
    !o.isSupervisor && 
    o.isPPO && 
    o.isWorking && 
    !o.isSpecialAssignment
  );

  const specialAssignments = allOfficers.filter(o => 
    o.isSpecialAssignment && 
    o.isWorking
  );

  const ptoOfficers = allOfficers.filter(o => 
    o.hasPTO && 
    !o.isWorking
  );

  // Get minimum staffing
  const minStaff = minimumStaffing?.[0] || { minimum_supervisors: 0, minimum_officers: 0 };
  
  const currentSupervisors = supervisors.length;
  const currentOfficers = regularOfficers.length;
  const minSupervisors = minStaff.minimum_supervisors || 0;
  const minOfficers = minStaff.minimum_officers || 0;

  return {
    date: dateStr,
    shiftId,
    shiftName: shiftTypes?.name || "Unknown Shift",
    currentSupervisors,
    currentOfficers,
    minSupervisors,
    minOfficers,
    supervisors,
    officers: regularOfficers,
    ppos,
    specialAssignments,
    ptoOfficers,
    isUnderstaffed: {
      supervisors: currentSupervisors < minSupervisors,
      officers: currentOfficers < minOfficers
    }
  };
};

// Function to calculate weekly staffing summary
export const calculateWeeklyStaffing = async (
  weekStart: Date,
  shiftId: string
) => {
  const days = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    
    const staffing = await calculateShiftStaffing(date, shiftId);
    days.push(staffing);
  }
  
  return days;
};

// Function to calculate monthly staffing summary
export const calculateMonthlyStaffing = async (
  monthStart: Date,
  shiftId: string
) => {
  const days = [];
  const currentDate = new Date(monthStart);
  
  // Get last day of month
  const lastDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  
  while (currentDate <= lastDay) {
    const staffing = await calculateShiftStaffing(new Date(currentDate), shiftId);
    days.push(staffing);
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return days;
};
