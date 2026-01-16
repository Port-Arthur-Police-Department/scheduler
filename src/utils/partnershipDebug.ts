// src/utils/partnershipDebug.ts
export const debugPartnershipIssues = async (dateStr: string, shiftId: string) => {
  const { supabase } = require("@/integrations/supabase/client");
  
  console.log("🔍 PARTNERSHIP DEBUG REPORT");
  console.log("==========================");
  
  // 1. Check all partnerships in recurring_schedules
  const { data: recurringPartnerships } = await supabase
    .from("recurring_schedules")
    .select(`
      id,
      officer_id,
      partner_officer_id,
      is_partnership,
      day_of_week,
      start_date,
      end_date,
      officer:profiles!recurring_schedules_officer_id_fkey (
        id,
        full_name,
        rank
      ),
      partner:profiles!recurring_schedules_partner_officer_id_fkey (
        id,
        full_name,
        rank
      )
    `)
    .eq("is_partnership", true);

  console.log("📋 Recurring Partnerships:", recurringPartnerships?.map(p => ({
    officer: p.officer?.full_name,
    partner: p.partner?.full_name,
    officerPPO: isPPOByRank(p.officer?.rank),
    partnerPPO: isPPOByRank(p.partner?.rank),
    dayOfWeek: p.day_of_week,
    active: new Date(dateStr) >= new Date(p.start_date) && 
           (!p.end_date || new Date(dateStr) <= new Date(p.end_date))
  })));

  // 2. Check all partnerships in schedule_exceptions for the date
  const { data: exceptionPartnerships } = await supabase
    .from("schedule_exceptions")
    .select(`
      id,
      officer_id,
      partner_officer_id,
      is_partnership,
      partnership_suspended,
      officer:profiles!schedule_exceptions_officer_id_fkey (
        id,
        full_name,
        rank
      ),
      partner:profiles!schedule_exceptions_partner_officer_id_fkey (
        id,
        full_name,
        rank
      )
    `)
    .eq("date", dateStr)
    .eq("is_partnership", true);

  console.log("📋 Exception Partnerships for", dateStr, ":", 
    exceptionPartnerships?.map(p => ({
      officer: p.officer?.full_name,
      partner: p.partner?.full_name,
      suspended: p.partnership_suspended
    })));

  // 3. Check all PPOs scheduled for the shift
  const dayOfWeek = new Date(dateStr).getDay();
  const { data: allScheduledPPOs } = await supabase
    .from("recurring_schedules")
    .select(`
      officer_id,
      profiles:profiles!recurring_schedules_officer_id_fkey (
        id,
        full_name,
        rank
      )
    `)
    .eq("shift_type_id", shiftId)
    .eq("day_of_week", dayOfWeek)
    .lte("start_date", dateStr)
    .or(`end_date.is.null,end_date.gte.${dateStr}`);

  const ppos = allScheduledPPOs?.filter(p => isPPOByRank(p.profiles?.rank));
  
  console.log("📋 All PPOs scheduled for shift:", 
    ppos?.map(p => p.profiles?.full_name));

  return {
    recurringPartnerships,
    exceptionPartnerships,
    scheduledPPOs: ppos
  };
};
