import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { useIsMobile } from "./hooks/use-mobile";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";

const queryClient = new QueryClient();

const App = () => {
  const isMobile = useIsMobile();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
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
            <PWAInstallPrompt />
          </div>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
