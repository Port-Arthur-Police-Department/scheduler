import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { useState, useEffect } from "react";

const queryClient = new QueryClient();

// Component to handle GitHub Pages redirect
const GitHubPagesRedirect = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Check if we have a stored redirect path from 404.html
    const redirectPath = sessionStorage.getItem('redirectPath');
    if (redirectPath) {
      sessionStorage.removeItem('redirectPath');
      // Navigate to the stored path
      navigate(redirectPath.replace('/scheduler', ''));
    }
  }, [navigate]);
  
  return null;
};

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
          <GitHubPagesRedirect />
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
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
