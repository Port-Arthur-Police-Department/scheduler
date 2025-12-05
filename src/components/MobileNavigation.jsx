// src/components/MobileNavigation.jsx - Fixed with proper admin access
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
  X,
  Briefcase,
  FileText,
  Shield
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
    // Primary tabs (always in bottom bar for quick access)
    { id: 'daily', label: 'Riding List', icon: Calendar, roles: ['all'], primary: true },
    { id: 'schedule', label: 'The Book', icon: CalendarDays, roles: ['all'], primary: true },
    { id: 'requests', label: 'PTO', icon: Clock, roles: ['all'], primary: true },
    
    // Supervisor/Admin tabs (in menu)
    { id: 'officers', label: 'Officers', icon: Users, roles: ['supervisor', 'admin'], icon: Users },
    { id: 'vacancies', label: 'Vacancies', icon: AlertTriangle, roles: ['supervisor', 'admin'], icon: AlertTriangle },
    { id: 'staff', label: 'Staff Management', icon: UserPlus, roles: ['supervisor', 'admin'], icon: UserPlus },
    
    // Admin-only tabs (in menu)
    { id: 'settings', label: 'Website Settings', icon: Settings, roles: ['admin'], icon: Settings },
  ];

  // Filter tabs based on user role
  const getVisibleTabs = () => {
    return allNavItems.filter(item => {
      if (item.roles.includes('all')) return true;
      if (item.roles.includes('supervisor') && isAdminOrSupervisor) return true;
      if (item.roles.includes('admin') && isAdmin) return true;
      return false;
    });
  };

  const visibleTabs = getVisibleTabs();
  
  // Separate into primary (bottom bar) and secondary (menu)
  const primaryTabs = visibleTabs.filter(tab => tab.primary);
  const secondaryTabs = visibleTabs.filter(tab => !tab.primary);

  // Group secondary tabs by role for better organization in menu
  const supervisorTabs = secondaryTabs.filter(tab => 
    tab.roles.includes('supervisor') && !tab.roles.includes('admin')
  );
  const adminOnlyTabs = secondaryTabs.filter(tab => 
    tab.roles.includes('admin')
  );

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
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 dashboard-blur border-t border-border/50 shadow-sm z-40 safe-area-bottom mobile-nav-elevation">
        <div className="flex justify-around items-center h-16 px-2">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            
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
                {/* Active indicator dot */}
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
          
          {/* FAB/Menu Button - Shows count of available options */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className="flex flex-col items-center justify-center flex-1 h-full relative mobile-nav-button text-muted-foreground hover:text-foreground"
            aria-label={`Open menu (${secondaryTabs.length} more options)`}
          >
            <div className="p-2 rounded-lg group-hover:bg-muted/50">
              <div className="relative">
                <Plus className="h-5 w-5" />
                {secondaryTabs.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {secondaryTabs.length}
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs font-medium mt-1">More</span>
          </button>
        </div>
      </nav>

      {/* Menu Overlay */}
      {isMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 fade-in"
            onClick={() => setIsMenuOpen(false)}
          />
          
          {/* Menu Sheet */}
          <div className="fixed inset-x-0 bottom-0 z-50 animate-in">
            <div className="dashboard-blur rounded-t-2xl border-t border-border/50 shadow-lg mx-auto max-w-lg max-h-[80vh] overflow-y-auto">
              
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-2 sticky top-0 bg-inherit">
                <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
              </div>
              
              {/* Menu Header */}
              <div className="px-6 pt-2 pb-4 sticky top-4 bg-inherit">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">More Options</h3>
                    <p className="text-sm text-muted-foreground">
                      {isAdmin ? 'Administrator' : isAdminOrSupervisor ? 'Supervisor' : 'Officer'} Tools
                    </p>
                  </div>
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
              <div className="px-4 pb-4 space-y-4">
                {/* Supervisor Tools Section */}
                {supervisorTabs.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground px-4 mb-2">
                      Supervisor Tools
                    </h4>
                    <div className="space-y-2">
                      {supervisorTabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => handleTabClick(tab.id)}
                            className={cn(
                              "flex items-center w-full p-4 rounded-lg hover:bg-muted/50 transition-all duration-200 active:scale-95 mobile-nav-button",
                              activeTab === tab.id && "bg-primary/10 text-primary border-l-4 border-primary"
                            )}
                          >
                            <div className="p-2 rounded-lg bg-muted/50 mr-3">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="text-left">
                              <span className="font-medium block">{tab.label}</span>
                              {tab.description && (
                                <span className="text-xs text-muted-foreground">{tab.description}</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Admin Tools Section */}
                {adminOnlyTabs.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground px-4 mb-2">
                      <Shield className="h-3 w-3 inline mr-1" />
                      Administrator Tools
                    </h4>
                    <div className="space-y-2">
                      {adminOnlyTabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => handleTabClick(tab.id)}
                            className={cn(
                              "flex items-center w-full p-4 rounded-lg hover:bg-muted/50 transition-all duration-200 active:scale-95 mobile-nav-button",
                              activeTab === tab.id && "bg-primary/10 text-primary border-l-4 border-primary"
                            )}
                          >
                            <div className="p-2 rounded-lg bg-muted/50 mr-3">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="text-left">
                              <span className="font-medium block">{tab.label}</span>
                              {tab.id === 'settings' && (
                                <span className="text-xs text-muted-foreground">Configure website settings</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* All Other Secondary Tabs */}
                {secondaryTabs.filter(tab => 
                  !supervisorTabs.includes(tab) && !adminOnlyTabs.includes(tab)
                ).length > 0 && (
                  <div className="space-y-2">
                    {secondaryTabs.filter(tab => 
                      !supervisorTabs.includes(tab) && !adminOnlyTabs.includes(tab)
                    ).map((tab) => {
                      const Icon = tab.icon;
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
                  </div>
                )}
                
                {/* Sign Out Button */}
                <div className="pt-4 border-t border-border/50">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center w-full p-4 rounded-lg text-destructive hover:bg-destructive/10 transition-all duration-200 active:scale-95 mobile-nav-button"
                  >
                    <div className="p-2 rounded-lg bg-destructive/10 mr-3">
                      <LogOut className="h-5 w-5" />
                    </div>
                    <span className="font-medium">Sign Out</span>
                  </button>
                </div>
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
