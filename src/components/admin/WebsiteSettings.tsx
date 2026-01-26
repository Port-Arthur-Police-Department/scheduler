// src/components/admin/WebsiteSettings.tsx - COMPLETE FIXED VERSION
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Eye } from "lucide-react";

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
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

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

  // Update settings mutation - CRITICAL FIX: Always include the ID
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
      queryClient.invalidateQueries({ queryKey: ['website-settings'] });
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

  const resetToDefaults = () => {
    setColorSettings(DEFAULT_COLORS);
    setPtoVisibility(DEFAULT_PTO_VISIBILITY);
    setAnniversaryRecipients(["admin", "supervisor"]);
    
    updateSettingsMutation.mutate({
      id: settings?.id, // MUST include ID
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
        isPreviewLoading={isGeneratingPreview}
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
};  return Array.isArray(data) ? data : [];
};

// Helper to get officer name safely
const getOfficerName = (officer: any): string => {
  if (!officer) return "Unknown Officer";
  
  return officer.name || 
         officer.fullName || 
         officer.officerName || 
         `${officer.firstName || ''} ${officer.lastName || ''}`.trim() || 
         "Unknown Officer";
};

export const PDFPreviewDialog = ({ 
  open, 
  onOpenChange, 
  previewData, 
  layoutSettings = DEFAULT_LAYOUT_SETTINGS, 
  selectedDate 
}: PDFPreviewDialogProps) => {
  const { exportToPDF } = usePDFExport();
  const [processedData, setProcessedData] = useState<any>(null);

  useEffect(() => {
    if (previewData) {
      console.log("Preview Data Structure:", previewData); // Debug log
      processPreviewData();
    }
  }, [previewData]);

  const processPreviewData = () => {
    if (!previewData) {
      setProcessedData(null);
      return;
    }

    const processed = {
      shift: previewData.shift || {
        name: "Shift Name",
        start_time: "00:00",
        end_time: "23:59"
      },
      
      // Extract supervisors with fallback
      supervisors: getSectionData(previewData, 'supervisors').map((supervisor: any) => ({
        name: getOfficerName(supervisor),
        position: supervisor.position || supervisor.rank || "Supervisor",
        badge: supervisor.badge || supervisor.badgeNumber || supervisor.id || "",
        unitNumber: supervisor.unitNumber || supervisor.unit || supervisor.carNumber || "",
        // Additional fields that might exist
        ...supervisor
      })),
      
      // Extract officers with fallback
      officers: getSectionData(previewData, 'officers').map((officer: any) => ({
        name: getOfficerName(officer),
        position: officer.position || officer.assignment || officer.beat || "",
        badge: officer.badge || officer.badgeNumber || officer.id || "",
        unitNumber: officer.unitNumber || officer.unit || officer.carNumber || "",
        // Additional fields that might exist
        ...officer
      })),
      
      // Extract special assignments
      specialAssignmentOfficers: getSectionData(previewData, 'specialAssignmentOfficers').map((officer: any) => ({
        name: getOfficerName(officer),
        position: officer.position || officer.assignment || officer.specialAssignment || "Special Assignment",
        badge: officer.badge || officer.badgeNumber || officer.id || "",
        unitNumber: officer.unitNumber || officer.unit || officer.carNumber || "",
        // Additional fields that might exist
        ...officer
      })),
      
      // Extract PTO records
      ptoRecords: getSectionData(previewData, 'ptoRecords').map((record: any) => ({
        name: getOfficerName(record),
        badge: record.badge || record.badgeNumber || record.id || "",
        ptoType: record.ptoType || record.type || record.absenceType || "PTO",
        startTime: record.startTime || record.start || "00:00",
        endTime: record.endTime || record.end || "23:59",
        // Additional fields that might exist
        ...record
      })),
      
      // Staffing counts with fallbacks
      currentSupervisors: previewData.currentSupervisors || 
                         previewData.supervisorCount || 
                         getSectionData(previewData, 'supervisors').length || 
                         0,
      minSupervisors: previewData.minSupervisors || previewData.requiredSupervisors || 0,
      currentOfficers: previewData.currentOfficers || 
                      previewData.officerCount || 
                      getSectionData(previewData, 'officers').length || 
                      0,
      minOfficers: previewData.minOfficers || previewData.requiredOfficers || 0
    };

    console.log("Processed Preview Data:", processed); // Debug log
    setProcessedData(processed);
  };

  const handleExportPreview = async () => {
    if (!previewData) return;
    
    await exportToPDF({
      selectedDate,
      shiftName: previewData.shift?.name || "Shift",
      shiftData: previewData,
      layoutSettings
    });
  };

  // Safely get layout settings with defaults
  const safeLayoutSettings = {
    ...DEFAULT_LAYOUT_SETTINGS,
    ...layoutSettings,
    fontSizes: {
      ...DEFAULT_LAYOUT_SETTINGS.fontSizes,
      ...(layoutSettings?.fontSizes || {})
    },
    sections: {
      ...DEFAULT_LAYOUT_SETTINGS.sections,
      ...(layoutSettings?.sections || {})
    },
    tableSettings: {
      ...DEFAULT_LAYOUT_SETTINGS.tableSettings,
      ...(layoutSettings?.tableSettings || {})
    },
    colorSettings: {
      ...DEFAULT_LAYOUT_SETTINGS.colorSettings,
      ...(layoutSettings?.colorSettings || {})
    }
  };

  const primaryColor = parseColorForPreview(safeLayoutSettings.colorSettings.primaryColor);
  const headerTextColor = parseColorForPreview(safeLayoutSettings.colorSettings.headerTextColor);
  const officerTextColor = parseColorForPreview(safeLayoutSettings.colorSettings.officerTextColor);
  const supervisorTextColor = parseColorForPreview(safeLayoutSettings.colorSettings.supervisorTextColor);
  const specialTextColor = parseColorForPreview(safeLayoutSettings.colorSettings.specialAssignmentTextColor);
  const ptoTextColor = parseColorForPreview(safeLayoutSettings.colorSettings.ptoTextColor);
  const evenRowColor = parseColorForPreview(safeLayoutSettings.colorSettings.evenRowColor);
  const oddRowColor = parseColorForPreview(safeLayoutSettings.colorSettings.oddRowColor);

  // If no data is loaded yet, show loading state
  if (!processedData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>PDF Layout Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-4 text-gray-500">Loading preview data...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>PDF Layout Preview</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto border rounded-md p-4 bg-gray-50">
          {/* Preview content that mimics PDF layout */}
          <div className="bg-white p-6 shadow-lg" style={{ 
            minHeight: '842px', 
            width: '595px', 
            margin: '0 auto',
            fontFamily: 'Helvetica, Arial, sans-serif'
          }}>
            {/* Header */}
            <div className="flex items-start mb-6">
              <div 
                className="w-16 h-16 flex items-center justify-center text-white font-bold text-xs"
                style={{ 
                  backgroundColor: `rgb(${primaryColor.join(',')})`,
                  borderRadius: '2px'
                }}
              >
                LOGO
              </div>
              <div className="ml-4">
                <div style={{ 
                  fontSize: `${safeLayoutSettings.fontSizes.header}pt`,
                  fontWeight: 'bold',
                  color: `rgb(${primaryColor.join(',')})`,
                  marginBottom: '2px'
                }}>
                  {processedData.shift.name} • {processedData.shift.start_time}-{processedData.shift.end_time}
                </div>
                <div style={{
                  fontSize: `${safeLayoutSettings.fontSizes.header}pt`,
                  color: `rgb(${primaryColor.join(',')})`
                }}>
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
              </div>
            </div>

            {/* Supervisors Section */}
            {safeLayoutSettings.sections.showSupervisors && processedData.supervisors.length > 0 && (
              <div className="mb-8">
                <div className="border rounded overflow-hidden" style={{ borderColor: '#dee2e6' }}>
                  {/* Table Header */}
                  <div style={{
                    backgroundColor: `rgb(${getHeaderColorForSection(safeLayoutSettings, 'supervisors').join(',')})`,
                    color: `rgb(${headerTextColor.join(',')})`,
                    fontSize: `${safeLayoutSettings.fontSizes.tableHeader}pt`,
                    padding: `${safeLayoutSettings.tableSettings.cellPadding}px`,
                    display: 'grid',
                    gridTemplateColumns: '35% 8% 15% 10% 32%',
                    fontWeight: 'bold'
                  }}>
                    <div>SUPERVISORS</div>
                    <div style={{ textAlign: 'center' }}>BEAT</div>
                    <div style={{ textAlign: 'center' }}>BADGE #</div>
                    <div style={{ textAlign: 'center' }}>UNIT</div>
                    <div>NOTES</div>
                  </div>
                  
                  {/* Table Rows */}
                  {processedData.supervisors.map((supervisor: any, index: number) => (
                    <div key={index} style={{
                      backgroundColor: safeLayoutSettings.tableSettings.showRowStriping && index % 2 === 1
                        ? `rgb(${oddRowColor.join(',')})`
                        : `rgb(${evenRowColor.join(',')})`,
                      fontSize: `${safeLayoutSettings.fontSizes.tableContent}pt`,
                      padding: `${safeLayoutSettings.tableSettings.cellPadding}px`,
                      height: `${safeLayoutSettings.tableSettings.rowHeight}px`,
                      display: 'grid',
                      gridTemplateColumns: '35% 8% 15% 10% 32%',
                      alignItems: 'center',
                      borderTop: index > 0 ? '1px solid #dee2e6' : 'none'
                    }}>
                      <div style={{ color: `rgb(${supervisorTextColor.join(',')})` }}>{supervisor.name}</div>
                      <div style={{ 
                        color: `rgb(${supervisorTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{supervisor.position?.match(/\d+/)?.[0] || ''}</div>
                      <div style={{ 
                        color: `rgb(${supervisorTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{supervisor.badge}</div>
                      <div style={{ 
                        color: `rgb(${supervisorTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{supervisor.unitNumber}</div>
                      <div style={{ color: `rgb(${supervisorTextColor.join(',')})` }}>
                        {supervisor.notes || supervisor.comments || 'Partnership details...'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Officers Section */}
            {safeLayoutSettings.sections.showOfficers && processedData.officers.length > 0 && (
              <div className="mb-8">
                <div className="border rounded overflow-hidden" style={{ borderColor: '#dee2e6' }}>
                  {/* Table Header */}
                  <div style={{
                    backgroundColor: `rgb(${getHeaderColorForSection(safeLayoutSettings, 'officers').join(',')})`,
                    color: `rgb(${headerTextColor.join(',')})`,
                    fontSize: `${safeLayoutSettings.fontSizes.tableHeader}pt`,
                    padding: `${safeLayoutSettings.tableSettings.cellPadding}px`,
                    display: 'grid',
                    gridTemplateColumns: '35% 8% 15% 10% 32%',
                    fontWeight: 'bold'
                  }}>
                    <div>OFFICERS</div>
                    <div style={{ textAlign: 'center' }}>BEAT</div>
                    <div style={{ textAlign: 'center' }}>BADGE #</div>
                    <div style={{ textAlign: 'center' }}>UNIT</div>
                    <div>NOTES</div>
                  </div>
                  
                  {/* Table Rows */}
                  {processedData.officers.map((officer: any, index: number) => (
                    <div key={index} style={{
                      backgroundColor: safeLayoutSettings.tableSettings.showRowStriping && index % 2 === 1
                        ? `rgb(${oddRowColor.join(',')})`
                        : `rgb(${evenRowColor.join(',')})`,
                      fontSize: `${safeLayoutSettings.fontSizes.tableContent}pt`,
                      padding: `${safeLayoutSettings.tableSettings.cellPadding}px`,
                      height: `${safeLayoutSettings.tableSettings.rowHeight}px`,
                      display: 'grid',
                      gridTemplateColumns: '35% 8% 15% 10% 32%',
                      alignItems: 'center',
                      borderTop: index > 0 ? '1px solid #dee2e6' : 'none'
                    }}>
                      <div style={{ color: `rgb(${officerTextColor.join(',')})` }}>{officer.name}</div>
                      <div style={{ 
                        color: `rgb(${officerTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{officer.position?.match(/\d+/)?.[0] || ''}</div>
                      <div style={{ 
                        color: `rgb(${officerTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{officer.badge}</div>
                      <div style={{ 
                        color: `rgb(${officerTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{officer.unitNumber}</div>
                      <div style={{ color: `rgb(${officerTextColor.join(',')})` }}>
                        {officer.notes || officer.comments || 'Regular assignment...'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Special Assignments Section */}
            {safeLayoutSettings.sections.showSpecialAssignments && processedData.specialAssignmentOfficers.length > 0 && (
              <div className="mb-8">
                <div className="border rounded overflow-hidden" style={{ borderColor: '#dee2e6' }}>
                  {/* Table Header */}
                  <div style={{
                    backgroundColor: `rgb(${getHeaderColorForSection(safeLayoutSettings, 'special').join(',')})`,
                    color: `rgb(${headerTextColor.join(',')})`,
                    fontSize: `${safeLayoutSettings.fontSizes.tableHeader}pt`,
                    padding: `${safeLayoutSettings.tableSettings.cellPadding}px`,
                    display: 'grid',
                    gridTemplateColumns: '35% 22% 15% 10% 18%',
                    fontWeight: 'bold'
                  }}>
                    <div>SPECIAL ASSIGNMENT OFFICERS</div>
                    <div>ASSIGNMENT</div>
                    <div style={{ textAlign: 'center' }}>BADGE #</div>
                    <div style={{ textAlign: 'center' }}>UNIT</div>
                    <div>NOTES</div>
                  </div>
                  
                  {/* Table Rows */}
                  {processedData.specialAssignmentOfficers.map((officer: any, index: number) => (
                    <div key={index} style={{
                      backgroundColor: safeLayoutSettings.tableSettings.showRowStriping && index % 2 === 1
                        ? `rgb(${oddRowColor.join(',')})`
                        : `rgb(${evenRowColor.join(',')})`,
                      fontSize: `${safeLayoutSettings.fontSizes.tableContent}pt`,
                      padding: `${safeLayoutSettings.tableSettings.cellPadding}px`,
                      height: `${safeLayoutSettings.tableSettings.rowHeight}px`,
                      display: 'grid',
                      gridTemplateColumns: '35% 22% 15% 10% 18%',
                      alignItems: 'center',
                      borderTop: index > 0 ? '1px solid #dee2e6' : 'none'
                    }}>
                      <div style={{ color: `rgb(${specialTextColor.join(',')})` }}>{officer.name}</div>
                      <div style={{ color: `rgb(${specialTextColor.join(',')})` }}>{officer.position}</div>
                      <div style={{ 
                        color: `rgb(${specialTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{officer.badge}</div>
                      <div style={{ 
                        color: `rgb(${specialTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{officer.unitNumber}</div>
                      <div style={{ color: `rgb(${specialTextColor.join(',')})` }}>
                        {officer.notes || officer.comments || 'Special duty...'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PTO Section */}
            {safeLayoutSettings.sections.showPTO && processedData.ptoRecords.length > 0 && (
              <div className="mb-8">
                <div className="border rounded overflow-hidden" style={{ borderColor: '#dee2e6' }}>
                  {/* Table Header */}
                  <div style={{
                    backgroundColor: `rgb(${getHeaderColorForSection(safeLayoutSettings, 'pto').join(',')})`,
                    color: `rgb(${headerTextColor.join(',')})`,
                    fontSize: `${safeLayoutSettings.fontSizes.tableHeader}pt`,
                    padding: `${safeLayoutSettings.tableSettings.cellPadding}px`,
                    display: 'grid',
                    gridTemplateColumns: '35% 15% 15% 35%',
                    fontWeight: 'bold'
                  }}>
                    <div>PTO OFFICERS</div>
                    <div style={{ textAlign: 'center' }}>BADGE #</div>
                    <div style={{ textAlign: 'center' }}>TYPE</div>
                    <div style={{ textAlign: 'center' }}>TIME</div>
                  </div>
                  
                  {/* Table Rows */}
                  {processedData.ptoRecords.map((record: any, index: number) => (
                    <div key={index} style={{
                      backgroundColor: safeLayoutSettings.tableSettings.showRowStriping && index % 2 === 1
                        ? `rgb(${oddRowColor.join(',')})`
                        : `rgb(${evenRowColor.join(',')})`,
                      fontSize: `${safeLayoutSettings.fontSizes.tableContent}pt`,
                      padding: `${safeLayoutSettings.tableSettings.cellPadding}px`,
                      height: `${safeLayoutSettings.tableSettings.rowHeight}px`,
                      display: 'grid',
                      gridTemplateColumns: '35% 15% 15% 35%',
                      alignItems: 'center',
                      borderTop: index > 0 ? '1px solid #dee2e6' : 'none'
                    }}>
                      <div style={{ color: `rgb(${ptoTextColor.join(',')})` }}>{record.name}</div>
                      <div style={{ 
                        color: `rgb(${ptoTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{record.badge}</div>
                      <div style={{ 
                        color: `rgb(${ptoTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{record.ptoType}</div>
                      <div style={{ 
                        color: `rgb(${ptoTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{record.startTime}-{record.endTime}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Staffing Summary */}
            {safeLayoutSettings.sections.showStaffingSummary && (
              <div className="mt-8 pt-4 border-t" style={{ borderColor: '#dee2e6' }}>
                <div style={{
                  fontSize: `${safeLayoutSettings.fontSizes.footer}pt`,
                  fontWeight: 'bold',
                  color: `rgb(${primaryColor.join(',')})`
                }}>
                  STAFFING: Supervisors {processedData.currentSupervisors}/{processedData.minSupervisors} • 
                  Officers {processedData.currentOfficers}/{processedData.minOfficers}
                </div>
                <div style={{
                  fontSize: `${safeLayoutSettings.fontSizes.footer}pt`,
                  color: `rgb(${primaryColor.join(',')})`,
                  textAlign: 'right',
                  marginTop: '2px'
                }}>
                  Generated: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleExportPreview}>
            <Download className="h-4 w-4 mr-2" />
            Export Preview as PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
