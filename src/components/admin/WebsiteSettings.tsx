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
import { PDFLayoutSettings } from "./settings/PDFLayoutSettings";
import { PDFPreviewDialog } from "./settings/PDFPreviewDialog";
import { DEFAULT_LAYOUT_SETTINGS } from "@/constants/pdfLayoutSettings";
import { AnniversaryAlertSettings } from "./settings/AnniversaryAlertSettings";

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
  enable_anniversary_alerts: false,
  enable_birthday_alerts: false,
  anniversary_alert_recipients: ["admin", "supervisor"],
};

interface WebsiteSettingsProps {
  isAdmin?: boolean;
  isSupervisor?: boolean;
}

export const WebsiteSettings = ({ isAdmin = false, isSupervisor = false }: WebsiteSettingsProps) => {
  const queryClient = useQueryClient();
  const [colorSettings, setColorSettings] = useState(DEFAULT_COLORS);
  const [ptoVisibility, setPtoVisibility] = useState(DEFAULT_PTO_VISIBILITY);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [anniversaryRecipients, setAnniversaryRecipients] = useState<string[]>(["admin", "supervisor"]);

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
              pto_type_visibility: DEFAULT_PTO_VISIBILITY,
              pdf_layout_settings: DEFAULT_LAYOUT_SETTINGS
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

      // Create a base object with all DEFAULT_NOTIFICATION_SETTINGS
      const baseSettings = { ...DEFAULT_NOTIFICATION_SETTINGS };
      
      // Merge database data on top of defaults
      const mergedData = {
        ...baseSettings,
        ...data,
        // Ensure nested objects are properly merged
        color_settings: { ...DEFAULT_COLORS, ...(data.color_settings || {}) },
        pto_type_visibility: { ...DEFAULT_PTO_VISIBILITY, ...(data.pto_type_visibility || {}) }
      };
      
      // Ensure pdf_layout_settings exists and has all defaults
      if (!mergedData.pdf_layout_settings) {
        mergedData.pdf_layout_settings = DEFAULT_LAYOUT_SETTINGS;
      } else {
        // Deep merge with defaults
        mergedData.pdf_layout_settings = {
          ...DEFAULT_LAYOUT_SETTINGS,
          ...mergedData.pdf_layout_settings,
          fontSizes: {
            ...DEFAULT_LAYOUT_SETTINGS.fontSizes,
            ...(mergedData.pdf_layout_settings.fontSizes || {})
          },
          sections: {
            ...DEFAULT_LAYOUT_SETTINGS.sections,
            ...(mergedData.pdf_layout_settings.sections || {})
          },
          tableSettings: {
            ...DEFAULT_LAYOUT_SETTINGS.tableSettings,
            ...(mergedData.pdf_layout_settings.tableSettings || {})
          },
          colorSettings: {
            ...DEFAULT_LAYOUT_SETTINGS.colorSettings,
            ...(mergedData.pdf_layout_settings.colorSettings || {})
          }
        };
      }
      
      // Specifically handle anniversary_alert_recipients if it doesn't exist
      if (!mergedData.anniversary_alert_recipients) {
        mergedData.anniversary_alert_recipients = DEFAULT_NOTIFICATION_SETTINGS.anniversary_alert_recipients;
      }
      
      return mergedData;
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
    if (settings?.anniversary_alert_recipients) {
      setAnniversaryRecipients(settings.anniversary_alert_recipients);
    }
  }, [settings]);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: any) => {
      console.log('Updating settings with:', updates);
      
      // Get current settings from cache first
      const currentSettings = queryClient.getQueryData(['website-settings']) || {};
      
      // Merge updates with current settings
      const newSettings = {
        ...currentSettings,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      
      const { data, error } = await supabase
        .from('website_settings')
        .upsert(newSettings)
        .select()
        .single();

      if (error) {
        console.error('Error updating settings:', error);
        throw error;
      }
      
      return data;
    },
    onSuccess: (data) => {
      // Merge the returned data with existing settings
      queryClient.setQueryData(['website-settings'], (oldData: any) => ({
        ...oldData,
        ...data,
        // Ensure nested objects are properly merged
        color_settings: { 
          ...DEFAULT_COLORS, 
          ...(oldData?.color_settings || {}), 
          ...(data.color_settings || {}) 
        },
        pto_type_visibility: { 
          ...DEFAULT_PTO_VISIBILITY, 
          ...(oldData?.pto_type_visibility || {}), 
          ...(data.pto_type_visibility || {}) 
        },
        pdf_layout_settings: {
          ...DEFAULT_LAYOUT_SETTINGS,
          ...(oldData?.pdf_layout_settings || {}),
          ...(data.pdf_layout_settings || {}),
          // Deep merge for nested objects in pdf_layout_settings
          fontSizes: {
            ...DEFAULT_LAYOUT_SETTINGS.fontSizes,
            ...(oldData?.pdf_layout_settings?.fontSizes || {}),
            ...(data.pdf_layout_settings?.fontSizes || {})
          },
          sections: {
            ...DEFAULT_LAYOUT_SETTINGS.sections,
            ...(oldData?.pdf_layout_settings?.sections || {}),
            ...(data.pdf_layout_settings?.sections || {})
          },
          tableSettings: {
            ...DEFAULT_LAYOUT_SETTINGS.tableSettings,
            ...(oldData?.pdf_layout_settings?.tableSettings || {}),
            ...(data.pdf_layout_settings?.tableSettings || {})
          },
          colorSettings: {
            ...DEFAULT_LAYOUT_SETTINGS.colorSettings,
            ...(oldData?.pdf_layout_settings?.colorSettings || {}),
            ...(data.pdf_layout_settings?.colorSettings || {})
          }
        }
      }));
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
    });
  };

  const handleRecipientChange = (recipient: string, checked: boolean) => {
    let newRecipients = [...anniversaryRecipients];
    
    if (checked && !newRecipients.includes(recipient)) {
      newRecipients.push(recipient);
    } else if (!checked && newRecipients.includes(recipient)) {
      newRecipients = newRecipients.filter(r => r !== recipient);
    }
    
    setAnniversaryRecipients(newRecipients);
    
    updateSettingsMutation.mutate({
      id: settings?.id,
      anniversary_alert_recipients: newRecipients,
    });
  };

  const handlePtoVisibilityToggle = (key: string, value: boolean) => {
    const newPtoVisibility = { ...ptoVisibility, [key]: value };
    setPtoVisibility(newPtoVisibility);
    
    updateSettingsMutation.mutate({
      id: settings?.id,
      pto_type_visibility: newPtoVisibility,
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
    });
  };

  const handleLayoutSettingsSave = (layoutSettings: any) => {
    console.log('Saving PDF layout settings:', layoutSettings);
    
    updateSettingsMutation.mutate({
      id: settings?.id,
      pdf_layout_settings: layoutSettings,
    });
  };

  const generatePreviewData = () => {
    const mockData = {
      shift: {
        name: "DAY SHIFT",
        start_time: "07:00",
        end_time: "15:00"
      },
      supervisors: [
        { 
          name: "SGT. JANE DOE", 
          badge: "1234", 
          position: "District 1 Supervisor", 
          unitNumber: "Unit 1",
          rank: "Sergeant",
          hasPTO: false
        },
        { 
          name: "LT. JOHN SMITH", 
          badge: "5678", 
          position: "District 2 Supervisor", 
          unitNumber: "Unit 2",
          rank: "Lieutenant",
          hasPTO: false
        }
      ],
      officers: [
        { 
          name: "OFFICER ALEX JONES", 
          badge: "9012", 
          position: "District 1", 
          unitNumber: "101",
          hasPTO: false,
          isPPO: false
        },
        { 
          name: "OFFICER SAM WILSON", 
          badge: "3456", 
          position: "District 2", 
          unitNumber: "102",
          hasPTO: false,
          isPPO: false
        }
      ],
      specialAssignmentOfficers: [
        { 
          name: "OFFICER TOM HARRIS", 
          badge: "7890", 
          position: "Traffic Enforcement", 
          unitNumber: "T-1",
          hasPTO: false
        }
      ],
      ptoRecords: [
        { 
          name: "OFFICER MIKE BROWN", 
          badge: "1111", 
          ptoType: "VACATION", 
          startTime: "07:00", 
          endTime: "15:00",
          isFullShift: true
        }
      ],
      currentSupervisors: 2,
      minSupervisors: 2,
      currentOfficers: 2,
      minOfficers: 8
    };

    setPreviewData(mockData);
    setPdfPreviewOpen(true);
  };

  const resetToDefaults = () => {
    setColorSettings(DEFAULT_COLORS);
    setPtoVisibility(DEFAULT_PTO_VISIBILITY);
    setAnniversaryRecipients(["admin", "supervisor"]);
    
    updateSettingsMutation.mutate({
      id: settings?.id,
      color_settings: DEFAULT_COLORS,
      pto_type_visibility: DEFAULT_PTO_VISIBILITY,
      anniversary_alert_recipients: ["admin", "supervisor"],
      pdf_layout_settings: DEFAULT_LAYOUT_SETTINGS,
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
      <PDFLayoutSettings 
        settings={settings}
        onSave={handleLayoutSettingsSave}
        onPreview={generatePreviewData}
        isPending={updateSettingsMutation.isPending}
      />

      <NotificationSettings 
        settings={settings}
        handleToggle={handleToggle}
        isPending={updateSettingsMutation.isPending}
      />

      <AnniversaryAlertSettings 
        settings={settings}
        handleToggle={handleToggle}
        handleRecipientChange={handleRecipientChange}
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

      {/* PDF Preview Dialog */}
      <PDFPreviewDialog
        open={pdfPreviewOpen}
        onOpenChange={setPdfPreviewOpen}
        previewData={previewData}
        layoutSettings={settings?.pdf_layout_settings || DEFAULT_LAYOUT_SETTINGS}
        selectedDate={new Date()}
      />
    </div>
  );
};
