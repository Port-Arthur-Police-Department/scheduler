// src/components/admin/settings/ScheduleColorSettings.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Palette } from "lucide-react";
import { ColorPicker } from "./ColorPicker";

interface ScheduleColorSettingsProps {
  colorSettings: any;
  handleColorChange: (key: string, value: string) => void;
  isPending: boolean;
  settings: any;
  ptoVisibility: any;
  updateSettingsMutation: any;
  setColorSettings: (colors: any) => void;
}

export const ScheduleColorSettings = ({ 
  colorSettings, 
  handleColorChange, 
  isPending,
  settings,
  ptoVisibility,
  updateSettingsMutation,
  setColorSettings
}: ScheduleColorSettingsProps) => {
  const resetScheduleColors = () => {
    const defaultScheduleColors = {
      schedule_supervisor_bg: "240,248,255",
      schedule_supervisor_text: "25,25,112",
      schedule_officer_bg: "248,249,250",
      schedule_officer_text: "33,37,41",
      schedule_special_bg: "243,229,245",
      schedule_special_text: "102,51,153",
      schedule_pto_bg: "230,255,242",
      schedule_pto_text: "0,100,0",
    };
    
    const newColors = { ...colorSettings, ...defaultScheduleColors };
    setColorSettings(newColors);
    
    updateSettingsMutation.mutate({
      id: settings?.id,
      color_settings: newColors,
      pto_type_visibility: ptoVisibility,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Riding List - Schedule Section Colors
        </CardTitle>
        <CardDescription>
          Customize the background colors for different sections in daily schedule view
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Supervisor Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded" 
                style={{ backgroundColor: `rgb(${colorSettings.schedule_supervisor_bg})` }} 
              />
              <Label className="font-medium">Supervisor Section</Label>
            </div>
            <ColorPicker
              label="Background Color"
              value={colorSettings.schedule_supervisor_bg}
              onChange={(val) => handleColorChange('schedule_supervisor_bg', val)}
            />
            <ColorPicker
              label="Text Color"
              value={colorSettings.schedule_supervisor_text}
              onChange={(val) => handleColorChange('schedule_supervisor_text', val)}
            />
          </div>

          {/* Officer Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded" 
                style={{ backgroundColor: `rgb(${colorSettings.schedule_officer_bg})` }} 
              />
              <Label className="font-medium">Officer Section</Label>
            </div>
            <ColorPicker
              label="Background Color"
              value={colorSettings.schedule_officer_bg}
              onChange={(val) => handleColorChange('schedule_officer_bg', val)}
            />
            <ColorPicker
              label="Text Color"
              value={colorSettings.schedule_officer_text}
              onChange={(val) => handleColorChange('schedule_officer_text', val)}
            />
          </div>

          {/* Special Assignment Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded" 
                style={{ backgroundColor: `rgb(${colorSettings.schedule_special_bg})` }} 
              />
              <Label className="font-medium">Special Assignment Section</Label>
            </div>
            <ColorPicker
              label="Background Color"
              value={colorSettings.schedule_special_bg}
              onChange={(val) => handleColorChange('schedule_special_bg', val)}
            />
            <ColorPicker
              label="Text Color"
              value={colorSettings.schedule_special_text}
              onChange={(val) => handleColorChange('schedule_special_text', val)}
            />
          </div>

          {/* PTO Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded" 
                style={{ backgroundColor: `rgb(${colorSettings.schedule_pto_bg})` }} 
              />
              <Label className="font-medium">PTO Section</Label>
            </div>
            <ColorPicker
              label="Background Color"
              value={colorSettings.schedule_pto_bg}
              onChange={(val) => handleColorChange('schedule_pto_bg', val)}
            />
            <ColorPicker
              label="Text Color"
              value={colorSettings.schedule_pto_text}
              onChange={(val) => handleColorChange('schedule_pto_text', val)}
            />
          </div>

        </div>

        {/* Reset Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={resetScheduleColors}
            disabled={isPending}
          >
            Reset Schedule Colors to Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
