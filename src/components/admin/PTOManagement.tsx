import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, Plus, Minus, Award, CalendarClock, Settings, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWebsiteSettings } from "@/hooks/useWebsiteSettings";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const PTOManagement = () => {
  const [selectedOfficer, setSelectedOfficer] = useState<string>("");
  const [ptoType, setPtoType] = useState<string>("vacation");
  const [hours, setHours] = useState<string>("");
  const [operation, setOperation] = useState<"add" | "subtract">("add");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<{ id: string; hours: string } | null>(null);
  const queryClient = useQueryClient();

  // Add website settings hook
  const { data: settings } = useWebsiteSettings();

  const { data: officers } = useQuery({
    queryKey: ["officers-pto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, badge_number, sick_hours, comp_hours, vacation_hours, holiday_hours, hire_date, service_credit_override");

      if (error) throw error;

      // Calculate service credit for each officer
      const officersWithCredit = await Promise.all(
        data.map(async (officer) => {
          const { data: creditData } = await supabase.rpc("get_service_credit", {
            profile_id: officer.id,
          });
          return {
            ...officer,
            service_credit: creditData || 0,
          };
        })
      );

      // Sort by last name
      return officersWithCredit.sort((a, b) => {
        const lastNameA = a.full_name.split(' ').pop()?.toLowerCase() || '';
        const lastNameB = b.full_name.split(' ').pop()?.toLowerCase() || '';
        return lastNameA.localeCompare(lastNameB);
      });
    },
  });

  const updatePTOMutation = useMutation({
    mutationFn: async () => {
      if (!settings?.show_pto_balances) {
        throw new Error("PTO balances are currently disabled in website settings");
      }

      if (!selectedOfficer || !hours || isNaN(Number(hours))) {
        throw new Error("Please fill in all fields with valid numbers");
      }

      const officer = officers?.find(o => o.id === selectedOfficer);
      if (!officer) throw new Error("Officer not found");

      const hoursValue = Number(hours);
      const adjustment = operation === "add" ? hoursValue : -hoursValue;

      const currentBalance = officer[`${ptoType}_hours` as keyof typeof officer] as number || 0;
      const newBalance = currentBalance + adjustment;

      if (newBalance < 0) {
        throw new Error(`Insufficient ${ptoType} hours balance`);
      }

      const { error } = await supabase
        .from("profiles")
        .update({ [`${ptoType}_hours`]: newBalance })
        .eq("id", selectedOfficer);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["officers-pto"] });
      toast.success("PTO balance updated successfully");
      setDialogOpen(false);
      setSelectedOfficer("");
      setHours("");
      setPtoType("vacation");
      setOperation("add");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const { data: accrualRules } = useQuery({
    queryKey: ["pto-accrual-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pto_accrual_rules")
        .select("*")
        .order("rule_type", { ascending: true })
        .order("service_credit_min", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const accrueAllSickTimeMutation = useMutation({
    mutationFn: async () => {
      if (!settings?.show_pto_balances) {
        throw new Error("PTO balances are currently disabled in website settings");
      }

      const { error } = await supabase.rpc("accrue_sick_time");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["officers-pto"] });
      toast.success("Sick time accrued for all officers");
    },
    onError: (error: Error) => {
      toast.error("Failed to accrue sick time: " + error.message);
    },
  });

  const accrueAnnualPTOMutation = useMutation({
    mutationFn: async () => {
      if (!settings?.show_pto_balances) {
        throw new Error("PTO balances are currently disabled in website settings");
      }

      const { error } = await supabase.rpc("accrue_annual_pto");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["officers-pto"] });
      toast.success("Annual PTO accrued for all officers");
    },
    onError: (error: Error) => {
      toast.error("Failed to accrue annual PTO: " + error.message);
    },
  });

  const updateAccrualRuleMutation = useMutation({
    mutationFn: async ({ id, hours }: { id: string; hours: number }) => {
      const { error } = await supabase
        .from("pto_accrual_rules")
        .update({ hours_to_accrue: hours, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pto-accrual-rules"] });
      toast.success("Accrual rule updated successfully");
      setEditingRule(null);
    },
    onError: (error: Error) => {
      toast.error("Failed to update rule: " + error.message);
    },
  });

  const holidayRule = accrualRules?.find(r => r.rule_type === "holiday");
  const vacationRules = accrualRules?.filter(r => r.rule_type === "vacation") || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              PTO Management
            </CardTitle>
            <CardDescription>Manage officer PTO balances and accrual rules</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setRulesDialogOpen(true)} variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Accrual Rules
            </Button>
            <Button 
              onClick={() => accrueAllSickTimeMutation.mutate()} 
              variant="outline" 
              size="sm"
              disabled={!settings?.show_pto_balances}
            >
              Accrue Sick Time (All)
            </Button>
            <Button 
              onClick={() => setDialogOpen(true)} 
              size="sm"
              disabled={!settings?.show_pto_balances}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adjust PTO
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Warning Alert when PTO is disabled */}
        {!settings?.show_pto_balances && (
          <Alert className="mb-4 bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              PTO balances are currently disabled in website settings. PTO management features are unavailable.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {officers?.map((officer) => (
            <div key={officer.id} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium">{officer.full_name}</p>
                  <p className="text-sm text-muted-foreground">Badge #{officer.badge_number}</p>
                </div>
              </div>
              <div className={`grid gap-4 ${settings?.show_pto_balances ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-1 md:grid-cols-2'}`}>
                {settings?.show_pto_balances ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Vacation</p>
                      <p className="text-lg font-semibold">{officer.vacation_hours || 0}h</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Sick</p>
                      <p className="text-lg font-semibold">{officer.sick_hours || 0}h</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Comp</p>
                      <p className="text-lg font-semibold">{officer.comp_hours || 0}h</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Holiday</p>
                      <p className="text-lg font-semibold">{officer.holiday_hours || 0}h</p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">PTO Status</p>
                    <p className="text-lg font-semibold text-muted-foreground">Indefinite</p>
                    <p className="text-xs text-muted-foreground">PTO balances are currently disabled</p>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Award className="h-3 w-3" />
                    Service Credit
                  </p>
                  <div className="space-y-0.5">
                    <p className="text-lg font-semibold">{officer.service_credit?.toFixed(1) || 0} yrs</p>
                    {officer.hire_date && (
                      <p className="text-xs text-muted-foreground">
                        Since {format(new Date(officer.hire_date), "MMM yyyy")}
                      </p>
                    )}
                    {officer.service_credit_override !== null && (
                      <p className="text-xs text-amber-600 dark:text-amber-500">
                        (Adjusted {officer.service_credit_override > 0 ? '+' : ''}{officer.service_credit_override.toFixed(1)} yrs)
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust PTO Balance</DialogTitle>
            <DialogDescription>Add or subtract PTO hours for an officer</DialogDescription>
          </DialogHeader>

          {!settings?.show_pto_balances ? (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                PTO balances are currently disabled in website settings. You cannot adjust PTO balances at this time.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Officer</Label>
                <Select value={selectedOfficer} onValueChange={setSelectedOfficer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select officer" />
                  </SelectTrigger>
                  <SelectContent>
                    {officers?.map((officer) => (
                      <SelectItem key={officer.id} value={officer.id}>
                        {officer.full_name} (#{officer.badge_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>PTO Type</Label>
                <Select value={ptoType} onValueChange={setPtoType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vacation">Vacation</SelectItem>
                    <SelectItem value="sick">Sick</SelectItem>
                    <SelectItem value="comp">Comp Time</SelectItem>
                    <SelectItem value="holiday">Holiday</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Operation</Label>
                <div className="flex gap-2">
                  <Button
                    variant={operation === "add" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setOperation("add")}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                  <Button
                    variant={operation === "subtract" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setOperation("subtract")}
                  >
                    <Minus className="h-4 w-4 mr-2" />
                    Subtract
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Hours</Label>
                <Input
                  type="number"
                  placeholder="Enter hours"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  min="0"
                  step="0.5"
                />
              </div>

              <Button
                className="w-full"
                onClick={() => updatePTOMutation.mutate()}
                disabled={updatePTOMutation.isPending}
              >
                {updatePTOMutation.isPending ? "Updating..." : "Update PTO Balance"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rulesDialogOpen} onOpenChange={setRulesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Annual PTO Accrual Rules
            </DialogTitle>
            <DialogDescription>
              Configure automatic PTO accrual at the beginning of each year
            </DialogDescription>
          </DialogHeader>

          {!settings?.show_pto_balances ? (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                PTO balances are currently disabled in website settings. Accrual rules cannot be modified at this time.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Holiday Hours</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Same amount for all officers regardless of service credit
                  </p>
                  {holidayRule && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={editingRule?.id === holidayRule.id ? editingRule.hours : holidayRule.hours_to_accrue}
                        onChange={(e) => setEditingRule({ id: holidayRule.id, hours: e.target.value })}
                        className="w-32"
                        step="1"
                      />
                      <span className="text-sm">hours/year</span>
                      {editingRule?.id === holidayRule.id && (
                        <Button
                          size="sm"
                          onClick={() => updateAccrualRuleMutation.mutate({ 
                            id: holidayRule.id, 
                            hours: Number(editingRule.hours) 
                          })}
                          disabled={updateAccrualRuleMutation.isPending}
                        >
                          Save
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Vacation Hours by Service Credit</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Based on years of service credit
                  </p>
                  <div className="space-y-3">
                    {vacationRules.map((rule) => {
                      const tierLabel = rule.service_credit_max 
                        ? `${rule.service_credit_min}-${Math.floor(rule.service_credit_max)} years`
                        : `${rule.service_credit_min}+ years`;
                      
                      return (
                        <div key={rule.id} className="flex items-center gap-2 p-3 border rounded-lg">
                          <span className="text-sm font-medium w-32">{tierLabel}</span>
                          <Input
                            type="number"
                            value={editingRule?.id === rule.id ? editingRule.hours : rule.hours_to_accrue}
                            onChange={(e) => setEditingRule({ id: rule.id, hours: e.target.value })}
                            className="w-32"
                            step="1"
                          />
                          <span className="text-sm">hours/year</span>
                          {editingRule?.id === rule.id && (
                            <Button
                              size="sm"
                              onClick={() => updateAccrualRuleMutation.mutate({ 
                                id: rule.id, 
                                hours: Number(editingRule.hours) 
                              })}
                              disabled={updateAccrualRuleMutation.isPending}
                            >
                              Save
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button
                  className="w-full"
                  onClick={() => accrueAnnualPTOMutation.mutate()}
                  disabled={accrueAnnualPTOMutation.isPending}
                >
                  <CalendarClock className="h-4 w-4 mr-2" />
                  {accrueAnnualPTOMutation.isPending ? "Processing..." : "Run Annual PTO Accrual Now"}
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  This will add PTO to all officers based on the rules above
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
