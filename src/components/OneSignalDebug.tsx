import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Bell } from 'lucide-react';

export const OneSignalDebug = () => {
  const [status, setStatus] = useState({
    scriptLoaded: false,
    serviceWorkerSupported: false,
    serviceWorkersRegistered: 0,
    oneSignalInstance: false,
    permission: 'unknown' as string,
    isSubscribed: false,
    environment: 'unknown'
  });

  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 9)]);
  };

  const checkStatus = () => {
    addLog('Checking OneSignal status...');
    
    const newStatus = {
      scriptLoaded: typeof window.OneSignalDeferred !== 'undefined',
      serviceWorkerSupported: 'serviceWorker' in navigator,
      serviceWorkersRegistered: 0,
      oneSignalInstance: typeof window.OneSignal !== 'undefined',
      permission: 'unknown',
      isSubscribed: false,
      environment: import.meta.env.DEV ? 'development' : 'production'
    };

    // Check service workers
    if (newStatus.serviceWorkerSupported) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        newStatus.serviceWorkersRegistered = registrations.length;
        
        // Look for OneSignal worker
        const onesignalWorker = registrations.find(reg => 
          reg.scope.includes('OneSignal') || reg.active?.scriptURL?.includes('OneSignal')
        );
        
        if (onesignalWorker) {
          addLog(`Found OneSignal service worker: ${onesignalWorker.scope}`);
        }
        
        setStatus(prev => ({ ...prev, ...newStatus }));
      });
    }

    // Check notification permission
    if (window.OneSignal) {
      window.OneSignal.getNotificationPermission?.().then(permission => {
        setStatus(prev => ({ ...prev, permission }));
      });
      
      window.OneSignal.getSubscription?.().then(isSubscribed => {
        setStatus(prev => ({ ...prev, isSubscribed }));
      });
    }

    setStatus(newStatus);
    addLog('Status check completed');
  };

  useEffect(() => {
    checkStatus();
    
    // Listen for OneSignal events
    const handleReady = () => {
      addLog('OneSignal ready event received');
      checkStatus();
    };
    
    window.addEventListener('onesignal-ready', handleReady);
    
    return () => {
      window.removeEventListener('onesignal-ready', handleReady);
    };
  }, []);

  const testNotification = () => {
    addLog('Attempting to send test notification...');
    
    if (window.OneSignal && window.OneSignal.sendSelfNotification) {
      window.OneSignal.sendSelfNotification({
        headings: { en: 'PAPD Test Alert' },
        contents: { en: 'This is a test notification from the debug panel' },
        url: '/dashboard'
      }).then(() => {
        addLog('Test notification sent successfully');
      }).catch((error: Error) => {
        addLog(`Failed to send test notification: ${error.message}`);
      });
    } else {
      addLog('OneSignal.sendSelfNotification not available');
    }
  };

  const requestPermission = () => {
    addLog('Requesting notification permission...');
    
    if (window.OneSignal && window.OneSignal.registerForPushNotifications) {
      window.OneSignal.registerForPushNotifications().then((permission: string) => {
        addLog(`Permission result: ${permission}`);
        checkStatus();
      }).catch((error: Error) => {
        addLog(`Permission request failed: ${error.message}`);
      });
    } else {
      addLog('OneSignal.registerForPushNotifications not available');
    }
  };

  return (
    <Card className="fixed bottom-4 right-4 w-96 z-50 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            OneSignal Debug
          </span>
          <Badge variant={import.meta.env.DEV ? "default" : "secondary"}>
            {import.meta.env.DEV ? 'DEV' : 'PROD'}
          </Badge>
        </CardTitle>
        <CardDescription>
          Debug panel for push notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Indicators */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Script Loaded</span>
            {status.scriptLoaded ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm">Service Worker Support</span>
            {status.serviceWorkerSupported ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm">OneSignal Instance</span>
            {status.oneSignalInstance ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm">Permission</span>
            <Badge variant={
              status.permission === 'granted' ? 'default' :
              status.permission === 'denied' ? 'destructive' : 'secondary'
            }>
              {status.permission}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm">Service Workers</span>
            <Badge variant="outline">{status.serviceWorkersRegistered}</Badge>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={checkStatus}
            className="flex-1"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
          
          <Button 
            size="sm" 
            variant="outline" 
            onClick={testNotification}
            className="flex-1"
            disabled={!status.oneSignalInstance}
          >
            <Bell className="h-3 w-3 mr-1" />
            Test
          </Button>
          
          <Button 
            size="sm" 
            onClick={requestPermission}
            className="flex-1"
            disabled={!status.oneSignalInstance || status.permission === 'granted'}
          >
            Enable
          </Button>
        </div>

        {/* Logs */}
        <div className="border rounded-md p-2 max-h-32 overflow-y-auto">
          <div className="text-xs font-medium mb-1">Recent Logs:</div>
          {logs.length === 0 ? (
            <div className="text-xs text-muted-foreground">No logs yet</div>
          ) : (
            <div className="space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="text-xs font-mono text-muted-foreground">
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Environment Info */}
        <div className="text-xs text-muted-foreground">
          <div>URL: {window.location.href}</div>
          <div>Path: {window.location.pathname}</div>
          <div>App ID: {import.meta.env.VITE_ONESIGNAL_APP_ID?.substring(0, 10)}...</div>
        </div>
      </CardContent>
    </Card>
  );
};
