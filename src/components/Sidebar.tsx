import React from 'react';
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Calendar, 
  CalendarDays, 
  Users, 
  Briefcase, 
  Clock, 
  Settings,
  BadgeCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, userRole }) => {
  const tabs = [
    { id: "daily", label: "Daily Schedule", icon: Calendar, role: 'all' },
    { id: "schedule", label: "The Book", icon: CalendarDays, role: 'all' },
    { id: "vacancies", label: "Vacancy Management", icon: Briefcase, role: 'admin' },
    { id: "staff", label: "Staff Management", icon: Users, role: 'admin' },
    { id: "requests", label: "Time Off Requests", icon: Clock, role: 'all' },
    { id: "settings", label: "Settings", icon: Settings, role: 'all' },
  ];

  const filteredTabs = tabs.filter(tab => 
    tab.role === 'all' || 
    userRole === 'admin' || 
    (userRole === 'supervisor' && tab.role !== 'admin')
  );

  return (
    <div className="w-64 bg-white border-r h-screen fixed left-0 top-0 overflow-y-auto">
      <div className="p-6 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <BadgeCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Police Schedule</h1>
            <p className="text-sm text-muted-foreground">Management System</p>
          </div>
        </div>
      </div>

      <nav className="p-4 space-y-1">
        {filteredTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <Button
              key={tab.id}
              variant={isActive ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start mb-1",
                isActive && "bg-primary/10 text-primary"
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon className="h-5 w-5 mr-3" />
              {tab.label}
            </Button>
          );
        })}
      </nav>

      <div className="p-4 border-t mt-4">
        <div className="text-xs text-muted-foreground mb-2">User Role</div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-3 h-3 rounded-full",
            userRole === 'admin' ? "bg-red-500" :
            userRole === 'supervisor' ? "bg-blue-500" :
            "bg-green-500"
          )} />
          <span className="font-medium capitalize">
            {userRole === 'admin' ? 'Administrator' :
             userRole === 'supervisor' ? 'Supervisor' :
             'Officer'}
          </span>
        </div>
      </div>
    </div>
  );
};
