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
import { OneSignalDebug } from "@/components/OneSignalDebug";
import { useEffect, useState } from "react";
import { X, Download, Bell, Smartphone, CheckCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

declare global {
  interface Window {
    OneSignal: any;
    deferredPrompt: any;
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
    hasManifest: false,
    showInstallPrompt: false,
    deferredPrompt: null as any
  });
  const [showStatusPanel, setShowStatusPanel] = useState(true);
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null);
  const [showNotificationBanner, setShowNotificationBanner] = useState(false);
  const [subscriptionMessage, setSubscriptionMessage] = useState<string>('');
  const [isInitializingOneSignal, setIsInitializingOneSignal] = useState(false);

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
          // First try at root scope (for PWA)
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

  // SIMPLE OneSignal Initialization - Using browser notifications as fallback
  useEffect(() => {
    console.log('🚀 Setting up notifications...');
    
    const initializeNotifications = async () => {
      // First, check browser permission
      const browserPermission = Notification.permission;
      console.log('🔔 Browser notification permission:', browserPermission);
      
      if (browserPermission === 'granted') {
        // Already have permission
        setOneSignalStatus(prev => ({
          ...prev,
          permission: 'granted',
          initialized: true
        }));
        
        // Check if we have a OneSignal ID stored
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('onesignal_user_id, notification_subscribed')
            .eq('id', session.user.id)
            .single();
            
          if (profile?.onesignal_user_id && profile.notification_subscribed) {
            setOneSignalStatus(prev => ({
              ...prev,
              subscribed: true,
              userId: profile.onesignal_user_id
            }));
            setShowNotificationBanner(false);
          }
        }
      } else if (browserPermission === 'denied') {
        setOneSignalStatus(prev => ({
          ...prev,
          permission: 'denied',
          initialized: true
        }));
        setShowNotificationBanner(false);
      }
      
      // Try to initialize OneSignal if available
      initializeOneSignal();
    };
    
    initializeNotifications();
  }, []);

  // Try to initialize OneSignal
  const initializeOneSignal = async () => {
    if (isInitializingOneSignal || oneSignalStatus.initialized) return;
    
    setIsInitializingOneSignal(true);
    console.log('🔄 Attempting OneSignal initialization...');
    
    try {
      // Check if OneSignal SDK is loaded
      if (typeof window.OneSignal === 'undefined') {
        console.log('⏳ OneSignal SDK not loaded yet');
        setIsInitializingOneSignal(false);
        return;
      }
      
      // Initialize OneSignal
      await window.OneSignal.init({
        appId: "3417d840-c226-40ba-92d6-a7590c31eef3",
        safari_web_id: "web.onesignal.auto.1d0d9a2a-074d-4411-b3af-2aed688566e1",
        
        // Service worker paths for GitHub Pages
        serviceWorkerPath: '/OneSignalSDKWorker.js',
        serviceWorkerParam: { scope: '/' },
        
        // Disable auto-prompt (we'll handle it manually)
        autoPrompt: false,
        
        // Prompt settings
        promptOptions: {
          slidedown: {
            enabled: true,
            autoPrompt: false,
            timeDelay: 3,
            pageViews: 1,
            actionMessage: "Get police department shift alerts",
            acceptButtonText: "ALLOW",
            cancelButtonText: "NO THANKS"
          }
        },
        
        // Welcome notification
        welcomeNotification: {
          disable: false,
          title: "Port Arthur PD Notifications",
          message: "You'll receive shift alerts and emergency notifications"
        },
        
        notifyButton: {
          enable: false
        },
        
        // GitHub Pages settings
        allowLocalhostAsSecureOrigin: true,
        autoResubscribe: true,
        persistNotification: false,
        autoRegister: true,
        httpPermissionRequest: {
          enable: true
        }
      });
      
      console.log('✅ OneSignal initialized');
      setOneSignalStatus(prev => ({ ...prev, initialized: true }));
      
      // Check subscription status
      await checkOneSignalSubscription();
      
      // Set up subscription change listener
      window.OneSignal.on('subscriptionChange', async (isSubscribed: boolean) => {
        console.log(`🔔 OneSignal subscriptionChange: ${isSubscribed}`);
        
        if (isSubscribed) {
          try {
            const onesignalUserId = await window.OneSignal.getUserId();
            console.log(`🎉 User subscribed with OneSignal ID: ${onesignalUserId}`);
            
            // Store in database
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id && onesignalUserId) {
              await supabase
                .from('profiles')
                .update({ 
                  onesignal_user_id: onesignalUserId,
                  notification_subscribed: true,
                  notification_subscribed_at: new Date().toISOString()
                })
                .eq('id', session.user.id);
              
              console.log('✅ OneSignal ID saved to profile');
            }
          } catch (error) {
            console.error('Error saving OneSignal ID:', error);
          }
        }
        
        // Get the userId asynchronously
        let userId = null;
        if (isSubscribed) {
          try {
            userId = await window.OneSignal.getUserId();
          } catch (error) {
            console.error('Error getting OneSignal userId:', error);
          }
        }
        
        setOneSignalStatus(prev => ({
          ...prev,
          subscribed: isSubscribed,
          userId: userId
        }));
        
        if (isSubscribed) {
          setShowNotificationBanner(false);
        }
      });
      
    } catch (error) {
      console.error('❌ OneSignal initialization failed:', error);
      // OneSignal failed, but we still have browser notifications
      setOneSignalStatus(prev => ({ ...prev, initialized: true }));
    } finally {
      setIsInitializingOneSignal(false);
    }
  };

  // Check OneSignal subscription status
  const checkOneSignalSubscription = async () => {
    if (!window.OneSignal || typeof window.OneSignal.getUserId !== 'function') {
      return null;
    }
    
    try {
      const userId = await window.OneSignal.getUserId();
      const permission = await window.OneSignal.getNotificationPermission();
      const isSubscribed = !!userId;
      
      console.log('🔍 OneSignal Subscription Status:', {
        userId: userId || 'Not subscribed',
        permission,
        isSubscribed
      });
      
      setOneSignalStatus(prev => ({
        ...prev,
        userId,
        subscribed: isSubscribed,
        permission
      }));
      
      if (isSubscribed) {
        setShowNotificationBanner(false);
      }
      
      return { userId, isSubscribed, permission };
    } catch (error) {
      console.error('Error checking OneSignal subscription:', error);
      return null;
    }
  };

  // WORKING: Manually trigger subscription prompt
  const triggerSubscriptionPrompt = async () => {
    console.log('🎯 Triggering subscription prompt...');
    
    // Show loading message
    setSubscriptionMessage('🔄 Requesting notification permission...');
    
    try {
      // First, try browser's native permission request (this always works)
      const browserPermission = await Notification.requestPermission();
      console.log('Browser permission result:', browserPermission);
      
      if (browserPermission === 'granted') {
        // Browser permission granted
        setSubscriptionMessage('✅ Browser notifications enabled!');
        
        // Update state
        setOneSignalStatus(prev => ({
          ...prev,
          permission: 'granted',
          subscribed: true,
          initialized: true
        }));
        
        // Store in database (using browser as provider)
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
        
        // Try to initialize OneSignal after permission is granted
        setTimeout(() => {
          initializeOneSignal();
        }, 1000);
        
      } else if (browserPermission === 'denied') {
        setSubscriptionMessage('❌ Notifications blocked in browser settings');
        setOneSignalStatus(prev => ({ ...prev, permission: 'denied' }));
        toast.error("Notifications blocked. Please enable them in browser settings.");
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

  // Test notification function
  const testNotification = async () => {
    // First check if we have browser permission
    if (Notification.permission !== 'granted') {
      alert('You need to enable notifications first.');
      triggerSubscriptionPrompt();
      return;
    }
    
    try {
      // Try to send via OneSignal if available
      if (window.OneSignal && oneSignalStatus.subscribed) {
        await window.OneSignal.sendSelfNotification({
          headings: { en: 'Test Notification' },
          contents: { en: 'This is a test notification from the Police Department Scheduler' },
          url: window.location.href
        });
        toast.success("Test notification sent via OneSignal!");
      } else {
        // Fallback to browser notifications
        const notification = new Notification('Police Department Test', {
          body: 'This is a test notification from the Police Department Scheduler',
          icon: '/scheduler/icon-192.png',
          tag: 'test-notification'
        });
        
        notification.onclick = () => {
          window.focus();
        };
        
        toast.success("Test notification sent via browser!");
      }
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
            {/* OneSignal Debug Component */}
            {import.meta.env.DEV && <OneSignalDebug />}
            
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
            {showNotificationBanner && !oneSignalStatus.subscribed && Notification.permission === 'default' && (
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
                    background: oneSignalStatus.initialized ? '#10b981' : '#f59e0b'
                  }} />
                  <strong>Notifications:</strong> {oneSignalStatus.subscribed ? '✅ Enabled' : '❌ Disabled'}
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
