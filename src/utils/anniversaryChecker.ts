import { supabase } from "@/integrations/supabase/client";
import { backgroundTaskManager } from "./backgroundTaskManager";

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
      
      // Send error notification to service worker if PWA
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        registration.active?.postMessage({
          type: 'ANNIVERSARY_CHECK_ERROR',
          error: error.message
        });
      }
    } else {
      console.log('✅ Anniversary check completed');
      
      // Send success notification
      if (settings?.enable_anniversary_alerts || settings?.enable_birthday_alerts) {
        await sendBackgroundNotification('Anniversary check complete', 'Daily anniversary check completed successfully');
      }
    }
  } catch (error) {
    console.error('Error in anniversary checker:', error);
  }
};

// Send background notification through service worker
const sendBackgroundNotification = async (title: string, body: string) => {
  try {
    // Use the background task manager if initialized
    if (backgroundTaskManager) {
      await backgroundTaskManager.sendPushNotification(title, body, {
        type: 'anniversary-check',
        url: '/dashboard'
      });
    } else {
      // Fallback to regular notification if service worker is active
      if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/badge-96.png',
          tag: 'anniversary-check',
          requireInteraction: false,
          silent: true
        });
      }
    }
  } catch (error) {
    console.error('Error sending background notification:', error);
  }
};

// Function to manually trigger a check
export const manuallyCheckAnniversaries = async () => {
  await checkAnniversariesAndBirthdays();
};

// Get upcoming anniversaries for display
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
