// components/settings/WebsiteSettings.tsx - UPDATED WITH PTO TYPE TOGGLES
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Palette, Eye, EyeOff } from "lucide-react";

// Default color scheme - COMPLETE WITH ALL COLORS
// Update your DEFAULT_COLORS in WebsiteSettings.tsx
const DEFAULT_COLORS = {
  // PDF Export Colors
  pdf_supervisor_pto_bg: "255,255,200",
  pdf_supervisor_pto_border: "255,220,100", 
  pdf_supervisor_pto_text: "139,69,19",
  
  pdf_officer_pto_bg: "240,255,240",
  pdf_officer_pto_border: "144,238,144",
  pdf_officer_pto_text: "0,100,0",
  
  // NEW: Different PTO type colors
  pdf_vacation_bg: "173,216,230", // Light blue
  pdf_vacation_border: "100,149,237",
  pdf_vacation_text: "0,0,139",
  
  pdf_sick_bg: "255,200,200", // Light red
  pdf_sick_border: "255,100,100",
  pdf_sick_text: "139,0,0",
  
  pdf_holiday_bg: "255,218,185", // Light orange
  pdf_holiday_border: "255,165,0",
  pdf_holiday_text: "165,42,42",
  
  pdf_comp_bg: "221,160,221", // Light purple
  pdf_comp_border: "186,85,211",
  pdf_comp_text: "128,0,128",
  
  pdf_off_day_bg: "220,220,220",
  pdf_off_day_text: "100,100,100",
  
  // Weekly Schedule Colors - SYNC WITH PDF COLORS
  weekly_supervisor_bg: "255,255,255",
  weekly_supervisor_text: "0,0,0",
  
  weekly_officer_bg: "255,255,255", 
  weekly_officer_text: "0,0,0",
  
  weekly_ppo_bg: "255,250,240",
  weekly_ppo_text: "150,75,0",
  
  // NEW: Weekly PTO type colors (same as PDF but in RGB format)
  weekly_vacation_bg: "173,216,230",
  weekly_vacation_text: "0,0,139",
  
  weekly_sick_bg: "255,200,200",
  weekly_sick_text: "139,0,0",
  
  weekly_holiday_bg: "255,218,185",
  weekly_holiday_text: "165,42,42",
  
  weekly_comp_bg: "221,160,221",
  weekly_comp_text: "128,0,128",
  
  weekly_pto_bg: "144,238,144", // General PTO fallback
  weekly_pto_text: "0,100,0",
  
  weekly_off_bg: "240,240,240",
  weekly_off_text: "100,100,100",
};

// Default PTO type visibility settings
const DEFAULT_PTO_VISIBILITY = {
  show_vacation_pto: true,
  show_holiday_pto: true,
  show_sick_pto: false,
  show_comp_pto: false,
};

export const WebsiteSettings = () => {
  const queryClient = useQueryClient();
  const [colorSettings, setColorSettings] = useState(DEFAULT_COLORS);
  const [ptoVisibility, setPtoVisibility] = useState(DEFAULT_PTO_VISIBILITY);

  // Fetch current settings with better error handling
  const { data: settings, isLoading } = useQuery({
    queryKey: ['website-settings'],
    queryFn: async () => {
      console.log('Fetching website settings...');
      
      const { data, error } = await supabase
        .from('website_settings')
        .select('*')
        .single();

      if (error) {
        console.log('Error fetching settings:', error);
        
        // If no settings exist yet, create default record
        if (error.code === 'PGRST116') {
          console.log('No settings found, creating default...');
          const { data: newSettings, error: createError } = await supabase
            .from('website_settings')
            .insert({
              enable_notifications: false,
              show_pto_balances: false,
              pto_balances_visible: false,
              color_settings: DEFAULT_COLORS,
              pto_type_visibility: DEFAULT_PTO_VISIBILITY
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating default settings:', createError);
            throw createError;
          }
          
          console.log('Default settings created:', newSettings);
          return newSettings;
        }
        throw error;
      }

      console.log('Settings fetched successfully:', data);
      
      // Ensure color_settings exists and has all required properties
      if (!data.color_settings) {
        console.log('No color_settings found, using defaults');
        data.color_settings = DEFAULT_COLORS;
      } else {
        // Merge with defaults to ensure all properties exist
        data.color_settings = { ...DEFAULT_COLORS, ...data.color_settings };
      }
      
      // Ensure pto_type_visibility exists and has all required properties
      if (!data.pto_type_visibility) {
        console.log('No pto_type_visibility found, using defaults');
        data.pto_type_visibility = DEFAULT_PTO_VISIBILITY;
      } else {
        // Merge with defaults to ensure all properties exist
        data.pto_type_visibility = { ...DEFAULT_PTO_VISIBILITY, ...data.pto_type_visibility };
      }
      
      return data;
    },
    retry: 1,
  });

  // Update color settings when settings load
  useEffect(() => {
    if (settings?.color_settings) {
      console.log('Setting color settings:', settings.color_settings);
      setColorSettings(settings.color_settings);
    }
    if (settings?.pto_type_visibility) {
      console.log('Setting PTO visibility:', settings.pto_type_visibility);
      setPtoVisibility(settings.pto_type_visibility);
    }
  }, [settings]);

  // Update settings mutation with better error handling
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      console.log('Updating settings:', newSettings);
      
      const { data, error } = await supabase
        .from('website_settings')
        .upsert({
          ...newSettings,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error updating settings:', error);
        throw error;
      }
      
      console.log('Settings updated successfully:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website-settings'] });
      toast.success("Settings updated successfully");
    },
    onError: (error) => {
      console.error("Error updating settings:", error);
      toast.error("Failed to update settings");
    },
  });

  const handleToggle = (key: string, value: boolean) => {
    updateSettingsMutation.mutate({
      id: settings?.id,
      [key]: value,
      color_settings: colorSettings,
      pto_type_visibility: ptoVisibility,
    });
  };

  const handlePtoVisibilityToggle = (key: string, value: boolean) => {
    const newPtoVisibility = { ...ptoVisibility, [key]: value };
    setPtoVisibility(newPtoVisibility);
    
    updateSettingsMutation.mutate({
      id: settings?.id,
      pto_type_visibility: newPtoVisibility,
      color_settings: colorSettings,
    });
  };

  // Helper function to convert hex to RGB string
  const hexToRgbString = (hex: string): string => {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Validate hex length
    if (hex.length !== 6) {
      console.warn('Invalid hex length:', hex, 'using default white');
      return '255,255,255';
    }
    
    try {
      // Parse hex values
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      
      // Validate parsed values
      if (isNaN(r) || isNaN(g) || isNaN(b)) {
        console.warn('Invalid hex values:', hex, 'using default white');
        return '255,255,255';
      }
      
      return `${r},${g},${b}`;
    } catch (error) {
      console.error('Error converting hex to RGB:', error, 'hex:', hex);
      return '255,255,255';
    }
  };

  // Helper function to convert RGB string to hex
  const rgbStringToHex = (rgb: string | undefined): string => {
    // If rgb is undefined, return default black
    if (!rgb) {
      console.warn('RGB string is undefined, returning default black');
      return '#000000';
    }
    
    try {
      const parts = rgb.split(',').map(part => parseInt(part.trim()));
      
      // Validate that we have exactly 3 parts and they're all numbers
      if (parts.length !== 3 || parts.some(isNaN)) {
        console.warn('Invalid RGB string:', rgb, 'returning default black');
        return '#000000';
      }
      
      return `#${parts[0].toString(16).padStart(2, '0')}${parts[1].toString(16).padStart(2, '0')}${parts[2].toString(16).padStart(2, '0')}`;
    } catch (error) {
      console.error('Error converting RGB to hex:', error, 'rgb:', rgb);
      return '#000000';
    }
  };

  const handleColorChange = (key: string, value: string) => {
    const rgbValue = hexToRgbString(value);
    const newColors = { ...colorSettings, [key]: rgbValue };
    setColorSettings(newColors);
    
    console.log('Color changed:', { key, value, rgbValue });
    
    // Auto-save color changes
    updateSettingsMutation.mutate({
      id: settings?.id,
      color_settings: newColors,
      pto_type_visibility: ptoVisibility,
    });
  };

  const resetToDefaults = () => {
    console.log('Resetting to default colors and PTO visibility');
    setColorSettings(DEFAULT_COLORS);
    setPtoVisibility(DEFAULT_PTO_VISIBILITY);
    updateSettingsMutation.mutate({
      id: settings?.id,
      color_settings: DEFAULT_COLORS,
      pto_type_visibility: DEFAULT_PTO_VISIBILITY,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading settings...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Website Settings</CardTitle>
          <CardDescription>
            Manage global website settings and feature toggles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Existing toggles */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications-toggle" className="text-base">
                Enable Notifications Feature
              </Label>
              <div className="text-sm text-muted-foreground">
                When disabled, the create notifications feature will be hidden from all users
              </div>
            </div>
            <Switch
              id="notifications-toggle"
              checked={settings?.enable_notifications || false}
              onCheckedChange={(checked) => 
                handleToggle('enable_notifications', checked)
              }
              disabled={updateSettingsMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="pto-toggle" className="text-base">
                Enable PTO Balances
              </Label>
              <div className="text-sm text-muted-foreground">
                When disabled, PTO balances will be hidden and treated as indefinite
              </div>
            </div>
            <Switch
              id="pto-toggle"
              checked={settings?.show_pto_balances || false}
              onCheckedChange={(checked) => 
                handleToggle('show_pto_balances', checked)
              }
              disabled={updateSettingsMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="pto-visibility-toggle" className="text-base">
                Show PTO Balances in Staff Profiles
              </Label>
              <div className="text-sm text-muted-foreground">
                When enabled, PTO balances will be visible in staff profiles (requires PTO Balances to be enabled)
              </div>
            </div>
            <Switch
              id="pto-visibility-toggle"
              checked={settings?.pto_balances_visible || false}
              onCheckedChange={(checked) => 
                handleToggle('pto_balances_visible', checked)
              }
              disabled={updateSettingsMutation.isPending || !settings?.show_pto_balances}
            />
          </div>
        </CardContent>
      </Card>

      {/* NEW: PTO Type Visibility Card */}
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
              onCheckedChange={(checked) => 
                handlePtoVisibilityToggle('show_vacation_pto', checked)
              }
              disabled={updateSettingsMutation.isPending}
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
              onCheckedChange={(checked) => 
                handlePtoVisibilityToggle('show_holiday_pto', checked)
              }
              disabled={updateSettingsMutation.isPending}
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
              onCheckedChange={(checked) => 
                handlePtoVisibilityToggle('show_sick_pto', checked)
              }
              disabled={updateSettingsMutation.isPending}
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
              onCheckedChange={(checked) => 
                handlePtoVisibilityToggle('show_comp_pto', checked)
              }
              disabled={updateSettingsMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Color Customization Card */}
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
              {/* Supervisor PTO */}
              <div className="space-y-2">
                <Label>Supervisor PTO Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.pdf_supervisor_pto_bg)}
                    onChange={(e) => handleColorChange('pdf_supervisor_pto_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.pdf_supervisor_pto_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.pdf_supervisor_pto_bg)}</div>
                  </div>
                </div>
              </div>

              {/* Officer PTO */}
              <div className="space-y-2">
                <Label>Officer PTO Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.pdf_officer_pto_bg)}
                    onChange={(e) => handleColorChange('pdf_officer_pto_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.pdf_officer_pto_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.pdf_officer_pto_bg)}</div>
                  </div>
                </div>
              </div>

              {/* Sick Time */}
              <div className="space-y-2">
                <Label>Sick Time Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.pdf_sick_bg)}
                    onChange={(e) => handleColorChange('pdf_sick_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.pdf_sick_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.pdf_sick_bg)}</div>
                  </div>
                </div>
              </div>

              {/* Off Days */}
              <div className="space-y-2">
                <Label>Off Days Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.pdf_off_day_bg)}
                    onChange={(e) => handleColorChange('pdf_off_day_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.pdf_off_day_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.pdf_off_day_bg)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Weekly Schedule Colors */}
          <div className="space-y-4">
            <h4 className="font-semibold">Weekly Schedule Colors</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Supervisor */}
              <div className="space-y-2">
                <Label>Supervisor Rows Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.weekly_supervisor_bg)}
                    onChange={(e) => handleColorChange('weekly_supervisor_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.weekly_supervisor_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.weekly_supervisor_bg)}</div>
                  </div>
                </div>
              </div>

              {/* Officer */}
              <div className="space-y-2">
                <Label>Officer Rows Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.weekly_officer_bg)}
                    onChange={(e) => handleColorChange('weekly_officer_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.weekly_officer_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.weekly_officer_bg)}</div>
                  </div>
                </div>
              </div>

              {/* PPO */}
              <div className="space-y-2">
                <Label>PPO Rows Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.weekly_ppo_bg)}
                    onChange={(e) => handleColorChange('weekly_ppo_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.weekly_ppo_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.weekly_ppo_bg)}</div>
                  </div>
                </div>
              </div>

              {/* PTO */}
              <div className="space-y-2">
                <Label>PTO Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.weekly_pto_bg)}
                    onChange={(e) => handleColorChange('weekly_pto_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.weekly_pto_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.weekly_pto_bg)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PTO Type Colors */}
          <div className="space-y-4">
            <h4 className="font-semibold">PTO Type Colors</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Vacation */}
              <div className="space-y-2">
                <Label>Vacation Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.pdf_vacation_bg)}
                    onChange={(e) => handleColorChange('pdf_vacation_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.pdf_vacation_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.pdf_vacation_bg)}</div>
                  </div>
                </div>
              </div>

              {/* Sick */}
              <div className="space-y-2">
                <Label>Sick Time Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.pdf_sick_bg)}
                    onChange={(e) => handleColorChange('pdf_sick_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.pdf_sick_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.pdf_sick_bg)}</div>
                  </div>
                </div>
              </div>

              {/* Holiday */}
              <div className="space-y-2">
                <Label>Holiday Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.pdf_holiday_bg)}
                    onChange={(e) => handleColorChange('pdf_holiday_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.pdf_holiday_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.pdf_holiday_bg)}</div>
                  </div>
                </div>
              </div>

              {/* Comp Time */}
              <div className="space-y-2">
                <Label>Comp Time Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.pdf_comp_bg)}
                    onChange={(e) => handleColorChange('pdf_comp_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.pdf_comp_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.pdf_comp_bg)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reset Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={resetToDefaults} disabled={updateSettingsMutation.isPending}>
              Reset to Default Colors
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How These Settings Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <strong>Notifications Feature:</strong> When disabled, the ability to create new notifications 
            will be hidden from the interface. Existing notifications will still be visible.
          </div>
          <div>
            <strong>PTO Balances:</strong> When disabled, all PTO balance tracking is turned off. 
            Staff will have indefinite time off availability, and balance calculations are suspended.
          </div>
          <div>
            <strong>PTO Type Visibility:</strong> Control which types of PTO are displayed in the monthly calendar view. 
            This does not affect PTO assignment or balance tracking.
          </div>
          <div>
            <strong>Color Customization:</strong> Changes to colors will affect both PDF exports and 
            the weekly schedule display. Changes are saved automatically.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
