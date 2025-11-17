// components/settings/WebsiteSettings.tsx - UPDATED WITH COLOR CUSTOMIZATION
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
import { ColorPicker } from "@/components/ui/color-picker"; // You'll need to create this component

// Default color scheme
const DEFAULT_COLORS = {
  // PDF Export Colors
  pdf_supervisor_pto_bg: "255,255,200", // Light yellow
  pdf_supervisor_pto_border: "255,220,100", // Golden yellow
  pdf_supervisor_pto_text: "139,69,19", // Brown
  
  pdf_officer_pto_bg: "240,255,240", // Light green
  pdf_officer_pto_border: "144,238,144", // Green
  pdf_officer_pto_text: "0,100,0", // Dark green
  
  pdf_sick_time_bg: "255,200,200", // Light red
  pdf_sick_time_border: "255,100,100", // Red
  pdf_sick_time_text: "139,0,0", // Dark red
  
  pdf_off_day_bg: "220,220,220", // Gray
  pdf_off_day_text: "100,100,100", // Dark gray
  
  // Weekly Schedule Colors
  weekly_supervisor_bg: "240,249,255", // Light blue
  weekly_supervisor_text: "0,75,150", // Dark blue
  
  weekly_officer_bg: "240,255,240", // Light green
  weekly_officer_text: "0,100,0", // Dark green
  
  weekly_ppo_bg: "255,250,240", // Light orange
  weekly_ppo_text: "150,75,0", // Dark orange
  
  weekly_pto_bg: "144,238,144", // Light green
  weekly_pto_text: "0,100,0", // Dark green
  
  weekly_sick_bg: "255,200,200", // Light red
  weekly_sick_text: "139,0,0", // Dark red
  
  weekly_off_bg: "240,240,240", // Light gray
  weekly_off_text: "100,100,100", // Dark gray
};

export const WebsiteSettings = () => {
  const queryClient = useQueryClient();
  const [colorSettings, setColorSettings] = useState(DEFAULT_COLORS);

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['website-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('website_settings')
        .select('*')
        .single();

      if (error) {
        // If no settings exist yet, return default values
        if (error.code === 'PGRST116') {
          return {
            enable_notifications: false,
            show_pto_balances: false,
            pto_balances_visible: false,
            color_settings: DEFAULT_COLORS
          };
        }
        throw error;
      }
      return data;
    },
  });

  // Update color settings when settings load
  useEffect(() => {
    if (settings?.color_settings) {
      setColorSettings(settings.color_settings);
    }
  }, [settings]);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      const { data, error } = await supabase
        .from('website_settings')
        .upsert(newSettings)
        .select()
        .single();

      if (error) throw error;
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
      updated_at: new Date().toISOString(),
    });
  };

  const handleColorChange = (key: string, value: string) => {
    const newColors = { ...colorSettings, [key]: value };
    setColorSettings(newColors);
    
    // Auto-save color changes
    updateSettingsMutation.mutate({
      id: settings?.id,
      color_settings: newColors,
      updated_at: new Date().toISOString(),
    });
  };

  const resetToDefaults = () => {
    setColorSettings(DEFAULT_COLORS);
    updateSettingsMutation.mutate({
      id: settings?.id,
      color_settings: DEFAULT_COLORS,
      updated_at: new Date().toISOString(),
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
                <Label>Supervisor PTO</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={`#${colorSettings.pdf_supervisor_pto_bg.split(',').map(c => parseInt(c).toString(16).padStart(2, '0')).join('')}`}
                    onChange={(e) => handleColorChange('pdf_supervisor_pto_bg', e.target.value.replace('#', '').match(/.{2}/g)?.map(hex => parseInt(hex, 16)).join(',') || '255,255,200')}
                    className="w-12 h-10"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">Background</div>
                    <div className="text-sm">{colorSettings.pdf_supervisor_pto_bg}</div>
                  </div>
                </div>
              </div>

              {/* Officer PTO */}
              <div className="space-y-2">
                <Label>Officer PTO</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={`#${colorSettings.pdf_officer_pto_bg.split(',').map(c => parseInt(c).toString(16).padStart(2, '0')).join('')}`}
                    onChange={(e) => handleColorChange('pdf_officer_pto_bg', e.target.value.replace('#', '').match(/.{2}/g)?.map(hex => parseInt(hex, 16)).join(',') || '240,255,240')}
                    className="w-12 h-10"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">Background</div>
                    <div className="text-sm">{colorSettings.pdf_officer_pto_bg}</div>
                  </div>
                </div>
              </div>

              {/* Sick Time */}
              <div className="space-y-2">
                <Label>Sick Time</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={`#${colorSettings.pdf_sick_time_bg.split(',').map(c => parseInt(c).toString(16).padStart(2, '0')).join('')}`}
                    onChange={(e) => handleColorChange('pdf_sick_time_bg', e.target.value.replace('#', '').match(/.{2}/g)?.map(hex => parseInt(hex, 16)).join(',') || '255,200,200')}
                    className="w-12 h-10"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">Background</div>
                    <div className="text-sm">{colorSettings.pdf_sick_time_bg}</div>
                  </div>
                </div>
              </div>

              {/* Off Days */}
              <div className="space-y-2">
                <Label>Off Days</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={`#${colorSettings.pdf_off_day_bg.split(',').map(c => parseInt(c).toString(16).padStart(2, '0')).join('')}`}
                    onChange={(e) => handleColorChange('pdf_off_day_bg', e.target.value.replace('#', '').match(/.{2}/g)?.map(hex => parseInt(hex, 16)).join(',') || '220,220,220')}
                    className="w-12 h-10"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">Background</div>
                    <div className="text-sm">{colorSettings.pdf_off_day_bg}</div>
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
                <Label>Supervisor Rows</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={`#${colorSettings.weekly_supervisor_bg.split(',').map(c => parseInt(c).toString(16).padStart(2, '0')).join('')}`}
                    onChange={(e) => handleColorChange('weekly_supervisor_bg', e.target.value.replace('#', '').match(/.{2}/g)?.map(hex => parseInt(hex, 16)).join(',') || '240,249,255')}
                    className="w-12 h-10"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">Background</div>
                    <div className="text-sm">{colorSettings.weekly_supervisor_bg}</div>
                  </div>
                </div>
              </div>

              {/* Officer */}
              <div className="space-y-2">
                <Label>Officer Rows</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={`#${colorSettings.weekly_officer_bg.split(',').map(c => parseInt(c).toString(16).padStart(2, '0')).join('')}`}
                    onChange={(e) => handleColorChange('weekly_officer_bg', e.target.value.replace('#', '').match(/.{2}/g)?.map(hex => parseInt(hex, 16)).join(',') || '240,255,240')}
                    className="w-12 h-10"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">Background</div>
                    <div className="text-sm">{colorSettings.weekly_officer_bg}</div>
                  </div>
                </div>
              </div>

              {/* PPO */}
              <div className="space-y-2">
                <Label>PPO Rows</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={`#${colorSettings.weekly_ppo_bg.split(',').map(c => parseInt(c).toString(16).padStart(2, '0')).join('')}`}
                    onChange={(e) => handleColorChange('weekly_ppo_bg', e.target.value.replace('#', '').match(/.{2}/g)?.map(hex => parseInt(hex, 16)).join(',') || '255,250,240')}
                    className="w-12 h-10"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">Background</div>
                    <div className="text-sm">{colorSettings.weekly_ppo_bg}</div>
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
            <strong>Color Customization:</strong> Changes to colors will affect both PDF exports and 
            the weekly schedule display. Changes are saved automatically.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
