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
import { useEffect } from "react";

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

const App = () => {
  const isMobile = useIsMobile();

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
            } else if (permission === 'granted') {
              console.log("✅ [App] Notifications are enabled!");
            } else if (permission === 'denied') {
              console.log("❌ [App] Notifications are blocked");
            }
          });
        }
      };
      
      window.addEventListener('onesignal-ready', handleOneSignalReady);
      
      // Also check if OneSignal is already ready
      if (window.OneSignal) {
        handleOneSignalReady();
      }
      
      return () => {
        window.removeEventListener('onesignal-ready', handleOneSignalReady);
      };
    }, 1000); // Wait 1 second for scripts to load
    
    return () => clearTimeout(timer);
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
