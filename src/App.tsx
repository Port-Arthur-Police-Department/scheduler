import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";

const queryClient = new QueryClient();

// Minimal Dashboard component for testing
const Dashboard = ({ isMobile }: { isMobile: boolean }) => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Port Arthur PD Scheduler</h1>
      <p>Dashboard loaded successfully! Mobile: {isMobile ? 'Yes' : 'No'}</p>
      <p>Build is working correctly!</p>
    </div>
  );
};

// Minimal Auth component for testing
const Auth = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Authentication</h1>
      <p>Auth page would go here</p>
    </div>
  );
};

// Minimal NotFound component for testing
const NotFound = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
    </div>
  );
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
      <BrowserRouter basename="/scheduler">
        <div className={isMobile ? "mobile-layout" : "desktop-layout"}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard isMobile={isMobile} />} />
            <Route path="/auth" element={<Auth />} />
            
            {/* Tab-specific routes */}
            <Route path="/daily-schedule" element={<Dashboard isMobile={isMobile} />} />
            <Route path="/weekly-schedule" element={<Dashboard isMobile={isMobile} />} />
            <Route path="/vacancies" element={<Dashboard isMobile={isMobile} />} />
            <Route path="/staff" element={<Dashboard isMobile={isMobile} />} />
            <Route path="/time-off" element={<Dashboard isMobile={isMobile} />} />
            <Route path="/pto" element={<Dashboard isMobile={isMobile} />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
