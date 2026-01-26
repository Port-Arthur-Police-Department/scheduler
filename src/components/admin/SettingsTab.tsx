// src/components/admin/SettingsTabs.tsx
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

// Import all settings components
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
import { AnniversaryAlertSettings } from "./settings/AnniversaryAlertSettings";

interface SettingsTabsProps {
  isAdmin?: boolean;
  isSupervisor?: boolean;
  settings: any;
  ptoVisibility: any;
  colorSettings: any;
  anniversaryRecipients: string[];
  isLoading: boolean;
  updateSettingsMutation: any;
  isPending: boolean;
  isGeneratingPreview: boolean;
  handleToggle: (key: string, value: boolean) => void;
  handleRecipientChange: (recipient: string, checked: boolean) => void;
  handlePtoVisibilityToggle: (key: string, value: boolean) => void;
  handleColorChange: (key: string, value: string) => void;
  handleLayoutSettingsSave: (layoutSettings: any) => void;
  generatePreviewData: () => void;
  resetToDefaults: () => void;
  setColorSettings: (colors: any) => void;
}

export const SettingsTabs = ({
  isAdmin = false,
  isSupervisor = false,
  settings,
  ptoVisibility,
  colorSettings,
  anniversaryRecipients,
  isLoading,
  updateSettingsMutation,
  isPending,
  isGeneratingPreview,
  handleToggle,
  handleRecipientChange,
  handlePtoVisibilityToggle,
  handleColorChange,
  handleLayoutSettingsSave,
  generatePreviewData,
  resetToDefaults,
  setColorSettings,
}: SettingsTabsProps) => {
  const [activeTab, setActiveTab] = useState("notifications");

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
        <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 h-auto">
          <TabsTrigger value="notifications" className="py-2">
            Notifications
          </TabsTrigger>
          <TabsTrigger value="pdf" className="py-2">
            PDF Layout
          </TabsTrigger>
          <TabsTrigger value="pto" className="py-2">
            PTO Settings
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
            isPending={isPending}
          />

          <AnniversaryAlertSettings 
            settings={settings}
            handleToggle={handleToggle}
            handleRecipientChange={handleRecipientChange}
            isPending={isPending}
          />

          <PTOSettings 
            settings={settings}
            handleToggle={handleToggle}
            isPending={isPending}
          />

          <PTOVisibilitySettings 
            ptoVisibility={ptoVisibility}
            handlePtoVisibilityToggle={handlePtoVisibilityToggle}
            isPending={isPending}
          />
        </TabsContent>

        {/* PDF LAYOUT TAB */}
        <TabsContent value="pdf" className="space-y-6 mt-6">
          <PDFLayoutSettings 
            settings={settings}
            onSave={handleLayoutSettingsSave}
            onPreview={generatePreviewData}
            isPending={isPending}
            isPreviewLoading={isGeneratingPreview}
          />
        </TabsContent>

        {/* PTO SETTINGS TAB */}
        <TabsContent value="pto" className="space-y-6 mt-6">
          <PTOSettings 
            settings={settings}
            handleToggle={handleToggle}
            isPending={isPending}
          />

          <PTOVisibilitySettings 
            ptoVisibility={ptoVisibility}
            handlePtoVisibilityToggle={handlePtoVisibilityToggle}
            isPending={isPending}
          />
        </TabsContent>

        {/* COLORS TAB */}
        <TabsContent value="colors" className="space-y-6 mt-6">
          <ScheduleColorSettings 
            colorSettings={colorSettings}
            handleColorChange={handleColorChange}
            isPending={isPending}
            settings={settings}
            ptoVisibility={ptoVisibility}
            updateSettingsMutation={updateSettingsMutation}
            setColorSettings={setColorSettings}
          />

          <ColorCustomizationSettings 
            colorSettings={colorSettings}
            handleColorChange={handleColorChange}
            resetToDefaults={resetToDefaults}
            isPending={isPending}
          />
        </TabsContent>

        {/* ALERTS TAB */}
        <TabsContent value="alerts" className="space-y-6 mt-6">
          {(isAdmin || isSupervisor) && <ManualAlertSender />}
          
          <AnniversaryAlertSettings 
            settings={settings}
            handleToggle={handleToggle}
            handleRecipientChange={handleRecipientChange}
            isPending={isPending}
          />
        </TabsContent>

        {/* SYSTEM TAB */}
        <TabsContent value="system" className="space-y-6 mt-6">
          {(isAdmin || isSupervisor) && <PasswordResetManager />}

          <AuditLogViewer />

          <SettingsInstructions />
        </TabsContent>
      </Tabs>

      {/* Reset All Settings Button (Sticky at bottom) */}
      <div className="sticky bottom-0 bg-background border-t pt-4 mt-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Current tab: {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </div>
            <button
              onClick={resetToDefaults}
              disabled={isPending}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset All Settings to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
