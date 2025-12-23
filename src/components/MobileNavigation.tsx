import { Calendar, Users, AlertTriangle, Clock, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

// Default settings fallback
const DEFAULT_NOTIFICATION_SETTINGS = {
  show_pto_tab: true,
};

interface MobileNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isAdminOrSupervisor: boolean;
  isAdmin: boolean;
}

const MobileNavigation = ({ 
  activeTab, 
  onTabChange, 
  isAdminOrSupervisor, 
  isAdmin 
}: MobileNavigationProps) => {
  const navigate = useNavigate();

  // Fetch website settings to check if PTO tab should be shown
  const { data: websiteSettings } = useQuery({
    queryKey: ['website-settings-mobile-nav'],
    queryFn: async () => {
      console.log('Fetching website settings for mobile navigation...');
      
      const { data, error } = await supabase
        .from('website_settings')
        .select('*')
        .single();

      if (error) {
        console.log('Error fetching website settings for mobile nav:', error);
        return DEFAULT_NOTIFICATION_SETTINGS;
      }

      console.log('Website settings fetched for mobile nav:', data);
      return data;
    },
  });

  // Helper function to get settings with fallback
  const getSetting = (key: string, defaultValue: boolean = true): boolean => {
    if (!websiteSettings) return defaultValue;
    
    // If the key exists in websiteSettings, use it
    if (websiteSettings[key] !== undefined) {
      return websiteSettings[key];
    }
    
    // Otherwise check DEFAULT_NOTIFICATION_SETTINGS
    if (DEFAULT_NOTIFICATION_SETTINGS[key as keyof typeof DEFAULT_NOTIFICATION_SETTINGS] !== undefined) {
      return DEFAULT_NOTIFICATION_SETTINGS[key as keyof typeof DEFAULT_NOTIFICATION_SETTINGS] as boolean;
    }
    
    return defaultValue;
  };

  const showPtoTab = getSetting('show_pto_tab', true);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  // Define types for navigation items
  interface NavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }

  // Navigation items for regular officers
  const officerItems: NavItem[] = [
    { id: 'daily', label: 'Riding List', icon: Calendar },
    { id: 'schedule', label: 'The Book', icon: Calendar },
  ];

  // Add PTO tab conditionally for officers
  if (showPtoTab) {
    officerItems.push({ id: 'requests', label: 'PTO', icon: Clock });
  }

  // Navigation items for admin/supervisor
  const adminSupervisorItems: NavItem[] = [
    { id: 'daily', label: 'Riding List', icon: Calendar },
    { id: 'schedule', label: 'The Book', icon: Calendar },
    { id: 'officers', label: 'Officers', icon: Users },
    { id: 'vacancies', label: 'Vacancies', icon: AlertTriangle },
    { id: 'staff', label: 'Staff', icon: Users },
  ];

  // Add PTO tab conditionally for admin/supervisor
  if (showPtoTab) {
    adminSupervisorItems.push({ id: 'requests', label: 'PTO', icon: Clock });
  }

  // Add Settings tab for admin only
  if (isAdmin) {
    adminSupervisorItems.push({ id: 'settings', label: 'Settings', icon: Settings });
  }

  // Use the appropriate navigation items based on user role
  const navItems = isAdminOrSupervisor ? adminSupervisorItems : officerItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 md:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "flex flex-col items-center justify-center h-full transition-colors flex-1",
                activeTab === item.id
                  ? "text-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
        
      </div>
    </nav>
  );
};

export default MobileNavigation;
