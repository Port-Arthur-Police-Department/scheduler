// src/components/MobileNavigation.jsx - Matches Dashboard header blur
import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Calendar, 
  CalendarDays, 
  Users, 
  AlertTriangle, 
  Settings, 
  Clock,
  UserPlus,
  LogOut,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const MobileNavigation = ({ activeTab, onTabChange, isAdminOrSupervisor, isAdmin }) => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const allTabs = [
    { id: 'daily', label: 'Riding List', icon: Calendar, roles: ['all'], primary: true },
    { id: 'schedule', label: 'The Book', icon: CalendarDays, roles: ['all'], primary: true },
    { id: 'requests', label: 'PTO', icon: Clock, roles: ['all'], primary: true },
    { id: 'officers', label: 'Officers', icon: Users, roles: ['supervisor', 'admin'] },
    { id: 'vacancies', label: 'Vacancies', icon: AlertTriangle, roles: ['supervisor', 'admin'] },
    { id: 'staff', label: 'Staff', icon: UserPlus, roles: ['supervisor', 'admin'] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: ['admin'] },
  ];

  const primaryTabs = allTabs.filter(tab => tab.primary);
  const secondaryTabs = allTabs.filter(tab => !tab.primary);

  const handleTabClick = (tabId) => {
    onTabChange(tabId);
    setIsMenuOpen(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }
    return () => {
      document.body.classList.remove('menu-open');
    };
  }, [isMenuOpen]);

  return (
    <>
      {/* Bottom Navigation Bar - MATCHES DASHBOARD HEADER BLUR */}
      <nav className="fixed bottom-0 left-0 right-0 dashboard-blur border-t border-border/50 shadow-sm z-40 safe-area-bottom mobile-nav-elevation">
        <div className="flex justify-around items-center h-16 px-2">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const hasAccess = tab.roles.includes('all') || 
              (tab.roles.includes('supervisor') && isAdminOrSupervisor) ||
              (tab.roles.includes('admin') && isAdmin);
            
            if (!hasAccess) return null;
            
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full relative group transition-all duration-200 mobile-nav-button",
                  activeTab === tab.id
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {/* Active indicator dot - matches Dashboard active states */}
                <div className={cn(
                  "absolute -top-1 w-8 h-1 bg-primary rounded-full transition-all duration-300",
                  activeTab === tab.id 
                    ? "opacity-100 scale-100" 
                    : "opacity-0 scale-0"
                )} />
                
                <div className={cn(
                  "p-2 rounded-lg transition-all duration-200",
                  activeTab === tab.id
                    ? "bg-primary/10"
                    : "group-hover:bg-muted/50"
                )}>
                  <Icon className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    activeTab === tab.id && "scale-110"
                  )} />
                </div>
                
                <span className="text-xs font-medium mt-1">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Floating Action Button - Matches Dashboard primary button style */}
      <button
        onClick={() => setIsMenuOpen(true)}
        className="fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all duration-200 hover:scale-105 active:scale-95 mobile-nav-button"
        aria-label="Open menu"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Menu Overlay - Also uses Dashboard blur style */}
      {isMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 fade-in"
            onClick={() => setIsMenuOpen(false)}
          />
          
          {/* Menu Sheet - Uses same blur as Dashboard */}
          <div className="fixed inset-x-0 bottom-0 z-50 animate-in">
            <div className="dashboard-blur rounded-t-2xl border-t border-border/50 shadow-lg mx-auto max-w-lg">
              
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
              </div>
              
              {/* Menu Header */}
              <div className="px-6 pt-2 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">More Options</h3>
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="p-2 rounded-lg hover:bg-muted/50 transition-colors mobile-nav-button"
                    aria-label="Close menu"
                  >
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Secondary Menu Items */}
              <div className="px-4 pb-4 space-y-2">
                {secondaryTabs.map((tab) => {
                  const Icon = tab.icon;
                  const hasAccess = tab.roles.includes('all') || 
                    (tab.roles.includes('supervisor') && isAdminOrSupervisor) ||
                    (tab.roles.includes('admin') && isAdmin);
                  
                  if (!hasAccess) return null;
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabClick(tab.id)}
                      className={cn(
                        "flex items-center w-full p-4 rounded-lg hover:bg-muted/50 transition-all duration-200 active:scale-95 mobile-nav-button",
                        activeTab === tab.id && "bg-primary/10 text-primary"
                      )}
                    >
                      <div className="p-2 rounded-lg bg-muted/50 mr-3">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="font-medium">{tab.label}</span>
                    </button>
                  );
                })}
                
                {/* Sign Out Button */}
                <button
                  onClick={handleSignOut}
                  className="flex items-center w-full p-4 rounded-lg text-destructive hover:bg-destructive/10 transition-all duration-200 active:scale-95 mt-4 mobile-nav-button"
                >
                  <div className="p-2 rounded-lg bg-destructive/10 mr-3">
                    <LogOut className="h-5 w-5" />
                  </div>
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>

              {/* Safe Area Padding */}
              <div className="h-4 safe-area-bottom" />
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default MobileNavigation;
