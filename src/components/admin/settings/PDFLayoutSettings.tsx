// src/components/admin/settings/PDFLayoutSettings.tsx
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColorPicker } from "@/components/ui/color-picker";
import { Eye, RotateCcw } from "lucide-react";

interface LayoutSettings {
  fontSizes: {
    header: number;
    sectionTitle: number;
    tableHeader: number;
    tableContent: number;
    footer: number;
  };
  sections: {
    showSupervisors: boolean;
    showOfficers: boolean;
    showSpecialAssignments: boolean;
    showPTO: boolean;
    showStaffingSummary: boolean;
  };
  tableSettings: {
    rowHeight: number;
    cellPadding: number;
    showRowStriping: boolean;
    compactMode: boolean;
  };
  colorSettings: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    headerBgColor: string;
    headerTextColor: string;
    evenRowColor: string;
    oddRowColor: string;
  };
}

const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  fontSizes: {
    header: 10,
    sectionTitle: 9,
    tableHeader: 7,
    tableContent: 7,
    footer: 7
  },
  sections: {
    showSupervisors: true,
    showOfficers: true,
    showSpecialAssignments: true,
    showPTO: true,
    showStaffingSummary: true
  },
  tableSettings: {
    rowHeight: 8,
    cellPadding: 3,
    showRowStriping: true,
    compactMode: false
  },
  colorSettings: {
    primaryColor: "#2980b9",
    secondaryColor: "#3498db",
    accentColor: "#9b59b6",
    headerBgColor: "#2980b9",
    headerTextColor: "#ffffff",
    evenRowColor: "#ffffff",
    oddRowColor: "#f8f9fa"
  }
};

interface PDFLayoutSettingsProps {
  settings: any;
  onSave: (settings: LayoutSettings) => void;
  onPreview: () => void;
  isPending: boolean;
}

export const PDFLayoutSettings = ({ settings, onSave, onPreview, isPending }: PDFLayoutSettingsProps) => {
  const [layoutSettings, setLayoutSettings] = useState<LayoutSettings>(
    settings?.pdf_layout_settings || DEFAULT_LAYOUT_SETTINGS
  );

  const handleFontSizeChange = (section: keyof LayoutSettings['fontSizes'], value: number) => {
    setLayoutSettings(prev => ({
      ...prev,
      fontSizes: {
        ...prev.fontSizes,
        [section]: value
      }
    }));
  };

  const handleSectionToggle = (section: keyof LayoutSettings['sections'], value: boolean) => {
    setLayoutSettings(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [section]: value
      }
    }));
  };

  const handleTableSettingChange = (setting: keyof LayoutSettings['tableSettings'], value: any) => {
    setLayoutSettings(prev => ({
      ...prev,
      tableSettings: {
        ...prev.tableSettings,
        [setting]: value
      }
    }));
  };

const handleColorChange = (key: string, value: string) => {
  setLayoutSettings(prev => ({
    ...prev,
    colorSettings: {
      ...prev.colorSettings,
      [key]: value
    }
  }));
};

  const handleReset = () => {
    setLayoutSettings(DEFAULT_LAYOUT_SETTINGS);
    onSave(DEFAULT_LAYOUT_SETTINGS);
  };

  const handleSave = () => {
    onSave(layoutSettings);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Riding List Layout Settings</CardTitle>
            <CardDescription>
              Customize the appearance of your PDF riding lists
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPreview}
              disabled={isPending}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sections">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="sections">Sections</TabsTrigger>
            <TabsTrigger value="fonts">Font Sizes</TabsTrigger>
            <TabsTrigger value="table">Table Settings</TabsTrigger>
            <TabsTrigger value="colors">Colors</TabsTrigger>
          </TabsList>

          <TabsContent value="sections" className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="showSupervisors">Show Supervisors Section</Label>
                <Switch
                  id="showSupervisors"
                  checked={layoutSettings.sections.showSupervisors}
                  onCheckedChange={(checked) => handleSectionToggle('showSupervisors', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="showOfficers">Show Officers Section</Label>
                <Switch
                  id="showOfficers"
                  checked={layoutSettings.sections.showOfficers}
                  onCheckedChange={(checked) => handleSectionToggle('showOfficers', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="showSpecialAssignments">Show Special Assignments</Label>
                <Switch
                  id="showSpecialAssignments"
                  checked={layoutSettings.sections.showSpecialAssignments}
                  onCheckedChange={(checked) => handleSectionToggle('showSpecialAssignments', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="showPTO">Show PTO Section</Label>
                <Switch
                  id="showPTO"
                  checked={layoutSettings.sections.showPTO}
                  onCheckedChange={(checked) => handleSectionToggle('showPTO', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="showStaffingSummary">Show Staffing Summary</Label>
                <Switch
                  id="showStaffingSummary"
                  checked={layoutSettings.sections.showStaffingSummary}
                  onCheckedChange={(checked) => handleSectionToggle('showStaffingSummary', checked)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="fonts" className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label>Header Font Size: {layoutSettings.fontSizes.header}pt</Label>
                <Slider
                  value={[layoutSettings.fontSizes.header]}
                  min={8}
                  max={14}
                  step={0.5}
                  onValueChange={([value]) => handleFontSizeChange('header', value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Section Title Size: {layoutSettings.fontSizes.sectionTitle}pt</Label>
                <Slider
                  value={[layoutSettings.fontSizes.sectionTitle]}
                  min={8}
                  max={12}
                  step={0.5}
                  onValueChange={([value]) => handleFontSizeChange('sectionTitle', value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Table Content Size: {layoutSettings.fontSizes.tableContent}pt</Label>
                <Slider
                  value={[layoutSettings.fontSizes.tableContent]}
                  min={6}
                  max={10}
                  step={0.5}
                  onValueChange={([value]) => handleFontSizeChange('tableContent', value)}
                  className="mt-2"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="table" className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label>Row Height: {layoutSettings.tableSettings.rowHeight}px</Label>
                <Slider
                  value={[layoutSettings.tableSettings.rowHeight]}
                  min={6}
                  max={12}
                  step={0.5}
                  onValueChange={([value]) => handleTableSettingChange('rowHeight', value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Cell Padding: {layoutSettings.tableSettings.cellPadding}px</Label>
                <Slider
                  value={[layoutSettings.tableSettings.cellPadding]}
                  min={1}
                  max={6}
                  step={0.5}
                  onValueChange={([value]) => handleTableSettingChange('cellPadding', value)}
                  className="mt-2"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="showRowStriping">Row Striping</Label>
                <Switch
                  id="showRowStriping"
                  checked={layoutSettings.tableSettings.showRowStriping}
                  onCheckedChange={(checked) => handleTableSettingChange('showRowStriping', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="compactMode">Compact Mode</Label>
                <Switch
                  id="compactMode"
                  checked={layoutSettings.tableSettings.compactMode}
                  onCheckedChange={(checked) => handleTableSettingChange('compactMode', checked)}
                />
              </div>
            </div>
          </TabsContent>

<TabsContent value="colors" className="space-y-4">
  <div className="grid grid-cols-2 gap-4">
    {/* Header Colors */}
    <div className="space-y-2">
      <Label>Header Background</Label>
      <ColorPicker
        value={layoutSettings.colorSettings.headerBgColor}
        onChange={(value) => handleColorChange('headerBgColor', value)}
      />
    </div>
    <div className="space-y-2">
      <Label>Header Text</Label>
      <ColorPicker
        value={layoutSettings.colorSettings.headerTextColor}
        onChange={(value) => handleColorChange('headerTextColor', value)}
      />
    </div>
    
    {/* Section Titles */}
    <div className="space-y-2">
      <Label>Section Titles (SUPERVISORS/OFFICERS)</Label>
      <ColorPicker
        value={layoutSettings.colorSettings.sectionTitleColor}
        onChange={(value) => handleColorChange('sectionTitleColor', value)}
      />
    </div>
    
    {/* Officer Text Colors */}
    <div className="space-y-2">
      <Label>Officer Names Text</Label>
      <ColorPicker
        value={layoutSettings.colorSettings.officerTextColor}
        onChange={(value) => handleColorChange('officerTextColor', value)}
      />
    </div>
    <div className="space-y-2">
      <Label>Supervisor Names Text</Label>
      <ColorPicker
        value={layoutSettings.colorSettings.supervisorTextColor}
        onChange={(value) => handleColorChange('supervisorTextColor', value)}
      />
    </div>
    <div className="space-y-2">
      <Label>Special Assignment Text</Label>
      <ColorPicker
        value={layoutSettings.colorSettings.specialAssignmentTextColor}
        onChange={(value) => handleColorChange('specialAssignmentTextColor', value)}
      />
    </div>
    <div className="space-y-2">
      <Label>PTO Text</Label>
      <ColorPicker
        value={layoutSettings.colorSettings.ptoTextColor}
        onChange={(value) => handleColorChange('ptoTextColor', value)}
      />
    </div>
    
    {/* Row Colors */}
    <div className="space-y-2">
      <Label>Even Rows</Label>
      <ColorPicker
        value={layoutSettings.colorSettings.evenRowColor}
        onChange={(value) => handleColorChange('evenRowColor', value)}
      />
    </div>
    <div className="space-y-2">
      <Label>Odd Rows</Label>
      <ColorPicker
        value={layoutSettings.colorSettings.oddRowColor}
        onChange={(value) => handleColorChange('oddRowColor', value)}
      />
    </div>
    
    {/* Accent Colors */}
    <div className="space-y-2">
      <Label>Primary Color (Headers/Accents)</Label>
      <ColorPicker
        value={layoutSettings.colorSettings.primaryColor}
        onChange={(value) => handleColorChange('primaryColor', value)}
      />
    </div>
    <div className="space-y-2">
      <Label>Accent Color</Label>
      <ColorPicker
        value={layoutSettings.colorSettings.accentColor}
        onChange={(value) => handleColorChange('accentColor', value)}
      />
    </div>
  </div>
</TabsContent>
        </Tabs>

        <Separator className="my-6" />

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save Layout Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
