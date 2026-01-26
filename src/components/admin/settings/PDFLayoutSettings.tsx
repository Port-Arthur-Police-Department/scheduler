// src/components/admin/settings/PDFLayoutSettings.tsx - FIXED VERSION
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Eye, Loader2 } from "lucide-react";
import { DEFAULT_LAYOUT_SETTINGS } from "@/constants/pdfLayoutSettings";
import { toast } from "sonner";

interface PDFLayoutSettingsProps {
  settings: any;
  onSave: (layoutSettings: any) => void;
  onPreview: () => void;
  isPending: boolean;
  isPreviewLoading?: boolean;
}

// Default column order settings
const DEFAULT_COLUMN_ORDER = {
  supervisors: "name-badge-position-unit",
  officers: "name-badge-beat-unit"
};

export const PDFLayoutSettings = ({ 
  settings, 
  onSave, 
  onPreview, 
  isPending,
  isPreviewLoading = false 
}: PDFLayoutSettingsProps) => {
  const [layoutSettings, setLayoutSettings] = useState(() => {
    const defaultSettings = {
      ...DEFAULT_LAYOUT_SETTINGS,
      columnOrder: DEFAULT_COLUMN_ORDER,
      ...(settings?.pdf_layout_settings || {})
    };
    
    // Ensure columnOrder exists
    if (!defaultSettings.columnOrder) {
      defaultSettings.columnOrder = DEFAULT_COLUMN_ORDER;
    }
    
    return defaultSettings;
  });

  const handleSectionToggle = (section: string, value: boolean) => {
    setLayoutSettings(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [section]: value
      }
    }));
  };

  const handleTableSettingChange = (setting: string, value: number | boolean | string) => {
    setLayoutSettings(prev => ({
      ...prev,
      tableSettings: {
        ...prev.tableSettings,
        [setting]: value
      }
    }));
  };

  const handleFontSizeChange = (section: string, value: number[]) => {
    setLayoutSettings(prev => ({
      ...prev,
      fontSizes: {
        ...prev.fontSizes,
        [section]: value[0]
      }
    }));
  };

  const handleColorChange = (setting: string, value: string) => {
    setLayoutSettings(prev => ({
      ...prev,
      colorSettings: {
        ...prev.colorSettings,
        [setting]: value
      }
    }));
  };

  const handleColumnOrderChange = (section: string, value: string) => {
    setLayoutSettings(prev => ({
      ...prev,
      columnOrder: {
        ...prev.columnOrder || DEFAULT_COLUMN_ORDER,
        [section]: value
      }
    }));
  };

  const handleSave = () => {
    onSave(layoutSettings);
    toast.success("PDF layout settings saved");
  };

  const handlePreview = () => {
    onPreview();
  };

  // Safely get column order value
  const getColumnOrderValue = (section: string): string => {
    return layoutSettings.columnOrder?.[section] || DEFAULT_COLUMN_ORDER[section as keyof typeof DEFAULT_COLUMN_ORDER] || "name-badge-position-unit";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>PDF Export Layout Settings</CardTitle>
            <CardDescription>
              Customize how your PDF riding lists are formatted and styled
            </CardDescription>
          </div>
          <Button 
            onClick={handlePreview} 
            disabled={isPreviewLoading || isPending}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {isPreviewLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Preview...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Preview Layout
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Section Visibility */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Section Visibility</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="showSupervisors"
                checked={layoutSettings.sections?.showSupervisors ?? true}
                onCheckedChange={(checked) => handleSectionToggle('showSupervisors', checked)}
              />
              <Label htmlFor="showSupervisors">Supervisors Section</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="showOfficers"
                checked={layoutSettings.sections?.showOfficers ?? true}
                onCheckedChange={(checked) => handleSectionToggle('showOfficers', checked)}
              />
              <Label htmlFor="showOfficers">Officers Section</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="showSpecialAssignments"
                checked={layoutSettings.sections?.showSpecialAssignments ?? true}
                onCheckedChange={(checked) => handleSectionToggle('showSpecialAssignments', checked)}
              />
              <Label htmlFor="showSpecialAssignments">Special Assignments</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="showPTO"
                checked={layoutSettings.sections?.showPTO ?? true}
                onCheckedChange={(checked) => handleSectionToggle('showPTO', checked)}
              />
              <Label htmlFor="showPTO">PTO Section</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="showStaffingSummary"
                checked={layoutSettings.sections?.showStaffingSummary ?? true}
                onCheckedChange={(checked) => handleSectionToggle('showStaffingSummary', checked)}
              />
              <Label htmlFor="showStaffingSummary">Staffing Summary</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="showLogoSection"
                checked={layoutSettings.sections?.showLogoSection ?? true}
                onCheckedChange={(checked) => handleSectionToggle('showLogoSection', checked)}
              />
              <Label htmlFor="showLogoSection">Logo Section</Label>
            </div>
          </div>
        </div>

        <Separator />

        {/* Table Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Table Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="rowHeight">Row Height (px)</Label>
                <Slider
                  id="rowHeight"
                  min={20}
                  max={60}
                  step={1}
                  value={[layoutSettings.tableSettings?.rowHeight ?? 30]}
                  onValueChange={(value) => handleTableSettingChange('rowHeight', value[0])}
                  className="mt-2"
                />
                <div className="text-sm text-gray-500 mt-1">
                  Current: {layoutSettings.tableSettings?.rowHeight ?? 30}px
                </div>
              </div>

              <div>
                <Label htmlFor="cellPadding">Cell Padding (px)</Label>
                <Slider
                  id="cellPadding"
                  min={2}
                  max={20}
                  step={1}
                  value={[layoutSettings.tableSettings?.cellPadding ?? 8]}
                  onValueChange={(value) => handleTableSettingChange('cellPadding', value[0])}
                  className="mt-2"
                />
                <div className="text-sm text-gray-500 mt-1">
                  Current: {layoutSettings.tableSettings?.cellPadding ?? 8}px
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="showRowStriping"
                  checked={layoutSettings.tableSettings?.showRowStriping ?? true}
                  onCheckedChange={(checked) => handleTableSettingChange('showRowStriping', checked)}
                />
                <Label htmlFor="showRowStriping">Enable Row Striping</Label>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="borderWidth">Border Width (px)</Label>
                <Slider
                  id="borderWidth"
                  min={0.5}
                  max={3}
                  step={0.1}
                  value={[layoutSettings.tableSettings?.borderWidth ?? 1]}
                  onValueChange={(value) => handleTableSettingChange('borderWidth', value[0])}
                  className="mt-2"
                />
                <div className="text-sm text-gray-500 mt-1">
                  Current: {layoutSettings.tableSettings?.borderWidth ?? 1}px
                </div>
              </div>

              <div>
                <Label htmlFor="columnSpacing">Column Spacing (px)</Label>
                <Slider
                  id="columnSpacing"
                  min={0}
                  max={20}
                  step={1}
                  value={[layoutSettings.tableSettings?.columnSpacing ?? 4]}
                  onValueChange={(value) => handleTableSettingChange('columnSpacing', value[0])}
                  className="mt-2"
                />
                <div className="text-sm text-gray-500 mt-1">
                  Current: {layoutSettings.tableSettings?.columnSpacing ?? 4}px
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="showVerticalLines"
                  checked={layoutSettings.tableSettings?.showVerticalLines ?? true}
                  onCheckedChange={(checked) => handleTableSettingChange('showVerticalLines', checked)}
                />
                <Label htmlFor="showVerticalLines">Show Vertical Lines</Label>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Column Order - Only show if the settings exist */}
        {layoutSettings.columnOrder && (
          <>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Column Order</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supervisorsOrder">Supervisors Column Order</Label>
                  <Select
                    value={getColumnOrderValue('supervisors')}
                    onValueChange={(value) => handleColumnOrderChange('supervisors', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name-badge-position-unit">Name → Badge → Position → Unit</SelectItem>
                      <SelectItem value="badge-name-position-unit">Badge → Name → Position → Unit</SelectItem>
                      <SelectItem value="position-name-badge-unit">Position → Name → Badge → Unit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="officersOrder">Officers Column Order</Label>
                  <Select
                    value={getColumnOrderValue('officers')}
                    onValueChange={(value) => handleColumnOrderChange('officers', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name-badge-beat-unit">Name → Badge → Beat → Unit</SelectItem>
                      <SelectItem value="badge-name-beat-unit">Badge → Name → Beat → Unit</SelectItem>
                      <SelectItem value="beat-name-badge-unit">Beat → Name → Badge → Unit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Font Sizes */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Font Sizes (pt)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="headerFont">Header</Label>
              <Slider
                id="headerFont"
                min={10}
                max={24}
                step={0.5}
                value={[layoutSettings.fontSizes?.header ?? 18]}
                onValueChange={(value) => handleFontSizeChange('header', value)}
                className="mt-2"
              />
              <div className="text-sm text-gray-500">Current: {layoutSettings.fontSizes?.header ?? 18}pt</div>
            </div>

            <div>
              <Label htmlFor="tableHeaderFont">Table Header</Label>
              <Slider
                id="tableHeaderFont"
                min={8}
                max={16}
                step={0.5}
                value={[layoutSettings.fontSizes?.tableHeader ?? 12]}
                onValueChange={(value) => handleFontSizeChange('tableHeader', value)}
                className="mt-2"
              />
              <div className="text-sm text-gray-500">Current: {layoutSettings.fontSizes?.tableHeader ?? 12}pt</div>
            </div>

            <div>
              <Label htmlFor="tableContentFont">Table Content</Label>
              <Slider
                id="tableContentFont"
                min={8}
                max={14}
                step={0.5}
                value={[layoutSettings.fontSizes?.tableContent ?? 10]}
                onValueChange={(value) => handleFontSizeChange('tableContent', value)}
                className="mt-2"
              />
              <div className="text-sm text-gray-500">Current: {layoutSettings.fontSizes?.tableContent ?? 10}pt</div>
            </div>

            <div>
              <Label htmlFor="footerFont">Footer</Label>
              <Slider
                id="footerFont"
                min={8}
                max={14}
                step={0.5}
                value={[layoutSettings.fontSizes?.footer ?? 9]}
                onValueChange={(value) => handleFontSizeChange('footer', value)}
                className="mt-2"
              />
              <div className="text-sm text-gray-500">Current: {layoutSettings.fontSizes?.footer ?? 9}pt</div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Color Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Color Settings (R,G,B format)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="primaryColor">Primary Color</Label>
              <Input
                id="primaryColor"
                value={layoutSettings.colorSettings?.primaryColor || "44,62,80"}
                onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                placeholder="e.g., 44,62,80"
              />
              <div className="text-sm text-gray-500 mt-1">Used for headers and titles</div>
            </div>

            <div>
              <Label htmlFor="headerTextColor">Header Text Color</Label>
              <Input
                id="headerTextColor"
                value={layoutSettings.colorSettings?.headerTextColor || "255,255,255"}
                onChange={(e) => handleColorChange('headerTextColor', e.target.value)}
                placeholder="e.g., 255,255,255"
              />
            </div>

            <div>
              <Label htmlFor="supervisorHeaderBgColor">Supervisor Header BG</Label>
              <Input
                id="supervisorHeaderBgColor"
                value={layoutSettings.colorSettings?.supervisorHeaderBgColor || "52,152,219"}
                onChange={(e) => handleColorChange('supervisorHeaderBgColor', e.target.value)}
                placeholder="e.g., 52,152,219"
              />
            </div>

            <div>
              <Label htmlFor="officerHeaderBgColor">Officer Header BG</Label>
              <Input
                id="officerHeaderBgColor"
                value={layoutSettings.colorSettings?.officerHeaderBgColor || "46,204,113"}
                onChange={(e) => handleColorChange('officerHeaderBgColor', e.target.value)}
                placeholder="e.g., 46,204,113"
              />
            </div>

            <div>
              <Label htmlFor="specialHeaderBgColor">Special Assignment Header BG</Label>
              <Input
                id="specialHeaderBgColor"
                value={layoutSettings.colorSettings?.specialHeaderBgColor || "155,89,182"}
                onChange={(e) => handleColorChange('specialHeaderBgColor', e.target.value)}
                placeholder="e.g., 155,89,182"
              />
            </div>

            <div>
              <Label htmlFor="ptoHeaderBgColor">PTO Header BG</Label>
              <Input
                id="ptoHeaderBgColor"
                value={layoutSettings.colorSettings?.ptoHeaderBgColor || "241,196,15"}
                onChange={(e) => handleColorChange('ptoHeaderBgColor', e.target.value)}
                placeholder="e.g., 241,196,15"
              />
            </div>

            <div>
              <Label htmlFor="officerTextColor">Officer Text Color</Label>
              <Input
                id="officerTextColor"
                value={layoutSettings.colorSettings?.officerTextColor || "0,0,0"}
                onChange={(e) => handleColorChange('officerTextColor', e.target.value)}
                placeholder="e.g., 0,0,0"
              />
            </div>

            <div>
              <Label htmlFor="supervisorTextColor">Supervisor Text Color</Label>
              <Input
                id="supervisorTextColor"
                value={layoutSettings.colorSettings?.supervisorTextColor || "0,0,0"}
                onChange={(e) => handleColorChange('supervisorTextColor', e.target.value)}
                placeholder="e.g., 0,0,0"
              />
            </div>

            <div>
              <Label htmlFor="specialAssignmentTextColor">Special Assignment Text Color</Label>
              <Input
                id="specialAssignmentTextColor"
                value={layoutSettings.colorSettings?.specialAssignmentTextColor || "0,0,0"}
                onChange={(e) => handleColorChange('specialAssignmentTextColor', e.target.value)}
                placeholder="e.g., 0,0,0"
              />
            </div>

            <div>
              <Label htmlFor="ptoTextColor">PTO Text Color</Label>
              <Input
                id="ptoTextColor"
                value={layoutSettings.colorSettings?.ptoTextColor || "0,0,0"}
                onChange={(e) => handleColorChange('ptoTextColor', e.target.value)}
                placeholder="e.g., 0,0,0"
              />
            </div>

            <div>
              <Label htmlFor="evenRowColor">Even Row Color</Label>
              <Input
                id="evenRowColor"
                value={layoutSettings.colorSettings?.evenRowColor || "255,255,255"}
                onChange={(e) => handleColorChange('evenRowColor', e.target.value)}
                placeholder="e.g., 255,255,255"
              />
            </div>

            <div>
              <Label htmlFor="oddRowColor">Odd Row Color</Label>
              <Input
                id="oddRowColor"
                value={layoutSettings.colorSettings?.oddRowColor || "248,249,250"}
                onChange={(e) => handleColorChange('oddRowColor', e.target.value)}
                placeholder="e.g., 248,249,250"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-2 pt-6">
          <Button 
            onClick={handleSave} 
            disabled={isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Layout Settings
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
