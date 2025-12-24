// src/components/NotificationTest.tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Bell, BellRing, BellOff, Loader2, AlertTriangle } from 'lucide-react';

const NotificationTest = () => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'subscribed' | 'blocked'>('loading');
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    const checkOneSignal = async () => {
      console.log('🔍 Checking OneSignal status...');
      
      // Check if OneSignal script loaded
      const scriptLoaded = typeof window.OneSignalDeferred !== 'undefined';
      console.log('📜 OneSignal script loaded:', scriptLoaded);
      
      // Check if OneSignal instance exists
      const oneSignalInstance = typeof window.OneSignal !== 'undefined';
      console.log('🚀 OneSignal instance:', oneSignalInstance);
      
      // Check browser notification permission
      const permission = Notification.permission;
      console.log('📋 Notification permission:', permission);
      
      if (permission === 'denied') {
        setStatus('blocked');
      } else if (oneSignalInstance) {
        setStatus('ready');
        
        // Try to get subscription status
        try {
          if (window.OneSignal.getUserId) {
            const userId = await window.OneSignal.getUserId();
            console.log('👤 OneSignal User ID:', userId);
            if (userId) {
              setStatus('subscribed');
            }
          }
        } catch (error) {
          console.error('Error getting user ID:', error);
        }
      } else {
        setStatus('ready');
      }
      
      setDebugInfo({
        scriptLoaded,
        oneSignalInstance,
        permission,
        windowLocation: window.location.href,
        windowPath: window.location.pathname,
        oneSignalMethods: oneSignalInstance ? 
          Object.keys(window.OneSignal).filter(k => typeof window.OneSignal[k] === 'function') : []
      });
    };

    // Wait 3 seconds for OneSignal to load, then check
    const timer = setTimeout(checkOneSignal, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleSubscribe = async () => {
    setIsTesting(true);
    try {
      console.log('🎯 Attempting to subscribe...');
      
      if (!window.OneSignal) {
        throw new Error('OneSignal not loaded');
      }
      
      // Method 1: Try showSlidedownPrompt
      if (typeof window.OneSignal.showSlidedownPrompt === 'function') {
        console.log('Using showSlidedownPrompt...');
        await window.OneSignal.showSlidedownPrompt({ force: true });
      } 
      // Method 2: Try direct permission
      else {
        console.log('Using direct Notification.requestPermission...');
        const permission = await Notification.requestPermission();
        console.log('Permission result:', permission);
        
        if (permission === 'granted') {
          alert('✅ Permission granted! OneSignal should register automatically.');
        } else {
          alert(`❌ Permission denied: ${permission}`);
          setStatus('blocked');
        }
      }
      
      // Check status after 3 seconds
      setTimeout(() => {
        const permission = Notification.permission;
        if (permission === 'granted' && window.OneSignal?.getUserId) {
          window.OneSignal.getUserId().then(userId => {
            if (userId) {
              setStatus('subscribed');
              alert('🎉 Successfully subscribed! User ID: ' + userId);
            }
          });
        }
        setIsTesting(false);
      }, 3000);
      
    } catch (error: any) {
      console.error('❌ Subscribe error:', error);
      alert(`Error: ${error.message || 'Unknown error'}`);
      setIsTesting(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      // Test browser notification first
      if (Notification.permission === 'granted') {
        new Notification('PAPD Test Notification', {
          body: 'This is a test notification from the Police Department Scheduler',
          icon: '/scheduler/icons/icon-192.png',
          badge: '/scheduler/icons/icon-192.png'
        });
        alert('✅ Browser notification sent!');
      } else {
        alert('⚠️ Please enable notifications first');
      }
    } catch (error) {
      console.error('Test notification error:', error);
    }
  };

  const renderStatusIcon = () => {
    switch (status) {
      case 'loading': return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'ready': return <Bell className="h-4 w-4" />;
      case 'subscribed': return <BellRing className="h-4 w-4 text-green-500" />;
      case 'blocked': return <BellOff className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Police Notification Test</h1>
        <p className="text-gray-600">Testing OneSignal integration for 129+ officers</p>
      </div>

      {/* Status Card */}
      <Alert className={`
        ${status === 'subscribed' ? 'border-green-500 bg-green-50' : ''}
        ${status === 'blocked' ? 'border-red-500 bg-red-50' : ''}
        ${status === 'ready' ? 'border-blue-500 bg-blue-50' : ''}
        ${status === 'loading' ? 'border-gray-500 bg-gray-50' : ''}
      `}>
        <div className="flex items-center gap-3">
          {renderStatusIcon()}
          <div>
            <AlertTitle className="flex items-center gap-2">
              Status: {status.toUpperCase()}
            </AlertTitle>
            <AlertDescription>
              {status === 'loading' && 'Checking OneSignal status...'}
              {status === 'ready' && 'Ready to subscribe to notifications'}
              {status === 'subscribed' && '✅ Successfully subscribed to notifications'}
              {status === 'blocked' && '❌ Notifications blocked. Please enable in browser settings.'}
            </AlertDescription>
          </div>
        </div>
      </Alert>

      {/* Debug Info */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Debug Information
        </h3>
        <div className="space-y-1 text-sm font-mono">
          <div>Script Loaded: {debugInfo.scriptLoaded ? '✅' : '❌'}</div>
          <div>OneSignal Instance: {debugInfo.oneSignalInstance ? '✅' : '❌'}</div>
          <div>Permission: {debugInfo.permission}</div>
          <div>Path: {debugInfo.windowPath}</div>
          <div>Methods: {debugInfo.oneSignalMethods?.join(', ') || 'None'}</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          onClick={handleSubscribe}
          disabled={status === 'subscribed' || status === 'blocked' || isTesting}
          className="w-full py-6 text-lg"
          size="lg"
        >
          {isTesting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            '🔔 SUBSCRIBE TO POLICE NOTIFICATIONS'
          )}
        </Button>

        <Button
          onClick={handleTestNotification}
          variant="outline"
          className="w-full"
          disabled={Notification.permission !== 'granted'}
        >
          Send Test Notification
        </Button>

        <div className="text-center text-sm text-gray-500">
          <p>Required for all 129+ officers to receive:</p>
          <ul className="list-disc list-inside mt-1">
            <li>Shift change alerts</li>
            <li>Emergency notifications</li>
            <li>Schedule updates</li>
          </ul>
        </div>
      </div>

      {/* Console Commands */}
      <div className="border rounded-lg p-4 bg-yellow-50">
        <h4 className="font-semibold mb-2">Debug Console Commands:</h4>
        <div className="space-y-1 text-sm">
          <code className="block bg-black text-white p-2 rounded">
            console.log('OneSignal:', window.OneSignal);
          </code>
          <code className="block bg-black text-white p-2 rounded">
            window.OneSignal?.showSlidedownPrompt()
          </code>
          <code className="block bg-black text-white p-2 rounded">
            window.OneSignal?.getUserId()
          </code>
        </div>
      </div>
    </div>
  );
};

export default NotificationTest;
