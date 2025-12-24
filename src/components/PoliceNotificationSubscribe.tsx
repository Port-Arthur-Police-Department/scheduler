// src/components/PoliceNotificationSubscribe.tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Declare OneSignal types globally
declare global {
  interface Window {
    OneSignal: any;
  }
}

interface PoliceNotificationSubscribeProps {
  userId: string;
  onSubscribed?: (onesignalId: string) => void;
}

const PoliceNotificationSubscribe: React.FC<PoliceNotificationSubscribeProps> = ({ 
  userId,
  onSubscribed 
}) => {
  const [status, setStatus] = useState<'loading' | 'subscribed' | 'unsubscribed' | 'blocked'>('loading');
  const [oneSignalReady, setOneSignalReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Store OneSignal user ID in Supabase
  const storeOneSignalUserId = async (onesignalId: string) => {
    try {
      console.log('💾 Storing OneSignal ID for officer:', userId, '->', onesignalId);
      
      const { error } = await supabase
        .from('officers')
        .update({ 
          onesignal_user_id: onesignalId,
          notification_subscribed: true,
          notification_subscribed_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Database error:', error);
        throw error;
      }
      
      console.log('✅ OneSignal user ID stored successfully');
      onSubscribed?.(onesignalId);
    } catch (error) {
      console.error('Error storing OneSignal user ID:', error);
    }
  };

  // Check subscription status
  const checkSubscription = async (forceCheck = false) => {
    if (!window.OneSignal && !forceCheck) return;
    
    try {
      // First check browser permission
      const permission = Notification.permission;
      console.log('🔍 Browser notification permission:', permission);
      
      if (permission === 'denied') {
        setStatus('blocked');
        return;
      }
      
      // Wait for OneSignal to be ready
      if (!window.OneSignal || typeof window.OneSignal.getUserId !== 'function') {
        if (forceCheck) {
          setStatus('unsubscribed');
        }
        return;
      }
      
      // Get OneSignal subscription status
      const isSubscribed = await window.OneSignal.isPushNotificationsEnabled();
      const onesignalUserId = await window.OneSignal.getUserId();
      
      console.log('📱 OneSignal status:', { 
        isSubscribed, 
        userId: onesignalUserId || 'Not set' 
      });
      
      if (isSubscribed && onesignalUserId) {
        setStatus('subscribed');
        // Store the OneSignal ID in database
        await storeOneSignalUserId(onesignalUserId);
      } else {
        setStatus('unsubscribed');
      }
    } catch (error) {
      console.error('Check subscription error:', error);
      setStatus('unsubscribed');
    }
  };

  useEffect(() => {
    // Check every second if OneSignal is ready (max 30 seconds)
    let attempts = 0;
    const maxAttempts = 30;
    
    const checkInterval = setInterval(() => {
      attempts++;
      
      if (window.OneSignal && typeof window.OneSignal.getUserId === 'function') {
        console.log('✅ OneSignal ready after', attempts, 'seconds');
        setOneSignalReady(true);
        checkSubscription();
        clearInterval(checkInterval);
      } else if (attempts >= maxAttempts) {
        console.warn('⚠️ OneSignal not ready after', maxAttempts, 'seconds');
        setStatus('unsubscribed');
        clearInterval(checkInterval);
      } else {
        console.log(`⏳ Waiting for OneSignal... (${attempts}/${maxAttempts})`);
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, []);

  const handleSubscribe = async () => {
    if (!window.OneSignal) {
      console.warn('OneSignal not available');
      alert('Notification service is still loading. Please wait a moment and try again.');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('🎯 Starting subscription process...');
      
      // Method 1: Use OneSignal's slidedown prompt (recommended)
      if (typeof window.OneSignal.showSlidedownPrompt === 'function') {
        console.log('Using showSlidedownPrompt method');
        await window.OneSignal.showSlidedownPrompt({
          force: true // Force show even if autoPrompt is false
        });
      } 
      // Method 2: Direct browser permission request with OneSignal registration
      else {
        console.log('Using direct permission request');
        
        // First get browser permission
        const permission = await Notification.requestPermission();
        console.log('Permission result:', permission);
        
        if (permission === 'granted') {
          // Register with OneSignal after permission is granted
          if (typeof window.OneSignal.setSubscription === 'function') {
            await window.OneSignal.setSubscription(true);
          }
          
          // Give OneSignal time to register
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          setStatus('blocked');
          alert('Notifications are required for shift alerts. Please enable in browser settings.');
          return;
        }
      }
      
      // Wait a moment for OneSignal to process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check the subscription result
      await checkSubscription(true);
      
      // If still not subscribed, try manual workaround
      if (status !== 'subscribed') {
        console.log('🔄 Subscription may have failed, trying workaround...');
        
        // Workaround: Manually trigger subscription
        const onesignalUserId = await window.OneSignal.getUserId();
        if (onesignalUserId) {
          console.log('Workaround found user ID:', onesignalUserId);
          setStatus('subscribed');
          await storeOneSignalUserId(onesignalUserId);
        }
      }
      
      // Show success message if subscribed
      if (status === 'subscribed') {
        alert('✅ Success! You will now receive shift alerts and emergency notifications.');
      }
      
    } catch (error: any) {
      console.error('❌ Subscription error:', error);
      
      // More specific error messages
      if (error.message?.includes('not a function')) {
        alert('OneSignal is not properly loaded. Please refresh the page.');
      } else if (error.message?.includes('permission')) {
        alert('Please allow notifications in your browser settings.');
      } else {
        alert('Failed to enable notifications. Please try again or contact IT support.');
      }
      
      // Fallback: Direct check
      await checkSubscription(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!window.OneSignal || !confirm('Are you sure you want to stop receiving notifications?')) {
      return;
    }
    
    setIsProcessing(true);
    try {
      if (typeof window.OneSignal.setSubscription === 'function') {
        await window.OneSignal.setSubscription(false);
      }
      
      // Update database
      const { error } = await supabase
        .from('officers')
        .update({ 
          onesignal_user_id: null,
          notification_subscribed: false 
        })
        .eq('id', userId);
      
      if (error) throw error;
      
      setStatus('unsubscribed');
      alert('Notifications have been disabled.');
    } catch (error) {
      console.error('Unsubscribe error:', error);
      alert('Failed to disable notifications.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Loading state
  if (status === 'loading') {
    return (
      <div className="p-6 border border-blue-200 rounded-lg bg-blue-50">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-blue-700 font-medium">Checking notification status...</span>
        </div>
      </div>
    );
  }

  // Blocked state
  if (status === 'blocked') {
    return (
      <div className="p-6 border border-red-300 rounded-lg bg-red-50">
        <div className="flex items-center gap-3 mb-3">
          <BellOff className="h-6 w-6 text-red-600" />
          <div>
            <h3 className="font-bold text-red-900">Notifications Blocked</h3>
            <p className="text-sm text-red-700 mt-1">
              Please enable notifications in your browser settings to receive shift alerts.
            </p>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-red-100 rounded border border-red-200">
          <p className="text-sm font-medium text-red-800">To fix this:</p>
          <ol className="text-sm text-red-700 mt-1 list-decimal list-inside space-y-1">
            <li>Click the lock icon (🔒) in your browser's address bar</li>
            <li>Find "Notifications" in the permissions list</li>
            <li>Change from "Block" to "Allow"</li>
            <li>Refresh this page and try again</li>
          </ol>
        </div>
      </div>
    );
  }

  // Subscribed state
  if (status === 'subscribed') {
    return (
      <div className="p-6 border border-green-300 rounded-lg bg-green-50">
        <div className="flex items-center gap-3 mb-3">
          <CheckCircle className="h-6 w-6 text-green-600" />
          <div>
            <h3 className="font-bold text-green-900">Notifications Enabled</h3>
            <p className="text-sm text-green-700 mt-1">
              You will receive real-time alerts for shift changes, emergencies, and announcements.
            </p>
          </div>
        </div>
        
        <div className="mt-4 flex gap-2">
          <Button
            onClick={handleUnsubscribe}
            variant="outline"
            className="text-red-600 border-red-300 hover:bg-red-50"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Disable Notifications'
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Unsubscribed state (default)
  return (
    <div className="p-6 border border-blue-300 rounded-lg bg-blue-50 shadow-sm">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-blue-100 rounded-full">
          <Bell className="h-8 w-8 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-lg text-blue-900">Police Department Notifications</h3>
          <p className="text-sm text-blue-700 mt-1">
            Get real-time alerts for shift changes, emergencies, and department announcements
          </p>
        </div>
      </div>
      
      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
          <span className="text-blue-800">Shift change notifications</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
          <span className="text-blue-800">Emergency alerts</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
          <span className="text-blue-800">Schedule updates</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
          <span className="text-blue-800">Department announcements</span>
        </div>
      </div>
      
      <Button 
        onClick={handleSubscribe}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 text-lg"
        disabled={!oneSignalReady || isProcessing}
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Enabling Notifications...
          </>
        ) : oneSignalReady ? (
          '🔔 Enable Police Notifications'
        ) : (
          'Loading Notification Service...'
        )}
      </Button>
      
      {!oneSignalReady && (
        <p className="text-xs text-blue-600 mt-3 text-center">
          Initializing notification service... This may take a few seconds.
        </p>
      )}
      
      <p className="text-xs text-blue-600 mt-3 text-center">
        <strong>Required:</strong> All officers must enable notifications to receive critical updates
      </p>
    </div>
  );
};

export default PoliceNotificationSubscribe;
