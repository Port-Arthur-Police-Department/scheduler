// src/components/admin/settings/PDFLayoutSettings.tsx - RESTORED FULL VERSION
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
      ...(settings?.pdf_layout_settings || {})
    };
    
    // Ensure all sections exist with proper defaults
    return {
      sections: {
        showSupervisors: true,
        showOfficers: true,
        showSpecialAssignments: true,
        showPTO: true,
        showStaffingSummary: true,
        showLogoSection: true,
        ...defaultSettings.sections
      },
      tableSettings: {
        rowHeight: 30,
        cellPadding: 8,
        showRowStriping: true,
        borderWidth: 1,
        columnSpacing: 4,
        showVerticalLines: true,
        ...defaultSettings.tableSettings
      },
      fontSizes: {
        header: 18,
        tableHeader: 12,
        tableContent: 10,
        footer: 9,
        ...defaultSettings.fontSizes
      },
      colorSettings: {
        primaryColor: "44,62,80",
        headerTextColor: "255,255,255",
        supervisorHeaderBgColor: "52,152,219",
        officerHeaderBgColor: "46,204,113",
        specialHeaderBgColor: "155,89,182",
        ptoHeaderBgColor: "241,196,15",
        officerTextColor: "0,0,0",
        supervisorTextColor: "0,0,0",
        specialAssignmentTextColor: "0,0,0",
        ptoTextColor: "0,0,0",
        evenRowColor: "255,255,255",
        oddRowColor: "248,249,250",
        ...defaultSettings.colorSettings
      },
      columnOrder: {
        supervisors: "name-badge-position-unit",
        officers: "name-badge-beat-unit",
        ...defaultSettings.columnOrder
      }
    };
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
        ...prev.columnOrder,
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
                checked={layoutSettings.sections.showSupervisors}
                onCheckedChange={(checked) => handleSectionToggle('showSupervisors', checked)}
              />
              <Label htmlFor="showSupervisors">Supervisors Section</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="showOfficers"
                checked={layoutSettings.sections.showOfficers}
                onCheckedChange={(checked) => handleSectionToggle('showOfficers', checked)}
              />
              <Label htmlFor="showOfficers">Officers Section</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="showSpecialAssignments"
                checked={layoutSettings.sections.showSpecialAssignments}
                onCheckedChange={(checked) => handleSectionToggle('showSpecialAssignments', checked)}
              />
              <Label htmlFor="showSpecialAssignments">Special Assignments</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="showPTO"
                checked={layoutSettings.sections.showPTO}
                onCheckedChange={(checked) => handleSectionToggle('showPTO', checked)}
              />
              <Label htmlFor="showPTO">PTO Section</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="showStaffingSummary"
                checked={layoutSettings.sections.showStaffingSummary}
                onCheckedChange={(checked) => handleSectionToggle('showStaffingSummary', checked)}
              />
              <Label htmlFor="showStaffingSummary">Staffing Summary</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="showLogoSection"
                checked={layoutSettings.sections.showLogoSection}
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
                  value={[layoutSettings.tableSettings.rowHeight]}
                  onValueChange={(value) => handleTableSettingChange('rowHeight', value[0])}
                  className="mt-2"
                />
                <div className="text-sm text-gray-500 mt-1">
                  Current: {layoutSettings.tableSettings.rowHeight}px
                </div>
              </div>

              <div>
                <Label htmlFor="cellPadding">Cell Padding (px)</Label>
                <Slider
                  id="cellPadding"
                  min={2}
                  max={20}
                  step={1}
                  value={[layoutSettings.tableSettings.cellPadding]}
                  onValueChange={(value) => handleTableSettingChange('cellPadding', value[0])}
                  className="mt-2"
                />
                <div className="text-sm text-gray-500 mt-1">
                  Current: {layoutSettings.tableSettings.cellPadding}px
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="showRowStriping"
                  checked={layoutSettings.tableSettings.showRowStriping}
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
                  value={[layoutSettings.tableSettings.borderWidth]}
                  onValueChange={(value) => handleTableSettingChange('borderWidth', value[0])}
                  className="mt-2"
                />
                <div className="text-sm text-gray-500 mt-1">
                  Current: {layoutSettings.tableSettings.borderWidth}px
                </div>
              </div>

              <div>
                <Label htmlFor="columnSpacing">Column Spacing (px)</Label>
                <Slider
                  id="columnSpacing"
                  min={0}
                  max={20}
                  step={1}
                  value={[layoutSettings.tableSettings.columnSpacing]}
                  onValueChange={(value) => handleTableSettingChange('columnSpacing', value[0])}
                  className="mt-2"
                />
                <div className="text-sm text-gray-500 mt-1">
                  Current: {layoutSettings.tableSettings.columnSpacing}px
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="showVerticalLines"
                  checked={layoutSettings.tableSettings.showVerticalLines}
                  onCheckedChange={(checked) => handleTableSettingChange('showVerticalLines', checked)}
                />
                <Label htmlFor="showVerticalLines">Show Vertical Lines</Label>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Column Order */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Column Order</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supervisorsOrder">Supervisors Column Order</Label>
              <Select
                value={layoutSettings.columnOrder.supervisors}
                onValueChange={(value) => handleColumnOrderChange('supervisors', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-badge-position-unit">Name → Badge → Position → Unit</SelectItem>
                  <SelectItem value="badge-name-position-unit">Badge → Name → Position → Unit</SelectItem>
                  <SelectItem value="position-name-badge-unit">Position → Name → Badge → Unit</SelectItem>
                  <SelectItem value="name-position-badge-unit">Name → Position → Badge → Unit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="officersOrder">Officers Column Order</Label>
              <Select
                value={layoutSettings.columnOrder.officers}
                onValueChange={(value) => handleColumnOrderChange('officers', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-badge-beat-unit">Name → Badge → Beat → Unit</SelectItem>
                  <SelectItem value="badge-name-beat-unit">Badge → Name → Beat → Unit</SelectItem>
                  <SelectItem value="beat-name-badge-unit">Beat → Name → Badge → Unit</SelectItem>
                  <SelectItem value="name-beat-badge-unit">Name → Beat → Badge → Unit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

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
                value={[layoutSettings.fontSizes.header]}
                onValueChange={(value) => handleFontSizeChange('header', value)}
                className="mt-2"
              />
              <div className="text-sm text-gray-500">Current: {layoutSettings.fontSizes.header}pt</div>
            </div>

            <div>
              <Label htmlFor="tableHeaderFont">Table Header</Label>
              <Slider
                id="tableHeaderFont"
                min={8}
                max={16}
                step={0.5}
                value={[layoutSettings.fontSizes.tableHeader]}
                onValueChange={(value) => handleFontSizeChange('tableHeader', value)}
                className="mt-2"
              />
              <div className="text-sm text-gray-500">Current: {layoutSettings.fontSizes.tableHeader}pt</div>
            </div>

            <div>
              <Label htmlFor="tableContentFont">Table Content</Label>
              <Slider
                id="tableContentFont"
                min={8}
                max={14}
                step={0.5}
                value={[layoutSettings.fontSizes.tableContent]}
                onValueChange={(value) => handleFontSizeChange('tableContent', value)}
                className="mt-2"
              />
              <div className="text-sm text-gray-500">Current: {layoutSettings.fontSizes.tableContent}pt</div>
            </div>

            <div>
              <Label htmlFor="footerFont">Footer</Label>
              <Slider
                id="footerFont"
                min={8}
                max={14}
                step={0.5}
                value={[layoutSettings.fontSizes.footer]}
                onValueChange={(value) => handleFontSizeChange('footer', value)}
                className="mt-2"
              />
              <div className="text-sm text-gray-500">Current: {layoutSettings.fontSizes.footer}pt</div>
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
                value={layoutSettings.colorSettings.primaryColor}
                onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                placeholder="e.g., 44,62,80"
              />
              <div className="text-sm text-gray-500 mt-1">Used for headers and titles</div>
            </div>

            <div>
              <Label htmlFor="headerTextColor">Header Text Color</Label>
              <Input
                id="headerTextColor"
                value={layoutSettings.colorSettings.headerTextColor}
                onChange={(e) => handleColorChange('headerTextColor', e.target.value)}
                placeholder="e.g., 255,255,255"
              />
            </div>

            <div>
              <Label htmlFor="supervisorHeaderBgColor">Supervisor Header BG</Label>
              <Input
                id="supervisorHeaderBgColor"
                value={layoutSettings.colorSettings.supervisorHeaderBgColor}
                onChange={(e) => handleColorChange('supervisorHeaderBgColor', e.target.value)}
                placeholder="e.g., 52,152,219"
              />
            </div>

            <div>
              <Label htmlFor="officerHeaderBgColor">Officer Header BG</Label>
              <Input
                id="officerHeaderBgColor"
                value={layoutSettings.colorSettings.officerHeaderBgColor}
                onChange={(e) => handleColorChange('officerHeaderBgColor', e.target.value)}
                placeholder="e.g., 46,204,113"
              />
            </div>

            <div>
              <Label htmlFor="specialHeaderBgColor">Special Assignment Header BG</Label>
              <Input
                id="specialHeaderBgColor"
                value={layoutSettings.colorSettings.specialHeaderBgColor}
                onChange={(e) => handleColorChange('specialHeaderBgColor', e.target.value)}
                placeholder="e.g., 155,89,182"
              />
            </div>

            <div>
              <Label htmlFor="ptoHeaderBgColor">PTO Header BG</Label>
              <Input
                id="ptoHeaderBgColor"
                value={layoutSettings.colorSettings.ptoHeaderBgColor}
                onChange={(e) => handleColorChange('ptoHeaderBgColor', e.target.value)}
                placeholder="e.g., 241,196,15"
              />
            </div>

            <div>
              <Label htmlFor="officerTextColor">Officer Text Color</Label>
              <Input
                id="officerTextColor"
                value={layoutSettings.colorSettings.officerTextColor}
                onChange={(e) => handleColorChange('officerTextColor', e.target.value)}
                placeholder="e.g., 0,0,0"
              />
            </div>

            <div>
              <Label htmlFor="supervisorTextColor">Supervisor Text Color</Label>
              <Input
                id="supervisorTextColor"
                value={layoutSettings.colorSettings.supervisorTextColor}
                onChange={(e) => handleColorChange('supervisorTextColor', e.target.value)}
                placeholder="e.g., 0,0,0"
              />
            </div>

            <div>
              <Label htmlFor="specialAssignmentTextColor">Special Assignment Text Color</Label>
              <Input
                id="specialAssignmentTextColor"
                value={layoutSettings.colorSettings.specialAssignmentTextColor}
                onChange={(e) => handleColorChange('specialAssignmentTextColor', e.target.value)}
                placeholder="e.g., 0,0,0"
              />
            </div>

            <div>
              <Label htmlFor="ptoTextColor">PTO Text Color</Label>
              <Input
                id="ptoTextColor"
                value={layoutSettings.colorSettings.ptoTextColor}
                onChange={(e) => handleColorChange('ptoTextColor', e.target.value)}
                placeholder="e.g., 0,0,0"
              />
            </div>

            <div>
              <Label htmlFor="evenRowColor">Even Row Color</Label>
              <Input
                id="evenRowColor"
                value={layoutSettings.colorSettings.evenRowColor}
                onChange={(e) => handleColorChange('evenRowColor', e.target.value)}
                placeholder="e.g., 255,255,255"
              />
            </div>

            <div>
              <Label htmlFor="oddRowColor">Odd Row Color</Label>
              <Input
                id="oddRowColor"
                value={layoutSettings.colorSettings.oddRowColor}
                onChange={(e) => handleColorChange('oddRowColor', e.target.value)}
                placeholder="e.g., 248,249,250"
              />
            </div>
          </div>
        </div>

        {/* Additional PDF Settings */}
        <Separator />
        
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Additional PDF Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pageMargins">Page Margins (mm)</Label>
              <Input
                id="pageMargins"
                value={layoutSettings.pageMargins || "20,20,20,20"}
                onChange={(e) => setLayoutSettings(prev => ({ ...prev, pageMargins: e.target.value }))}
                placeholder="e.g., 20,20,20,20"
              />
              <div className="text-sm text-gray-500 mt-1">Top, Right, Bottom, Left</div>
            </div>

            <div>
              <Label htmlFor="pageSize">Page Size</Label>
              <Select
                value={layoutSettings.pageSize || "A4"}
                onValueChange={(value) => setLayoutSettings(prev => ({ ...prev, pageSize: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select page size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A4">A4 (210 × 297 mm)</SelectItem>
                  <SelectItem value="LETTER">Letter (8.5 × 11 in)</SelectItem>
                  <SelectItem value="LEGAL">Legal (8.5 × 14 in)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="showPageNumbers"
                checked={layoutSettings.showPageNumbers || true}
                onCheckedChange={(checked) => setLayoutSettings(prev => ({ ...prev, showPageNumbers: checked }))}
              />
              <Label htmlFor="showPageNumbers">Show Page Numbers</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="compressPDF"
                checked={layoutSettings.compressPDF || false}
                onCheckedChange={(checked) => setLayoutSettings(prev => ({ ...prev, compressPDF: checked }))}
              />
              <Label htmlFor="compressPDF">Compress PDF File</Label>
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
