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
  const [oneSignalInitialized, setOneSignalInitialized] = useState(false);
  const [pwaStatus, setPwaStatus] = useState({
    isInstallable: false,
    isInstalled: false,
    serviceWorkerActive: false,
    hasManifest: false
  });
  const [showStatusPanel, setShowStatusPanel] = useState(true);
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null);

  // Auto-hide status panel after 10 seconds if everything is ready
  useEffect(() => {
    if (oneSignalInitialized && pwaStatus.serviceWorkerActive) {
      const timer = setTimeout(() => {
        setShowStatusPanel(false);
      }, 10000); // 10 seconds
      
      setAutoHideTimer(timer);
      
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [oneSignalInitialized, pwaStatus.serviceWorkerActive]);

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
          
          console.log('📱 PWA Status:', {
            isInstalled,
            serviceWorkerActive,
            hasManifest,
            registrationScope: registration?.scope
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

  // OneSignal Initialization
  useEffect(() => {
    const initOneSignal = () => {
      // Check if OneSignal is loaded
      if (!window.OneSignal || typeof window.OneSignal.init !== 'function') {
        console.log('⏳ Waiting for OneSignal...');
        
        // Check if script is loaded
        if (!document.querySelector('script[src*="onesignal"]')) {
          console.log('📦 Loading OneSignal SDK...');
          const script = document.createElement('script');
          script.src = 'https://cdn.onesignal.com/sdks/OneSignalSDK.js';
          script.async = true;
          script.onload = () => {
            console.log('✅ OneSignal SDK loaded');
            setTimeout(initOneSignal, 1000);
          };
          document.head.appendChild(script);
          return;
        }
        
        setTimeout(initOneSignal, 2000);
        return;
      }
      
      // Initialize OneSignal
      try {
        console.log('⚙️ Initializing OneSignal...');
        
        window.OneSignal.init({
          appId: "3417d840-c226-40ba-92d6-a7590c31eef3",
          safari_web_id: "web.onesignal.auto.1d0d9a2a-074d-4411-b3af-2aed688566e1",
          serviceWorkerPath: '/scheduler/OneSignalSDKWorker.js',
          serviceWorkerParam: { scope: '/scheduler/' },
          allowLocalhostAsSecureOrigin: true,
          autoResubscribe: true,
          promptOptions: {
            slidedown: {
              enabled: true,
              autoPrompt: true,
              timeDelay: 2,
              pageViews: 1
            }
          }
        }).then(() => {
          console.log('✅ OneSignal initialized');
          setOneSignalInitialized(true);
          
          // Set tags
          window.OneSignal.sendTags({
            department: 'port-arthur-pd',
            app: 'scheduler',
            environment: import.meta.env.PROD ? 'production' : 'development'
          });
          
          // Check user ID
          window.OneSignal.getUserId().then((userId: string) => {
            if (userId) {
              console.log(`👤 User ID: ${userId}`);
            }
          });
        });
        
      } catch (error) {
        console.error('❌ OneSignal init error:', error);
      }
    };
    
    // Start initialization
    const timer = setTimeout(initOneSignal, 1500);
    
    return () => clearTimeout(timer);
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
        
        // Register Vite PWA service worker if it exists
        try {
          const viteReg = await navigator.serviceWorker.register(
            '/scheduler/sw.js',
            { scope: '/scheduler/', updateViaCache: 'none' }
          );
          console.log('✅ Vite PWA worker registered:', viteReg.scope);
        } catch (error) {
          // This is normal if sw.js doesn't exist
        }
        
      } catch (error) {
        console.error('❌ Service worker registration failed:', error);
      }
    };
    
    const timer = setTimeout(registerServiceWorkers, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Debug functions
  const testNotification = () => {
    if (window.OneSignal) {
      console.log('📨 Test notification triggered');
      alert('Test notification - In production, this would send via OneSignal API');
      
      // Reset auto-hide timer when user interacts
      if (autoHideTimer) {
        clearTimeout(autoHideTimer);
      }
      const newTimer = setTimeout(() => {
        setShowStatusPanel(false);
      }, 10000);
      setAutoHideTimer(newTimer);
    } else {
      alert('OneSignal not ready yet');
    }
  };

  const checkServiceWorkers = async () => {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log('🔍 Service Workers:', registrations.map(r => ({
        scope: r.scope,
        active: !!r.active
      })));
      
      // Force update
      registrations.forEach(reg => reg.update());
      alert(`Found ${registrations.length} service workers. Check console for details.`);
      
      // Reset auto-hide timer when user interacts
      if (autoHideTimer) {
        clearTimeout(autoHideTimer);
      }
      const newTimer = setTimeout(() => {
        setShowStatusPanel(false);
      }, 10000);
      setAutoHideTimer(newTimer);
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
    // Auto-hide again after 10 seconds
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
                maxWidth: '250px',
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
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <X size={14} />
                </button>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', marginRight: '16px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: oneSignalInitialized ? '#10b981' : '#f59e0b',
                    animation: !oneSignalInitialized ? 'pulse 1.5s infinite' : 'none'
                  }} />
                  <strong>OneSignal:</strong> {oneSignalInitialized ? '✅ Ready' : '🔄 Loading...'}
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: pwaStatus.serviceWorkerActive ? '#10b981' : '#ef4444',
                    animation: !pwaStatus.serviceWorkerActive ? 'pulse 1.5s infinite' : 'none'
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
                        width: '100%',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      Test Notification
                    </button>
                    
                    <button
                      onClick={checkServiceWorkers}
                      style={{
                        background: '#8b5cf6',
                        color: 'white',
                        border: 'none',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        width: '100%',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      Check Service Workers
                    </button>
                  </div>
                )}
                
                <div style={{
                  fontSize: '10px',
                  color: '#94a3b8',
                  marginTop: '8px',
                  textAlign: 'center',
                  borderTop: '1px solid #334155',
                  paddingTop: '6px'
                }}>
                  Auto-hides in {autoHideTimer ? '10s' : 'hidden'}
                </div>
              </div>
            ) : import.meta.env.DEV && (
              // Show a small "Show Panel" button when hidden
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
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>Status</span>
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
