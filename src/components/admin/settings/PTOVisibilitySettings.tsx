// src/components/admin/settings/PTOVisibilitySettings.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Eye } from "lucide-react";

interface PTOVisibilitySettingsProps {
  ptoVisibility: any;
  handlePtoVisibilityToggle: (key: string, value: boolean) => void;
  isPending: boolean;
}

export const PTOVisibilitySettings = ({ 
  ptoVisibility, 
  handlePtoVisibilityToggle, 
  isPending 
}: PTOVisibilitySettingsProps) => {
  return (
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
  );
};
