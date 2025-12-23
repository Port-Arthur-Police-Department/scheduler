import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    OneSignalDeferred?: any[];
    OneSignal?: any;
    setOneSignalUserId?: (userId: string) => void;
    clearOneSignalUserId?: () => void;
  }
}

export const useOneSignal = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Initialize OneSignal
  const initialize = useCallback(async (externalUserId?: string) => {
    return new Promise<void>((resolve) => {
      const checkOneSignal = () => {
        if (window.OneSignal) {
          console.log('OneSignal already loaded, initializing...');
          
          if (externalUserId && window.setOneSignalUserId) {
            window.setOneSignalUserId(externalUserId);
            setUserId(externalUserId);
          }
          
          setIsInitialized(true);
          resolve();
        } else {
          console.log('Waiting for OneSignal...');
          setTimeout(checkOneSignal, 100);
        }
      };
      
      checkOneSignal();
    });
  }, []);

  // Set user ID after login
  const setUser = useCallback((userId: string) => {
    if (window.setOneSignalUserId) {
      window.setOneSignalUserId(userId);
      setUserId(userId);
      
      // Also dispatch custom event for the script in index.html
      window.dispatchEvent(new CustomEvent('onesignal-set-user', {
        detail: { userId }
      }));
      
      // Save to Supabase profile
      supabase
        .from('profiles')
        .update({ 
          onesignal_user_id: userId,
          notification_settings: {
            push_enabled: true,
            provider: 'onesignal',
            updated_at: new Date().toISOString()
          }
        })
        .eq('id', userId)
        .then(({ error }) => {
          if (error) {
            console.error('Error saving OneSignal user ID:', error);
          } else {
            console.log('OneSignal user ID saved to profile');
          }
        });
    }
  }, []);

  // Clear user ID on logout
  const clearUser = useCallback(() => {
    if (window.clearOneSignalUserId) {
      window.clearOneSignalUserId();
      setUserId(null);
      window.dispatchEvent(new CustomEvent('onesignal-clear-user'));
    }
  }, []);

  // Check subscription status
  const checkSubscription = useCallback(async () => {
    if (window.OneSignal) {
      try {
        const subscription = await window.OneSignal.getSubscription();
        setIsSubscribed(subscription === true);
        return subscription === true;
      } catch (error) {
        console.error('Error checking subscription:', error);
        return false;
      }
    }
    return false;
  }, []);

  // Request permission
  const requestPermission = useCallback(async () => {
    if (window.OneSignal) {
      try {
        const permission = await window.OneSignal.registerForPushNotifications();
        const subscribed = permission === 'granted';
        setIsSubscribed(subscribed);
        
        if (subscribed) {
          console.log('✅ Push notifications enabled');
        } else {
          console.log('❌ Push notifications not granted');
        }
        
        return subscribed;
      } catch (error) {
        console.error('Error requesting permission:', error);
        return false;
      }
    }
    return false;
  }, []);

  // Send test notification
  const sendTestNotification = useCallback(async () => {
    if (!userId) {
      console.error('No user ID set');
      return false;
    }

    try {
      const response = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${process.env.NEXT_PUBLIC_ONESIGNAL_API_KEY}`
        },
        body: JSON.stringify({
          app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
          include_external_user_ids: [userId],
          headings: { en: 'PAPD Test Alert' },
          contents: { en: 'This is a test notification from Port Arthur PD Scheduler' },
          data: { type: 'test', url: '/dashboard' },
          url: '/dashboard'
        })
      });

      if (!response.ok) {
        throw new Error(`OneSignal API error: ${response.status}`);
      }

      console.log('✅ Test notification sent');
      return true;
    } catch (error) {
      console.error('Error sending test notification:', error);
      return false;
    }
  }, [userId]);

  // Listen for OneSignal events
  useEffect(() => {
    const handleOneSignalReady = () => {
      console.log('🎯 OneSignal ready event received');
      setIsInitialized(true);
    };

    const handleSubscriptionChange = (event: CustomEvent) => {
      setIsSubscribed(event.detail.isSubscribed);
      console.log('Subscription changed:', event.detail.isSubscribed);
    };

    window.addEventListener('onesignal-ready', handleOneSignalReady);
    window.addEventListener('onesignal-subscription-change', handleSubscriptionChange as EventListener);

    return () => {
      window.removeEventListener('onesignal-ready', handleOneSignalReady);
      window.removeEventListener('onesignal-subscription-change', handleSubscriptionChange as EventListener);
    };
  }, []);

  return {
    isInitialized,
    isSubscribed,
    userId,
    initialize,
    setUser,
    clearUser,
    checkSubscription,
    requestPermission,
    sendTestNotification
  };
};
