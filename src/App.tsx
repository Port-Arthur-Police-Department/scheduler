import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { useIsMobile } from "./hooks/use-mobile";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";
import { UserProvider } from "@/contexts/UserContext";
import { QueryClientProvider } from "@/providers/QueryClientProvider";
import { OneSignalDebug } from "@/components/OneSignalDebug";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

declare global {
  interface Window {
    OneSignal: any;
    OneSignalDeferred: any[];
  }
}

const App = () => {
  const isMobile = useIsMobile();
  const [oneSignalStatus, setOneSignalStatus] = useState<{
    initialized: boolean;
    userId: string | null;
    subscribed: boolean;
    permission: string;
  }>({
    initialized: false,
    userId: null,
    subscribed: false,
    permission: 'default'
  });
  const [pwaStatus, setPwaStatus] = useState({
    isInstallable: false,
    isInstalled: false,
    serviceWorkerActive: false,
    hasManifest: false
  });
  const [showStatusPanel, setShowStatusPanel] = useState(true);
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null);

  // Check and log current subscription status
  const checkSubscriptionStatus = async () => {
    if (!window.OneSignal) return;
    
    try {
      const userId = await window.OneSignal.getUserId();
      const permission = await window.OneSignal.getNotificationPermission();
      const isSubscribed = !!userId;
      
      console.log('🔍 Current Subscription Status:', {
        userId,
        permission,
        isSubscribed,
        hasOneSignal: !!window.OneSignal
      });
      
      setOneSignalStatus(prev => ({
        ...prev,
        userId,
        subscribed: isSubscribed,
        permission
      }));
      
      return { userId, isSubscribed, permission };
    } catch (error) {
      console.error('Error checking subscription:', error);
      return null;
    }
  };

  // Auto-hide status panel after 10 seconds if everything is ready
  useEffect(() => {
    if (oneSignalStatus.initialized && pwaStatus.serviceWorkerActive) {
      const timer = setTimeout(() => {
        setShowStatusPanel(false);
      }, 10000);
      
      setAutoHideTimer(timer);
      
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [oneSignalStatus.initialized, pwaStatus.serviceWorkerActive]);

  // PWA Status Check
  useEffect(() => {
    const checkPWAStatus = () => {
      // Check if installed
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isInWebAppiOS = (window.navigator as any).standalone === true;
      const isInstalled = isStandalone || isInWebAppiOS;
      
      // Check manifest
      const hasManifest = document.querySelector('link[rel="manifest"]') !== null;
      
      // Check service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(registration => {
          const serviceWorkerActive = !!registration?.active;
          
          setPwaStatus(prev => ({
            ...prev,
            isInstalled,
            serviceWorkerActive,
            hasManifest
          }));
        });
      } else {
        setPwaStatus(prev => ({
          ...prev,
          isInstalled,
          hasManifest
        }));
      }
    };
    
    // Handle PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      console.log('📱 PWA install prompt available');
      (window as any).deferredPrompt = e;
      setPwaStatus(prev => ({ ...prev, isInstallable: true }));
    };
    
    const handleAppInstalled = () => {
      console.log('✅ PWA installed');
      setPwaStatus(prev => ({ 
        ...prev, 
        isInstallable: false, 
        isInstalled: true 
      }));
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    // Initial check
    checkPWAStatus();
    
    // Periodic checks
    const interval = setInterval(checkPWAStatus, 5000);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearInterval(interval);
    };
  }, []);

  // Enhanced OneSignal Initialization
  useEffect(() => {
    console.log('🚀 Starting enhanced OneSignal initialization...');
    
    const initializeOneSignal = async () => {
      // Wait for OneSignal to be available
      if (!window.OneSignal || typeof window.OneSignal.init !== 'function') {
        console.log('⏳ OneSignal not loaded yet, checking script...');
        
        // Check if script is already loaded
        const oneSignalScript = document.querySelector('script[src*="onesignal"]');
        if (!oneSignalScript) {
          console.log('📦 Loading OneSignal SDK...');
          const script = document.createElement('script');
          script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
          script.defer = true;
          script.onload = () => {
            console.log('✅ OneSignal SDK loaded');
            setTimeout(initializeOneSignal, 1000);
          };
          document.head.appendChild(script);
          return;
        }
        
        setTimeout(initializeOneSignal, 2000);
        return;
      }

      try {
        console.log('⚙️ Configuring OneSignal...');
        
        // First, check current state
        const currentState = await checkSubscriptionStatus();
        
        // Initialize with proper configuration
        await window.OneSignal.init({
          appId: "3417d840-c226-40ba-92d6-a7590c31eef3",
          safari_web_id: "web.onesignal.auto.1d0d9a2a-074d-4411-b3af-2aed688566e1",
          
          // GitHub Pages configuration
          serviceWorkerPath: '/scheduler/OneSignalSDKWorker.js',
          serviceWorkerParam: { scope: '/scheduler/' },
          
          // Critical settings
          allowLocalhostAsSecureOrigin: true,
          autoResubscribe: true,
          persistNotification: false,
          
          // Prompt configuration
          promptOptions: {
            slidedown: {
              enabled: true,
              autoPrompt: true,
              timeDelay: 1,
              pageViews: 1,
              prompts: [
                {
                  type: "push",
                  text: {
                    actionMessage: "Get notified about shift changes, emergencies, and department announcements",
                    acceptButton: "Allow",
                    cancelButton: "Not now"
                  }
                }
              ]
            }
          },
          
          // Welcome notification
          welcomeNotification: {
            disable: false,
            title: "Welcome to Port Arthur PD Scheduler",
            message: "You'll now receive notifications about your shifts and department alerts.",
            url: window.location.href
          }
        });

        console.log('✅ OneSignal initialized');
        setOneSignalStatus(prev => ({ ...prev, initialized: true }));
        
        // Set up subscription change listener
        window.OneSignal.on('subscriptionChange', async (isSubscribed: boolean) => {
          console.log(`🔔 Subscription changed: ${isSubscribed ? 'SUBSCRIBED' : 'UNSUBSCRIBED'}`);
          
          if (isSubscribed) {
            const userId = await window.OneSignal.getUserId();
            console.log(`🎉 User subscribed with ID: ${userId}`);
            
            // Set tags for police department
            try {
              await window.OneSignal.sendTags({
                department: 'port-arthur-pd',
                user_type: 'officer',
                app: 'scheduler',
                environment: import.meta.env.PROD ? 'production' : 'development',
                subscribed_at: new Date().toISOString()
              });
              console.log('✅ Tags set successfully');
            } catch (tagError) {
              console.error('Error setting tags:', tagError);
            }
            
            // Send welcome notification
            try {
              await window.OneSignal.sendSelfNotification({
                headings: { en: 'Notifications Enabled' },
                contents: { en: 'You will now receive shift alerts and department notifications.' },
                url: window.location.href
              });
            } catch (notifError) {
              console.log('Could not send welcome notification:', notifError);
            }
          }
          
          // Update state
          const newStatus = await checkSubscriptionStatus();
          if (newStatus) {
            setOneSignalStatus(prev => ({
              ...prev,
              userId: newStatus.userId,
              subscribed: newStatus.isSubscribed,
              permission: newStatus.permission
            }));
          }
        });

        // Check initial subscription status
        setTimeout(async () => {
          const status = await checkSubscriptionStatus();
          if (status) {
            setOneSignalStatus(prev => ({
              ...prev,
              userId: status.userId,
              subscribed: status.isSubscribed,
              permission: status.permission
            }));
            
            // If not subscribed, show prompt
            if (!status.isSubscribed && status.permission === 'default') {
              console.log('🔄 Showing notification prompt...');
              setTimeout(() => {
                if (window.OneSignal) {
                  window.OneSignal.showSlidedownPrompt();
                }
              }, 2000);
            }
          }
        }, 3000);

      } catch (error) {
        console.error('❌ OneSignal initialization failed:', error);
      }
    };

    // Start initialization
    initializeOneSignal();

    // Set up periodic subscription checks
    const subscriptionCheckInterval = setInterval(() => {
      if (window.OneSignal) {
        checkSubscriptionStatus();
      }
    }, 30000); // Check every 30 seconds

    return () => {
      clearInterval(subscriptionCheckInterval);
    };
  }, []);

  // Register Service Workers
  useEffect(() => {
    const registerServiceWorkers = async () => {
      if (!('serviceWorker' in navigator)) {
        console.log('❌ Service Workers not supported');
        return;
      }
      
      try {
        console.log('🛠️ Registering service workers...');
        
        // Register OneSignal worker
        try {
          const oneSignalReg = await navigator.serviceWorker.register(
            '/scheduler/OneSignalSDKWorker.js',
            { scope: '/scheduler/', updateViaCache: 'none' }
          );
          console.log('✅ OneSignal worker registered:', oneSignalReg.scope);
        } catch (error) {
          console.log('⚠️ OneSignal worker registration failed:', error);
        }
        
        // Register app service worker
        try {
          const appReg = await navigator.serviceWorker.register(
            '/scheduler/service-worker.js',
            { scope: '/scheduler/', updateViaCache: 'none' }
          );
          console.log('✅ App service worker registered:', appReg.scope);
        } catch (error) {
          console.log('⚠️ App service worker registration failed:', error);
        }
        
      } catch (error) {
        console.error('❌ Service worker registration failed:', error);
      }
    };
    
    const timer = setTimeout(registerServiceWorkers, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Test notification function
  const testNotification = async () => {
    if (!window.OneSignal) {
      alert('OneSignal not loaded yet. Please wait a moment.');
      return;
    }

    // Check subscription status first
    const status = await checkSubscriptionStatus();
    
    if (!status?.isSubscribed) {
      alert('You need to enable push notifications first. Click "Enable Notifications" below.');
      
      // Show the prompt
      if (status?.permission === 'default') {
        window.OneSignal.showSlidedownPrompt();
      }
      return;
    }

    console.log('📨 Sending test notification...');
    
    // This would normally come from your backend
    // For testing, we'll simulate it
    alert(`Test notification would be sent to User ID: ${status.userId}\n\n` +
          'In production, your backend would call OneSignal API with this user ID.');
    
    // Log the user ID for manual testing
    console.log('👤 User ID for testing:', status.userId);
    console.log('📋 Copy this ID to test in OneSignal dashboard:', status.userId);
    
    // You can test manually in OneSignal dashboard with this ID
  };

  // Enable notifications function
  const enableNotifications = () => {
    if (!window.OneSignal) {
      alert('OneSignal not ready yet. Please wait.');
      return;
    }
    
    const permission = oneSignalStatus.permission;
    
    if (permission === 'granted') {
      alert('Notifications are already enabled!');
    } else if (permission === 'denied') {
      alert('Notifications were blocked. Please enable them in your browser settings.');
    } else {
      // Show the prompt
      window.OneSignal.showSlidedownPrompt();
    }
  };

  const handleClosePanel = () => {
    setShowStatusPanel(false);
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
    }
  };

  const handleShowPanel = () => {
    setShowStatusPanel(true);
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
    }
    const newTimer = setTimeout(() => {
      setShowStatusPanel(false);
    }, 10000);
    setAutoHideTimer(newTimer);
  };

  // Only show in development mode
  const shouldShowPanel = import.meta.env.DEV && showStatusPanel;

  return (
    <QueryClientProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <UserProvider>
            {/* OneSignal Debug Component */}
            {import.meta.env.DEV && <OneSignalDebug />}
            
            {/* Status Indicator Panel */}
            {shouldShowPanel ? (
              <div style={{
                position: 'fixed',
                top: 10,
                right: 10,
                background: '#1e293b',
                color: 'white',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12px',
                zIndex: 9999,
                maxWidth: '280px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                border: '1px solid #334155',
                animation: 'slideInRight 0.3s ease-out'
              }}>
                <style>
                  {`
                    @keyframes slideInRight {
                      from {
                        transform: translateX(100%);
                        opacity: 0;
                      }
                      to {
                        transform: translateX(0);
                        opacity: 1;
                      }
                    }
                  `}
                </style>
                
                {/* Close Button */}
                <button
                  onClick={handleClosePanel}
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}
                >
                  <X size={14} />
                </button>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', marginRight: '16px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: oneSignalStatus.initialized ? '#10b981' : '#f59e0b'
                  }} />
                  <strong>OneSignal:</strong> {oneSignalStatus.initialized ? '✅ Ready' : '🔄 Loading...'}
                </div>
                
                <div style={{ marginBottom: '8px' }}>
                  <strong>Status:</strong> {oneSignalStatus.subscribed ? '✅ Subscribed' : '❌ Not subscribed'}
                  {oneSignalStatus.userId && (
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                      ID: {oneSignalStatus.userId.substring(0, 8)}...
                    </div>
                  )}
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: pwaStatus.serviceWorkerActive ? '#10b981' : '#ef4444'
                  }} />
                  <strong>PWA:</strong> {pwaStatus.isInstalled ? '✅ Installed' : pwaStatus.serviceWorkerActive ? '📱 Ready' : '🔧 Setting up...'}
                </div>
                
                {/* Action buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button
                    onClick={enableNotifications}
                    style={{
                      background: oneSignalStatus.subscribed ? '#10b981' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      width: '100%',
                      fontWeight: 'bold'
                    }}
                  >
                    {oneSignalStatus.subscribed ? '✅ Notifications Enabled' : '🔔 Enable Notifications'}
                  </button>
                  
                  <button
                    onClick={testNotification}
                    style={{
                      background: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                    disabled={!oneSignalStatus.subscribed}
                  >
                    Test Notification
                  </button>
                </div>
              </div>
            ) : import.meta.env.DEV && (
              <button
                onClick={handleShowPanel}
                style={{
                  position: 'fixed',
                  top: 10,
                  right: 10,
                  background: '#1e293b',
                  color: 'white',
                  border: 'none',
                  padding: '6px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  zIndex: 9999,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}
              >
                Status
              </button>
            )}
            
            <div className={isMobile ? "mobile-layout" : "desktop-layout"}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard isMobile={isMobile} />} />
                <Route path="/auth" element={<Auth />} />
                
                {/* Tab-specific routes */}
                <Route path="/daily-schedule" element={<Dashboard isMobile={isMobile} initialTab="daily" />} />
                <Route path="/weekly-schedule" element={<Dashboard isMobile={isMobile} initialTab="schedule" />} />
                <Route path="/vacancies" element={<Dashboard isMobile={isMobile} initialTab="vacancies" />} />
                <Route path="/staff" element={<Dashboard isMobile={isMobile} initialTab="staff" />} />
                <Route path="/time-off" element={<Dashboard isMobile={isMobile} initialTab="requests" />} />
                <Route path="/pto" element={<Dashboard isMobile={isMobile} initialTab="requests" />} />
                <Route path="/settings" element={<Dashboard isMobile={isMobile} initialTab="settings" />} />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
              
              {/* PWA Install Prompt */}
              {!pwaStatus.isInstalled && pwaStatus.serviceWorkerActive && (
                <PWAInstallPrompt />
              )}
            </div>
          </UserProvider>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
