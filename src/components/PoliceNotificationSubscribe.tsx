// src/components/PoliceNotificationSubscribe.tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';

// Declare OneSignal types globally
declare global {
  interface Window {
    OneSignal: any;
  }
}

interface PoliceNotificationSubscribeProps {
  onSubscribed?: (onesignalId: string) => void;
}

const PoliceNotificationSubscribe: React.FC<PoliceNotificationSubscribeProps> = ({ 
  onSubscribed 
}) => {
  const { user, isLoading: authLoading } = useUser();
  const userId = user?.id || '';
  const [status, setStatus] = useState<'loading' | 'subscribed' | 'unsubscribed' | 'blocked'>('loading');
  const [oneSignalReady, setOneSignalReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Debug authentication status
  useEffect(() => {
    console.log('🔐 PoliceNotificationSubscribe auth status:', {
      hasUser: !!user,
      userId: user?.id,
      email: user?.email,
      authLoading,
      oneSignalReady
    });
    
    if (!user && !authLoading) {
      setDebugInfo('❌ No authenticated user found. Please log in.');
      console.error('No authenticated user for notifications');
    }
  }, [user, authLoading, oneSignalReady]);

  // Fetch user profile when user is available
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId || authLoading) {
        console.log('⏳ Waiting for user authentication...');
        return;
      }

      try {
        console.log('📋 Fetching profile for user:', userId);
        
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          console.error('❌ Error fetching profile:', error);
          
          // Check if profile doesn't exist
          if (error.code === 'PGRST116') {
            setDebugInfo('⚠️ User profile not found in database. Creating profile...');
            await createUserProfile();
            return;
          }
          return;
        }

        console.log('✅ Profile fetched:', {
          id: data.id,
          email: data.email,
          onesignalId: data.onesignal_user_id,
          subscribed: data.notification_subscribed
        });
        
        setUserProfile(data);
        setDebugInfo('✅ Profile loaded successfully');
        
        // Check if already subscribed
        if (data.onesignal_user_id && data.notification_subscribed) {
          setStatus('subscribed');
          console.log('📱 User already has OneSignal ID:', data.onesignal_user_id);
        } else {
          setStatus('unsubscribed');
        }
      } catch (error) {
        console.error('❌ Error in fetchUserProfile:', error);
        setDebugInfo('❌ Failed to load profile');
      }
    };

    fetchUserProfile();
  }, [userId, authLoading]);

  // Create user profile if it doesn't exist
  const createUserProfile = async () => {
    if (!user) return;
    
    try {
      console.log('🔄 Creating profile for user:', user.id);
      
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.email?.split('@')[0] || 'Officer',
          badge_number: 'UNASSIGNED',
          role: 'officer',
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to create profile:', error);
        setDebugInfo('❌ Failed to create user profile');
        return null;
      }

      console.log('✅ Profile created:', data);
      setUserProfile(data);
      setDebugInfo('✅ Profile created successfully');
      return data;
    } catch (error) {
      console.error('❌ Error creating profile:', error);
      setDebugInfo('❌ Error creating profile');
      return null;
    }
  };

  // Store OneSignal user ID in Supabase
  const storeOneSignalUserId = async (onesignalId: string) => {
    try {
      if (!userId) {
        console.error('❌ No user ID available to store OneSignal ID');
        setDebugInfo('❌ No user ID available');
        return false;
      }
      
      console.log('💾 Storing OneSignal ID:', {
        profileUserId: userId,
        onesignalId: onesignalId.substring(0, 8) + '...',
        timestamp: new Date().toISOString()
      });
      
      // First check if profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();
      
      console.log('🔍 Profile existence check:', {
        exists: !!existingProfile,
        checkError
      });
      
      // Create profile if it doesn't exist
      if (!existingProfile) {
        console.log('🔄 Profile not found, creating...');
        await createUserProfile();
      }
      
      // Update the profile with OneSignal user ID
      const { error } = await supabase
        .from('profiles')
        .update({ 
          onesignal_user_id: onesignalId,
          notification_subscribed: true,
          notification_subscribed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('❌ Database error:', error);
        setDebugInfo(`❌ Database error: ${error.message}`);
        return false;
      }
      
      console.log('✅ OneSignal user ID stored successfully in profiles table');
      setDebugInfo('✅ OneSignal ID saved to database');
      onSubscribed?.(onesignalId);
      
      // Update local profile state
      setUserProfile((prev: any) => ({
        ...prev,
        onesignal_user_id: onesignalId,
        notification_subscribed: true,
        notification_subscribed_at: new Date().toISOString()
      }));
      
      return true;
    } catch (error) {
      console.error('❌ Error storing OneSignal user ID:', error);
      setDebugInfo('❌ Error saving to database');
      return false;
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
        setDebugInfo('❌ Notifications blocked in browser settings');
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
        userId: onesignalUserId || 'Not set',
        permission
      });
      
      if (isSubscribed && onesignalUserId) {
        setStatus('subscribed');
        setDebugInfo('✅ Subscribed to push notifications');
        // Store the OneSignal ID in database
        await storeOneSignalUserId(onesignalUserId);
      } else {
        setStatus('unsubscribed');
        if (permission === 'granted' && !onesignalUserId) {
          setDebugInfo('⚠️ Browser allows notifications but OneSignal not registered');
        } else if (permission === 'default') {
          setDebugInfo('ℹ️ Notifications not enabled yet');
        } else {
          setDebugInfo('❌ Not subscribed to notifications');
        }
      }
    } catch (error) {
      console.error('❌ Check subscription error:', error);
      setStatus('unsubscribed');
      setDebugInfo('❌ Error checking subscription status');
    }
  };

  // Initialize OneSignal monitoring
  useEffect(() => {
    if (authLoading) return;
    
    // Check every second if OneSignal is ready (max 30 seconds)
    let attempts = 0;
    const maxAttempts = 30;
    
    const checkInterval = setInterval(() => {
      attempts++;
      
      if (window.OneSignal && typeof window.OneSignal.getUserId === 'function') {
        console.log('✅ OneSignal ready after', attempts, 'seconds');
        setOneSignalReady(true);
        setDebugInfo('✅ OneSignal service ready');
        
        // If profile already has OneSignal ID, mark as subscribed
        if (userProfile?.onesignal_user_id) {
          setStatus('subscribed');
          console.log('✅ Using existing OneSignal ID from profile');
        } else {
          checkSubscription();
        }
        
        clearInterval(checkInterval);
        
        // Set up subscription change listener
        window.OneSignal.on('subscriptionChange', async (isSubscribed: boolean) => {
          console.log(`🔔 OneSignal subscriptionChange event: ${isSubscribed}`);
          await checkSubscription(true);
        });
        
      } else if (attempts >= maxAttempts) {
        console.warn('⚠️ OneSignal not ready after', maxAttempts, 'seconds');
        setStatus('unsubscribed');
        setDebugInfo('❌ OneSignal service failed to load');
        clearInterval(checkInterval);
      } else {
        console.log(`⏳ Waiting for OneSignal... (${attempts}/${maxAttempts})`);
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [userProfile, authLoading]);

  const handleSubscribe = async () => {
    if (!window.OneSignal) {
      console.warn('OneSignal not available');
      setDebugInfo('❌ Notification service not loaded');
      alert('Notification service is still loading. Please wait a moment and try again.');
      return;
    }
    
    if (!userId) {
      console.warn('No authenticated user');
      setDebugInfo('❌ Please log in first');
      alert('You must be logged in to enable notifications.');
      return;
    }

    setIsProcessing(true);
    setDebugInfo('🔄 Starting subscription process...');
    
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
          setDebugInfo('❌ Notifications blocked by user');
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
        setDebugInfo('🔄 Checking subscription status...');
        
        // Workaround: Manually trigger subscription
        const onesignalUserId = await window.OneSignal.getUserId();
        if (onesignalUserId) {
          console.log('Workaround found user ID:', onesignalUserId.substring(0, 8) + '...');
          setStatus('subscribed');
          await storeOneSignalUserId(onesignalUserId);
        }
      }
      
      // Show success message if subscribed
      if (status === 'subscribed') {
        setDebugInfo('✅ Successfully subscribed!');
        alert('✅ Success! You will now receive shift alerts and emergency notifications.');
      } else {
        setDebugInfo('⚠️ Subscription incomplete - please try again');
      }
      
    } catch (error: any) {
      console.error('❌ Subscription error:', error);
      setDebugInfo(`❌ Error: ${error.message}`);
      
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
    setDebugInfo('🔄 Disabling notifications...');
    
    try {
      if (typeof window.OneSignal.setSubscription === 'function') {
        await window.OneSignal.setSubscription(false);
      }
      
      // Update database
      const { error } = await supabase
        .from('profiles')
        .update({ 
          onesignal_user_id: null,
          notification_subscribed: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (error) throw error;
      
      setStatus('unsubscribed');
      setDebugInfo('✅ Notifications disabled');
      
      // Update local profile state
      setUserProfile((prev: any) => ({
        ...prev,
        onesignal_user_id: null,
        notification_subscribed: false
      }));
      
      alert('Notifications have been disabled.');
    } catch (error) {
      console.error('Unsubscribe error:', error);
      setDebugInfo('❌ Failed to disable notifications');
      alert('Failed to disable notifications.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Loading state
  if (authLoading || status === 'loading') {
    return (
      <div className="p-6 border border-blue-200 rounded-lg bg-blue-50">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-blue-700 font-medium">
            {authLoading ? 'Checking authentication...' : 'Checking notification status...'}
          </span>
        </div>
        {debugInfo && (
          <p className="text-xs text-blue-600 mt-2 text-center">{debugInfo}</p>
        )}
      </div>
    );
  }

  // No user state
  if (!user) {
    return (
      <div className="p-6 border border-yellow-300 rounded-lg bg-yellow-50">
        <div className="flex items-center gap-3">
          <BellOff className="h-6 w-6 text-yellow-600" />
          <div>
            <h3 className="font-bold text-yellow-900">Authentication Required</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Please log in to enable police department notifications.
            </p>
          </div>
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
        {debugInfo && (
          <p className="text-xs text-red-600 mt-2">{debugInfo}</p>
        )}
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
        
        {userProfile?.badge_number && (
          <p className="text-sm text-green-600 mb-3">
            Badge: {userProfile.badge_number} • Registered for notifications
          </p>
        )}
        
        {userProfile?.onesignal_user_id && (
          <p className="text-xs text-green-500 mb-3 font-mono">
            OneSignal ID: {userProfile.onesignal_user_id.substring(0, 12)}...
          </p>
        )}
        
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
        {debugInfo && (
          <p className="text-xs text-green-600 mt-2">{debugInfo}</p>
        )}
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
          
          {userProfile?.badge_number && (
            <p className="text-sm text-blue-600 mt-2">
              Officer: {userProfile.full_name} • Badge: {userProfile.badge_number}
            </p>
          )}
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
      
      {debugInfo && (
        <p className="text-xs text-blue-600 mt-2 text-center">{debugInfo}</p>
      )}
      
      {/* Debug info for development */}
      {import.meta.env.DEV && (
        <div className="mt-4 p-2 bg-blue-100 rounded border border-blue-200">
          <p className="text-xs font-medium text-blue-800">Debug Info:</p>
          <p className="text-xs text-blue-700">User: {user?.email}</p>
          <p className="text-xs text-blue-700">User ID: {userId.substring(0, 8)}...</p>
          <p className="text-xs text-blue-700">OneSignal Ready: {oneSignalReady ? 'Yes' : 'No'}</p>
          <p className="text-xs text-blue-700">Profile: {userProfile ? 'Loaded' : 'Not loaded'}</p>
        </div>
      )}
    </div>
  );
};

export default PoliceNotificationSubscribe;
