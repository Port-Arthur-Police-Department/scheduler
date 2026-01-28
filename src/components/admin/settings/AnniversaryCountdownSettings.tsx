import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Timer, UserCheck, Bell, Progress, Award, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AnniversaryCountdownSettingsProps {
  settings: any;
  handleToggle: (key: string, value: any) => void;
  isPending: boolean;
}

export const AnniversaryCountdownSettings: React.FC<AnniversaryCountdownSettingsProps> = ({
  settings,
  handleToggle,
  isPending
}) => {
  // Handle switch changes
  const handleSwitchChange = (key: string, checked: boolean) => {
    handleToggle(key, checked);
  };

  // Handle checkbox changes
  const handleCheckboxChange = (key: string, checked: boolean) => {
    handleToggle(key, checked);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5" />
          Anniversary Countdown Module
        </CardTitle>
        <CardDescription>
          Control settings for the personal service anniversary countdown
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="enable_anniversary_countdown" className="font-medium flex items-center gap-2">
                <Timer className="h-4 w-4" />
                Enable Anniversary Countdown
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>
                        Shows a personal countdown to each officer's next service anniversary. 
                        Officers can toggle visibility in their profile menu.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Show personal service anniversary countdown on dashboard
            </p>
          </div>
          <Switch
            id="enable_anniversary_countdown"
            checked={settings?.enable_anniversary_countdown !== false}
            onCheckedChange={(checked) => handleSwitchChange("enable_anniversary_countdown", checked)}
            disabled={isPending}
          />
        </div>

        {/* Only show additional settings if enabled */}
        {(settings?.enable_anniversary_countdown || false) && (
          <>
            {/* Role Visibility */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="font-medium flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Anniversary Countdown Visible To
              </Label>
              <p className="text-sm text-muted-foreground">
                Select which user roles see the anniversary countdown by default
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="anniversary_countdown_admins"
                    checked={settings?.anniversary_countdown_admins !== false}
                    onCheckedChange={(checked) => handleCheckboxChange("anniversary_countdown_admins", checked as boolean)}
                    disabled={isPending}
                  />
                  <Label htmlFor="anniversary_countdown_admins" className="text-sm">
                    Administrators
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="anniversary_countdown_supervisors"
                    checked={settings?.anniversary_countdown_supervisors !== false}
                    onCheckedChange={(checked) => handleCheckboxChange("anniversary_countdown_supervisors", checked as boolean)}
                    disabled={isPending}
                  />
                  <Label htmlFor="anniversary_countdown_supervisors" className="text-sm">
                    Supervisors
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="anniversary_countdown_officers"
                    checked={settings?.anniversary_countdown_officers !== false}
                    onCheckedChange={(checked) => handleCheckboxChange("anniversary_countdown_officers", checked as boolean)}
                    disabled={isPending}
                  />
                  <Label htmlFor="anniversary_countdown_officers" className="text-sm">
                    Officers
                  </Label>
                </div>
              </div>
            </div>

            {/* Display Options */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="font-medium flex items-center gap-2">
                <Progress className="h-4 w-4" />
                Display Options
              </Label>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="anniversary_show_progress_bar" className="text-sm font-medium flex items-center gap-2">
                      <Progress className="h-3 w-3" />
                      Show Year Progress Bar
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Display a progress bar showing completion of current service year
                    </p>
                  </div>
                  <Switch
                    id="anniversary_show_progress_bar"
                    checked={settings?.anniversary_show_progress_bar !== false}
                    onCheckedChange={(checked) => handleSwitchChange("anniversary_show_progress_bar", checked)}
                    disabled={isPending}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="anniversary_show_milestone_badges" className="text-sm font-medium flex items-center gap-2">
                      <Award className="h-3 w-3" />
                      Show Milestone Badges
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Display badges for service milestones (5, 10, 20, 25 years)
                    </p>
                  </div>
                  <Switch
                    id="anniversary_show_milestone_badges"
                    checked={settings?.anniversary_show_milestone_badges !== false}
                    onCheckedChange={(checked) => handleSwitchChange("anniversary_show_milestone_badges", checked)}
                    disabled={isPending}
                  />
                </div>
              </div>
            </div>

            {/* Notification Settings */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="font-medium flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notification Settings
              </Label>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="anniversary_enable_notifications" className="text-sm font-medium">
                      Enable Anniversary Notifications
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Send notifications when officers approach their anniversary
                    </p>
                  </div>
                  <Switch
                    id="anniversary_enable_notifications"
                    checked={settings?.anniversary_enable_notifications !== false}
                    onCheckedChange={(checked) => handleSwitchChange("anniversary_enable_notifications", checked)}
                    disabled={isPending}
                  />
                </div>

                {(settings?.anniversary_enable_notifications || false) && (
                  <>
                    <div className="space-y-2 pl-6 border-l-2">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="anniversary_notify_days_before" className="text-sm font-medium">
                            Notify Days Before
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            How many days before anniversary to send notification
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <select
                            id="anniversary_notify_days_before"
                            value={settings?.anniversary_notify_days_before || 7}
                            onChange={(e) => handleToggle("anniversary_notify_days_before", parseInt(e.target.value))}
                            disabled={isPending}
                            className="border rounded px-2 py-1 text-sm w-24"
                          >
                            <option value={1}>1 day</option>
                            <option value={3}>3 days</option>
                            <option value={7}>7 days</option>
                            <option value={14}>14 days</option>
                            <option value={30}>30 days</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="anniversary_notify_on_day" className="text-sm font-medium">
                            Notify on Anniversary Day
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Send notification on the actual anniversary date
                          </p>
                        </div>
                        <Switch
                          id="anniversary_notify_on_day"
                          checked={settings?.anniversary_notify_on_day !== false}
                          onCheckedChange={(checked) => handleSwitchChange("anniversary_notify_on_day", checked)}
                          disabled={isPending}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Data Requirements Info */}
            <div className="pt-4 border-t">
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Requirements & Notes:</p>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  <li>Requires <code className="text-xs bg-muted px-1 py-0.5 rounded">hire_date</code> field in officer profiles</li>
                  <li>Officers can toggle visibility in their profile dropdown</li>
                  <li>Countdown automatically calculates based on hire_date</li>
                  <li>Shows years of service and days until next anniversary</li>
                  <li>Special celebration display on anniversary day</li>
                </ul>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
