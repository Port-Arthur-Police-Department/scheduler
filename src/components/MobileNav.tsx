import React from 'react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LayoutDashboard, 
  Calendar, 
  CalendarDays, 
  Users, 
  Briefcase, 
  Clock, 
  Settings 
} from "lucide-react";

interface MobileNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: "daily", label: "Daily", icon: Calendar },
    { id: "schedule", label: "The Book", icon: CalendarDays },
    { id: "vacancies", label: "Vacancies", icon: Briefcase },
    { id: "staff", label: "Staff", icon: Users },
    { id: "requests", label: "PTO", icon: Clock },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="border-t bg-white">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-6 h-16 rounded-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id} 
                className="flex-col h-full py-2 px-1 data-[state=active]:bg-primary/10 rounded-none"
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-xs">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
    </div>
  );
};
