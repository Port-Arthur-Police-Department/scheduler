// File: scheduler/src/components/admin/settings/EventsDashboardSettings.tsx
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Cake, Award, Eye, Bell, Timer, UserCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface EventsDashboardSettingsProps {
  settings: any;
  handleToggle: (key: string, value: any) => void; // Updated to accept any value
  isPending: boolean;
}

export const EventsDashboardSettings: React.FC<EventsDashboardSettingsProps> = ({
  settings,
  handleToggle,
  isPending
}) => {
  // Handle radio button changes
  const handleRadioChange = (key: string, value: string) => {
    handleToggle(key, value);
  };

  // Handle checkbox changes - ensure boolean values
  const handleCheckboxChange = (key: string, checked: boolean) => {
    handleToggle(key, checked);
  };

  // Handle switch changes
  const handleSwitchChange = (key: string, checked: boolean) => {
    handleToggle(key, checked);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Events Dashboard Module
        </CardTitle>
        <CardDescription>
          Control the visibility and settings of the upcoming events dashboard module
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enable_events_dashboard" className="font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Enable Events Dashboard
            </Label>
            <p className="text-sm text-muted-foreground">
              Show the upcoming events module on the main dashboard
            </p>
          </div>
          <Switch
            id="enable_events_dashboard"
            checked={settings?.enable_events_dashboard || false}
            onCheckedChange={(checked) => handleSwitchChange("enable_events_dashboard", checked)}
            disabled={isPending}
          />
        </div>

        {/* NEW: Anniversary Countdown Module Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="enable_anniversary_countdown" className="font-medium flex items-center gap-2">
                <Timer className="h-4 w-4" />
                Enable Anniversary Countdown
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground cursor-help">(ℹ️)</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
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

        {/* NEW: Special Occasions in Schedule Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="show_special_occasions_in_schedule" className="font-medium flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Show Birthday/Anniversary Badges
            </Label>
            <p className="text-sm text-muted-foreground">
              Display 🎂 and 🎖️ badges on officer schedule cards for birthdays and anniversaries
            </p>
          </div>
          <Switch
            id="show_special_occasions_in_schedule"
            checked={settings?.show_special_occasions_in_schedule !== false}
            onCheckedChange={(checked) => handleSwitchChange("show_special_occasions_in_schedule", checked)}
            disabled={isPending}
          />
        </div>

        {/* Only show additional settings if Events Dashboard is enabled */}
        {(settings?.enable_events_dashboard || false) && (
          <>
            {/* Role Visibility for Events Dashboard */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="font-medium flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Events Dashboard Visible To Roles
              </Label>
              <p className="text-sm text-muted-foreground">
                Select which user roles can see the events dashboard
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="visible_admins"
                    checked={settings?.events_dashboard_visible_to_admins !== false}
                    onCheckedChange={(checked) => handleCheckboxChange("events_dashboard_visible_to_admins", checked as boolean)}
                    disabled={isPending}
                  />
                  <Label htmlFor="visible_admins" className="text-sm">
                    Administrators
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="visible_supervisors"
                    checked={settings?.events_dashboard_visible_to_supervisors !== false}
                    onCheckedChange={(checked) => handleCheckboxChange("events_dashboard_visible_to_supervisors", checked as boolean)}
                    disabled={isPending}
                  />
                  <Label htmlFor="visible_supervisors" className="text-sm">
                    Supervisors
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="visible_officers"
                    checked={settings?.events_dashboard_visible_to_officers !== false}
                    onCheckedChange={(checked) => handleCheckboxChange("events_dashboard_visible_to_officers", checked as boolean)}
                    disabled={isPending}
                  />
                  <Label htmlFor="visible_officers" className="text-sm">
                    Officers
                  </Label>
                </div>
              </div>
            </div>

            {/* Event Type Filters for Events Dashboard */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Show Event Types in Dashboard
              </Label>
              <p className="text-sm text-muted-foreground">
                Select which types of events to display in the events dashboard
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Cake className="h-4 w-4" />
                    <Label htmlFor="events_dashboard_show_birthdays" className="text-sm">
                      Birthdays
                    </Label>
                  </div>
                  <Switch
                    id="events_dashboard_show_birthdays"
                    checked={settings?.events_dashboard_show_birthdays !== false}
                    onCheckedChange={(checked) => handleSwitchChange("events_dashboard_show_birthdays", checked)}
                    disabled={isPending}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Award className="h-4 w-4" />
                    <Label htmlFor="events_dashboard_show_anniversaries" className="text-sm">
                      Hire Date Anniversaries
                    </Label>
                  </div>
                  <Switch
                    id="events_dashboard_show_anniversaries"
                    checked={settings?.events_dashboard_show_anniversaries !== false}
                    onCheckedChange={(checked) => handleSwitchChange("events_dashboard_show_anniversaries", checked)}
                    disabled={isPending}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Anniversary Countdown Specific Settings (only shown when enabled) */}
        {(settings?.enable_anniversary_countdown || false) && (
          <>
            {/* Role Visibility for Countdown */}
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

            {/* Countdown Display Options */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="font-medium flex items-center gap-2">
                <Timer className="h-4 w-4" />
                Countdown Display Options
              </Label>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="anniversary_show_progress_bar" className="text-sm font-medium">
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
                    <Label htmlFor="anniversary_show_milestone_badges" className="text-sm font-medium">
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
              </div>
            </div>

            {/* Notification Settings */}
            {(settings?.anniversary_enable_notifications || false) && (
              <div className="space-y-3 pt-4 border-t">
                <Label className="font-medium flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Notification Settings
                </Label>
                
                <div className="space-y-2">
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
                        className="border rounded px-2 py-1 text-sm"
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
              </div>
            )}
          </>
        )}

        {/* Month Scope for Events Dashboard */}
        <div className="space-y-3 pt-4 border-t">
          <Label className="font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Time Period Display (Events Dashboard)
          </Label>
          <p className="text-sm text-muted-foreground">
            Choose what time period to show events for in the events dashboard
          </p>
          
          <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="scope_current"
                name="events_dashboard_month_scope"
                value="current"
                checked={settings?.events_dashboard_month_scope === 'current'}
                onChange={() => handleRadioChange("events_dashboard_month_scope", "current")}
                disabled={isPending}
                className="h-4 w-4"
              />
              <Label htmlFor="scope_current" className="text-sm">
                Current Month Only
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="scope_upcoming"
                name="events_dashboard_month_scope"
                value="upcoming"
                checked={settings?.events_dashboard_month_scope === 'upcoming'}
                onChange={() => handleRadioChange("events_dashboard_month_scope", "upcoming")}
                disabled={isPending}
                className="h-4 w-4"
              />
              <Label htmlFor="scope_upcoming" className="text-sm">
                Upcoming 30 Days
              </Label>
            </div>
          </div>
        </div>

        {/* Test Data Info */}
        <div className="pt-4 border-t">
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">Data Requirements:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Birthdays require <code className="text-xs bg-muted px-1 py-0.5 rounded">birthday</code> field in profiles</li>
              <li>Anniversaries require <code className="text-xs bg-muted px-1 py-0.5 rounded">hire_date</code> field in profiles</li>
              <li>Only active officers are shown</li>
            </ul>
            
            {(settings?.enable_anniversary_countdown || false) && (
              <div className="mt-2 pt-2 border-t">
                <p className="text-muted-foreground">Anniversary Countdown Notes:</p>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  <li>Officers can toggle visibility in their profile dropdown</li>
                  <li>Countdown automatically calculates based on hire_date</li>
                  <li>Shows years of service and days until next anniversary</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
