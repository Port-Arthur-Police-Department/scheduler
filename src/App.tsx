import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { useState, useEffect } from "react";

const queryClient = new QueryClient();

const App = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename="/scheduler">
          <div className={isMobile ? "mobile-layout" : "desktop-layout"}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard isMobile={isMobile} />} />
              <Route path="/auth" element={<Auth />} />
              
              {/* Tab-specific routes that all render the Dashboard with different active tabs */}
              <Route path="/daily-schedule" element={<Dashboard isMobile={isMobile} initialTab="daily" />} />
              <Route path="/weekly-schedule" element={<Dashboard isMobile={isMobile} initialTab="schedule" />} />
              <Route path="/vacancies" element={<Dashboard isMobile={isMobile} initialTab="vacancies" />} />
              <Route path="/staff" element={<Dashboard isMobile={isMobile} initialTab="staff" />} />
              <Route path="/time-off" element={<Dashboard isMobile={isMobile} initialTab="requests" />} />
              <Route path="/pto" element={<Dashboard isMobile={isMobile} initialTab="requests" />} />
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
