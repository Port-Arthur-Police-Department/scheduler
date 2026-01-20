// src/components/PoliceNotificationSubscribe.tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';

interface PoliceNotificationSubscribeProps {
  onSubscribed?: () => void;
}

const PoliceNotificationSubscribe: React.FC<PoliceNotificationSubscribeProps> = ({ 
  onSubscribed 
}) => {
  const { user, isLoading: authLoading } = useUser();
  const userId = user?.id || '';
  
  const [status, setStatus] = useState<'loading' | 'subscribed' | 'unsubscribed' | 'blocked'>('loading');
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
      browserPermission: Notification.permission
    });
    
    if (!user && !authLoading) {
      setDebugInfo('❌ No authenticated user found. Please log in.');
      console.error('No authenticated user for notifications');
    }
  }, [user, authLoading]);

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
          subscribed: data.notification_subscribed
        });
        
        setUserProfile(data);
        setDebugInfo('✅ Profile loaded successfully');
        
        // Check notification status
        checkNotificationStatus();
        
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

  // Store notification subscription in Supabase profile
  const storeNotificationSubscription = async (subscribed: boolean) => {
    try {
      if (!userId) {
        console.error('❌ No user ID available to store notification status');
        setDebugInfo('❌ No user ID available');
        return false;
      }
      
      console.log('💾 Storing notification status in profile:', {
        profileUserId: userId,
        subscribed,
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
      
      // Update the profile with notification status
      const { error } = await supabase
        .from('profiles')
        .update({ 
          notification_subscribed: subscribed,
          notification_subscribed_at: subscribed ? new Date().toISOString() : null,
          notification_provider: subscribed ? 'browser' : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('❌ Database error:', error);
        setDebugInfo(`❌ Database error: ${error.message}`);
        return false;
      }
      
      console.log('✅ Notification status stored successfully in profiles table');
      setDebugInfo('✅ Notification status saved to database');
      
      // Update local profile state
      setUserProfile((prev: any) => ({
        ...prev,
        notification_subscribed: subscribed,
        notification_subscribed_at: subscribed ? new Date().toISOString() : null,
        notification_provider: subscribed ? 'browser' : null
      }));
      
      return true;
    } catch (error) {
      console.error('❌ Error storing notification status:', error);
      setDebugInfo('❌ Error saving to database');
      return false;
    }
  };

  // Check notification status
  const checkNotificationStatus = async () => {
    try {
      // Check browser permission
      const permission = Notification.permission;
      console.log('🔍 Browser notification permission:', permission);
      
      if (permission === 'denied') {
        setStatus('blocked');
        setDebugInfo('❌ Notifications blocked in browser settings');
        return;
      }
      
      // Check if subscribed in database
      const isSubscribed = userProfile?.notification_subscribed || false;
      
      console.log('📱 Notification status check:', { 
        isSubscribed, 
        permission
      });
      
      if (isSubscribed && permission === 'granted') {
        setStatus('subscribed');
        setDebugInfo('✅ Subscribed to push notifications');
      } else {
        setStatus('unsubscribed');
        if (permission === 'granted') {
          setDebugInfo('⚠️ Browser allows notifications but subscription not active');
        } else if (permission === 'default') {
          setDebugInfo('ℹ️ Notifications not enabled yet');
        } else {
          setDebugInfo('❌ Not subscribed to notifications');
        }
      }
    } catch (error) {
      console.error('❌ Check subscription error:', error);
      setStatus('unsubscribed');
      setDebugInfo('❌ Error checking notification status');
    }
  };

  // Monitor notification status
  useEffect(() => {
    if (authLoading) return;
    
    if (userProfile) {
      checkNotificationStatus();
    }
  }, [userProfile, authLoading]);

  const handleSubscribe = async () => {
    if (!userId) {
      setDebugInfo('❌ Please log in first');
      alert('You must be logged in to enable notifications.');
      return;
    }

    setIsProcessing(true);
    setDebugInfo('🔄 Enabling notifications...');
    
    try {
      console.log('🎯 Starting browser notification subscription...');
      
      // Request browser permission
      const permission = await Notification.requestPermission();
      
      console.log('Browser permission result:', permission);
      
      if (permission === 'granted') {
        // Browser permission granted
        const success = await storeNotificationSubscription(true);
        
        if (success) {
          setStatus('subscribed');
          setDebugInfo('✅ Successfully subscribed!');
          
          alert('✅ Success! You will now receive shift alerts and emergency notifications.');
          onSubscribed?.();
        } else {
          setDebugInfo('❌ Could not save subscription. Please try again.');
          alert('Failed to save notification settings. Please try again.');
        }
      } else if (permission === 'denied') {
        setStatus('blocked');
        setDebugInfo('❌ Notifications blocked by user');
        alert('Notifications are required for shift alerts. Please enable in browser settings.');
      } else {
        setDebugInfo('❌ Permission request cancelled');
        alert('Notifications are required for shift alerts.');
      }
      
    } catch (error: any) {
      console.error('❌ Subscription error:', error);
      setDebugInfo(`❌ Error: ${error.message}`);
      
      if (error.message?.includes('permission')) {
        alert('Please allow notifications in your browser settings.');
      } else {
        alert('Failed to enable notifications. Please try again or contact IT support.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!confirm('Are you sure you want to stop receiving notifications?')) {
      return;
    }
    
    setIsProcessing(true);
    setDebugInfo('🔄 Disabling notifications...');
    
    try {
      // Update database
      const success = await storeNotificationSubscription(false);
      
      if (success) {
        setStatus('unsubscribed');
        setDebugInfo('✅ Notifications disabled');
        alert('Notifications have been disabled.');
      } else {
        setDebugInfo('❌ Failed to disable notifications');
        alert('Failed to disable notifications.');
      }
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
            {authLoading ? 'Checking authentication...' : 'Loading notification service...'}
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
        disabled={isProcessing}
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Enabling Notifications...
          </>
        ) : (
          '🔔 Enable Police Notifications'
        )}
      </Button>
      
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
          <p className="text-xs text-blue-700">Profile: {userProfile ? 'Loaded' : 'Not loaded'}</p>
          <p className="text-xs text-blue-700">Browser Permission: {Notification.permission}</p>
        </div>
      )}
    </div>
  );
};

export default PoliceNotificationSubscribe;
