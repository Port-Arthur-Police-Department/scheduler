// utils/anniversaryNotifications.ts
import { supabase } from "@/integrations/supabase/client";
import { addDays, isWithinInterval, parseISO } from "date-fns";

export const checkAnniversaryNotifications = async (settings: any) => {
  if (!settings?.anniversary_enable_notifications) return;

  const today = new Date();
  const notifyDate = addDays(today, settings.anniversary_notify_days_before || 7);
  
  // Get officers with upcoming anniversaries
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, hire_date, email')
    .eq('active', true)
    .not('hire_date', 'is', null);

  if (!profiles) return;

  for (const profile of profiles) {
    if (!profile.hire_date) continue;
    
    const hireDate = parseISO(profile.hire_date);
    const thisYearAnniversary = new Date(today.getFullYear(), hireDate.getMonth(), hireDate.getDate());
    
    // Check if anniversary is within notification window
    if (isWithinInterval(thisYearAnniversary, { start: today, end: notifyDate })) {
      // Create notification
      await supabase.from('notifications').insert({
        user_id: profile.id,
        title: 'Upcoming Service Anniversary',
        message: `Your ${new Date().getFullYear() - hireDate.getFullYear()} year service anniversary is coming up soon!`,
        type: 'anniversary'
      });
    }
  }
};
