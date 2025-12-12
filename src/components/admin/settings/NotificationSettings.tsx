// src/components/admin/settings/NotificationSettings.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, AlertCircle } from "lucide-react";

interface NotificationSettingsProps {
  settings: any;
  handleToggle: (key: string, value: boolean) => void;
  isPending: boolean;
}

export const NotificationSettings = ({ settings, handleToggle, isPending }: NotificationSettingsProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification & Alert Settings
        </CardTitle>
        <CardDescription>
          Control different notification features and alert systems
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        
        {/* SECTION 1: Mass Alert Sending System */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Mass Alert System</h3>
          <div className="pl-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="mass-alert-toggle" className="text-base">
                  Enable Mass Alert Sending
                </Label>
                <div className="text-sm text-muted-foreground">
                  Controls the "Create Manual Alert" and "Create All Alerts" buttons on the Vacancy Management page.
                  When disabled, users cannot send alerts to people or receive responses.
                </div>
              </div>
              <Switch
                id="mass-alert-toggle"
                checked={settings?.enable_mass_alert_sending !== false}
                onCheckedChange={(checked) => handleToggle('enable_mass_alert_sending', checked)}
                disabled={isPending}
              />
            </div>
            
            {/* Vacancy Alert Buttons */}
            <div className={`flex items-center justify-between ${!settings?.enable_mass_alert_sending ? 'opacity-60' : ''}`}>
              <div className="space-y-0.5">
                <Label 
                  htmlFor="vacancy-button-toggle" 
                  className={`text-base ${!settings?.enable_mass_alert_sending ? 'text-muted-foreground' : ''}`}
                >
                  Show Vacancy Alert Subscription Buttons
                </Label>
                <div className={`text-sm ${!settings?.enable_mass_alert_sending ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                  Allow users to subscribe to vacancy alerts (requires Mass Alert System to be enabled)
                </div>
              </div>
              <Switch
                id="vacancy-button-toggle"
                checked={settings?.show_vacancy_alert_buttons !== false}
                onCheckedChange={(checked) => handleToggle('show_vacancy_alert_buttons', checked)}
                disabled={isPending || !settings?.enable_mass_alert_sending}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Dashboard Display Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Dashboard Display Settings</h3>
          <div className="pl-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="staffing-overview-toggle" className="text-base">
                  Show Staffing Overview
                </Label>
                <div className="text-sm text-muted-foreground">
                  Display the Staffing Overview section on the dashboard for admin/supervisor users
                </div>
              </div>
              <Switch
                id="staffing-overview-toggle"
                checked={settings?.show_staffing_overview !== false}
                onCheckedChange={(checked) => handleToggle('show_staffing_overview', checked)}
                disabled={isPending}
              />
            </div>
          </div>
        </div>

        {/* Tab Visibility Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Tab Visibility Settings</h3>
          <div className="pl-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="pto-tab-toggle" className="text-base">
                  Show PTO Tab
                </Label>
                <div className="text-sm text-muted-foreground">
                  When enabled, all users can see and access the PTO tab. When disabled, the PTO tab is hidden from all users.
                </div>
              </div>
              <Switch
                id="pto-tab-toggle"
                checked={settings?.show_pto_tab !== false}
                onCheckedChange={(checked) => handleToggle('show_pto_tab', checked)}
                disabled={isPending}
              />
            </div>
          </div>
        </div>
        
        <Separator />
        
        {/* SECTION 2: Automated Notifications */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Automated Notifications</h3>
          <div className="pl-4 space-y-4">
            {/* Global Notification Sending Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifications-toggle" className="text-base">
                  Enable All Automated Notifications
                </Label>
                <div className="text-sm text-muted-foreground">
                  Master switch for automated notifications (PTO requests, schedule changes, etc.)
                </div>
              </div>
              <Switch
                id="notifications-toggle"
                checked={settings?.enable_notifications || false}
                onCheckedChange={(checked) => handleToggle('enable_notifications', checked)}
                disabled={isPending}
              />
            </div>

            {/* Supervisor PTO Notifications */}
            <div className={`flex items-center justify-between ${!settings?.enable_notifications ? 'opacity-60' : ''}`}>
              <div className="space-y-0.5">
                <Label 
                  htmlFor="supervisor-pto-notifications-toggle" 
                  className={`text-base ${!settings?.enable_notifications ? 'text-muted-foreground' : ''}`}
                >
                  Supervisor PTO Notifications
                </Label>
                <div className={`text-sm ${!settings?.enable_notifications ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                  Notify supervisors when other supervisors request PTO
                </div>
              </div>
              <Switch
                id="supervisor-pto-notifications-toggle"
                checked={settings?.enable_supervisor_pto_notifications !== false}
                onCheckedChange={(checked) => handleToggle('enable_supervisor_pto_notifications', checked)}
                disabled={isPending || !settings?.enable_notifications}
              />
            </div>

            {!settings?.enable_notifications && (
              <Alert className="bg-gray-50 border-gray-200">
                <AlertCircle className="h-4 w-4 text-gray-600" />
                <AlertDescription className="text-gray-700">
                  Automated notifications are currently disabled. Enable above to configure individual settings.
                </AlertDescription>
              </Alert>
            )}

            {/* Vacancy Alert Notifications */}
            <div className={`flex items-center justify-between ${!settings?.enable_notifications ? 'opacity-60' : ''}`}>
              <div className="space-y-0.5">
                <Label 
                  htmlFor="vacancy-alerts-toggle" 
                  className={`text-base ${!settings?.enable_notifications ? 'text-muted-foreground' : ''}`}
                >
                  Send Vacancy Alert Notifications
                </Label>
                <div className={`text-sm ${!settings?.enable_notifications ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                  Automatically send notifications when vacancies occur to subscribed users
                </div>
              </div>
              <Switch
                id="vacancy-alerts-toggle"
                checked={settings?.enable_vacancy_alerts !== false}
                onCheckedChange={(checked) => handleToggle('enable_vacancy_alerts', checked)}
                disabled={isPending || !settings?.enable_notifications}
              />
            </div>

            {/* PTO Request Notifications */}
            <div className={`flex items-center justify-between ${!settings?.enable_notifications ? 'opacity-60' : ''}`}>
              <div className="space-y-0.5">
                <Label 
                  htmlFor="pto-request-notifications-toggle" 
                  className={`text-base ${!settings?.enable_notifications ? 'text-muted-foreground' : ''}`}
                >
                  PTO Request Notifications
                </Label>
                <div className={`text-sm ${!settings?.enable_notifications ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                  Notify supervisors and admins when a new PTO request is submitted
                </div>
              </div>
              <Switch
                id="pto-request-notifications-toggle"
                checked={settings?.enable_pto_request_notifications !== false}
                onCheckedChange={(checked) => handleToggle('enable_pto_request_notifications', checked)}
                disabled={isPending || !settings?.enable_notifications}
              />
            </div>

            {/* PTO Status Notifications */}
            <div className={`flex items-center justify-between ${!settings?.enable_notifications ? 'opacity-60' : ''}`}>
              <div className="space-y-0.5">
                <Label 
                  htmlFor="pto-status-notifications-toggle" 
                  className={`text-base ${!settings?.enable_notifications ? 'text-muted-foreground' : ''}`}
                >
                  PTO Status Notifications
                </Label>
                <div className={`text-sm ${!settings?.enable_notifications ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                  Notify officers when their PTO request is approved or denied
                </div>
              </div>
              <Switch
                id="pto-status-notifications-toggle"
                checked={settings?.enable_pto_status_notifications !== false}
                onCheckedChange={(checked) => handleToggle('enable_pto_status_notifications', checked)}
                disabled={isPending || !settings?.enable_notifications}
              />
            </div>

            {/* Schedule Change Notifications */}
            <div className={`flex items-center justify-between ${!settings?.enable_notifications ? 'opacity-60' : ''}`}>
              <div className="space-y-0.5">
                <Label 
                  htmlFor="schedule-change-notifications-toggle" 
                  className={`text-base ${!settings?.enable_notifications ? 'text-muted-foreground' : ''}`}
                >
                  Schedule Change Notifications
                </Label>
                <div className={`text-sm ${!settings?.enable_notifications ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                  Notify users when their schedule is updated
                </div>
              </div>
              <Switch
                id="schedule-change-notifications-toggle"
                checked={settings?.enable_schedule_change_notifications !== false}
                onCheckedChange={(checked) => handleToggle('enable_schedule_change_notifications', checked)}
                disabled={isPending || !settings?.enable_notifications}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
