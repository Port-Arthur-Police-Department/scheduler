// src/components/admin/settings/ColorCustomizationSettings.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Palette } from "lucide-react";
import { ColorPicker } from "./ColorPicker";

interface ColorCustomizationSettingsProps {
  colorSettings: any;
  handleColorChange: (key: string, value: string) => void;
  resetToDefaults: () => void;
  isPending: boolean;
}

export const ColorCustomizationSettings = ({ 
  colorSettings, 
  handleColorChange, 
  resetToDefaults, 
  isPending 
}: ColorCustomizationSettingsProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Color Customization
        </CardTitle>
        <CardDescription>
          Customize the colors used in PDF exports and weekly schedule display
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* PDF Export Colors */}
        <div className="space-y-4">
          <h4 className="font-semibold">PDF Export Colors</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ColorPicker
              label="Supervisor PTO Background"
              value={colorSettings.pdf_supervisor_pto_bg}
              onChange={(val) => handleColorChange('pdf_supervisor_pto_bg', val)}
            />
            <ColorPicker
              label="Officer PTO Background"
              value={colorSettings.pdf_officer_pto_bg}
              onChange={(val) => handleColorChange('pdf_officer_pto_bg', val)}
            />
            <ColorPicker
              label="Sick Time Background"
              value={colorSettings.pdf_sick_bg}
              onChange={(val) => handleColorChange('pdf_sick_bg', val)}
            />
            <ColorPicker
              label="Off Days Background"
              value={colorSettings.pdf_off_day_bg}
              onChange={(val) => handleColorChange('pdf_off_day_bg', val)}
            />
          </div>
        </div>

        {/* Weekly Schedule Colors */}
        <div className="space-y-4">
          <h4 className="font-semibold">Weekly Schedule Colors</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ColorPicker
              label="Supervisor Rows Background"
              value={colorSettings.weekly_supervisor_bg}
              onChange={(val) => handleColorChange('weekly_supervisor_bg', val)}
            />
            <ColorPicker
              label="Officer Rows Background"
              value={colorSettings.weekly_officer_bg}
              onChange={(val) => handleColorChange('weekly_officer_bg', val)}
            />
            <ColorPicker
              label="PPO Rows Background"
              value={colorSettings.weekly_ppo_bg}
              onChange={(val) => handleColorChange('weekly_ppo_bg', val)}
            />
            <ColorPicker
              label="PTO Background"
              value={colorSettings.weekly_pto_bg}
              onChange={(val) => handleColorChange('weekly_pto_bg', val)}
            />
          </div>
        </div>

        {/* PTO Type Colors */}
        <div className="space-y-4">
          <h4 className="font-semibold">PTO Type Colors</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ColorPicker
              label="Vacation Background"
              value={colorSettings.pdf_vacation_bg}
              onChange={(val) => handleColorChange('pdf_vacation_bg', val)}
            />
            <ColorPicker
              label="Sick Time Background"
              value={colorSettings.pdf_sick_bg}
              onChange={(val) => handleColorChange('pdf_sick_bg', val)}
            />
            <ColorPicker
              label="Holiday Background"
              value={colorSettings.pdf_holiday_bg}
              onChange={(val) => handleColorChange('pdf_holiday_bg', val)}
            />
            <ColorPicker
              label="Comp Time Background"
              value={colorSettings.pdf_comp_bg}
              onChange={(val) => handleColorChange('pdf_comp_bg', val)}
            />
          </div>
        </div>

        {/* Reset Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={resetToDefaults} 
            disabled={isPending}
          >
            Reset to Default Colors
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
