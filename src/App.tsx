import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { useIsMobile } from "./hooks/use-mobile";
import { UserProvider } from "@/contexts/UserContext";
import { QueryClientProvider } from "@/providers/QueryClientProvider";
import { useEffect, useState } from "react";
import { X, Download, Bell, Smartphone, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

declare global {
  interface Window {
    deferredPrompt: any;
  }
}

const App = () => {
  const isMobile = useIsMobile();
  const [notificationStatus, setNotificationStatus] = useState<{
    permission: NotificationPermission;
    subscribed: boolean;
  }>({
    permission: 'default',
    subscribed: false
  });
  const [pwaStatus, setPwaStatus] = useState({
    isInstallable: false,
    isInstalled: false,
    serviceWorkerActive: false,
    hasManifest: false,
    showInstallPrompt: false,
    deferredPrompt: null as any
  });
  const [showStatusPanel, setShowStatusPanel] = useState(true);
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null);
  const [showNotificationBanner, setShowNotificationBanner] = useState(false);
  const [subscriptionMessage, setSubscriptionMessage] = useState<string>('');

  // Auto-hide status panel after 10 seconds if everything is ready
  useEffect(() => {
    if (notificationStatus.permission === 'granted' && pwaStatus.serviceWorkerActive) {
      const timer = setTimeout(() => {
        setShowStatusPanel(false);
      }, 10000);
      
      setAutoHideTimer(timer);
      
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [notificationStatus.permission, pwaStatus.serviceWorkerActive]);

  // Enhanced PWA Status Check and Service Worker Registration
  useEffect(() => {
    console.log('📱 Initializing PWA functionality...');
    
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
            hasManifest,
            showInstallPrompt: !isInstalled && serviceWorkerActive && hasManifest
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
    const handleBeforeInstallPrompt = (e: any) => {
      console.log('🎯 PWA install prompt event fired!');
      e.preventDefault();
      
      // Save the event for later use
      const deferredPrompt = e;
      setPwaStatus(prev => ({ 
        ...prev, 
        isInstallable: true,
        deferredPrompt,
        showInstallPrompt: true
      }));
      
      // Also save to window for backup
      window.deferredPrompt = e;
      
      toast.info("Police Scheduler can be installed as an app!", {
        duration: 5000,
        action: {
          label: "Install",
          onClick: () => installPWA()
        }
      });
    };
    
    const handleAppInstalled = () => {
      console.log('✅ PWA installed successfully');
      setPwaStatus(prev => ({ 
        ...prev, 
        isInstallable: false, 
        isInstalled: true,
        showInstallPrompt: false,
        deferredPrompt: null
      }));
      window.deferredPrompt = null;
      
      toast.success("Police Scheduler installed successfully!");
    };
    
    // Register service workers for PWA
    const registerServiceWorkers = async () => {
      if (!('serviceWorker' in navigator)) {
        console.log('❌ Service Workers not supported');
        return;
      }
      
      try {
        // Try to register service worker for PWA
        try {
          const registration = await navigator.serviceWorker.register(
            '/service-worker.js',
            { 
              scope: '/',
              updateViaCache: 'none'
            }
          );
          console.log('✅ PWA Service Worker registered:', registration.scope);
          
          if (registration.active) {
            setPwaStatus(prev => ({ ...prev, serviceWorkerActive: true }));
          }
        } catch (error) {
          console.log('⚠️ PWA service worker registration failed, trying scheduler path:', error);
          
          // Fallback to scheduler path
          try {
            const schedulerReg = await navigator.serviceWorker.register(
              '/scheduler/service-worker.js',
              { 
                scope: '/scheduler/',
                updateViaCache: 'none'
              }
            );
            console.log('✅ Scheduler service worker registered:', schedulerReg.scope);
            
            if (schedulerReg.active) {
              setPwaStatus(prev => ({ ...prev, serviceWorkerActive: true }));
            }
          } catch (schedulerError) {
            console.error('❌ Scheduler service worker also failed:', schedulerError);
          }
        }
        
      } catch (error) {
        console.error('❌ Service worker registration failed:', error);
      }
    };
    
    // Set up event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    // Initial checks
    checkPWAStatus();
    registerServiceWorkers();
    
    // Periodic checks
    const interval = setInterval(checkPWAStatus, 5000);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearInterval(interval);
    };
  }, []);

  // Browser Notification Initialization
  useEffect(() => {
    console.log('🔔 Setting up browser notifications...');
    
    const initializeNotifications = async () => {
      // Check browser permission
      const browserPermission = Notification.permission;
      console.log('🔔 Browser notification permission:', browserPermission);
      
      // Update state
      setNotificationStatus(prev => ({
        ...prev,
        permission: browserPermission
      }));
      
      // Check if user has already subscribed (stored in database)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('notification_subscribed')
          .eq('id', session.user.id)
          .single();
          
        if (profile?.notification_subscribed && browserPermission === 'granted') {
          setNotificationStatus(prev => ({
            ...prev,
            subscribed: true
          }));
          setShowNotificationBanner(false);
        } else if (browserPermission === 'default') {
          // Show banner if permission hasn't been requested yet
          setShowNotificationBanner(true);
        }
      }
    };
    
    initializeNotifications();
  }, []);

  // Trigger subscription prompt for browser notifications
  const triggerSubscriptionPrompt = async () => {
    console.log('🎯 Requesting browser notification permission...');
    
    // Show loading message
    setSubscriptionMessage('🔄 Requesting notification permission...');
    
    try {
      // Request browser permission
      const browserPermission = await Notification.requestPermission();
      console.log('Browser permission result:', browserPermission);
      
      if (browserPermission === 'granted') {
        // Browser permission granted
        setSubscriptionMessage('✅ Browser notifications enabled!');
        
        // Update state
        setNotificationStatus(prev => ({
          ...prev,
          permission: 'granted',
          subscribed: true
        }));
        
        // Store in database
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          await supabase
            .from('profiles')
            .update({ 
              notification_subscribed: true,
              notification_subscribed_at: new Date().toISOString(),
              notification_provider: 'browser'
            })
            .eq('id', session.user.id);
        }
        
        setShowNotificationBanner(false);
        
        // Show success message
        toast.success("Notifications enabled! You'll receive shift alerts.");
        
      } else if (browserPermission === 'denied') {
        setSubscriptionMessage('❌ Notifications blocked in browser settings');
        setNotificationStatus(prev => ({ ...prev, permission: 'denied' }));
        toast.error("Notifications blocked. Please enable them in browser settings.");
      } else {
        setSubscriptionMessage('❌ Notification permission not granted');
        setNotificationStatus(prev => ({ ...prev, permission: 'default' }));
      }
      
    } catch (error) {
      console.error('❌ Error requesting permission:', error);
      setSubscriptionMessage('❌ Failed to request permission');
      toast.error("Failed to enable notifications. Please try again.");
    }
    
    // Clear message after 3 seconds
    setTimeout(() => {
      setSubscriptionMessage('');
    }, 3000);
  };

  // Test notification function using browser notifications
  const testNotification = async () => {
    // First check if we have browser permission
    if (Notification.permission !== 'granted') {
      toast.error('You need to enable notifications first.');
      triggerSubscriptionPrompt();
      return;
    }
    
    try {
      // Use browser notifications
      const notification = new Notification('Police Department Test', {
        body: 'This is a test notification from the Police Department Scheduler',
        icon: '/scheduler/icon-192.png',
        tag: 'test-notification',
        badge: '/scheduler/icon-192.png'
      });
      
      notification.onclick = () => {
        window.focus();
      };
      
      toast.success("Test notification sent via browser!");
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error("Failed to send test notification");
    }
  };

  // WORKING PWA install function
  const installPWA = async () => {
    console.log('📲 Attempting PWA installation...');
    
    // Check if already installed
    if (pwaStatus.isInstalled) {
      toast.info("App is already installed!");
      return;
    }
    
    // Check for deferred prompt
    const deferredPrompt = pwaStatus.deferredPrompt || window.deferredPrompt;
    
    if (deferredPrompt) {
      try {
        console.log('🔄 Showing installation prompt...');
        deferredPrompt.prompt();
        
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`✅ User choice: ${outcome}`);
        
        if (outcome === 'accepted') {
          console.log('🎉 User accepted PWA installation');
          toast.success("Police Scheduler is installing...");
        } else {
          console.log('❌ User dismissed PWA installation');
          setPwaStatus(prev => ({ ...prev, showInstallPrompt: false }));
          toast.info("Installation canceled. You can install later.");
        }
        
        // Clear the prompt
        setPwaStatus(prev => ({ ...prev, deferredPrompt: null }));
        window.deferredPrompt = null;
        
      } catch (error) {
        console.error('❌ Error during PWA installation:', error);
        showManualInstallInstructions();
      }
    } else {
      showManualInstallInstructions();
    }
  };

  const showManualInstallInstructions = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    let message = '';
    let title = 'Install Police Scheduler';
    
    if (isIOS) {
      message = '1. Tap the Share button (⎋) at the bottom\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" in the top right';
    } else if (isAndroid) {
      message = '1. Tap the menu (⋮) in your browser\n2. Tap "Install app" or "Add to Home screen"\n3. Confirm the installation';
    } else {
      message = '1. Click the menu (⋮) in your browser\n2. Look for "Install Police Scheduler"\n3. Click to install';
      title = 'Install App';
    }
    
    toast(
      <div className="space-y-2">
        <div className="font-semibold">{title}</div>
        <div className="text-sm whitespace-pre-line">{message}</div>
      </div>,
      { duration: 10000 }
    );
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

  const hideInstallPrompt = () => {
    setPwaStatus(prev => ({ ...prev, showInstallPrompt: false }));
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
            {/* REMOVED: OneSignal Debug Component */}
            
            {/* Subscription Status Message */}
            {subscriptionMessage && (
              <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md animate-slide-down">
                <div className={`p-4 rounded-lg shadow-lg ${
                  subscriptionMessage.includes('✅') 
                    ? 'bg-green-100 border border-green-300 text-green-800' 
                    : subscriptionMessage.includes('❌')
                    ? 'bg-red-100 border border-red-300 text-red-800'
                    : 'bg-blue-100 border border-blue-300 text-blue-800'
                }`}>
                  <div className="flex items-center gap-2">
                    {subscriptionMessage.includes('✅') && <CheckCircle className="h-5 w-5" />}
                    <span className="font-medium">{subscriptionMessage}</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Notification Subscription Banner */}
            {showNotificationBanner && !notificationStatus.subscribed && Notification.permission === 'default' && (
              <div className="fixed top-0 left-0 right-0 z-40 bg-blue-600 text-white p-4 shadow-lg">
                <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Bell className="h-6 w-6" />
                    <div>
                      <h3 className="font-bold">Police Department Notifications</h3>
                      <p className="text-sm opacity-90">Required for all officers to receive shift alerts and emergency notifications</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={triggerSubscriptionPrompt}
                      className="bg-white text-blue-600 hover:bg-gray-100 font-semibold"
                    >
                      Enable Notifications
                    </Button>
                    <Button
                      onClick={() => setShowNotificationBanner(false)}
                      variant="outline"
                      className="text-white border-white hover:bg-blue-700"
                    >
                      Not Now
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Custom PWA Install Prompt */}
            {pwaStatus.showInstallPrompt && !pwaStatus.isInstalled && (
              <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-slide-up">
                <div className="bg-white rounded-lg shadow-xl border border-blue-200 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Smartphone className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">Install Police Scheduler</h3>
                        <p className="text-sm text-gray-600">Get quick access to your shifts</p>
                      </div>
                    </div>
                    <button
                      onClick={hideInstallPrompt}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <span>Works offline</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <span>Push notifications</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <span>Quick access from home screen</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={installPWA}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Install App
                    </Button>
                    <Button
                      onClick={hideInstallPrompt}
                      variant="outline"
                      className="flex-1"
                    >
                      Not Now
                    </Button>
                  </div>
                  
                  <p className="text-xs text-gray-500 mt-3">
                    For all 129+ officers • Secure HTTPS connection
                  </p>
                </div>
              </div>
            )}
            
            {/* Status Indicator Panel */}
            {shouldShowPanel ? (
              <div style={{
                position: 'fixed',
                top: showNotificationBanner ? 80 : 10,
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
                    @keyframes slide-up {
                      from {
                        transform: translateY(100%);
                        opacity: 0;
                      }
                      to {
                        transform: translateY(0);
                        opacity: 1;
                      }
                    }
                    @keyframes slide-down {
                      from {
                        transform: translateY(-100%);
                        opacity: 0;
                      }
                      to {
                        transform: translateY(0);
                        opacity: 1;
                      }
                    }
                    .animate-slide-up {
                      animation: slide-up 0.3s ease-out;
                    }
                    .animate-slide-down {
                      animation: slide-down 0.3s ease-out;
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
                    background: notificationStatus.permission === 'granted' ? '#10b981' : '#f59e0b'
                  }} />
                  <strong>Notifications:</strong> {notificationStatus.subscribed ? '✅ Enabled' : '❌ Disabled'}
                </div>
                
                <div style={{ marginBottom: '8px' }}>
                  <strong>Browser Permission:</strong> {Notification.permission}
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
                    onClick={triggerSubscriptionPrompt}
                    style={{
                      background: notificationStatus.subscribed ? '#10b981' : '#3b82f6',
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
                    {notificationStatus.subscribed ? '✅ Notifications Enabled' : '🔔 Enable Notifications'}
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
                    disabled={Notification.permission !== 'granted'}
                  >
                    Test Notification
                  </button>
                  
                  {pwaStatus.showInstallPrompt && (
                    <button
                      onClick={installPWA}
                      style={{
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        width: '100%'
                      }}
                    >
                      📱 Install App
                    </button>
                  )}
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
            </div>
          </UserProvider>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
