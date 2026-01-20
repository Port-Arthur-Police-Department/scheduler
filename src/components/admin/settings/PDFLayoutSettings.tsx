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
import { Eye, RotateCcw, Type, Table, Palette, Settings } from "lucide-react";
import { DEFAULT_LAYOUT_SETTINGS, LayoutSettings, FONT_SIZE_PRESETS, FONT_SIZE_RANGES } from "@/constants/pdfLayoutSettings";

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

  // Helper function to apply font presets
  const applyPreset = (presetName: keyof typeof FONT_SIZE_PRESETS) => {
    const preset = FONT_SIZE_PRESETS[presetName];
    setLayoutSettings(prev => ({
      ...prev,
      fontSizes: {
        ...prev.fontSizes,
        ...preset
      }
    }));
    
    // Also adjust row height for certain presets
    if (presetName === 'accessibility' || presetName === 'extraLarge') {
      handleTableSettingChange('rowHeight', 10);
    } else if (presetName === 'large') {
      handleTableSettingChange('rowHeight', 9);
    } else if (presetName === 'small') {
      handleTableSettingChange('rowHeight', 7);
    }
  };

  // Helper function to set row height
  const setRowHeight = (height: number) => {
    handleTableSettingChange('rowHeight', height);
  };

  // Helper function for column width changes
  const handleColumnWidthChange = (column: keyof LayoutSettings['tableSettings']['columnWidths'], value: number) => {
    setLayoutSettings(prev => ({
      ...prev,
      tableSettings: {
        ...prev.tableSettings,
        columnWidths: {
          ...prev.tableSettings.columnWidths,
          [column]: value
        }
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
              Customize the appearance of your PDF riding lists for better readability
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
              Reset All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="presets">
          <TabsList className="grid grid-cols-5 mb-4">
            <TabsTrigger value="presets" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Presets</span>
            </TabsTrigger>
            <TabsTrigger value="sections" className="flex items-center gap-2">
              <Table className="h-4 w-4" />
              <span className="hidden sm:inline">Sections</span>
            </TabsTrigger>
            <TabsTrigger value="fonts" className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              <span className="hidden sm:inline">Fonts</span>
            </TabsTrigger>
            <TabsTrigger value="table" className="flex items-center gap-2">
              <Table className="h-4 w-4" />
              <span className="hidden sm:inline">Table</span>
            </TabsTrigger>
            <TabsTrigger value="colors" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Colors</span>
            </TabsTrigger>
          </TabsList>

          {/* PRESETS TAB */}
          <TabsContent value="presets" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label>Quick Font Presets</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Apply pre-configured font size sets for different needs
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset('small')}
                    className="h-auto py-3 flex flex-col items-center justify-center"
                  >
                    <div className="text-center">
                      <div className="font-medium text-sm">Small</div>
                      <div className="text-xs text-muted-foreground mt-1">Compact view</div>
                      <div className="text-xs mt-1">6-8pt</div>
                    </div>
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset('medium')}
                    className="h-auto py-3 flex flex-col items-center justify-center"
                  >
                    <div className="text-center">
                      <div className="font-medium text-sm">Medium</div>
                      <div className="text-xs text-muted-foreground mt-1">Standard</div>
                      <div className="text-xs mt-1">7-10pt</div>
                    </div>
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset('large')}
                    className="h-auto py-3 flex flex-col items-center justify-center border-2 border-primary"
                  >
                    <div className="text-center">
                      <div className="font-medium text-sm">Large</div>
                      <div className="text-xs text-muted-foreground mt-1">Better readability</div>
                      <div className="text-xs mt-1">8-12pt</div>
                    </div>
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset('extraLarge')}
                    className="h-auto py-3 flex flex-col items-center justify-center"
                  >
                    <div className="text-center">
                      <div className="font-medium text-sm">Extra Large</div>
                      <div className="text-xs text-muted-foreground mt-1">Large print</div>
                      <div className="text-xs mt-1">9-14pt</div>
                    </div>
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset('accessibility')}
                    className="h-auto py-3 flex flex-col items-center justify-center"
                  >
                    <div className="text-center">
                      <div className="font-medium text-sm">Accessibility</div>
                      <div className="text-xs text-muted-foreground mt-1">High visibility</div>
                      <div className="text-xs mt-1">10-16pt</div>
                    </div>
                  </Button>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <Label>Row Height Presets</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Adjust spacing between rows for better readability
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRowHeight(6)}
                    className="h-10"
                  >
                    <div className="text-center w-full">
                      <div className="font-medium">Compact</div>
                      <div className="text-xs text-muted-foreground">6px</div>
                    </div>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRowHeight(8)}
                    className="h-10"
                  >
                    <div className="text-center w-full">
                      <div className="font-medium">Standard</div>
                      <div className="text-xs text-muted-foreground">8px</div>
                    </div>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRowHeight(10)}
                    className="h-10"
                  >
                    <div className="text-center w-full">
                      <div className="font-medium">Spacious</div>
                      <div className="text-xs text-muted-foreground">10px</div>
                    </div>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRowHeight(12)}
                    className="h-10"
                  >
                    <div className="text-center w-full">
                      <div className="font-medium">Extra Spacious</div>
                      <div className="text-xs text-muted-foreground">12px</div>
                    </div>
                  </Button>
                </div>
              </div>
              
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-2">💡 Tips for Better Readability</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Use "Large" or "Accessibility" presets for printed copies</li>
                  <li>• Increase row height when using larger fonts</li>
                  <li>• Adjust column widths if text is being cut off</li>
                  <li>• Preview changes before final export</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          {/* SECTIONS TAB */}
          <TabsContent value="sections" className="space-y-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-3">Display Sections</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <Label htmlFor="showSupervisors" className="font-normal">Show Supervisors Section</Label>
                      <p className="text-sm text-muted-foreground">Display supervisor assignments</p>
                    </div>
                    <Switch
                      id="showSupervisors"
                      checked={layoutSettings.sections.showSupervisors}
                      onCheckedChange={(checked) => handleSectionToggle('showSupervisors', checked)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <Label htmlFor="showOfficers" className="font-normal">Show Officers Section</Label>
                      <p className="text-sm text-muted-foreground">Display regular officer assignments</p>
                    </div>
                    <Switch
                      id="showOfficers"
                      checked={layoutSettings.sections.showOfficers}
                      onCheckedChange={(checked) => handleSectionToggle('showOfficers', checked)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <Label htmlFor="showSpecialAssignments" className="font-normal">Show Special Assignments</Label>
                      <p className="text-sm text-muted-foreground">Display special assignment officers</p>
                    </div>
                    <Switch
                      id="showSpecialAssignments"
                      checked={layoutSettings.sections.showSpecialAssignments}
                      onCheckedChange={(checked) => handleSectionToggle('showSpecialAssignments', checked)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <Label htmlFor="showPTO" className="font-normal">Show PTO Section</Label>
                      <p className="text-sm text-muted-foreground">Display officers on leave</p>
                    </div>
                    <Switch
                      id="showPTO"
                      checked={layoutSettings.sections.showPTO}
                      onCheckedChange={(checked) => handleSectionToggle('showPTO', checked)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <Label htmlFor="showStaffingSummary" className="font-normal">Show Staffing Summary</Label>
                      <p className="text-sm text-muted-foreground">Display staffing counts at bottom</p>
                    </div>
                    <Switch
                      id="showStaffingSummary"
                      checked={layoutSettings.sections.showStaffingSummary}
                      onCheckedChange={(checked) => handleSectionToggle('showStaffingSummary', checked)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* FONTS TAB */}
          <TabsContent value="fonts" className="space-y-6">
            <div className="space-y-6">
              <div>
                <h4 className="font-medium mb-3">Header Font Sizes</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Main Header</Label>
                      <span className="text-sm font-medium">{layoutSettings.fontSizes.header}pt</span>
                    </div>
                    <Slider
                      value={[layoutSettings.fontSizes.header]}
                      min={FONT_SIZE_RANGES.header.min}
                      max={FONT_SIZE_RANGES.header.max}
                      step={FONT_SIZE_RANGES.header.step}
                      onValueChange={([value]) => handleFontSizeChange('header', value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Shift name and date at top
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Table Headers</Label>
                      <span className="text-sm font-medium">{layoutSettings.fontSizes.tableHeader}pt</span>
                    </div>
                    <Slider
                      value={[layoutSettings.fontSizes.tableHeader]}
                      min={FONT_SIZE_RANGES.tableHeader.min}
                      max={FONT_SIZE_RANGES.tableHeader.max}
                      step={FONT_SIZE_RANGES.tableHeader.step}
                      onValueChange={([value]) => handleFontSizeChange('tableHeader', value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Column headers in tables
                    </p>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="font-medium mb-3">Table Content Font Sizes</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Officer Names</Label>
                      <span className="text-sm font-medium">{layoutSettings.fontSizes.nameColumn}pt</span>
                    </div>
                    <Slider
                      value={[layoutSettings.fontSizes.nameColumn]}
                      min={FONT_SIZE_RANGES.nameColumn.min}
                      max={FONT_SIZE_RANGES.nameColumn.max}
                      step={FONT_SIZE_RANGES.nameColumn.step}
                      onValueChange={([value]) => handleFontSizeChange('nameColumn', value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Names in all officer columns
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Beat/District Numbers</Label>
                      <span className="text-sm font-medium">{layoutSettings.fontSizes.beatColumn}pt</span>
                    </div>
                    <Slider
                      value={[layoutSettings.fontSizes.beatColumn]}
                      min={FONT_SIZE_RANGES.beatColumn.min}
                      max={FONT_SIZE_RANGES.beatColumn.max}
                      step={FONT_SIZE_RANGES.beatColumn.step}
                      onValueChange={([value]) => handleFontSizeChange('beatColumn', value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Beat, district, or assignment numbers
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Badge Numbers</Label>
                      <span className="text-sm font-medium">{layoutSettings.fontSizes.badgeColumn}pt</span>
                    </div>
                    <Slider
                      value={[layoutSettings.fontSizes.badgeColumn]}
                      min={FONT_SIZE_RANGES.badgeColumn.min}
                      max={FONT_SIZE_RANGES.badgeColumn.max}
                      step={FONT_SIZE_RANGES.badgeColumn.step}
                      onValueChange={([value]) => handleFontSizeChange('badgeColumn', value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Badge numbers in all tables
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Notes & Details</Label>
                      <span className="text-sm font-medium">{layoutSettings.fontSizes.notesColumn}pt</span>
                    </div>
                    <Slider
                      value={[layoutSettings.fontSizes.notesColumn]}
                      min={FONT_SIZE_RANGES.notesColumn.min}
                      max={FONT_SIZE_RANGES.notesColumn.max}
                      step={FONT_SIZE_RANGES.notesColumn.step}
                      onValueChange={([value]) => handleFontSizeChange('notesColumn', value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Notes, partnerships, and special info
                    </p>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="font-medium mb-3">Other Font Sizes</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>PTO Time Ranges</Label>
                      <span className="text-sm font-medium">{layoutSettings.fontSizes.ptoTimeColumn}pt</span>
                    </div>
                    <Slider
                      value={[layoutSettings.fontSizes.ptoTimeColumn]}
                      min={FONT_SIZE_RANGES.ptoTimeColumn.min}
                      max={FONT_SIZE_RANGES.ptoTimeColumn.max}
                      step={FONT_SIZE_RANGES.ptoTimeColumn.step}
                      onValueChange={([value]) => handleFontSizeChange('ptoTimeColumn', value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Time ranges for PTO entries
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Footer & Summary</Label>
                      <span className="text-sm font-medium">{layoutSettings.fontSizes.footer}pt</span>
                    </div>
                    <Slider
                      value={[layoutSettings.fontSizes.footer]}
                      min={FONT_SIZE_RANGES.footer.min}
                      max={FONT_SIZE_RANGES.footer.max}
                      step={FONT_SIZE_RANGES.footer.step}
                      onValueChange={([value]) => handleFontSizeChange('footer', value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Staffing summary and timestamp
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TABLE SETTINGS TAB */}
          <TabsContent value="table" className="space-y-4">
            <div className="space-y-6">
              <div>
                <h4 className="font-medium mb-3">Table Layout</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Row Height</Label>
                      <span className="text-sm font-medium">{layoutSettings.tableSettings.rowHeight}px</span>
                    </div>
                    <Slider
                      value={[layoutSettings.tableSettings.rowHeight]}
                      min={4}
                      max={14}
                      step={0.5}
                      onValueChange={([value]) => handleTableSettingChange('rowHeight', value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Height of each table row
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Cell Padding</Label>
                      <span className="text-sm font-medium">{layoutSettings.tableSettings.cellPadding}px</span>
                    </div>
                    <Slider
                      value={[layoutSettings.tableSettings.cellPadding]}
                      min={1}
                      max={8}
                      step={0.5}
                      onValueChange={([value]) => handleTableSettingChange('cellPadding', value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Space inside each cell
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <Label htmlFor="showRowStriping" className="font-normal">Row Striping</Label>
                    <p className="text-sm text-muted-foreground">Alternate row colors for better readability</p>
                  </div>
                  <Switch
                    id="showRowStriping"
                    checked={layoutSettings.tableSettings.showRowStriping}
                    onCheckedChange={(checked) => handleTableSettingChange('showRowStriping', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <Label htmlFor="compactMode" className="font-normal">Compact Mode</Label>
                    <p className="text-sm text-muted-foreground">Reduce spacing for more content per page</p>
                  </div>
                  <Switch
                    id="compactMode"
                    checked={layoutSettings.tableSettings.compactMode}
                    onCheckedChange={(checked) => handleTableSettingChange('compactMode', checked)}
                  />
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="font-medium mb-3">Column Width Adjustments</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Adjust percentage of table width allocated to each column type
                </p>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Name Column Width</Label>
                      <span className="text-sm font-medium">{Math.round(layoutSettings.tableSettings.columnWidths.name * 100)}%</span>
                    </div>
                    <Slider
                      value={[layoutSettings.tableSettings.columnWidths.name]}
                      min={0.2}
                      max={0.5}
                      step={0.01}
                      onValueChange={([value]) => handleColumnWidthChange('name', value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Space for officer/supervisor names
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Notes Column Width</Label>
                      <span className="text-sm font-medium">{Math.round(layoutSettings.tableSettings.columnWidths.notes * 100)}%</span>
                    </div>
                    <Slider
                      value={[layoutSettings.tableSettings.columnWidths.notes]}
                      min={0.2}
                      max={0.5}
                      step={0.01}
                      onValueChange={([value]) => handleColumnWidthChange('notes', value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Space for notes and details
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Beat Column Width</Label>
                      <span className="text-sm font-medium">{Math.round(layoutSettings.tableSettings.columnWidths.beat * 100)}%</span>
                    </div>
                    <Slider
                      value={[layoutSettings.tableSettings.columnWidths.beat]}
                      min={0.05}
                      max={0.15}
                      step={0.01}
                      onValueChange={([value]) => handleColumnWidthChange('beat', value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Space for beat/district numbers
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Badge Column Width</Label>
                      <span className="text-sm font-medium">{Math.round(layoutSettings.tableSettings.columnWidths.badge * 100)}%</span>
                    </div>
                    <Slider
                      value={[layoutSettings.tableSettings.columnWidths.badge]}
                      min={0.05}
                      max={0.15}
                      step={0.01}
                      onValueChange={([value]) => handleColumnWidthChange('badge', value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Space for badge numbers
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* COLORS TAB */}
          <TabsContent value="colors" className="space-y-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-3">Section Header Colors</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Supervisor Header</Label>
                    <div className="flex items-center gap-2">
                      <ColorPicker
                        value={layoutSettings.colorSettings.supervisorHeaderBgColor}
                        onChange={(value) => handleColorChange('supervisorHeaderBgColor', value)}
                      />
                      <div className="text-xs text-muted-foreground">
                        Supervisor section header background
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Officer Header</Label>
                    <div className="flex items-center gap-2">
                      <ColorPicker
                        value={layoutSettings.colorSettings.officerHeaderBgColor}
                        onChange={(value) => handleColorChange('officerHeaderBgColor', value)}
                      />
                      <div className="text-xs text-muted-foreground">
                        Officer section header background
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Special Assignment Header</Label>
                    <div className="flex items-center gap-2">
                      <ColorPicker
                        value={layoutSettings.colorSettings.specialHeaderBgColor}
                        onChange={(value) => handleColorChange('specialHeaderBgColor', value)}
                      />
                      <div className="text-xs text-muted-foreground">
                        Special assignment header background
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>PTO Header</Label>
                    <div className="flex items-center gap-2">
                      <ColorPicker
                        value={layoutSettings.colorSettings.ptoHeaderBgColor}
                        onChange={(value) => handleColorChange('ptoHeaderBgColor', value)}
                      />
                      <div className="text-xs text-muted-foreground">
                        PTO section header background
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="font-medium mb-3">Text Colors</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Header Text Color</Label>
                    <div className="flex items-center gap-2">
                      <ColorPicker
                        value={layoutSettings.colorSettings.headerTextColor}
                        onChange={(value) => handleColorChange('headerTextColor', value)}
                      />
                      <div className="text-xs text-muted-foreground">
                        Text color for all section headers
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Primary Color (Title)</Label>
                    <div className="flex items-center gap-2">
                      <ColorPicker
                        value={layoutSettings.colorSettings.primaryColor}
                        onChange={(value) => handleColorChange('primaryColor', value)}
                      />
                      <div className="text-xs text-muted-foreground">
                        Shift name and date at top
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Officer Names</Label>
                    <div className="flex items-center gap-2">
                      <ColorPicker
                        value={layoutSettings.colorSettings.officerTextColor}
                        onChange={(value) => handleColorChange('officerTextColor', value)}
                      />
                      <div className="text-xs text-muted-foreground">
                        Officer name text color
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Supervisor Names</Label>
                    <div className="flex items-center gap-2">
                      <ColorPicker
                        value={layoutSettings.colorSettings.supervisorTextColor}
                        onChange={(value) => handleColorChange('supervisorTextColor', value)}
                      />
                      <div className="text-xs text-muted-foreground">
                        Supervisor name text color
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Special Assignment Text</Label>
                    <div className="flex items-center gap-2">
                      <ColorPicker
                        value={layoutSettings.colorSettings.specialAssignmentTextColor}
                        onChange={(value) => handleColorChange('specialAssignmentTextColor', value)}
                      />
                      <div className="text-xs text-muted-foreground">
                        Special assignment text color
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>PTO Text</Label>
                    <div className="flex items-center gap-2">
                      <ColorPicker
                        value={layoutSettings.colorSettings.ptoTextColor}
                        onChange={(value) => handleColorChange('ptoTextColor', value)}
                      />
                      <div className="text-xs text-muted-foreground">
                        PTO section text color
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="font-medium mb-3">Row Colors</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Even Rows</Label>
                    <div className="flex items-center gap-2">
                      <ColorPicker
                        value={layoutSettings.colorSettings.evenRowColor}
                        onChange={(value) => handleColorChange('evenRowColor', value)}
                      />
                      <div className="text-xs text-muted-foreground">
                        Background color for even rows
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Odd Rows</Label>
                    <div className="flex items-center gap-2">
                      <ColorPicker
                        value={layoutSettings.colorSettings.oddRowColor}
                        onChange={(value) => handleColorChange('oddRowColor', value)}
                      />
                      <div className="text-xs text-muted-foreground">
                        Background color for odd rows
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Separator className="my-6" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            <p>Current settings will apply to all future PDF exports.</p>
            <p>Use "Preview" to test changes before saving.</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onPreview}
              disabled={isPending}
              className="min-w-[100px]"
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending}
              className="min-w-[100px]"
            >
              {isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
