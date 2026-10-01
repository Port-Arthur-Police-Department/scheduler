import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Convert base64 VAPID key to Uint8Array for push subscription
 */
export const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
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

/**
 * Register for push notifications and save subscription to database
 */
export const registerForPushNotifications = async (
  userId: string,
  swRegistration: ServiceWorkerRegistration
): Promise<boolean> => {
  try {
    console.log('🔔 Registering for push notifications...');

    // Check if push is supported
    if (!('pushManager' in swRegistration)) {
      console.warn('⚠️ Push notifications not supported');
      return false;
    }

    // Get VAPID public key from environment
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

    if (!vapidPublicKey) {
      console.warn('⚠️ VAPID public key not configured - check .env.local');
      return false;
    }

    console.log('✅ VAPID key found, proceeding with subscription...');

    try {
      // Check if already subscribed
      const existingSubscription = await swRegistration.pushManager.getSubscription();

      if (existingSubscription) {
        console.log('✅ Already subscribed to push notifications');

        // Save to database if not already there
        await savePushSubscriptionToDb(userId, existingSubscription);
        return true;
      }

      // Subscribe to push notifications
      const subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      console.log('✅ Push subscription created:', subscription);

      // Save to database
      await savePushSubscriptionToDb(userId, subscription);

      return true;
    } catch (subscriptionError) {
      console.error('❌ Push subscription failed:', subscriptionError);
      return false;
    }

  } catch (error) {
    console.error('❌ Error registering for push:', error);
    return false;
  }
};

/**
 * Save push subscription to Supabase database
 */
export const savePushSubscriptionToDb = async (
  userId: string,
  subscription: PushSubscription
): Promise<void> => {
  try {
    const subscriptionJson = JSON.stringify(subscription);

    // Check if subscription already exists
    const { data: existing, error: fetchError } = await supabase
      .from('user_push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching existing subscription:', fetchError);
      return;
    }

    if (existing) {
      // Update existing subscription
      const { error: updateError } = await supabase
        .from('user_push_subscriptions')
        .update({
          subscription: subscriptionJson,
          updated_at: new Date().toISOString(),
          enabled: true
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('❌ Failed to update push subscription:', updateError);
      } else {
        console.log('✅ Push subscription updated in database');
      }
    } else {
      // Insert new subscription
      const { error: insertError } = await supabase
        .from('user_push_subscriptions')
        .insert({
          user_id: userId,
          subscription: subscriptionJson,
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('❌ Failed to save push subscription:', insertError);
      } else {
        console.log('✅ Push subscription saved to database');
      }
    }
  } catch (error) {
    console.error('❌ Error saving push subscription:', error);
  }
};

/**
 * Unsubscribe from push notifications
 */
export const unsubscribeFromPush = async (
  userId: string,
  swRegistration: ServiceWorkerRegistration
): Promise<void> => {
  try {
    // Get current subscription
    const subscription = await swRegistration.pushManager.getSubscription();

    if (subscription) {
      // Unsubscribe from browser
      await subscription.unsubscribe();
      console.log('✅ Unsubscribed from push notifications');
    }

    // Disable in database
    const { error } = await supabase
      .from('user_push_subscriptions')
      .update({ enabled: false })
      .eq('user_id', userId);

    if (error) {
      console.error('Error disabling push subscription:', error);
    }
  } catch (error) {
    console.error('Error unsubscribing from push:', error);
  }
};

/**
 * Send a push notification via Supabase Edge Function
 */
export const sendPushNotification = async (
  userIds: string[],
  title: string,
  body: string,
  options?: {
    icon?: string;
    badge?: string;
    tag?: string;
    data?: Record<string, any>;
  }
): Promise<void> => {
  try {
    console.log(`📤 Sending push notification to ${userIds.length} users...`);

    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userIds,
        title,
        body,
        icon: options?.icon || '/scheduler/icons/icon-192.png',
        badge: options?.badge || '/scheduler/icons/badge-96.png',
        tag: options?.tag || 'default',
        data: options?.data || {}
      }
    });

    if (error) {
      console.error('❌ Error sending push notification:', error);
      toast.error('Failed to send notification');
      return;
    }

    console.log('✅ Push notification sent:', data);
  } catch (error) {
    console.error('❌ Error in sendPushNotification:', error);
    toast.error('Failed to send notification');
  }
};
