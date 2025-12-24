// src/lib/notifications.ts
import { supabase } from '@/integrations/supabase/client';

// Types for notifications
export interface NotificationPayload {
  title: string;
  message: string;
  url?: string;
  data?: Record<string, any>;
}

// Send notification to a specific officer
export async function sendNotificationToOfficer(
  officerId: string, 
  payload: NotificationPayload
) {
  try {
    // Get officer's OneSignal user ID
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('onesignal_user_id')
      .eq('id', officerId)
      .single();

    if (error) {
      console.error('Error fetching officer profile:', error);
      return { success: false, error: 'Officer not found' };
    }

    if (!profile?.onesignal_user_id) {
      return { success: false, error: 'Officer not subscribed to notifications' };
    }

    // Send via OneSignal API
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${import.meta.env.VITE_ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify({
        app_id: import.meta.env.VITE_ONESIGNAL_APP_ID || "3417d840-c226-40ba-92d6-a7590c31eef3",
        include_player_ids: [profile.onesignal_user_id],
        headings: { en: payload.title },
        contents: { en: payload.message },
        url: payload.url,
        data: payload.data,
        android_channel_id: "shift-notifications",
        ios_category: "SHIFT_UPDATES"
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Notification sent successfully:', result);
      return { success: true, data: result };
    } else {
      console.error('❌ Error sending notification:', result);
      return { success: false, error: result.errors };
    }
  } catch (error) {
    console.error('Error in sendNotificationToOfficer:', error);
    return { success: false, error };
  }
}

// Send notification to multiple officers
export async function sendNotificationToOfficers(
  officerIds: string[], 
  payload: NotificationPayload
) {
  try {
    // Get OneSignal user IDs for all officers
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('onesignal_user_id')
      .in('id', officerIds)
      .not('onesignal_user_id', 'is', null);

    if (error) {
      console.error('Error fetching officer profiles:', error);
      return { success: false, error: 'Error fetching profiles' };
    }

    const playerIds = profiles
      .map(profile => profile.onesignal_user_id)
      .filter(Boolean);

    if (playerIds.length === 0) {
      return { success: false, error: 'No subscribed officers found' };
    }

    // Send via OneSignal API
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${import.meta.env.VITE_ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify({
        app_id: import.meta.env.VITE_ONESIGNAL_APP_ID || "3417d840-c226-40ba-92d6-a7590c31eef3",
        include_player_ids: playerIds,
        headings: { en: payload.title },
        contents: { en: payload.message },
        url: payload.url,
        data: payload.data,
        android_channel_id: "shift-notifications",
        ios_category: "SHIFT_UPDATES"
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ Notification sent to ${playerIds.length} officers:`, result);
      return { success: true, data: result };
    } else {
      console.error('❌ Error sending notification:', result);
      return { success: false, error: result.errors };
    }
  } catch (error) {
    console.error('Error in sendNotificationToOfficers:', error);
    return { success: false, error };
  }
}

// Send notification to all subscribed officers
export async function sendNotificationToAllSubscribed(payload: NotificationPayload) {
  try {
    // Send via OneSignal segments API (uses OneSignal dashboard segments)
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${import.meta.env.VITE_ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify({
        app_id: import.meta.env.VITE_ONESIGNAL_APP_ID || "3417d840-c226-40ba-92d6-a7590c31eef3",
        included_segments: ["Subscribed Users"],
        headings: { en: payload.title },
        contents: { en: payload.message },
        url: payload.url,
        data: payload.data,
        android_channel_id: "shift-notifications",
        ios_category: "SHIFT_UPDATES"
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Notification sent to all subscribed officers:', result);
      return { success: true, data: result };
    } else {
      console.error('❌ Error sending notification:', result);
      return { success: false, error: result.errors };
    }
  } catch (error) {
    console.error('Error in sendNotificationToAllSubscribed:', error);
    return { success: false, error };
  }
}

// Example usage functions
export async function sendShiftChangeNotification(
  officerId: string,
  oldShift: string,
  newShift: string,
  effectiveDate: string
) {
  return sendNotificationToOfficer(officerId, {
    title: 'Shift Change Notification',
    message: `Your shift has been changed from ${oldShift} to ${newShift} effective ${effectiveDate}`,
    data: {
      type: 'SHIFT_CHANGE',
      oldShift,
      newShift,
      effectiveDate
    }
  });
}

export async function sendEmergencyNotification(message: string) {
  return sendNotificationToAllSubscribed({
    title: '🚨 EMERGENCY ALERT',
    message: message,
    data: {
      type: 'EMERGENCY',
      priority: 'HIGH'
    }
  });
}
