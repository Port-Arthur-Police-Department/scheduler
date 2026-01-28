// src/components/admin/WebsiteSettings.tsx - COMPLETE FIXED VERSION
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Eye } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
import { EventsDashboardSettings } from "./settings/EventsDashboardSettings";

// Constants - UPDATED WITH YOUR CURRENT SETTINGS FROM SUPABASE
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
  show_staffing_overview: false,
  enable_vacancy_alerts: true,
  enable_pto_request_notifications: true,
  enable_pto_status_notifications: true,
  enable_supervisor_pto_notifications: true,
  enable_schedule_change_notifications: true,
  show_vacancy_alert_buttons: true,
  show_pto_balances: false,
  pto_balances_visible: false,
  show_pto_tab: false,
  enable_anniversary_alerts: false,
  enable_birthday_alerts: false,
  anniversary_alert_recipients: ["admin", "supervisor"],
  
  // Events Dashboard Settings
  enable_events_dashboard: true,
  events_dashboard_visible_to_officers: true,
  events_dashboard_visible_to_supervisors: true,
  events_dashboard_visible_to_admins: true,
  events_dashboard_show_birthdays: true,
  events_dashboard_show_anniversaries: true,
  events_dashboard_month_scope: 'current', // 'current' or 'upcoming'
  
  // NEW: Anniversary Countdown Settings
  enable_anniversary_countdown: true,
  anniversary_countdown_admins: true,
  anniversary_countdown_supervisors: true,
  anniversary_countdown_officers: true,
  anniversary_show_progress_bar: true,
  anniversary_show_milestone_badges: true,
  anniversary_enable_notifications: true,
  anniversary_notify_days_before: 7,
  anniversary_notify_on_day: true,
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
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [activeTab, setActiveTab] = useState("notifications");
  const [isResetting, setIsResetting] = useState(false);

  // Helper function to get PTO records
  const getPTORecordsForDate = async (date: Date): Promise<any[]> => {
    try {
      const dateString = date.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('pto_requests')
        .select(`
          *,
          officers!inner(
            first_name,
            last_name,
            badge_number
          )
        `)
        .eq('date', dateString)
        .eq('status', 'approved');

      if (error) {
        console.error("Error fetching PTO records:", error);
        return [];
      }

      return data?.map((record: any) => ({
        id: record.id,
        name: `${record.officers?.first_name || ''} ${record.officers?.last_name || ''}`.trim(),
        badge: record.officers?.badge_number || "",
        ptoType: record.pto_type?.toUpperCase() || "PTO",
        startTime: record.start_time || "07:00",
        endTime: record.end_time || "15:00",
        isFullShift: record.is_full_shift || false,
        firstName: record.officers?.first_name,
        lastName: record.officers?.last_name
      })) || [];
    } catch (error) {
      console.error("Error in getPTORecordsForDate:", error);
      return [];
    }
  };

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

      // Merge with defaults to ensure all properties exist
      const mergedData = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...data,
        color_settings: { ...DEFAULT_COLORS, ...(data.color_settings || {}) },
        pto_type_visibility: { ...DEFAULT_PTO_VISIBILITY, ...(data.pto_type_visibility || {}) },
        pdf_layout_settings: { ...DEFAULT_LAYOUT_SETTINGS, ...(data.pdf_layout_settings || {}) }
      };
      
      return mergedData;
    },
    retry: 1,
    staleTime: 0,
    gcTime: 0,
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
      console.log('Updating settings with ID:', settings?.id, 'Updates:', updates);
      
      // ALWAYS include the ID to update existing record, not create new one
      const dataToUpdate = {
        ...updates,
        id: settings?.id, // CRITICAL: This ensures we update, not create new
        updated_at: new Date().toISOString(),
      };

      console.log('Data being sent to Supabase:', dataToUpdate);
      
      const { data, error } = await supabase
        .from('website_settings')
        .upsert(dataToUpdate, {
          onConflict: 'id' // Ensure it updates based on ID
        })
        .select()
        .single();

      if (error) {
        console.error('Error updating settings:', error);
        throw error;
      }
      
      return data;
    },
    onSuccess: (data) => {
      console.log('Settings updated successfully:', data);
      // Force an immediate refetch
      queryClient.invalidateQueries({ 
        queryKey: ['website-settings'],
        refetchType: 'active'
      });
      toast.success("Settings updated successfully");
    },
    onError: (error) => {
      console.error("Error updating settings:", error);
      toast.error("Failed to update settings");
    },
  });

  // ALL handlers must include the ID
  const handleToggle = (key: string, value: boolean) => {
    updateSettingsMutation.mutate({
      id: settings?.id, // MUST include ID
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
      id: settings?.id, // MUST include ID
      anniversary_alert_recipients: newRecipients,
    });
  };

  const handlePtoVisibilityToggle = (key: string, value: boolean) => {
    const newPtoVisibility = { ...ptoVisibility, [key]: value };
    setPtoVisibility(newPtoVisibility);
    
    updateSettingsMutation.mutate({
      id: settings?.id, // MUST include ID
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
      id: settings?.id, // MUST include ID
      color_settings: newColors,
    });
  };

  const handleLayoutSettingsSave = (layoutSettings: any) => {
    console.log('Saving PDF layout settings:', layoutSettings);
    
    updateSettingsMutation.mutate({
      id: settings?.id, // MUST include ID
      pdf_layout_settings: layoutSettings,
    });
  };

  const generatePreviewData = async () => {
    setIsGeneratingPreview(true);
    try {
      // Try to fetch actual data from your database first
      const today = new Date().toISOString().split('T')[0];
      console.log("Fetching shift data for date:", today);
      
      const { data: actualData, error } = await supabase
        .from('shifts')
        .select(`
          *,
          shift_assignments!inner(
            *,
            officers!inner(
              id,
              first_name,
              last_name,
              badge_number,
              rank,
              unit,
              position,
              is_supervisor,
              is_ppo
            )
          )
        `)
        .eq('date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && actualData) {
        console.log("Found actual shift data:", actualData);
        
        // Process actual data into preview format
        const processedData = {
          shift: {
            name: actualData.name || "DAY SHIFT",
            start_time: actualData.start_time || "07:00",
            end_time: actualData.end_time || "15:00"
          },
          supervisors: actualData.shift_assignments
            ?.filter((assignment: any) => assignment.officers?.is_supervisor)
            .map((assignment: any) => ({
              id: assignment.officer_id,
              name: `${assignment.officers?.first_name || ''} ${assignment.officers?.last_name || ''}`.trim() || "Unknown Officer",
              badge: assignment.officers?.badge_number || "0000",
              position: assignment.officers?.position || assignment.officers?.rank || "Supervisor",
              unitNumber: assignment.officers?.unit || assignment.unit || "",
              rank: assignment.officers?.rank || "",
              hasPTO: false,
              firstName: assignment.officers?.first_name,
              lastName: assignment.officers?.last_name
            })) || [],
          officers: actualData.shift_assignments
            ?.filter((assignment: any) => !assignment.officers?.is_supervisor && !assignment.officers?.is_ppo)
            .map((assignment: any) => ({
              id: assignment.officer_id,
              name: `${assignment.officers?.first_name || ''} ${assignment.officers?.last_name || ''}`.trim() || "Unknown Officer",
              badge: assignment.officers?.badge_number || "0000",
              position: assignment.officers?.position || assignment.beat || "Officer",
              unitNumber: assignment.officers?.unit || assignment.unit || "",
              hasPTO: false,
              isPPO: assignment.officers?.is_ppo || false,
              firstName: assignment.officers?.first_name,
              lastName: assignment.officers?.last_name
            })) || [],
          specialAssignmentOfficers: actualData.shift_assignments
            ?.filter((assignment: any) => assignment.is_special_assignment)
            .map((assignment: any) => ({
              id: assignment.officer_id,
              name: `${assignment.officers?.first_name || ''} ${assignment.officers?.last_name || ''}`.trim() || "Unknown Officer",
              badge: assignment.officers?.badge_number || "0000",
              position: assignment.special_assignment_type || assignment.position || "Special Assignment",
              unitNumber: assignment.officers?.unit || assignment.unit || "",
              hasPTO: false,
              firstName: assignment.officers?.first_name,
              lastName: assignment.officers?.last_name
            })) || [],
          ptoRecords: await getPTORecordsForDate(new Date()),
          currentSupervisors: actualData.shift_assignments?.filter((a: any) => a.officers?.is_supervisor).length || 2,
          minSupervisors: actualData.min_supervisors || 2,
          currentOfficers: actualData.shift_assignments?.filter((a: any) => !a.officers?.is_supervisor && !a.officers?.is_ppo).length || 8,
          minOfficers: actualData.min_officers || 8
        };

        console.log("Processed actual data for preview:", processedData);
        setPreviewData(processedData);
        setPdfPreviewOpen(true);
        return;
      }

      console.log("No actual shift data found, using mock data");
      
      // Fallback to more realistic mock data
      const mockData = {
        shift: {
          name: "DAY SHIFT",
          start_time: "07:00",
          end_time: "15:00"
        },
        supervisors: [
          { 
            id: 1,
            name: "SGT. JANE DOE", 
            badge: "1234", 
            position: "District 1 Supervisor", 
            unitNumber: "Unit 1",
            rank: "Sergeant",
            hasPTO: false,
            firstName: "Jane",
            lastName: "Doe"
          },
          { 
            id: 2,
            name: "LT. JOHN SMITH", 
            badge: "5678", 
            position: "District 2 Supervisor", 
            unitNumber: "Unit 2",
            rank: "Lieutenant",
            hasPTO: false,
            firstName: "John",
            lastName: "Smith"
          }
        ],
        officers: [
          { 
            id: 3,
            name: "OFFICER ALEX JONES", 
            badge: "9012", 
            position: "Beat 101", 
            unitNumber: "101",
            hasPTO: false,
            isPPO: false,
            firstName: "Alex",
            lastName: "Jones"
          },
          { 
            id: 4,
            name: "OFFICER SAM WILSON", 
            badge: "3456", 
            position: "Beat 102", 
            unitNumber: "102",
            hasPTO: false,
            isPPO: false,
            firstName: "Sam",
            lastName: "Wilson"
          },
          { 
            id: 5,
            name: "OFFICER CHRIS TAYLOR", 
            badge: "7891", 
            position: "Beat 103", 
            unitNumber: "103",
            hasPTO: false,
            isPPO: false,
            firstName: "Chris",
            lastName: "Taylor"
          },
          { 
            id: 6,
            name: "OFFICER PATRICK MILLER", 
            badge: "2345", 
            position: "Beat 104", 
            unitNumber: "104",
            hasPTO: false,
            isPPO: false,
            firstName: "Patrick",
            lastName: "Miller"
          }
        ],
        specialAssignmentOfficers: [
          { 
            id: 7,
            name: "OFFICER TOM HARRIS", 
            badge: "7890", 
            position: "Traffic Enforcement", 
            unitNumber: "T-1",
            hasPTO: false,
            firstName: "Tom",
            lastName: "Harris"
          },
          { 
            id: 8,
            name: "OFFICER SARAH CONNOR", 
            badge: "1357", 
            position: "K9 Unit", 
            unitNumber: "K9-1",
            hasPTO: false,
            firstName: "Sarah",
            lastName: "Connor"
          }
        ],
        ptoRecords: [
          { 
            id: 9,
            name: "OFFICER MIKE BROWN", 
            badge: "1111", 
            ptoType: "VACATION", 
            startTime: "07:00", 
            endTime: "15:00",
            isFullShift: true,
            firstName: "Mike",
            lastName: "Brown"
          },
          { 
            id: 10,
            name: "OFFICER LISA WHITE", 
            badge: "2222", 
            ptoType: "SICK", 
            startTime: "07:00", 
            endTime: "11:00",
            isFullShift: false,
            firstName: "Lisa",
            lastName: "White"
          }
        ],
        currentSupervisors: 2,
        minSupervisors: 2,
        currentOfficers: 4,
        minOfficers: 8
      };

      setPreviewData(mockData);
      setPdfPreviewOpen(true);
    } catch (error) {
      console.error("Error generating preview data:", error);
      toast.error("Failed to generate preview");
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  // FIXED: Reset to defaults function with proper UI updates
  const resetToDefaults = async () => {
    setIsResetting(true);
    const toastId = toast.loading("Resetting all settings to defaults...");
    
    try {
      // Update local state immediately for instant UI feedback
      setColorSettings(DEFAULT_COLORS);
      setPtoVisibility(DEFAULT_PTO_VISIBILITY);
      setAnniversaryRecipients(["admin", "supervisor"]);
      
      // Create the reset data
      const resetData = {
        id: settings?.id,
        color_settings: DEFAULT_COLORS,
        pto_type_visibility: DEFAULT_PTO_VISIBILITY,
        anniversary_alert_recipients: ["admin", "supervisor"],
        pdf_layout_settings: DEFAULT_LAYOUT_SETTINGS,
        ...DEFAULT_NOTIFICATION_SETTINGS,
      };

      // Update the database
      const { data, error } = await supabase
        .from('website_settings')
        .upsert(resetData, {
          onConflict: 'id'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Force a complete refresh of the settings
      queryClient.invalidateQueries({ 
        queryKey: ['website-settings'],
        refetchType: 'active'
      });
      
      // Refetch fresh data
      await queryClient.refetchQueries({ 
        queryKey: ['website-settings'] 
      });
      
      toast.dismiss(toastId);
      toast.success("All settings have been reset to defaults");
      
    } catch (error) {
      console.error("Error resetting settings:", error);
      toast.error("Failed to reset settings");
    } finally {
      setIsResetting(false);
    }
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
<TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 h-auto">
  <TabsTrigger value="notifications" className="py-2">
    Notifications
  </TabsTrigger>
  <TabsTrigger value="pdf" className="py-2">
    PDF Layout
  </TabsTrigger>
  <TabsTrigger value="pto" className="py-2">
    PTO Settings
  </TabsTrigger>
  <TabsTrigger value="events" className="py-2"> {/* NEW TAB */}
    Events Dashboard
  </TabsTrigger>
  <TabsTrigger value="colors" className="py-2">
    Colors
  </TabsTrigger>
  <TabsTrigger value="alerts" className="py-2">
    Alerts
  </TabsTrigger>
  <TabsTrigger value="system" className="py-2">
    System
  </TabsTrigger>
</TabsList>

        {/* NOTIFICATIONS TAB */}
        <TabsContent value="notifications" className="space-y-6 mt-6">
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
        </TabsContent>

        {/* PDF LAYOUT TAB */}
        <TabsContent value="pdf" className="space-y-6 mt-6">
          <PDFLayoutSettings 
            settings={settings}
            onSave={handleLayoutSettingsSave}
            onPreview={generatePreviewData}
            isPending={updateSettingsMutation.isPending}
            isPreviewLoading={isGeneratingPreview}
          />
        </TabsContent>

        {/* PTO SETTINGS TAB */}
        <TabsContent value="pto" className="space-y-6 mt-6">
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
        </TabsContent>

                {/* EVENTS DASHBOARD TAB */}
        <TabsContent value="events" className="space-y-6 mt-6">
          <EventsDashboardSettings 
            settings={settings}
            handleToggle={handleToggle}
            isPending={updateSettingsMutation.isPending}
          />
        </TabsContent>

        {/* COLORS TAB */}
        <TabsContent value="colors" className="space-y-6 mt-6">
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
            isPending={updateSettingsMutation.isPending || isResetting}
          />
        </TabsContent>

        {/* ALERTS TAB */}
        <TabsContent value="alerts" className="space-y-6 mt-6">
          {(isAdmin || isSupervisor) && <ManualAlertSender />}
          
          <AnniversaryAlertSettings 
            settings={settings}
            handleToggle={handleToggle}
            handleRecipientChange={handleRecipientChange}
            isPending={updateSettingsMutation.isPending}
          />
        </TabsContent>

        {/* SYSTEM TAB */}
        <TabsContent value="system" className="space-y-6 mt-6">
          {(isAdmin || isSupervisor) && <PasswordResetManager />}

          <AuditLogViewer />

          <SettingsInstructions />
        </TabsContent>
      </Tabs>

      {/* Reset All Settings Button - UPDATED */}
      <div className="flex justify-end">
        <Button 
          variant="outline" 
          onClick={resetToDefaults}
          disabled={isLoading || updateSettingsMutation.isPending || isResetting}
        >
          {isResetting || updateSettingsMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isResetting ? "Resetting..." : "Saving..."}
            </>
          ) : (
            "Reset All Settings to Defaults"
          )}
        </Button>
      </div>

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
