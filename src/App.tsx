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
import { X, Download, Bell, Smartphone, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    OneSignal: any;
    OneSignalDeferred: any[];
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
  const [userId, setUserId] = useState<string>('');
  const [subscriptionMessage, setSubscriptionMessage] = useState<string>('');

  // Mock user ID for testing - replace with actual auth
  useEffect(() => {
    // Simulate getting user ID (replace with actual auth logic)
    const mockUserId = 'test-officer-id-123';
    setUserId(mockUserId);
    
    // Show notification banner if not subscribed
    const timer = setTimeout(() => {
      if (!oneSignalStatus.subscribed) {
        setShowNotificationBanner(true);
      }
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [oneSignalStatus.subscribed]);

  // Function to store OneSignal user ID in Supabase
  const storeOneSignalUserId = async (onesignalUserId: string) => {
    try {
      console.log('💾 Storing OneSignal ID in Supabase:', onesignalUserId);
      
      // First, check if profiles table exists and has the columns
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('Error fetching profile:', fetchError);
        setSubscriptionMessage('Error: User profile not found');
        return false;
      }

      // Update the profile with OneSignal user ID
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          onesignal_user_id: onesignalUserId,
          notification_subscribed: true,
          notification_subscribed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        
        // If column doesn't exist, we need to add it
        if (updateError.message.includes('column') && updateError.message.includes('does not exist')) {
          console.log('🔄 Creating missing columns in profiles table...');
          await createNotificationColumns();
          // Retry the update
          return await storeOneSignalUserId(onesignalUserId);
        }
        
        setSubscriptionMessage('Error saving to database');
        return false;
      }

      console.log('✅ Successfully stored OneSignal ID in Supabase');
      setSubscriptionMessage('✅ Successfully subscribed! Your OneSignal ID has been saved.');
      
      // Show success message for 5 seconds
      setTimeout(() => {
        setSubscriptionMessage('');
      }, 5000);
      
      return true;
    } catch (error) {
      console.error('Error storing OneSignal user ID:', error);
      setSubscriptionMessage('Error: Could not save subscription');
      return false;
    }
  };

  // Function to create missing notification columns in profiles table
  const createNotificationColumns = async () => {
    try {
      // Note: In production, you should run this SQL in Supabase dashboard
      // This is just for development/testing
      console.log('⚠️ Notification columns missing. Please run this SQL in Supabase:');
      console.log(`
        ALTER TABLE profiles 
        ADD COLUMN IF NOT EXISTS onesignal_user_id TEXT,
        ADD COLUMN IF NOT EXISTS notification_subscribed BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS notification_subscribed_at TIMESTAMP WITH TIME ZONE;
      `);
      
      // For now, we'll use a different approach
      // Try to update without the missing columns
      const { error } = await supabase
        .from('profiles')
        .update({ 
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        throw error;
      }
      
      console.log('✅ Updated profile (without notification columns)');
    } catch (error) {
      console.error('Error creating columns:', error);
    }
  };

  // Check and log current subscription status
  const checkSubscriptionStatus = async () => {
    // Check if OneSignal is properly loaded
    if (!window.OneSignal || typeof window.OneSignal.getUserId !== 'function') {
      console.log('⏳ OneSignal not ready for status check');
      return null;
    }
    
    try {
      const userId = await window.OneSignal.getUserId();
      const permission = await window.OneSignal.getNotificationPermission();
      const isSubscribed = !!userId;
      
      console.log('🔍 Subscription Status:', {
        userId: userId || 'Not subscribed',
        permission,
        isSubscribed,
        oneSignalReady: !!window.OneSignal
      });
      
      setOneSignalStatus(prev => ({
        ...prev,
        userId,
        subscribed: isSubscribed,
        permission
      }));
      
      // If subscribed, store the user ID in Supabase
      if (isSubscribed && userId) {
        await storeOneSignalUserId(userId);
        setShowNotificationBanner(false);
      }
      
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
            showInstallPrompt: !isInstalled && serviceWorkerActive && window.location.protocol === 'https:'
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
        showInstallPrompt: !prev.isInstalled
      }));
      
      // Also save to window for backup
      window.deferredPrompt = e;
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
    };
    
    // Register service workers for PWA
const registerServiceWorkers = async () => {
  if (!('serviceWorker' in navigator)) {
    console.log('❌ Service Workers not supported');
    return;
  }
  
  try {
    // Register main service worker for PWA
    try {
      const vitePwaReg = await navigator.serviceWorker.register(
        '/scheduler/service-worker.js',
        { 
          scope: '/scheduler/',
          updateViaCache: 'none'
        }
      );
      console.log('✅ Main service worker registered');
      
      if (vitePwaReg.active) {
        setPwaStatus(prev => ({ ...prev, serviceWorkerActive: true }));
      }
    } catch (error) {
      console.log('⚠️ Main service worker registration failed:', error);
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

  // Set up OneSignal ready listener
  useEffect(() => {
    console.log('🚀 Setting up OneSignal listener...');
    
    // Listen for OneSignal ready event from index.html
    window.onOneSignalReady = () => {
      console.log('✅ OneSignal is ready for React');
      setOneSignalStatus(prev => ({ ...prev, initialized: true }));
      
      // Check subscription status
      checkSubscriptionStatus();
      
      // Set up subscription change listener
      if (window.OneSignal && typeof window.OneSignal.on === 'function') {
        window.OneSignal.on('subscriptionChange', async (isSubscribed: boolean) => {
          console.log(`🔔 OneSignal subscriptionChange: ${isSubscribed}`);
          
          if (isSubscribed) {
            try {
              const onesignalUserId = await window.OneSignal.getUserId();
              console.log(`🎉 User subscribed with OneSignal ID: ${onesignalUserId}`);
              
              // Wait for user to be authenticated
              setTimeout(async () => {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user?.id && onesignalUserId) {
                  console.log(`💾 Saving for user ${session.user.id}: ${onesignalUserId}`);
                  
                  // Update the profile
                  const { error } = await supabase
                    .from('profiles')
                    .update({ 
                      onesignal_user_id: onesignalUserId,
                      notification_subscribed: true,
                      notification_subscribed_at: new Date().toISOString()
                    })
                    .eq('id', session.user.id);
                  
                  if (error) {
                    console.error('❌ Failed to save OneSignal ID:', error);
                  } else {
                    console.log('✅ OneSignal ID saved to profile');
                  }
                } else {
                  console.log('⚠️ No authenticated user found for OneSignal ID');
                }
              }, 1000);
            } catch (error) {
              console.error('Error in subscriptionChange handler:', error);
            }
          }
          
          // Update local state
          await checkSubscriptionStatus();
        });
      }
    };
    
    // If OneSignal is already loaded (happens on page reload)
    const checkOneSignalLoaded = () => {
      if (window.OneSignal && typeof window.OneSignal.getUserId === 'function') {
        console.log('✅ OneSignal already loaded');
        setOneSignalStatus(prev => ({ ...prev, initialized: true }));
        
        // Trigger ready callback
        if (window.onOneSignalReady) {
          window.onOneSignalReady();
        }
      } else {
        // Check again in 1 second
        setTimeout(checkOneSignalLoaded, 1000);
      }
    };
    
    checkOneSignalLoaded();
    
    return () => {
      window.onOneSignalReady = undefined;
    };
  }, []);


  // Manually trigger subscription prompt
  const triggerSubscriptionPrompt = async () => {
    if (!window.OneSignal || typeof window.OneSignal.showSlidedownPrompt !== 'function') {
      alert('Notification service is still loading. Please wait a moment.');
      return;
    }
    
    try {
      console.log('🎯 Manually triggering subscription prompt...');
      setSubscriptionMessage('🔄 Opening notification permission prompt...');
      
      await window.OneSignal.showSlidedownPrompt({
        force: true
      });
      
      // Check status after showing prompt
      setTimeout(async () => {
        await checkSubscriptionStatus();
      }, 3000);
    } catch (error) {
      console.error('Error showing prompt:', error);
      setSubscriptionMessage('❌ Could not show notification prompt. Please try refreshing the page.');
    }
  };

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
      triggerSubscriptionPrompt();
      return;
    }

    console.log('📨 Sending test notification...');
    
    try {
      // Send a test notification
      await window.OneSignal.sendSelfNotification({
        headings: { en: 'Test Notification' },
        contents: { en: 'This is a test notification from the Police Department Scheduler' },
        url: window.location.href
      });
      
      alert('✅ Test notification sent! Check your device.');
    } catch (error) {
      console.error('Error sending test notification:', error);
      alert('❌ Failed to send test notification');
    }
  };

  // Install PWA function
  const installPWA = async () => {
    console.log('📲 Attempting PWA installation...');
    
    // Try state first, then window backup
    const deferredPrompt = pwaStatus.deferredPrompt || window.deferredPrompt;
    
    if (!deferredPrompt) {
      console.error('❌ No deferred prompt available');
      alert('PWA installation is not available at this time.');
      return;
    }
    
    try {
      console.log('🔄 Showing installation prompt...');
      deferredPrompt.prompt();
      
      const choiceResult = await deferredPrompt.userChoice;
      console.log(`✅ User choice: ${choiceResult.outcome}`);
      
      // Clear the deferred prompt
      setPwaStatus(prev => ({ ...prev, deferredPrompt: null, isInstallable: false }));
      window.deferredPrompt = null;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('🎉 User accepted PWA installation');
      } else {
        console.log('❌ User dismissed PWA installation');
        setPwaStatus(prev => ({ ...prev, showInstallPrompt: false }));
      }
    } catch (error) {
      console.error('❌ Error during PWA installation:', error);
      alert('Failed to install the app. Please try refreshing the page.');
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
            {showNotificationBanner && !oneSignalStatus.subscribed && (
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
            </div>
          </UserProvider>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
