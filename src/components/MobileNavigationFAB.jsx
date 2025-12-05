// src/components/MobileNavigation.jsx - FAB Version
import React, { useState } from 'react';
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
  Home,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

  return (
    <>
      {/* Bottom Navigation - Just primary tabs */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t z-40 safe-area-bottom">
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
                className={`
                  flex flex-col items-center justify-center flex-1 h-full
                  ${activeTab === tab.id
                    ? 'text-primary'
                    : 'text-muted-foreground'
                  }
                `}
              >
                <Icon className={`h-5 w-5 mb-1 ${activeTab === tab.id ? 'text-primary' : ''}`} />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsMenuOpen(true)}
        className="fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Menu Overlay */}
      {isMenuOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setIsMenuOpen(false)}
          />
          
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4">
            <div className="bg-background rounded-xl w-full max-w-sm shadow-lg animate-in slide-in-from-bottom-full">
              <div className="p-4 space-y-2">
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
                      className="flex items-center w-full p-3 rounded-lg hover:bg-muted"
                    >
                      <Icon className="h-5 w-5 mr-3 text-muted-foreground" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
                
                <button
                  onClick={handleSignOut}
                  className="flex items-center w-full p-3 rounded-lg text-destructive hover:bg-destructive/10 mt-2"
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

export default MobileNavigation;
