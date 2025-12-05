// src/components/MobileNavigation.jsx - Simpler all-in-menu version
import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  Calendar, 
  CalendarDays, 
  Users, 
  AlertTriangle, 
  Settings, 
  Clock,
  UserPlus,
  LogOut,
  X,
  Home
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const MobileNavigation = ({ activeTab, onTabChange, isAdminOrSupervisor, isAdmin }) => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Define ALL navigation items
  const allNavItems = [
    { id: 'daily', label: 'Riding List', icon: Calendar, roles: ['all'] },
    { id: 'schedule', label: 'The Book', icon: CalendarDays, roles: ['all'] },
    { id: 'requests', label: 'PTO', icon: Clock, roles: ['all'] },
    { id: 'officers', label: 'Officers', icon: Users, roles: ['supervisor', 'admin'] },
    { id: 'vacancies', label: 'Vacancies', icon: AlertTriangle, roles: ['supervisor', 'admin'] },
    { id: 'staff', label: 'Staff Management', icon: UserPlus, roles: ['supervisor', 'admin'] },
    { id: 'settings', label: 'Website Settings', icon: Settings, roles: ['admin'] },
  ];

  // Filter tabs based on user role
  const visibleTabs = allNavItems.filter(item => {
    if (item.roles.includes('all')) return true;
    if (item.roles.includes('supervisor') && isAdminOrSupervisor) return true;
    if (item.roles.includes('admin') && isAdmin) return true;
    return false;
  });

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
      {/* Simple Bottom Bar with just a Menu Button */}
      <nav className="fixed bottom-0 left-0 right-0 dashboard-blur border-t border-border/50 shadow-sm z-40 safe-area-bottom mobile-nav-elevation">
        <div className="flex justify-around items-center h-16 px-2">
          {/* Current Tab Indicator */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className="flex items-center justify-center flex-1 h-full mobile-nav-button text-foreground"
          >
            <div className="flex items-center gap-3">
              {(() => {
                const currentTab = visibleTabs.find(tab => tab.id === activeTab);
                const Icon = currentTab?.icon || Menu;
                return <Icon className="h-5 w-5" />;
              })()}
              <div className="text-left">
                <div className="text-sm font-semibold">
                  {visibleTabs.find(tab => tab.id === activeTab)?.label || 'Menu'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Tap to switch
                </div>
              </div>
            </div>
          </button>
          
          {/* Quick Access to most important tabs */}
          <div className="flex items-center gap-1">
            {['daily', 'schedule', 'requests']
              .filter(tabId => visibleTabs.some(tab => tab.id === tabId))
              .map(tabId => {
                const tab = visibleTabs.find(t => t.id === tabId);
                if (!tab) return null;
                const Icon = tab.icon;
                return (
                  <button
                    key={tabId}
                    onClick={() => handleTabClick(tabId)}
                    className={cn(
                      "p-2 rounded-lg mobile-nav-button",
                      activeTab === tabId
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                    aria-label={tab.label}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                );
              })}
          </div>
        </div>
      </nav>

      {/* Menu Overlay */}
      {isMenuOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 fade-in"
            onClick={() => setIsMenuOpen(false)}
          />
          
          <div className="fixed inset-x-0 bottom-0 z-50 animate-in">
            <div className="dashboard-blur rounded-t-2xl border-t border-border/50 shadow-lg mx-auto max-w-lg">
              
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
              </div>
              
              <div className="px-6 pt-2 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Navigation</h3>
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <div className="px-4 pb-4 space-y-2">
                {visibleTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabClick(tab.id)}
                      className={cn(
                        "flex items-center w-full p-4 rounded-lg hover:bg-muted/50 transition-all duration-200",
                        activeTab === tab.id && "bg-primary/10 text-primary"
                      )}
                    >
                      <Icon className="h-5 w-5 mr-3" />
                      <span className="font-medium">{tab.label}</span>
                      {tab.roles.includes('admin') && (
                        <span className="ml-auto text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                          Admin
                        </span>
                      )}
                    </button>
                  );
                })}
                
                <div className="pt-4 border-t border-border/50">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center w-full p-4 rounded-lg text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-5 w-5 mr-3" />
                    <span className="font-medium">Sign Out</span>
                  </button>
                </div>
              </div>

              <div className="h-4 safe-area-bottom" />
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default MobileNavigation;
