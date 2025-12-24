// src/components/PoliceNotificationSubscribe.tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, CheckCircle } from 'lucide-react';

const PoliceNotificationSubscribe = () => {
  const [status, setStatus] = useState<'loading' | 'subscribed' | 'unsubscribed' | 'blocked'>('loading');
  const [oneSignalReady, setOneSignalReady] = useState(false);

  useEffect(() => {
    // Check every second if OneSignal is ready
    const checkInterval = setInterval(() => {
      if (window.OneSignal && typeof window.OneSignal.getUserId === 'function') {
        setOneSignalReady(true);
        checkSubscription();
        clearInterval(checkInterval);
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, []);

  const checkSubscription = async () => {
    if (!window.OneSignal) return;
    
    try {
      const permission = Notification.permission;
      
      if (permission === 'denied') {
        setStatus('blocked');
        return;
      }
      
      const userId = await window.OneSignal.getUserId();
      setStatus(userId ? 'subscribed' : 'unsubscribed');
    } catch (error) {
      console.error('Check error:', error);
      setStatus('unsubscribed');
    }
  };

  const handleSubscribe = async () => {
    if (!window.OneSignal) {
      alert('Notification service loading... Please wait a moment.');
      return;
    }

    try {
      // First get browser permission
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        // Now trigger OneSignal subscription
        await window.OneSignal.registerForPushNotifications();
        
        // Check if subscription worked
        setTimeout(async () => {
          await checkSubscription();
          if (status === 'subscribed') {
            alert('✅ Success! You will now receive shift alerts and emergency notifications.');
          }
        }, 2000);
      } else {
        setStatus('blocked');
        alert('Notifications are required for shift alerts. Please enable in browser settings.');
      }
    } catch (error) {
      console.error('Subscribe error:', error);
      alert('Failed to enable notifications. Please try again.');
    }
  };

  if (status === 'loading') {
    return (
      <div className="p-4 border rounded-lg bg-blue-50">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-blue-700">Checking notification status...</span>
        </div>
      </div>
    );
  }

  if (status === 'blocked') {
    return (
      <div className="p-4 border border-red-300 rounded-lg bg-red-50">
        <div className="flex items-center gap-2 text-red-700">
          <BellOff className="h-5 w-5" />
          <span className="font-medium">Notifications Blocked</span>
        </div>
        <p className="text-sm text-red-600 mt-1">
          Please enable notifications in your browser settings to receive shift alerts.
        </p>
      </div>
    );
  }

  if (status === 'subscribed') {
    return (
      <div className="p-4 border border-green-300 rounded-lg bg-green-50">
        <div className="flex items-center gap-2 text-green-700">
          <CheckCircle className="h-5 w-5" />
          <span className="font-medium">Notifications Enabled</span>
        </div>
        <p className="text-sm text-green-600 mt-1">
          You will receive alerts for shift changes and emergencies.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 border border-blue-300 rounded-lg bg-blue-50">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-100 rounded-full">
          <Bell className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h3 className="font-bold text-blue-900">Police Department Notifications</h3>
          <p className="text-sm text-blue-700">
            Get real-time alerts for shift changes, emergencies, and department announcements
          </p>
        </div>
      </div>
      
      <Button 
        onClick={handleSubscribe}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3"
        disabled={!oneSignalReady}
      >
        {oneSignalReady ? '🔔 Enable Notifications' : 'Loading...'}
      </Button>
      
      <p className="text-xs text-blue-600 mt-3 text-center">
        Required for all officers to receive critical updates
      </p>
    </div>
  );
};

export default PoliceNotificationSubscribe;
