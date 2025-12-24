import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    OneSignalDeferred?: any[];
    OneSignal?: any;
  }
}

export const useOneSignal = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simple OneSignal initialization that works with GitHub Pages
  const initialize = useCallback(async () => {
    console.log('🚀 Starting OneSignal initialization...');
    setLoading(true);
    setError(null);

    return new Promise<boolean>((resolve) => {
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max

      const checkOneSignal = () => {
        attempts++;

        // Check if OneSignal SDK is loaded
        if (window.OneSignal && typeof window.OneSignal.init === 'function') {
          console.log('✅ OneSignal SDK loaded after', attempts, 'seconds');
          
          // Initialize OneSignal with GitHub Pages configuration
          window.OneSignal.init({
            appId: "3417d840-c226-40ba-92d6-a7590c31eef3",
            safari_web_id: "web.onesignal.auto.1d0d9a2a-074d-4411-b3af-2aed688566e1",
            
            // GitHub Pages paths
            serviceWorkerPath: '/scheduler/OneSignalSDKWorker.js',
            serviceWorkerParam: { scope: '/scheduler/' },
            
            // Disable auto-prompt
            promptOptions: {
              slidedown: {
                enabled: true,
                autoPrompt: false,
                timeDelay: 3,
                pageViews: 1
              }
            },
            
            // Other settings
            welcomeNotification: {
              disable: false,
              title: "Port Arthur PD Notifications",
              message: "You'll receive shift alerts and emergency notifications"
            },
            
            notifyButton: {
              enable: false
            },
            
            // GitHub Pages specific
            allowLocalhostAsSecureOrigin: true,
            autoResubscribe: true,
            persistNotification: false,
            autoRegister: true,
            httpPermissionRequest: { enable: true }
          }).then(() => {
            console.log('✅ OneSignal initialized successfully');
            setIsInitialized(true);
            
            // Check subscription status
            checkSubscription();
            
            // Set up subscription change listener
            window.OneSignal.on('subscriptionChange', (isSubscribed: boolean) => {
              console.log('🔔 Subscription changed:', isSubscribed);
              setIsSubscribed(isSubscribed);
              
              // Store OneSignal user ID when subscribed
              if (isSubscribed) {
                window.OneSignal.getUserId().then((onesignalUserId: string) => {
                  if (onesignalUserId) {
                    console.log('🎉 OneSignal User ID:', onesignalUserId);
                    setUserId(onesignalUserId);
                  }
                });
              }
            });
            
            setLoading(false);
            resolve(true);
          }).catch((error: any) => {
            console.error('❌ OneSignal init error:', error);
            setError('Failed to initialize OneSignal');
            setLoading(false);
            resolve(false);
          });
        }
        // Check if OneSignalDeferred is available
        else if (window.OneSignalDeferred && window.OneSignalDeferred.push) {
          console.log('✅ OneSignalDeferred available after', attempts, 'seconds');
          
          // Push our initialization function
          window.OneSignalDeferred.push(function(OneSignal: any) {
            window.OneSignal = OneSignal;
            
            OneSignal.init({
              appId: "3417d840-c226-40ba-92d6-a7590c31eef3",
              safari_web_id: "web.onesignal.auto.1d0d9a2a-074d-4411-b3af-2aed688566e1",
              serviceWorkerPath: '/scheduler/OneSignalSDKWorker.js',
              serviceWorkerParam: { scope: '/scheduler/' },
              allowLocalhostAsSecureOrigin: true,
              autoResubscribe: true,
              autoRegister: true,
              notifyButton: { enable: false }
            }).then(() => {
              console.log('✅ OneSignal initialized via Deferred');
              setIsInitialized(true);
              
              // Check initial subscription
              OneSignal.getUserId().then((onesignalUserId: string) => {
                if (onesignalUserId) {
                  console.log('🔑 OneSignal User ID:', onesignalUserId);
                  setUserId(onesignalUserId);
                  setIsSubscribed(true);
                }
              });
              
              setLoading(false);
              resolve(true);
            }).catch((error: any) => {
              console.error('❌ Deferred init error:', error);
              setError('Failed to initialize via Deferred');
              setLoading(false);
              resolve(false);
            });
          });
        }
        else if (attempts >= maxAttempts) {
          console.warn('❌ OneSignal not available after', maxAttempts, 'seconds');
          setError('OneSignal service failed to load. Please refresh the page.');
          setLoading(false);
          resolve(false);
        } else {
          // Try again in 1 second
          setTimeout(checkOneSignal, 1000);
        }
      };

      checkOneSignal();
    });
  }, []);

  // Check subscription status
  const checkSubscription = useCallback(async () => {
    if (!window.OneSignal) {
      console.warn('OneSignal not available for subscription check');
      return false;
    }

    try {
      const onesignalUserId = await window.OneSignal.getUserId();
      const permission = Notification.permission;
      
      console.log('🔍 Subscription check:', {
        onesignalUserId: onesignalUserId || 'Not set',
        permission,
        oneSignalAvailable: !!window.OneSignal
      });

      if (onesignalUserId && permission === 'granted') {
        setIsSubscribed(true);
        setUserId(onesignalUserId);
        return true;
      } else {
        setIsSubscribed(false);
        return false;
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      setIsSubscribed(false);
      return false;
    }
  }, []);

  // Request permission and subscribe
  const requestPermission = useCallback(async () => {
    if (!window.OneSignal) {
      console.warn('OneSignal not available for permission request');
      return false;
    }

    try {
      console.log('🎯 Requesting notification permission...');
      
      // Method 1: Use OneSignal's slidedown prompt
      if (typeof window.OneSignal.showSlidedownPrompt === 'function') {
        await window.OneSignal.showSlidedownPrompt({ force: true });
      } 
      // Method 2: Use browser's native prompt
      else {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          await window.OneSignal.setSubscription(true);
        }
      }
      
      // Wait and check result
      await new Promise(resolve => setTimeout(resolve, 3000));
      const subscribed = await checkSubscription();
      
      if (subscribed) {
        console.log('✅ Successfully subscribed to notifications');
        return true;
      } else {
        console.log('❌ Failed to subscribe');
        return false;
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      return false;
    }
  }, [checkSubscription]);

  // Store OneSignal user ID in Supabase profile
  const storeOneSignalUserId = useCallback(async (profileUserId: string) => {
    if (!userId) {
      console.warn('No OneSignal user ID to store');
      return false;
    }

    try {
      console.log('💾 Storing OneSignal ID for profile:', profileUserId);
      
      const { error } = await supabase
        .from('profiles')
        .update({ 
          onesignal_user_id: userId,
          notification_subscribed: true,
          notification_subscribed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', profileUserId);

      if (error) {
        console.error('Error saving OneSignal ID:', error);
        return false;
      }

      console.log('✅ OneSignal user ID saved to profile');
      return true;
    } catch (error) {
      console.error('Error in storeOneSignalUserId:', error);
      return false;
    }
  }, [userId]);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  return {
    isInitialized,
    isSubscribed,
    userId,
    loading,
    error,
    initialize,
    checkSubscription,
    requestPermission,
    storeOneSignalUserId
  };
};
