import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Cake, Users } from "lucide-react";

interface AnniversaryAlertSettingsProps {
  settings: any;
  handleToggle: (key: string, value: boolean) => void;
  handleRecipientChange: (recipient: string, checked: boolean) => void;
  isPending: boolean;
}

export const AnniversaryAlertSettings: React.FC<AnniversaryAlertSettingsProps> = ({
  settings,
  handleToggle,
  handleRecipientChange,
  isPending
}) => {
  const recipients = settings?.anniversary_alert_recipients || ["admin", "supervisor"];
  
  const isRecipientSelected = (recipient: string) => {
    return recipients.includes(recipient);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Anniversary & Birthday Alerts
        </CardTitle>
        <CardDescription>
          Configure automatic alerts for hire anniversaries and birthdays
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hire Date Anniversary Alerts */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enable_anniversary_alerts" className="font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Hire Date Anniversaries
            </Label>
            <p className="text-sm text-muted-foreground">
              Send alerts when officers reach their hire date anniversary
            </p>
          </div>
          <Switch
            id="enable_anniversary_alerts"
            checked={settings?.enable_anniversary_alerts || false}
            onCheckedChange={(checked) => handleToggle("enable_anniversary_alerts", checked)}
            disabled={isPending}
          />
        </div>

        {/* Birthday Alerts */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enable_birthday_alerts" className="font-medium flex items-center gap-2">
              <Cake className="h-4 w-4" />
              Birthday Alerts
            </Label>
            <p className="text-sm text-muted-foreground">
              Send alerts on officers' birthdays (requires birthday in profile)
            </p>
          </div>
          <Switch
            id="enable_birthday_alerts"
            checked={settings?.enable_birthday_alerts || false}
            onCheckedChange={(checked) => handleToggle("enable_birthday_alerts", checked)}
            disabled={isPending || !settings?.enable_anniversary_alerts}
          />
        </div>

        {/* Alert Recipients */}
        {(settings?.enable_anniversary_alerts || settings?.enable_birthday_alerts) && (
          <div className="space-y-3 pt-4 border-t">
            <Label className="font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Alert Recipients
            </Label>
            <p className="text-sm text-muted-foreground">
              Select who receives anniversary and birthday alerts
            </p>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="recipient_admin"
                  checked={isRecipientSelected("admin")}
                  onCheckedChange={(checked) => handleRecipientChange("admin", checked as boolean)}
                  disabled={isPending}
                />
                <Label htmlFor="recipient_admin" className="text-sm">
                  Administrators
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="recipient_supervisor"
                  checked={isRecipientSelected("supervisor")}
                  onCheckedChange={(checked) => handleRecipientChange("supervisor", checked as boolean)}
                  disabled={isPending}
                />
                <Label htmlFor="recipient_supervisor" className="text-sm">
                  Supervisors
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="recipient_officer"
                  checked={isRecipientSelected("officer")}
                  onCheckedChange={(checked) => handleRecipientChange("officer", checked as boolean)}
                  disabled={isPending}
                />
                <Label htmlFor="recipient_officer" className="text-sm">
                  Officer Themselves
                </Label>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="pt-4 border-t">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">Officers with birthdays</p>
              <p className="font-medium">Coming soon</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Next anniversary</p>
              <p className="font-medium">Tomorrow</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
