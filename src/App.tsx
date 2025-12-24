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
import { X, Download, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    showInstallPrompt: false
  });
  const [showStatusPanel, setShowStatusPanel] = useState(true);
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null);

  // Clean up any previous OneSignal instances on mount
  useEffect(() => {
    console.log('🧹 Cleaning up previous OneSignal state...');
    
    // Reset OneSignal global to ensure clean initialization
    window.OneSignal = undefined;
    window.OneSignalDeferred = [];
    
    console.log('✅ Ready for clean OneSignal initialization');
  }, []);

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
            // Only show install prompt if not installed, service worker active, and on HTTPS
            showInstallPrompt: !isInstalled && serviceWorkerActive && window.location.protocol === 'https:'
          }));
          
          console.log('📊 PWA Status:', {
            isInstalled,
            serviceWorkerActive,
            hasManifest,
            displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
          });
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
      window.deferredPrompt = e;
      setPwaStatus(prev => ({ 
        ...prev, 
        isInstallable: true,
        showInstallPrompt: !prev.isInstalled
      }));
      
      // Show install prompt after 5 seconds
      setTimeout(() => {
        if (!pwaStatus.isInstalled && window.deferredPrompt) {
          console.log('🔄 Auto-showing PWA install prompt');
          setPwaStatus(prev => ({ ...prev, showInstallPrompt: true }));
        }
      }, 5000);
    };
    
    const handleAppInstalled = () => {
      console.log('✅ PWA installed successfully');
      setPwaStatus(prev => ({ 
        ...prev, 
        isInstallable: false, 
        isInstalled: true,
        showInstallPrompt: false 
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
        console.log('🛠️ Checking for existing service workers...');
        
        // Get all existing registrations
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log('📋 Existing service workers:', registrations.map(r => r.scope));
        
        // Register Vite PWA service worker
        try {
          const vitePwaReg = await navigator.serviceWorker.register(
            '/scheduler/service-worker.js',
            { 
              scope: '/scheduler/',
              updateViaCache: 'none',
              type: 'module' // Modern service workers
            }
          );
          console.log('✅ Vite PWA service worker registered:', vitePwaReg.scope);
          
          // Wait for service worker to be ready
          if (vitePwaReg.installing) {
            vitePwaReg.installing.addEventListener('statechange', (e) => {
              console.log('🔄 Service worker state:', (e.target as ServiceWorker).state);
              if ((e.target as ServiceWorker).state === 'activated') {
                console.log('🎉 Service worker activated!');
                setPwaStatus(prev => ({ ...prev, serviceWorkerActive: true }));
              }
            });
          } else if (vitePwaReg.active) {
            console.log('✅ Service worker already active');
            setPwaStatus(prev => ({ ...prev, serviceWorkerActive: true }));
          }
        } catch (error) {
          console.log('⚠️ Vite PWA service worker registration failed:', error);
          
          // Try alternative path
          try {
            const altReg = await navigator.serviceWorker.register(
              '/scheduler/sw.js',
              { 
                scope: '/scheduler/',
                updateViaCache: 'none' 
              }
            );
            console.log('✅ Alternative service worker registered:', altReg.scope);
            setPwaStatus(prev => ({ ...prev, serviceWorkerActive: true }));
          } catch (error2) {
            console.log('⚠️ Alternative service worker also failed:', error2);
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
    
    // Register service workers after a short delay
    const timer = setTimeout(() => {
      registerServiceWorkers();
    }, 2000);
    
    // Periodic checks
    const interval = setInterval(checkPWAStatus, 10000);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  // Simplified OneSignal Initialization
  useEffect(() => {
    console.log('🚀 Starting OneSignal initialization...');
    
    // Function to initialize OneSignal
    const initializeOneSignal = async () => {
      // Wait for OneSignal SDK to load
      if (!window.OneSignalDeferred) {
        console.log('⏳ Waiting for OneSignal SDK to load...');
        setTimeout(initializeOneSignal, 1000);
        return;
      }

      try {
        console.log('⚙️ OneSignal SDK loaded, configuring...');
        
        // Use the deferred initialization pattern
        window.OneSignalDeferred.push(async function() {
          try {
            // Initialize OneSignal
            await window.OneSignal.init({
              appId: "3417d840-c226-40ba-92d6-a7590c31eef3",
              safari_web_id: "web.onesignal.auto.1d0d9a2a-074d-4411-b3af-2aed688566e1",
              
              // CRITICAL: GitHub Pages paths
              serviceWorkerPath: '/scheduler/OneSignalSDKWorker.js',
              serviceWorkerParam: { scope: '/scheduler/' },
              
              // Auto prompt settings
              promptOptions: {
                slidedown: {
                  enabled: true,
                  autoPrompt: true,
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
              
              // Disable notify button
              notifyButton: {
                enable: false
              },
              
              // Important settings for GitHub Pages
              allowLocalhostAsSecureOrigin: true,
              autoResubscribe: true,
              persistNotification: false
            });

            console.log('✅ OneSignal initialized successfully');
            setOneSignalStatus(prev => ({ ...prev, initialized: true }));

            // Set up event listeners
            window.OneSignal.on('subscriptionChange', async (isSubscribed: boolean) => {
              console.log(`🔔 Subscription changed: ${isSubscribed ? 'SUBSCRIBED' : 'UNSUBSCRIBED'}`);
              await checkSubscriptionStatus();
              
              // If subscribed, set tags and send welcome notification
              if (isSubscribed) {
                try {
                  const userId = await window.OneSignal.getUserId();
                  console.log(`🎉 Officer subscribed with ID: ${userId}`);
                  
                  // Set department tags
                  await window.OneSignal.sendTags({
                    department: 'port-arthur-pd',
                    user_type: 'officer',
                    app: 'scheduler',
                    environment: import.meta.env.PROD ? 'production' : 'development',
                    subscribed_at: new Date().toISOString()
                  });
                  
                  // Send welcome notification
                  await window.OneSignal.sendSelfNotification({
                    headings: { en: 'Notifications Enabled' },
                    contents: { en: 'You will now receive shift alerts and department notifications.' },
                    url: window.location.href
                  });
                } catch (error) {
                  console.log('Could not send welcome notification:', error);
                }
              }
            });

            // Initial status check
            setTimeout(async () => {
              await checkSubscriptionStatus();
            }, 2000);

          } catch (initError) {
            console.error('❌ OneSignal init error:', initError);
          }
        });
        
      } catch (error) {
        console.error('❌ OneSignal setup error:', error);
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
        try {
          await window.OneSignal.showSlidedownPrompt({ force: true });
        } catch (error) {
          console.error('Error showing prompt:', error);
        }
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
  const enableNotifications = async () => {
    // Check if OneSignal is loaded
    if (!window.OneSignal || typeof window.OneSignal.showSlidedownPrompt !== 'function') {
      alert('Notification service is still loading. Please wait a moment.');
      return;
    }
    
    const permission = oneSignalStatus.permission;
    
    if (permission === 'granted' && oneSignalStatus.subscribed) {
      alert('✅ You are already subscribed to notifications!');
    } else if (permission === 'denied') {
      alert('❌ Notifications were blocked. Please enable them in your browser settings.');
    } else {
      try {
        console.log('🎯 Showing notification prompt...');
        // Use showSlidedownPrompt which is the correct method
        await window.OneSignal.showSlidedownPrompt({
          force: true
        });
        
        // Check status after showing prompt
        setTimeout(async () => {
          await checkSubscriptionStatus();
        }, 2000);
      } catch (error) {
        console.error('Error showing prompt:', error);
        alert('Could not show notification prompt. Please try refreshing the page.');
      }
    }
  };

  // Install PWA function
  const installPWA = async () => {
    if (!window.deferredPrompt) {
      alert('PWA installation is not available. Try visiting the site again.');
      return;
    }
    
    try {
      console.log('📲 Installing PWA...');
      window.deferredPrompt.prompt();
      
      const { outcome } = await window.deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      
      window.deferredPrompt = null;
      
      if (outcome === 'accepted') {
        setPwaStatus(prev => ({ 
          ...prev, 
          isInstalled: true,
          showInstallPrompt: false 
        }));
      }
    } catch (error) {
      console.error('Error installing PWA:', error);
      alert('Failed to install the app. Please try again.');
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
            
            {/* Custom PWA Install Prompt */}
            {pwaStatus.showInstallPrompt && !pwaStatus.isInstalled && (
              <div className="fixed bottom-4 right-4 z-50 max-w-sm">
                <div className="bg-white rounded-lg shadow-xl border p-4 animate-slide-up">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Download className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">Install Police Scheduler</h3>
                        <p className="text-sm text-gray-600">Get quick access to your shifts</p>
                      </div>
                    </div>
                    <button
                      onClick={hideInstallPrompt}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={installPWA}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
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
                    Works offline • Push notifications • Quick access
                  </p>
                </div>
              </div>
            )}
            
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
                    .animate-slide-up {
                      animation: slide-up 0.3s ease-out;
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
              
              {/* Legacy PWA Install Prompt - Keep for compatibility */}
              {!pwaStatus.isInstalled && pwaStatus.serviceWorkerActive && pwaStatus.isInstallable && (
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
