import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

export const WebsiteSettings = () => {
  const queryClient = useQueryClient();

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
            pto_balances_visible: false
          };
        }
        throw error;
      }
      return data;
    },
  });

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
          {/* Notifications Feature Toggle */}
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

          {/* PTO Balances Toggle */}
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

          {/* PTO Visibility Toggle */}
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

          {/* Status */}
          <div className="pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              <strong>Current Status:</strong>
              <div className="mt-1 space-y-1">
                <div>• Notifications: {settings?.enable_notifications ? 'Enabled' : 'Disabled'}</div>
                <div>• PTO Balances: {settings?.show_pto_balances ? 'Enabled' : 'Disabled'}</div>
                <div>• PTO Visibility: {settings?.pto_balances_visible ? 'Visible' : 'Hidden'}</div>
              </div>
            </div>
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
            <strong>PTO Visibility:</strong> Controls whether PTO balances are shown in staff profiles. 
            This only works when PTO Balances are enabled.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
