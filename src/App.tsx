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
import { useEffect, useRef } from "react";
import { registerOneSignalWorker } from "@/utils/registerOneSignalWorker";

// Debug function to check OneSignal status
const checkOneSignalStatus = () => {
  console.log("🔍 [App] Checking OneSignal status...");
  
  // Check if we're on the correct URL for GitHub Pages
  const isGithubPages = window.location.hostname.includes('github.io');
  const hasSchedulerPath = window.location.pathname.includes('/scheduler');
  
  console.log("📍 URL Info:", {
    hostname: window.location.hostname,
    pathname: window.location.pathname,
    href: window.location.href,
    isGithubPages,
    hasSchedulerPath
  });
  
  // Check if OneSignal scripts are loaded
  if (typeof window.OneSignalDeferred === 'undefined') {
    console.error("❌ [App] OneSignalDeferred not defined - script may not have loaded");
    
    // Try to dynamically load OneSignal if not present
    if (!document.querySelector('script[src*="onesignal"]')) {
      console.log("🔄 [App] Attempting to load OneSignal script dynamically...");
      const script = document.createElement('script');
      script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
      script.defer = true;
      script.async = true;
      document.head.appendChild(script);
    }
  } else {
    console.log("✅ [App] OneSignal scripts loaded");
  }
  
  // Check service worker support
  if ('serviceWorker' in navigator) {
    console.log("✅ [App] Service Workers supported");
    
    // List registered service workers
    navigator.serviceWorker.getRegistrations().then(registrations => {
      console.log(`📋 [App] ${registrations.length} service worker(s) registered:`);
      registrations.forEach((reg, index) => {
        console.log(`  ${index + 1}. ${reg.scope}`);
      });
      
      // Check for OneSignal worker
      const onesignalWorker = registrations.find(reg => 
        reg.scope.includes('OneSignal') || 
        reg.active?.scriptURL?.includes('OneSignal') ||
        reg.scope.includes('scheduler')
      );
      
      if (onesignalWorker) {
        console.log("✅ [App] Found service worker with scheduler scope");
      }
    });
  } else {
    console.error("❌ [App] Service Workers NOT supported by browser");
  }
  
  // Check environment variables
  console.log("⚙️ [App] Environment check:", {
    hasAppId: !!import.meta.env.VITE_ONESIGNAL_APP_ID,
    appIdPreview: import.meta.env.VITE_ONESIGNAL_APP_ID?.substring(0, 10) + '...',
    isProduction: import.meta.env.PROD,
    isDevelopment: import.meta.env.DEV
  });
};

// Function to detect 404 errors for OneSignal resources
const hasOneSignal404Errors = (): boolean => {
  try {
    // Check performance entries for 404 errors
    const resources = performance.getEntriesByType('resource');
    let has404 = false;
    
    resources.forEach(entry => {
      const resource = entry as PerformanceResourceTiming;
      const isOneSignalResource = resource.name.includes('OneSignal');
      
      // Check if it's a OneSignal script and had an error
      // Resource entries with 404 will have transferSize of 0
      if (isOneSignalResource) {
        console.log(`📊 [App] Resource: ${resource.name}`, {
          transferSize: resource.transferSize,
          initiatorType: resource.initiatorType,
          duration: resource.duration
        });
        
        // A transferSize of 0 often indicates a 404 error
        if (resource.transferSize === 0 || resource.duration < 10) {
          console.error(`❌ [App] Possible 404 for: ${resource.name}`);
          has404 = true;
        }
      }
    });
    
    return has404;
  } catch (error) {
    console.error("❌ [App] Error checking for 404s:", error);
    return false;
  }
};

const App = () => {
  const isMobile = useIsMobile();
  const manualRegistrationAttempted = useRef(false);

  // Manual OneSignal registration logic
  useEffect(() => {
    const manualRegistrationTimeout = setTimeout(() => {
      // Wait for page to load, then try manual registration
      const checkOneSignalErrors = () => {
        const has404Errors = hasOneSignal404Errors();
        
        if (has404Errors && !manualRegistrationAttempted.current) {
          console.log('🔧 [App] Detected OneSignal 404 errors, attempting manual registration...');
          manualRegistrationAttempted.current = true;
          
          // Call the manual registration function
          registerOneSignalWorker();
          
          // Also try to re-check OneSignal status after manual registration
          setTimeout(() => {
            console.log("🔄 [App] Re-checking OneSignal after manual registration...");
            
            // Check if OneSignal is now available
            if (window.OneSignal) {
              console.log("✅ [App] Manual registration successful - OneSignal is now available");
              
              // Try to initialize OneSignal with correct paths
              if (window.location.pathname.includes('/scheduler')) {
                console.log("⚙️ [App] Configuring OneSignal for /scheduler/ subdirectory");
                
                window.OneSignal.init({
                  appId: import.meta.env.VITE_ONESIGNAL_APP_ID || "3417d840-c226-40ba-92d6-a7590c31eef3",
                  safari_web_id: "web.onesignal.auto.1d0d9a2a-074d-4411-b3af-2aed688566e1",
                  serviceWorkerPath: '/scheduler/OneSignalSDKWorker.js',
                  serviceWorkerParam: { scope: '/scheduler/' },
                  allowLocalhostAsSecureOrigin: true,
                });
              }
            }
          }, 2000);
        } else if (!has404Errors && !manualRegistrationAttempted.current) {
          console.log("✅ [App] No OneSignal 404 errors detected");
        }
      };
      
      // Run check after 3 seconds to allow scripts to load
      setTimeout(checkOneSignalErrors, 3000);
    }, 1000); // Initial delay before starting checks
    
    return () => clearTimeout(manualRegistrationTimeout);
  }, []);

  // Original OneSignal initialization logic
  useEffect(() => {
    // Run OneSignal checks after component mounts
    const timer = setTimeout(() => {
      checkOneSignalStatus();
      
      // Set up OneSignal ready listener
      const handleOneSignalReady = () => {
        console.log("🎉 [App] OneSignal ready event received");
        
        // Try to access OneSignal
        if (window.OneSignal) {
          console.log("✅ [App] window.OneSignal is available");
          
          // Check notification permission
          window.OneSignal.getNotificationPermission?.().then(permission => {
            console.log(`🔔 [App] Notification permission: ${permission}`);
            
            if (permission === 'default') {
              console.log("ℹ️ [App] User hasn't made a permission choice yet");
              
              // Auto-prompt after a delay
              setTimeout(() => {
                if (window.OneSignal && permission === 'default') {
                  console.log("🔄 [App] Showing notification prompt...");
                  window.OneSignal.showSlidedownPrompt?.();
                }
              }, 3000);
            } else if (permission === 'granted') {
              console.log("✅ [App] Notifications are enabled!");
              
              // Get user ID
              window.OneSignal.getUserId?.().then((userId: string) => {
                console.log(`👤 [App] OneSignal User ID: ${userId || 'Not subscribed yet'}`);
              });
            } else if (permission === 'denied') {
              console.log("❌ [App] Notifications are blocked");
            }
          });
          
          // Set tags for police department context
          window.OneSignal.sendTags?.({
            department: 'port-arthur-pd',
            app: 'scheduler',
            environment: import.meta.env.PROD ? 'production' : 'development',
            platform: isMobile ? 'mobile' : 'desktop'
          }).then(() => {
            console.log("🏷️ [App] Tags set successfully");
          }).catch((error: Error) => {
            console.error("❌ [App] Error setting tags:", error);
          });
        }
      };
      
      window.addEventListener('onesignal-ready', handleOneSignalReady);
      
      // Also check if OneSignal is already ready
      if (window.OneSignal) {
        handleOneSignalReady();
      }
      
      // Fallback: Check periodically if OneSignal becomes available
      const checkInterval = setInterval(() => {
        if (window.OneSignal && !window.OneSignal.getNotificationPermission) {
          // If OneSignal is partially loaded, try to trigger initialization
          console.log("🔄 [App] OneSignal detected but not fully initialized");
          handleOneSignalReady();
        }
      }, 5000);
      
      return () => {
        window.removeEventListener('onesignal-ready', handleOneSignalReady);
        clearInterval(checkInterval);
      };
    }, 2000); // Wait 2 seconds for scripts to load
    
    return () => clearTimeout(timer);
  }, [isMobile]);

  // Check for push notification support
  useEffect(() => {
    if ('Notification' in window) {
      console.log("✅ [App] Push notifications supported");
      
      // Request permission if not already determined
      if (Notification.permission === 'default') {
        console.log("ℹ️ [App] Notification permission not yet requested");
      }
    } else {
      console.error("❌ [App] Push notifications NOT supported");
    }
  }, []);

  return (
    <QueryClientProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <UserProvider>
            {/* OneSignal Debug Component - Only show in development */}
            {import.meta.env.DEV && <OneSignalDebug />}
            
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
              
              <PWAInstallPrompt />
            </div>
          </UserProvider>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
