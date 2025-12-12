// src/components/admin/WebsiteSettings.tsx - MAIN REFACTORED COMPONENT
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

// Import sub-components
import { NotificationSettings } from "./settings/NotificationSettings";
import { PTOSettings } from "./settings/PTOSettings";
import { PTOVisibilitySettings } from "./settings/PTOVisibilitySettings";
import { ScheduleColorSettings } from "./settings/ScheduleColorSettings";
import { ColorCustomizationSettings } from "./settings/ColorCustomizationSettings";
import { PasswordResetManager } from "./PasswordResetManager";
import { AuditLogViewer } from "./settings/AuditLogViewer";
import { ManualAlertSender } from "./settings/ManualAlertSender";
import { SettingsInstructions } from "./settings/SettingsInstructions";

// Constants
export const DEFAULT_COLORS = {
  // PDF Export Colors
  pdf_supervisor_pto_bg: "255,255,200",
  pdf_supervisor_pto_border: "255,220,100", 
  pdf_supervisor_pto_text: "139,69,19",
  pdf_officer_pto_bg: "240,255,240",
  pdf_officer_pto_border: "144,238,144",
  pdf_officer_pto_text: "0,100,0",
  
  // PTO type colors
  pdf_vacation_bg: "173,216,230",
  pdf_vacation_border: "100,149,237",
  pdf_vacation_text: "0,0,139",
  pdf_sick_bg: "255,200,200",
  pdf_sick_border: "255,100,100",
  pdf_sick_text: "139,0,0",
  pdf_holiday_bg: "255,218,185",
  pdf_holiday_border: "255,165,0",
  pdf_holiday_text: "165,42,42",
  pdf_comp_bg: "221,160,221",
  pdf_comp_border: "186,85,211",
  pdf_comp_text: "128,0,128",
  pdf_off_day_bg: "220,220,220",
  pdf_off_day_text: "100,100,100",
  
  // Weekly Schedule Colors
  weekly_supervisor_bg: "255,255,255",
  weekly_supervisor_text: "0,0,0",
  weekly_officer_bg: "255,255,255", 
  weekly_officer_text: "0,0,0",
  weekly_ppo_bg: "255,250,240",
  weekly_ppo_text: "150,75,0",
  weekly_vacation_bg: "173,216,230",
  weekly_vacation_text: "0,0,139",
  weekly_sick_bg: "255,200,200",
  weekly_sick_text: "139,0,0",
  weekly_holiday_bg: "255,218,185",
  weekly_holiday_text: "165,42,42",
  weekly_comp_bg: "221,160,221",
  weekly_comp_text: "128,0,128",
  weekly_pto_bg: "144,238,144",
  weekly_pto_text: "0,100,0",
  weekly_off_bg: "240,240,240",
  weekly_off_text: "100,100,100",

  // Schedule Section Colors
  schedule_supervisor_bg: "240,248,255",
  schedule_supervisor_text: "25,25,112",
  schedule_officer_bg: "248,249,250",
  schedule_officer_text: "33,37,41",
  schedule_special_bg: "243,229,245",
  schedule_special_text: "102,51,153",
  schedule_pto_bg: "230,255,242",
  schedule_pto_text: "0,100,0",
};

export const DEFAULT_PTO_VISIBILITY = {
  show_vacation_pto: true,
  show_holiday_pto: true,
  show_sick_pto: false,
  show_comp_pto: false,
};

export const DEFAULT_NOTIFICATION_SETTINGS = {
  enable_notifications: false,
  enable_mass_alert_sending: true,
  show_staffing_overview: true,
  enable_vacancy_alerts: true,
  enable_pto_request_notifications: true,
  enable_pto_status_notifications: true,
  enable_supervisor_pto_notifications: true,
  enable_schedule_change_notifications: true,
  show_vacancy_alert_buttons: true,
  show_pto_balances: false,
  pto_balances_visible: false,
  show_pto_tab: true,
};

interface WebsiteSettingsProps {
  isAdmin?: boolean;
  isSupervisor?: boolean;
}

export const WebsiteSettings = ({ isAdmin = false, isSupervisor = false }: WebsiteSettingsProps) => {
  const queryClient = useQueryClient();
  const [colorSettings, setColorSettings] = useState(DEFAULT_COLORS);
  const [ptoVisibility, setPtoVisibility] = useState(DEFAULT_PTO_VISIBILITY);

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['website-settings'],
    queryFn: async () => {
      console.log('Fetching website settings...');
      
      const { data, error } = await supabase
        .from('website_settings')
        .select('*')
        .single();

      if (error) {
        console.log('Error fetching settings:', error);
        
        if (error.code === 'PGRST116') {
          console.log('No settings found, creating default...');
          const { data: newSettings, error: createError } = await supabase
            .from('website_settings')
            .insert({
              ...DEFAULT_NOTIFICATION_SETTINGS,
              color_settings: DEFAULT_COLORS,
              pto_type_visibility: DEFAULT_PTO_VISIBILITY
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating default settings:', createError);
            throw createError;
          }
          
          return newSettings;
        }
        throw error;
      }

      // Merge with defaults to ensure all properties exist
      data.color_settings = { ...DEFAULT_COLORS, ...(data.color_settings || {}) };
      data.pto_type_visibility = { ...DEFAULT_PTO_VISIBILITY, ...(data.pto_type_visibility || {}) };
      
      for (const key in DEFAULT_NOTIFICATION_SETTINGS) {
        if (data[key] === undefined) {
          data[key] = DEFAULT_NOTIFICATION_SETTINGS[key as keyof typeof DEFAULT_NOTIFICATION_SETTINGS];
        }
      }
      
      return data;
    },
    retry: 1,
  });

  // Update local state when settings load
  useEffect(() => {
    if (settings?.color_settings) {
      setColorSettings(settings.color_settings);
    }
    if (settings?.pto_type_visibility) {
      setPtoVisibility(settings.pto_type_visibility);
    }
  }, [settings]);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      console.log('Updating settings:', newSettings);
      
      const { data, error } = await supabase
        .from('website_settings')
        .upsert({
          ...newSettings,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error updating settings:', error);
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website-settings'] });
      toast.success("Settings updated successfully");
    },
    onError: (error) => {
      console.error("Error updating settings:", error);
      toast.error("Failed to update settings");
    },
  });

  const handleToggle = (key: string, value: boolean) => {
    updateSettingsMutation.mutate({
      id: settings?.id,
      [key]: value,
      color_settings: colorSettings,
      pto_type_visibility: ptoVisibility,
    });
  };

  const handlePtoVisibilityToggle = (key: string, value: boolean) => {
    const newPtoVisibility = { ...ptoVisibility, [key]: value };
    setPtoVisibility(newPtoVisibility);
    
    updateSettingsMutation.mutate({
      id: settings?.id,
      pto_type_visibility: newPtoVisibility,
      color_settings: colorSettings,
    });
  };

  const handleColorChange = (key: string, value: string) => {
    const hexToRgbString = (hex: string): string => {
      hex = hex.replace('#', '');
      if (hex.length !== 6) return '255,255,255';
      
      try {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        if (isNaN(r) || isNaN(g) || isNaN(b)) return '255,255,255';
        return `${r},${g},${b}`;
      } catch (error) {
        return '255,255,255';
      }
    };

    const rgbValue = hexToRgbString(value);
    const newColors = { ...colorSettings, [key]: rgbValue };
    setColorSettings(newColors);
    
    updateSettingsMutation.mutate({
      id: settings?.id,
      color_settings: newColors,
      pto_type_visibility: ptoVisibility,
    });
  };

  const resetToDefaults = () => {
    setColorSettings(DEFAULT_COLORS);
    setPtoVisibility(DEFAULT_PTO_VISIBILITY);
    updateSettingsMutation.mutate({
      id: settings?.id,
      color_settings: DEFAULT_COLORS,
      pto_type_visibility: DEFAULT_PTO_VISIBILITY,
      ...DEFAULT_NOTIFICATION_SETTINGS,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading settings...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <NotificationSettings 
        settings={settings}
        handleToggle={handleToggle}
        isPending={updateSettingsMutation.isPending}
      />

      <PTOSettings 
        settings={settings}
        handleToggle={handleToggle}
        isPending={updateSettingsMutation.isPending}
      />

      <PTOVisibilitySettings 
        ptoVisibility={ptoVisibility}
        handlePtoVisibilityToggle={handlePtoVisibilityToggle}
        isPending={updateSettingsMutation.isPending}
      />

      <ScheduleColorSettings 
        colorSettings={colorSettings}
        handleColorChange={handleColorChange}
        isPending={updateSettingsMutation.isPending}
        settings={settings}
        ptoVisibility={ptoVisibility}
        updateSettingsMutation={updateSettingsMutation}
        setColorSettings={setColorSettings}
      />

      <ColorCustomizationSettings 
        colorSettings={colorSettings}
        handleColorChange={handleColorChange}
        resetToDefaults={resetToDefaults}
        isPending={updateSettingsMutation.isPending}
      />

      {(isAdmin || isSupervisor) && <PasswordResetManager />}

      <AuditLogViewer />

      {(isAdmin || isSupervisor) && <ManualAlertSender />}

      <SettingsInstructions />
    </div>
  );
};
