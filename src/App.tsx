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

// Declare OneSignal types
declare global {
  interface Window {
    OneSignal: any;
    OneSignalDeferred: any[];
  }
}

const App = () => {
  const isMobile = useIsMobile();
  const [oneSignalInitialized, setOneSignalInitialized] = useState(false);
  const [pwaStatus, setPwaStatus] = useState<{
    isInstallable: boolean;
    isInstalled: boolean;
    serviceWorkerActive: boolean;
  }>({
    isInstallable: false,
    isInstalled: false,
    serviceWorkerActive: false
  });

  // PWA Installation Status Check
  useEffect(() => {
    const checkPWAStatus = () => {
      // Check if app is already installed
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isInWebAppiOS = (window.navigator as any).standalone === true;
      const isInstalled = isStandalone || isInWebAppiOS;
      
      console.log('📱 PWA Status Check:', {
        displayMode: window.matchMedia('(display-mode: standalone)').matches,
        isStandalone,
        isInWebAppiOS,
        isInstalled
      });
      
      // Check service worker registration
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(registration => {
          const serviceWorkerActive = !!registration?.active;
          console.log('🔧 Service Worker Registration:', {
            hasRegistration: !!registration,
            scope: registration?.scope,
            active: serviceWorkerActive
          });
          
          setPwaStatus(prev => ({
            ...prev,
            isInstalled,
            serviceWorkerActive
          }));
        });
      }
    };
    
    // Handle beforeinstallprompt event for PWA
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      console.log('📱 PWA install prompt available');
      setPwaStatus(prev => ({
        ...prev,
        isInstallable: true
      }));
      
      // Store the event for later use
      (window as any).deferredPrompt = e;
    };
    
    // Handle app installed event
    const handleAppInstalled = () => {
      console.log('✅ PWA installed successfully');
      setPwaStatus(prev => ({
        ...prev,
        isInstallable: false,
        isInstalled: true
      }));
    };
    
    // Check PWA requirements
    const checkPWAEligibility = () => {
      const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
      const hasServiceWorker = 'serviceWorker' in navigator;
      const hasManifest = document.querySelector('link[rel="manifest"]') !== null;
      
      console.log('📱 PWA Eligibility Check:', {
        isSecure,
        hasServiceWorker,
        hasManifest,
        url: window.location.href
      });
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    // Run initial checks
    setTimeout(checkPWAStatus, 1000);
    setTimeout(checkPWAEligibility, 2000);
    
    // Check periodically for PWA status changes
    const pwaCheckInterval = setInterval(checkPWAStatus, 10000);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearInterval(pwaCheckInterval);
    };
  }, []);

  // Main OneSignal initialization
  useEffect(() => {
    const initializeOneSignal = async () => {
      console.log("🔧 [App] Starting OneSignal initialization...");
      
      // Wait for OneSignal SDK to load
      if (!window.OneSignal || typeof window.OneSignal.init !== 'function') {
        console.log("⏳ [App] OneSignal not loaded yet, waiting...");
        
        // Check if OneSignal script is loaded
        const oneSignalScript = document.querySelector('script[src*="onesignal"]');
        if (!oneSignalScript) {
          console.log("📦 [App] Loading OneSignal SDK...");
          const script = document.createElement('script');
          script.src = 'https://cdn.onesignal.com/sdks/OneSignalSDK.js';
          script.async = true;
          script.onload = () => {
            console.log("✅ [App] OneSignal SDK loaded");
            setTimeout(initializeOneSignal, 1000);
          };
          document.head.appendChild(script);
          return;
        }
        
        // Try again in 2 seconds
        setTimeout(initializeOneSignal, 2000);
        return;
      }

      try {
        console.log("⚙️ [App] Initializing OneSignal for GitHub Pages...");
        
        // IMPORTANT: Pre-create service workers before OneSignal init
        if ('serviceWorker' in navigator) {
          console.log("🛠️ [App] Pre-registering service workers...");
          
          // Try to register our service workers first
          try {
            // Register the main service worker
            await navigator.serviceWorker.register('/scheduler/service-worker.js', {
              scope: '/scheduler/'
            });
            console.log("✅ [App] Main service worker registered");
          } catch (swError) {
            console.warn("⚠️ [App] Could not pre-register service worker:", swError);
          }
        }

        // Initialize OneSignal with GitHub Pages configuration
        window.OneSignal.init({
          appId: "3417d840-c226-40ba-92d6-a7590c31eef3",
          safari_web_id: "web.onesignal.auto.1d0d9a2a-074d-4411-b3af-2aed688566e1",
          
          // CRITICAL: GitHub Pages paths
          serviceWorkerPath: '/scheduler/OneSignalSDKWorker.js',
          serviceWorkerParam: { scope: '/scheduler/' },
          
          allowLocalhostAsSecureOrigin: true,
          autoResubscribe: true,
          notifyButton: {
            enable: false
          },
          
          promptOptions: {
            slidedown: {
              enabled: true,
              autoPrompt: true,
              timeDelay: 3,
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
          }
        });

        console.log("✅ [App] OneSignal initialized successfully");
        setOneSignalInitialized(true);

        // Set up event listeners
        window.OneSignal.on('subscriptionChange', (isSubscribed: boolean) => {
          console.log(`🔔 [App] Subscription changed: ${isSubscribed ? 'Subscribed' : 'Unsubscribed'}`);
        });

        window.OneSignal.on('notificationDisplay', (event: any) => {
          console.log('📨 [App] Notification displayed:', event);
        });

        // Set tags for police department
        window.OneSignal.getUserId().then((userId: string) => {
          if (userId) {
            console.log(`👤 [App] OneSignal User ID: ${userId}`);
            
            // Set department tags
            window.OneSignal.sendTags({
              department: 'port-arthur-pd',
              role: 'officer',
              app: 'scheduler',
              environment: import.meta.env.PROD ? 'production' : 'development'
            }).then(() => {
              console.log("🏷️ [App] Tags set successfully");
            });
          }
        });

        // Check permission
        window.OneSignal.getNotificationPermission().then((permission: string) => {
          console.log(`🔐 [App] Notification permission: ${permission}`);
        });

      } catch (error) {
        console.error('❌ [App] Failed to initialize OneSignal:', error);
        
        // Fallback: Try alternative initialization
        try {
          console.log("🔄 [App] Trying fallback initialization...");
          
          // Force set service worker paths
          if (window.OneSignal.SERVICE_WORKER_PARAM) {
            window.OneSignal.SERVICE_WORKER_PARAM.scope = '/scheduler/';
          }
          
          if (window.OneSignal.SERVICE_WORKER_PATH) {
            window.OneSignal.SERVICE_WORKER_PATH = '/scheduler/OneSignalSDKWorker.js';
          }
          
          setOneSignalInitialized(true);
        } catch (fallbackError) {
          console.error('❌ [App] Fallback also failed:', fallbackError);
        }
      }
    };

    // Start initialization
    initializeOneSignal();

    // Cleanup
    return () => {
      // Optional: Clean up OneSignal listeners
      if (window.OneSignal && window.OneSignal.removeAllListeners) {
        window.OneSignal.removeAllListeners();
      }
    };
  }, []);

  // Service Worker Fallback Registration
  useEffect(() => {
    const registerFallbackServiceWorkers = async () => {
      if (!('serviceWorker' in navigator)) return;
      
      console.log("🛠️ [App] Registering fallback service workers...");
      
      // Array of service workers to register
      const workers = [
        {
          path: '/scheduler/OneSignalSDKWorker.js',
          scope: '/scheduler/'
        },
        {
          path: '/scheduler/service-worker.js',
          scope: '/scheduler/'
        },
        {
          path: '/OneSignalSDKWorker.js',
          scope: '/'
        }
      ];
      
      for (const worker of workers) {
        try {
          const registration = await navigator.serviceWorker.register(worker.path, {
            scope: worker.scope,
            updateViaCache: 'none'
          });
          
          console.log(`✅ [App] Registered ${worker.path} with scope ${worker.scope}`);
          console.log('   Active:', !!registration.active);
          console.log('   Installing:', !!registration.installing);
          console.log('   Waiting:', !!registration.waiting);
          
        } catch (error) {
          console.log(`⚠️ [App] Failed to register ${worker.path}:`, error.message);
        }
      }
      
      // List all registered workers
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log(`📋 [App] Total registered service workers: ${registrations.length}`);
      registrations.forEach((reg, i) => {
        console.log(`   ${i + 1}. ${reg.scope}`);
      });
    };
    
    // Register fallback workers after a delay
    const timer = setTimeout(registerFallbackServiceWorkers, 3000);
    
    return () => clearTimeout(timer);
  }, []);

  // Test function for notifications
  const testNotification = () => {
    if (window.OneSignal) {
      // This is a client-side test - actual notifications should come from your backend
      console.log("📨 [App] Test notification triggered");
      
      // You would typically send a notification via your backend using OneSignal REST API
      // For now, just show a local alert
      alert("Test notification sent! Actual push notifications would come from your server.");
      
      // Example of how you'd trigger a real notification (server-side):
      // fetch('/api/send-notification', {
      //   method: 'POST',
      //   body: JSON.stringify({
      //     title: 'Test Alert',
      //     message: 'This is a test notification from Port Arthur PD',
      //     url: window.location.href
      //   })
      // });
    } else {
      alert("OneSignal not initialized yet. Please wait and try again.");
    }
  };

  // Force service worker update (for debugging)
  const forceServiceWorkerUpdate = async () => {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log('🔄 Forcing service worker update...');
      
      for (const registration of registrations) {
        try {
          await registration.update();
          console.log(`✅ Updated: ${registration.scope}`);
        } catch (error) {
          console.log(`❌ Failed to update ${registration.scope}:`, error);
        }
      }
      
      // Reload page to activate new service worker
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

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
              maxWidth: '250px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              border: '1px solid #334155'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: oneSignalInitialized ? '#10b981' : '#f59e0b'
                }} />
                <strong>OneSignal:</strong> {oneSignalInitialized ? '✅ Ready' : '🔄 Loading...'}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: pwaStatus.serviceWorkerActive ? '#10b981' : '#ef4444'
                }} />
                <strong>PWA:</strong> {pwaStatus.isInstalled ? '✅ Installed' : pwaStatus.serviceWorkerActive ? '📱 Ready' : '🔧 Setting up...'}
              </div>
              
              {/* Debug buttons for development */}
              {import.meta.env.DEV && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                  <button
                    onClick={testNotification}
                    style={{
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  >
                    Test Notification
                  </button>
                  
                  <button
                    onClick={forceServiceWorkerUpdate}
                    style={{
                      background: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  >
                    Update Service Worker
                  </button>
                </div>
              )}
            </div>
            
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
              
              {/* PWA Install Prompt - Only show if not installed and installable */}
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
