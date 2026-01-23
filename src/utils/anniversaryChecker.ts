import { supabase } from "@/integrations/supabase/client";

export const checkAnniversariesAndBirthdays = async () => {
  try {
    console.log('🔔 Checking for anniversaries and birthdays...');
    
    const { data: settings, error: settingsError } = await supabase
      .from('website_settings')
      .select('enable_anniversary_alerts, enable_birthday_alerts, anniversary_alert_recipients')
      .single();
    
    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return;
    }
    
    // Call the database function
    const { error } = await supabase.rpc('check_anniversary_alerts');
    
    if (error) {
      console.error('Error checking anniversaries:', error);
    } else {
      console.log('✅ Anniversary check completed');
    }
  } catch (error) {
    console.error('Error in anniversary checker:', error);
  }
};

// Function to manually trigger a check (for testing)
export const manuallyCheckAnniversaries = async () => {
  await checkAnniversariesAndBirthdays();
};

// Function to get upcoming anniversaries for display
export const getUpcomingAnniversaries = async (daysAhead: number = 7) => {
  try {
    const { data, error } = await supabase.rpc('get_upcoming_anniversaries', {
      days_ahead: daysAhead
    });
    
    if (error) {
      console.error('Error getting upcoming anniversaries:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getUpcomingAnniversaries:', error);
    return [];
  }
};
