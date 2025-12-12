// src/components/admin/settings/PTOSettings.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface PTOSettingsProps {
  settings: any;
  handleToggle: (key: string, value: boolean) => void;
  isPending: boolean;
}

export const PTOSettings = ({ settings, handleToggle, isPending }: PTOSettingsProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>PTO Settings</CardTitle>
        <CardDescription>
          Manage PTO balance visibility and tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="pto-toggle" className="text-base">
              Enable PTO Balances
            </Label>
            <div className="text-sm text-muted-foreground">
              When disabled, all PTO balance tracking is turned off and treated as indefinite
            </div>
          </div>
          <Switch
            id="pto-toggle"
            checked={settings?.show_pto_balances || false}
            onCheckedChange={(checked) => handleToggle('show_pto_balances', checked)}
            disabled={isPending}
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
            onCheckedChange={(checked) => handleToggle('pto_balances_visible', checked)}
            disabled={isPending || !settings?.show_pto_balances}
          />
        </div>
      </CardContent>
    </Card>
  );
};
