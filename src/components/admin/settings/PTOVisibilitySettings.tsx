// src/components/admin/settings/PTOVisibilitySettings.tsx
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Calendar as CalendarIcon, Trash2, Plus } from "lucide-react";

interface PTOVisibilitySettingsProps {
  ptoVisibility: any;
  handlePtoVisibilityToggle: (key: string, value: boolean) => void;
  cityHolidays?: any[];
  onAddCityHoliday?: (holiday: { date: string; title: string }) => void;
  onDeleteCityHoliday?: (id: string) => void;
  isPending: boolean;
}

export const PTOVisibilitySettings = ({
  ptoVisibility,
  handlePtoVisibilityToggle,
  cityHolidays = [],
  onAddCityHoliday,
  onDeleteCityHoliday,
  isPending
}: PTOVisibilitySettingsProps) => {
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayTitle, setHolidayTitle] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDate || !holidayTitle) return;
    if (onAddCityHoliday) {
      onAddCityHoliday({ date: holidayDate, title: holidayTitle });
      setHolidayDate("");
      setHolidayTitle("");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            PTO Type Visibility
          </CardTitle>
          <CardDescription>
            Control which PTO types are displayed in the monthly calendar view
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="vacation-pto-toggle" className="text-base">
                Show Vacation PTO
              </Label>
              <div className="text-sm text-muted-foreground">
                Display vacation time off in the monthly calendar view
              </div>
            </div>
            <Switch
              id="vacation-pto-toggle"
              checked={ptoVisibility?.show_vacation_pto || false}
              onCheckedChange={(checked) => handlePtoVisibilityToggle('show_vacation_pto', checked)}
              disabled={isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="holiday-pto-toggle" className="text-base">
                Show Holiday PTO
              </Label>
              <div className="text-sm text-muted-foreground">
                Display holiday time off in the monthly calendar view
              </div>
            </div>
            <Switch
              id="holiday-pto-toggle"
              checked={ptoVisibility?.show_holiday_pto || false}
              onCheckedChange={(checked) => handlePtoVisibilityToggle('show_holiday_pto', checked)}
              disabled={isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sick-pto-toggle" className="text-base">
                Show Sick PTO
              </Label>
              <div className="text-sm text-muted-foreground">
                Display sick time off in the monthly calendar view
              </div>
            </div>
            <Switch
              id="sick-pto-toggle"
              checked={ptoVisibility?.show_sick_pto || false}
              onCheckedChange={(checked) => handlePtoVisibilityToggle('show_sick_pto', checked)}
              disabled={isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="comp-pto-toggle" className="text-base">
                Show Comp Time PTO
              </Label>
              <div className="text-sm text-muted-foreground">
                Display comp time off in the monthly calendar view
              </div>
            </div>
            <Switch
              id="comp-pto-toggle"
              checked={ptoVisibility?.show_comp_pto || false}
              onCheckedChange={(checked) => handlePtoVisibilityToggle('show_comp_pto', checked)}
              disabled={isPending}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            City Holidays & Special Events
          </CardTitle>
          <CardDescription>
            Mark city holidays or special events to display prominently on the Monthly Calendar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="space-y-1 flex-1">
              <Label htmlFor="holiday-date">Date</Label>
              <Input
                id="holiday-date"
                type="date"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1 flex-[2]">
              <Label htmlFor="holiday-title">Event Title</Label>
              <Input
                id="holiday-title"
                type="text"
                placeholder="e.g., Independence Day / City Parade"
                value={holidayTitle}
                onChange={(e) => setHolidayTitle(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isPending}>
              <Plus className="h-4 w-4 mr-2" />
              Add Event
            </Button>
          </form>

          {cityHolidays.length > 0 && (
            <div className="mt-4 space-y-2">
              <Label className="text-sm font-medium">Configured Holidays & Events</Label>
              <div className="divide-y border rounded-md">
                {cityHolidays.map((holiday: any) => (
                  <div key={holiday.id} className="flex items-center justify-between p-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{holiday.date}</span>
                      <span>🎉 {holiday.title}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => onDeleteCityHoliday && onDeleteCityHoliday(holiday.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
