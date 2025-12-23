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

const App = () => {
  const isMobile = useIsMobile();

  return (
    <QueryClientProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <UserProvider>
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
