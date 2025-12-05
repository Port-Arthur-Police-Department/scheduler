// src/components/MobileNavigation.jsx - Final FAB version using your CSS classes
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
  X,
  ChevronUp
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
  React.useEffect(() => {
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
      {/* Blurred Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 frosted-glass border-t shadow-lg z-40 safe-area-bottom mobile-nav-elevation">
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
                    : "text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary"
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
                  "p-2 rounded-xl transition-all duration-200",
                  activeTab === tab.id
                    ? "bg-primary/10"
                    : "group-hover:bg-gray-200/50 dark:group-hover:bg-gray-800/50"
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

      {/* Floating Action Button */}
      <button
        onClick={() => setIsMenuOpen(true)}
        className="fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-primary text-white fab-shadow flex items-center justify-center hover:bg-primary/90 transition-all duration-200 hover:scale-105 active:scale-95 mobile-nav-button"
        aria-label="Open menu"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Menu Overlay with Frosted Glass Effect */}
      {isMenuOpen && (
        <>
          {/* Blurred Overlay */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 fade-in mobile-menu-backdrop"
            onClick={() => setIsMenuOpen(false)}
          />
          
          {/* Menu Sheet */}
          <div className="fixed inset-x-0 bottom-0 z-50 animate-in">
            <div className="frosted-glass rounded-t-3xl border-t shadow-2xl mx-auto max-w-lg">
              
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing" onClick={() => setIsMenuOpen(false)}>
                <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
              </div>
              
              {/* Menu Header */}
              <div className="px-6 pt-2 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    More Options
                  </h3>
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="p-2 rounded-full hover:bg-gray-200/50 dark:hover:bg-gray-800/50 transition-colors mobile-nav-button"
                    aria-label="Close menu"
                  >
                    <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
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
                        "flex items-center w-full p-4 rounded-2xl hover:bg-gray-200/50 dark:hover:bg-gray-800/50 transition-all duration-200 active:scale-95 mobile-nav-button",
                        activeTab === tab.id && "bg-primary/10 text-primary"
                      )}
                    >
                      <div className="p-2 rounded-xl bg-gray-100/50 dark:bg-gray-800/50 mr-3">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="font-medium">{tab.label}</span>
                    </button>
                  );
                })}
                
                {/* Sign Out Button */}
                <button
                  onClick={handleSignOut}
                  className="flex items-center w-full p-4 rounded-2xl text-red-600 dark:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-900/20 transition-all duration-200 active:scale-95 mt-4 mobile-nav-button"
                >
                  <div className="p-2 rounded-xl bg-red-100/50 dark:bg-red-900/20 mr-3">
                    <LogOut className="h-5 w-5" />
                  </div>
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>

              {/* Safe Area Padding for iPhone Notch */}
              <div className="h-4 safe-area-bottom" />
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default MobileNavigation;
