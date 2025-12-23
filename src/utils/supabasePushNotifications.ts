import { supabase } from "@/integrations/supabase/client";

// Request notification permission and subscribe
export const subscribeToPushNotifications = async (userId: string): Promise<boolean> => {
  try {
    // Check if notifications are supported
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return false;
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered');

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied:', permission);
      return false;
    }

    // Get VAPID public key from environment
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.error('VAPID public key not configured');
      return false;
    }

    // Get subscription
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    // Save subscription to Supabase
    const { error } = await supabase
      .from('user_push_subscriptions')
      .upsert({
        user_id: userId,
        subscription: JSON.stringify(subscription),
        enabled: true
      }, {
        onConflict: 'user_id,subscription'
      });

    if (error) {
      console.error('Error saving subscription:', error);
      return false;
    }

    console.log('Push notification subscription saved');
    return true;

  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    return false;
  }
};

// Unsubscribe from push notifications
export const unsubscribeFromPushNotifications = async (userId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('user_push_subscriptions')
      .update({ enabled: false })
      .eq('user_id', userId);

    if (error) {
      console.error('Error unsubscribing:', error);
      return;
    }

    // Also try to unsubscribe from browser
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
    }

    console.log('Unsubscribed from push notifications');

  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
  }
};

// Send push notification via Supabase Edge Function
export const sendPushNotification = async (
  userIds: string | string[],
  title: string,
  body: string,
  alertType: 'info' | 'warning' | 'critical' | 'emergency' = 'info',
  data?: Record<string, any>
): Promise<{ success: boolean; results?: any }> => {
  try {
    const userIdsArray = Array.isArray(userIds) ? userIds : [userIds];

    // Call Supabase Edge Function
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userIds: userIdsArray,
        title,
        body,
        alertType,
        data
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false };
  }
};

// Send to all users
export const sendPushNotificationToAll = async (
  title: string,
  body: string,
  alertType: 'info' | 'warning' | 'critical' | 'emergency' = 'info',
  data?: Record<string, any>
): Promise<{ success: boolean; results?: any }> => {
  try {
    // Get all users with push enabled
    const { data: users, error } = await supabase
      .from('user_push_subscriptions')
      .select('user_id')
      .eq('enabled', true);

    if (error) {
      console.error('Error fetching users:', error);
      return { success: false };
    }

    if (!users || users.length === 0) {
      console.log('No users with push notifications enabled');
      return { success: false, results: { total: 0, successful: 0, failed: 0 } };
    }

    const userIds = users.map(user => user.user_id);
    return await sendPushNotification(userIds, title, body, alertType, data);

  } catch (error) {
    console.error('Error sending to all:', error);
    return { success: false };
  }
};

// Send to role
export const sendPushNotificationToRole = async (
  role: 'officer' | 'supervisor' | 'admin',
  title: string,
  body: string,
  alertType: 'info' | 'warning' | 'critical' | 'emergency' = 'info',
  data?: Record<string, any>
): Promise<{ success: boolean; results?: any }> => {
  try {
    // Get user IDs with specific role
    const { data: userRoles, error } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', role);

    if (error) {
      console.error(`Error fetching ${role}s:`, error);
      return { success: false };
    }

    if (!userRoles || userRoles.length === 0) {
      console.log(`No ${role}s found`);
      return { success: false, results: { total: 0, successful: 0, failed: 0 } };
    }

    const userIds = userRoles.map(role => role.user_id);
    
    // Get only those with push enabled
    const { data: subscriptions } = await supabase
      .from('user_push_subscriptions')
      .select('user_id')
      .in('user_id', userIds)
      .eq('enabled', true);

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No ${role}s with push notifications enabled`);
      return { success: false, results: { total: 0, successful: 0, failed: 0 } };
    }

    const subscribedUserIds = subscriptions.map(sub => sub.user_id);
    return await sendPushNotification(subscribedUserIds, title, body, alertType, data);

  } catch (error) {
    console.error(`Error sending to ${role}s:`, error);
    return { success: false };
  }
};

// Utility function to convert VAPID key
const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
};
