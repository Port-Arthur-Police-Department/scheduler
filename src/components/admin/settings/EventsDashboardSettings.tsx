// File: scheduler/src/components/admin/settings/EventsDashboardSettings.tsx
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Cake, Award, Eye, Bell } from "lucide-react";

interface EventsDashboardSettingsProps {
  settings: any;
  handleToggle: (key: string, value: any) => void;
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

        {/* Special Occasions in Schedule Toggle */}
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
            {/* Role Visibility */}
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
                    id="events_dashboard_visible_to_admins"
                    checked={settings?.events_dashboard_visible_to_admins !== false}
                    onCheckedChange={(checked) => handleCheckboxChange("events_dashboard_visible_to_admins", checked as boolean)}
                    disabled={isPending}
                  />
                  <Label htmlFor="events_dashboard_visible_to_admins" className="text-sm">
                    Administrators
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="events_dashboard_visible_to_supervisors"
                    checked={settings?.events_dashboard_visible_to_supervisors !== false}
                    onCheckedChange={(checked) => handleCheckboxChange("events_dashboard_visible_to_supervisors", checked as boolean)}
                    disabled={isPending}
                  />
                  <Label htmlFor="events_dashboard_visible_to_supervisors" className="text-sm">
                    Supervisors
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="events_dashboard_visible_to_officers"
                    checked={settings?.events_dashboard_visible_to_officers !== false}
                    onCheckedChange={(checked) => handleCheckboxChange("events_dashboard_visible_to_officers", checked as boolean)}
                    disabled={isPending}
                  />
                  <Label htmlFor="events_dashboard_visible_to_officers" className="text-sm">
                    Officers
                  </Label>
                </div>
              </div>
            </div>

            {/* Event Type Filters */}
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

            {/* Month Scope */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Time Period Display
              </Label>
              <p className="text-sm text-muted-foreground">
                Choose what time period to show events for
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
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
