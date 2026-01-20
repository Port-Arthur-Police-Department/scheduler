import { useState, useEffect } from "react";
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

// Helper function to migrate old settings to new structure
const migrateLayoutSettings = (oldSettings: any): LayoutSettings => {
  if (!oldSettings) {
    return DEFAULT_LAYOUT_SETTINGS;
  }

  // Check if this is the new structure (has fontSizes.nameColumn)
  if (oldSettings.fontSizes?.nameColumn !== undefined) {
    return oldSettings as LayoutSettings;
  }

  // Old structure - migrate to new structure
  console.log("Migrating old layout settings to new structure");
  
  return {
    ...DEFAULT_LAYOUT_SETTINGS,
    ...oldSettings,
    fontSizes: {
      ...DEFAULT_LAYOUT_SETTINGS.fontSizes,
      ...oldSettings.fontSizes,
      // Set column-specific font sizes from tableContent if not present
      nameColumn: oldSettings.fontSizes?.tableContent || DEFAULT_LAYOUT_SETTINGS.fontSizes.tableContent,
      beatColumn: oldSettings.fontSizes?.tableContent || DEFAULT_LAYOUT_SETTINGS.fontSizes.tableContent,
      badgeColumn: oldSettings.fontSizes?.tableContent || DEFAULT_LAYOUT_SETTINGS.fontSizes.tableContent,
      notesColumn: oldSettings.fontSizes?.tableContent || DEFAULT_LAYOUT_SETTINGS.fontSizes.tableContent,
      ptoTimeColumn: oldSettings.fontSizes?.tableContent || DEFAULT_LAYOUT_SETTINGS.fontSizes.tableContent,
    },
    tableSettings: {
      ...DEFAULT_LAYOUT_SETTINGS.tableSettings,
      ...oldSettings.tableSettings,
      // Add columnWidths if not present
      columnWidths: oldSettings.tableSettings?.columnWidths || DEFAULT_LAYOUT_SETTINGS.tableSettings.columnWidths,
    }
  };
};

export const PDFLayoutSettings = ({ settings, onSave, onPreview, isPending }: PDFLayoutSettingsProps) => {
  // Migrate settings on component mount
  const [layoutSettings, setLayoutSettings] = useState<LayoutSettings>(() => {
    return migrateLayoutSettings(settings?.pdf_layout_settings);
  });

  // Track which preset was last applied
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Update layout settings when props change
  useEffect(() => {
    if (settings?.pdf_layout_settings) {
      const migrated = migrateLayoutSettings(settings.pdf_layout_settings);
      setLayoutSettings(migrated);
      // Reset active preset when settings change externally
      setActivePreset(null);
    }
  }, [settings]);

  const handleFontSizeChange = (section: keyof LayoutSettings['fontSizes'], value: number) => {
    setLayoutSettings(prev => ({
      ...prev,
      fontSizes: {
        ...prev.fontSizes,
        [section]: value
      }
    }));
    // Clear active preset when manually adjusting
    setActivePreset(null);
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

  // FIXED: Helper function to apply font presets - only affects font sizes
  const applyPreset = (presetName: keyof typeof FONT_SIZE_PRESETS) => {
    const preset = FONT_SIZE_PRESETS[presetName];
    
    // Only update font sizes, keep all other settings
    const newSettings = {
      ...layoutSettings,
      fontSizes: {
        ...layoutSettings.fontSizes,
        ...preset
      }
    };
    
    // Update local state
    setLayoutSettings(newSettings);
    setActivePreset(presetName);
    
    // Auto-save immediately
    onSave(newSettings);
  };

  // Helper function to set row height
  const setRowHeight = (height: number) => {
    const newSettings = {
      ...layoutSettings,
      tableSettings: {
        ...layoutSettings.tableSettings,
        rowHeight: height
      }
    };
    setLayoutSettings(newSettings);
    onSave(newSettings);
  };

  // Helper function for column width changes
  const handleColumnWidthChange = (column: keyof LayoutSettings['tableSettings']['columnWidths'], value: number) => {
    const newSettings = {
      ...layoutSettings,
      tableSettings: {
        ...layoutSettings.tableSettings,
        columnWidths: {
          ...layoutSettings.tableSettings.columnWidths,
          [column]: value
        }
      }
    };
    setLayoutSettings(newSettings);
    onSave(newSettings);
  };

  // Helper function to apply a specific color theme
  const applyColorTheme = (theme: 'default' | 'high-contrast' | 'grayscale' | 'dark' | 'police' | 'print-friendly') => {
    const themes = {
      default: {
        supervisorHeaderBgColor: "41,128,185",
        officerHeaderBgColor: "52,152,219",
        specialHeaderBgColor: "155,89,182",
        ptoHeaderBgColor: "243,156,18",
        headerTextColor: "255,255,255",
        officerTextColor: "44,62,80",
        supervisorTextColor: "44,62,80",
        specialAssignmentTextColor: "102,51,153",
        ptoTextColor: "139,0,0",
        evenRowColor: "255,255,255",
        oddRowColor: "248,249,250",
        primaryColor: "41,128,185",
        secondaryColor: "52,152,219",
        accentColor: "155,89,182"
      },
      'high-contrast': {
        supervisorHeaderBgColor: "0,0,0",
        officerHeaderBgColor: "0,0,139",
        specialHeaderBgColor: "139,0,139",
        ptoHeaderBgColor: "165,42,42",
        headerTextColor: "255,255,255",
        officerTextColor: "0,0,0",
        supervisorTextColor: "0,0,0",
        specialAssignmentTextColor: "0,0,0",
        ptoTextColor: "0,0,0",
        evenRowColor: "255,255,255",
        oddRowColor: "240,240,240",
        primaryColor: "0,0,0",
        secondaryColor: "0,0,139",
        accentColor: "139,0,139"
      },
      grayscale: {
        supervisorHeaderBgColor: "64,64,64",
        officerHeaderBgColor: "96,96,96",
        specialHeaderBgColor: "128,128,128",
        ptoHeaderBgColor: "160,160,160",
        headerTextColor: "255,255,255",
        officerTextColor: "0,0,0",
        supervisorTextColor: "0,0,0",
        specialAssignmentTextColor: "0,0,0",
        ptoTextColor: "0,0,0",
        evenRowColor: "255,255,255",
        oddRowColor: "245,245,245",
        primaryColor: "64,64,64",
        secondaryColor: "96,96,96",
        accentColor: "128,128,128"
      },
      dark: {
        supervisorHeaderBgColor: "41,128,185",
        officerHeaderBgColor: "52,152,219",
        specialHeaderBgColor: "155,89,182",
        ptoHeaderBgColor: "243,156,18",
        headerTextColor: "255,255,255",
        officerTextColor: "230,230,230",
        supervisorTextColor: "230,230,230",
        specialAssignmentTextColor: "230,230,230",
        ptoTextColor: "255,200,200",
        evenRowColor: "30,30,30",
        oddRowColor: "40,40,40",
        primaryColor: "41,128,185",
        secondaryColor: "52,152,219",
        accentColor: "155,89,182"
      },
      police: {
        supervisorHeaderBgColor: "0,51,102", // Navy blue
        officerHeaderBgColor: "0,102,204", // Police blue
        specialHeaderBgColor: "153,0,0", // Police red
        ptoHeaderBgColor: "255,153,0", // Orange
        headerTextColor: "255,255,255",
        officerTextColor: "0,0,0",
        supervisorTextColor: "0,0,0",
        specialAssignmentTextColor: "153,0,0",
        ptoTextColor: "139,0,0",
        evenRowColor: "255,255,255",
        oddRowColor: "245,245,245",
        primaryColor: "0,51,102",
        secondaryColor: "0,102,204",
        accentColor: "153,0,0"
      },
      'print-friendly': {
        supervisorHeaderBgColor: "200,200,200", // Light gray
        officerHeaderBgColor: "220,220,220", // Lighter gray
        specialHeaderBgColor: "180,180,180", // Medium gray
        ptoHeaderBgColor: "160,160,160", // Dark gray
        headerTextColor: "0,0,0",
        officerTextColor: "0,0,0",
        supervisorTextColor: "0,0,0",
        specialAssignmentTextColor: "0,0,0",
        ptoTextColor: "0,0,0",
        evenRowColor: "255,255,255",
        oddRowColor: "248,248,248",
        primaryColor: "0,0,0",
        secondaryColor: "64,64,64",
        accentColor: "128,128,128"
      }
    };

    const newSettings = {
      ...layoutSettings,
      colorSettings: {
        ...layoutSettings.colorSettings,
        ...themes[theme]
      }
    };
    
    setLayoutSettings(newSettings);
    onSave(newSettings);
  };

  // Quick reset to default font sizes only
  const resetFontSizes = () => {
    const newSettings = {
      ...layoutSettings,
      fontSizes: DEFAULT_LAYOUT_SETTINGS.fontSizes
    };
    setLayoutSettings(newSettings);
    setActivePreset(null);
    onSave(newSettings);
  };

  // Quick reset to default table settings only
  const resetTableSettings = () => {
    const newSettings = {
      ...layoutSettings,
      tableSettings: DEFAULT_LAYOUT_SETTINGS.tableSettings
    };
    setLayoutSettings(newSettings);
    onSave(newSettings);
  };

  // Quick reset to default colors only
  const resetColors = () => {
    const newSettings = {
      ...layoutSettings,
      colorSettings: DEFAULT_LAYOUT_SETTINGS.colorSettings
    };
    setLayoutSettings(newSettings);
    onSave(newSettings);
  };

  const handleReset = () => {
    const defaultSettings = DEFAULT_LAYOUT_SETTINGS;
    setLayoutSettings(defaultSettings);
    setActivePreset(null);
    onSave(defaultSettings);
  };

  const handleSave = () => {
    onSave(layoutSettings);
  };

  // Helper to check if current settings match a preset
  const getMatchingPreset = (): string | null => {
    const currentFontSizes = layoutSettings.fontSizes;
    
    for (const [presetName, preset] of Object.entries(FONT_SIZE_PRESETS)) {
      let matches = true;
      for (const [key, value] of Object.entries(preset)) {
        if (currentFontSizes[key as keyof typeof currentFontSizes] !== value) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return presetName;
      }
    }
    return null;
  };

  // Check for matching preset on component mount and updates
  useEffect(() => {
    const matchingPreset = getMatchingPreset();
    if (matchingPreset && matchingPreset !== activePreset) {
      setActivePreset(matchingPreset);
    }
  }, [layoutSettings.fontSizes]);

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
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <Label>Quick Font Presets</Label>
                    {activePreset && (
                      <p className="text-sm text-muted-foreground">
                        Currently using: <span className="font-medium text-primary">{activePreset.charAt(0).toUpperCase() + activePreset.slice(1)}</span> preset
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFontSizes}
                    className="h-7 text-xs"
                    disabled={isPending}
                  >
                    Reset Fonts
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  One-click font size sets. You can still adjust individual sizes after applying.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
                  {Object.entries(FONT_SIZE_PRESETS).map(([presetName, preset]) => (
                    <Button
                      key={presetName}
                      type="button"
                      variant={activePreset === presetName ? "default" : "outline"}
                      size="sm"
                      onClick={() => applyPreset(presetName as keyof typeof FONT_SIZE_PRESETS)}
                      className="h-auto py-3 flex flex-col items-center justify-center transition-colors"
                      disabled={isPending}
                    >
                      <div className="text-center">
                        <div className="font-medium text-sm">
                          {presetName.charAt(0).toUpperCase() + presetName.slice(1)}
                        </div>
                        <div className="text-xs mt-1">
                          {preset.tableContent}pt
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
                
                {isPending && (
                  <div className="mt-2 text-sm text-green-600 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-600 animate-pulse"></div>
                    Saving changes...
                  </div>
                )}
              </div>
              
              <Separator />
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Row Height Presets</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetTableSettings}
                    className="h-7 text-xs"
                    disabled={isPending}
                  >
                    Reset Table
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Adjust spacing between rows (automatically saves)
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button
                    type="button"
                    variant={layoutSettings.tableSettings.rowHeight === 6 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRowHeight(6)}
                    className="h-10"
                    disabled={isPending}
                  >
                    <div className="text-center w-full">
                      <div className="font-medium">Compact</div>
                      <div className="text-xs">6px</div>
                    </div>
                  </Button>
                  <Button
                    type="button"
                    variant={layoutSettings.tableSettings.rowHeight === 8 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRowHeight(8)}
                    className="h-10"
                    disabled={isPending}
                  >
                    <div className="text-center w-full">
                      <div className="font-medium">Standard</div>
                      <div className="text-xs">8px</div>
                    </div>
                  </Button>
                  <Button
                    type="button"
                    variant={layoutSettings.tableSettings.rowHeight === 10 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRowHeight(10)}
                    className="h-10"
                    disabled={isPending}
                  >
                    <div className="text-center w-full">
                      <div className="font-medium">Spacious</div>
                      <div className="text-xs">10px</div>
                    </div>
                  </Button>
                  <Button
                    type="button"
                    variant={layoutSettings.tableSettings.rowHeight === 12 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRowHeight(12)}
                    className="h-10"
                    disabled={isPending}
                  >
                    <div className="text-center w-full">
                      <div className="font-medium">Extra Spacious</div>
                      <div className="text-xs">12px</div>
                    </div>
                  </Button>
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Color Themes</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetColors}
                    className="h-7 text-xs"
                    disabled={isPending}
                  >
                    Reset Colors
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Apply complete color schemes
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {(['default', 'police', 'high-contrast', 'grayscale', 'dark', 'print-friendly'] as const).map((theme) => (
                    <Button
                      key={theme}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyColorTheme(theme)}
                      className="h-10"
                      disabled={isPending}
                    >
                      <div className="text-center w-full">
                        <div className="font-medium">
                          {theme === 'high-contrast' ? 'High Contrast' : 
                           theme === 'print-friendly' ? 'Print Friendly' :
                           theme.charAt(0).toUpperCase() + theme.slice(1)}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
              
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-2">💡 How Presets Work</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Presets only affect font sizes - your other settings remain unchanged</li>
                  <li>• After applying a preset, you can still adjust individual font sizes</li>
                  <li>• The preset button will show as active when your settings match that preset</li>
                  <li>• Changing any font size manually will clear the active preset indicator</li>
                  <li>• Row height and color themes are separate and don't affect fonts</li>
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
                      disabled={isPending}
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
                      disabled={isPending}
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
                      disabled={isPending}
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
                      disabled={isPending}
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
                      disabled={isPending}
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* FONTS TAB */}
          <TabsContent value="fonts" className="space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Font Sizes</h4>
                {activePreset && (
                  <span className="text-sm text-muted-foreground">
                    Based on <span className="font-medium text-primary">{activePreset}</span> preset
                  </span>
                )}
              </div>
              
              <div>
                <h5 className="font-medium mb-3 text-sm">Header Font Sizes</h5>
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
                      disabled={isPending}
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
                      disabled={isPending}
                    />
                    <p className="text-xs text-muted-foreground">
                      Column headers in tables
                    </p>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h5 className="font-medium mb-3 text-sm">Table Content Font Sizes</h5>
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
                      disabled={isPending}
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
                      disabled={isPending}
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
                      disabled={isPending}
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
                      disabled={isPending}
                    />
                    <p className="text-xs text-muted-foreground">
                      Notes, partnerships, and special info
                    </p>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h5 className="font-medium mb-3 text-sm">Other Font Sizes</h5>
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
                      disabled={isPending}
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
                      disabled={isPending}
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
                      disabled={isPending}
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
                      disabled={isPending}
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
                    disabled={isPending}
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
                    disabled={isPending}
                  />
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="font-medium mb-3">Column Width Adjustments</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Adjust percentage of table width allocated to each column type (automatically saves)
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
                      disabled={isPending}
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
                      disabled={isPending}
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
                      disabled={isPending}
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
                      disabled={isPending}
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
            <p>• Presets only affect font sizes</p>
            <p>• You can adjust individual settings after applying a preset</p>
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
              {isPending ? "Saving..." : "Save All Settings"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
