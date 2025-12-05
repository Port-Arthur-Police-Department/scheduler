// src/components/MobileHeader.jsx - Separate component for top header
import React, { useState } from 'react';
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
  Home,
  ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MobileHeader = ({ activeTab, onTabChange, isAdminOrSupervisor, isAdmin, profile }) => {
  const navigate = useNavigate();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const allTabs = [
    { id: 'daily', label: 'Riding List', icon: Calendar, roles: ['all'] },
    { id: 'schedule', label: 'The Book', icon: CalendarDays, roles: ['all'] },
    { id: 'requests', label: 'PTO', icon: Clock, roles: ['all'] },
    { id: 'officers', label: 'Officers', icon: Users, roles: ['supervisor', 'admin'] },
    { id: 'vacancies', label: 'Vacancies', icon: AlertTriangle, roles: ['supervisor', 'admin'] },
    { id: 'staff', label: 'Staff', icon: UserPlus, roles: ['supervisor', 'admin'] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: ['admin'] },
  ];

  const handleTabClick = (tabId) => {
    onTabChange(tabId);
    setIsDrawerOpen(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
    setIsDrawerOpen(false);
  };

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b z-40 safe-area-top">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="p-2 rounded-lg hover:bg-muted"
            >
              <Menu className="h-5 w-5" />
            </button>
            
            <div className="flex items-center gap-2">
              <img 
                src="[LOGO_BASE64_PLACEHOLDER]" 
                alt="Port Arthur PD Logo" 
                className="w-8 h-8 object-contain"
              />
              <div>
                <h1 className="text-sm font-semibold">Port Arthur PD</h1>
                <p className="text-xs text-muted-foreground">Shift Scheduler</p>
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-sm font-medium truncate max-w-[120px]">
              {profile?.full_name?.split(" ")[0] || "Officer"}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {isAdmin ? 'Admin' : isAdminOrSupervisor ? 'Supervisor' : 'Officer'}
            </p>
          </div>
        </div>
        
        {/* Tab Switcher - Horizontal Scroll */}
        <div className="px-4 pb-2 overflow-x-auto scrollbar-hide">
          <div className="flex space-x-2">
            {allTabs.filter(tab => {
              const hasAccess = tab.roles.includes('all') || 
                (tab.roles.includes('supervisor') && isAdminOrSupervisor) ||
                (tab.roles.includes('admin') && isAdmin);
              return hasAccess;
            }).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-full whitespace-nowrap text-sm
                    ${activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Side Drawer */}
      {isDrawerOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setIsDrawerOpen(false)}
          />
          
          <div className="fixed left-0 top-0 bottom-0 w-64 bg-background z-50 animate-in slide-in-from-left-full">
            <div className="p-4 h-full flex flex-col">
              {/* Drawer Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <img 
                    src="[LOGO_BASE64_PLACEHOLDER]" 
                    alt="Logo" 
                    className="w-8 h-8"
                  />
                  <span className="font-semibold">Menu</span>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 rounded-lg hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* User Info */}
              <div className="px-4 py-3 bg-muted rounded-lg mb-6">
                <p className="font-medium">{profile?.full_name || 'User'}</p>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
                <p className="text-xs text-muted-foreground capitalize mt-1">
                  {isAdmin ? 'Administrator' : isAdminOrSupervisor ? 'Supervisor' : 'Officer'}
                </p>
              </div>

              {/* Navigation Links */}
              <div className="flex-1 space-y-1">
                {allTabs.map((tab) => {
                  const Icon = tab.icon;
                  const hasAccess = tab.roles.includes('all') || 
                    (tab.roles.includes('supervisor') && isAdminOrSupervisor) ||
                    (tab.roles.includes('admin') && isAdmin);
                  
                  if (!hasAccess) return null;
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabClick(tab.id)}
                      className={`
                        flex items-center w-full p-3 rounded-lg text-left
                        ${activeTab === tab.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                        }
                      `}
                    >
                      <Icon className="h-5 w-5 mr-3" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Sign Out Button */}
              <div className="pt-4 border-t">
                <button
                  onClick={handleSignOut}
                  className="flex items-center w-full p-3 rounded-lg text-left text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default MobileHeader;
