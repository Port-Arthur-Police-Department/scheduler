import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Award, KeyRound, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useWebsiteSettings } from "@/hooks/useWebsiteSettings";

interface OfficerProfileDialogProps {
  officer: {
    id: string;
    full_name: string;
    email: string;
    phone?: string | null;
    badge_number?: string | null;
    hire_date?: string | null;
    service_credit_override?: number | null;
    vacation_hours?: number | null;
    sick_hours?: number | null;
    comp_hours?: number | null;
    holiday_hours?: number | null;
    rank?: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const OfficerProfileDialog = ({ officer, open, onOpenChange }: OfficerProfileDialogProps) => {
  const queryClient = useQueryClient();
  const isEditing = officer !== null;
  
  // Add website settings hook
  const { data: settings } = useWebsiteSettings();
  
  // Initialize state with defaults or existing officer data
  const [hireDate, setHireDate] = useState<Date | undefined>(
    officer?.hire_date ? new Date(officer.hire_date) : undefined
  );
  const [serviceCreditOverride, setServiceCreditOverride] = useState<string>(
    officer?.service_credit_override?.toString() || ""
  );
  const [calculatedCredit, setCalculatedCredit] = useState<number>(0);
  const [formData, setFormData] = useState({
    full_name: officer?.full_name || "",
    email: officer?.email || "",
    phone: officer?.phone || "",
    badge_number: officer?.badge_number || "",
    rank: officer?.rank || "Officer",
    vacation_hours: officer?.vacation_hours?.toString() || "0",
    sick_hours: officer?.sick_hours?.toString() || "0",
    comp_hours: officer?.comp_hours?.toString() || "0",
    holiday_hours: officer?.holiday_hours?.toString() || "0",
  });
  const [newPassword, setNewPassword] = useState("");

  // Reset form when dialog opens/closes or officer changes
  useEffect(() => {
    if (open) {
      setHireDate(officer?.hire_date ? new Date(officer.hire_date) : undefined);
      setServiceCreditOverride(officer?.service_credit_override?.toString() || "");
      setFormData({
        full_name: officer?.full_name || "",
        email: officer?.email || "",
        phone: officer?.phone || "",
        badge_number: officer?.badge_number || "",
        rank: officer?.rank || "Officer",
        vacation_hours: officer?.vacation_hours?.toString() || "0",
        sick_hours: officer?.sick_hours?.toString() || "0",
        comp_hours: officer?.comp_hours?.toString() || "0",
        holiday_hours: officer?.holiday_hours?.toString() || "0",
      });
      setNewPassword("");
      
      // Only fetch service credit for existing officers
      if (officer?.id) {
        fetchServiceCredit();
      } else {
        setCalculatedCredit(0);
      }
    }
  }, [open, officer]);

  const fetchServiceCredit = async () => {
    if (!officer?.id) return;
    
    const { data } = await supabase.rpc("get_service_credit", {
      profile_id: officer.id,
    });
    setCalculatedCredit(data || 0);
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!officer?.id) throw new Error("No officer ID provided");
      
      // Prepare profile data
      const profileData: any = {
        full_name: data.full_name,
        email: data.email,
        phone: data.phone || null,
        badge_number: data.badge_number || null,
        rank: data.rank as "Officer" | "Sergeant" | "Lieutenant" | "Deputy Chief" | "Chief",
        hire_date: hireDate ? format(hireDate, "yyyy-MM-dd") : null,
        service_credit_override: serviceCreditOverride ? Number(serviceCreditOverride) : null,
      };

      // Only include PTO balances if they are enabled in settings
      if (settings?.show_pto_balances) {
        profileData.vacation_hours = Number(data.vacation_hours) || 0;
        profileData.sick_hours = Number(data.sick_hours) || 0;
        profileData.comp_hours = Number(data.comp_hours) || 0;
        profileData.holiday_hours = Number(data.holiday_hours) || 0;
      }

      // Update profile
      const { error } = await supabase
        .from("profiles")
        .update(profileData)
        .eq("id", officer.id);

      if (error) throw error;

      // Update user role based on new rank
      const getRoleFromRank = (rank: string): "admin" | "officer" | "supervisor" => {
        const rankLower = rank.toLowerCase();
        if (rankLower === 'chief' || rankLower === 'deputy chief') return 'admin';
        if (rankLower === 'sergeant' || rankLower === 'lieutenant') return 'supervisor';
        return 'officer';
      };

      const newRole = getRoleFromRank(data.rank);
      
      // Update the user_roles table
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role: newRole as any })
        .eq('user_id', officer.id);

      if (roleError) {
        console.error('Failed to update role:', roleError);
        // Don't throw - the profile was updated successfully, just role update failed
      }
    },
    onSuccess: () => {
      toast.success("Profile updated successfully");
      queryClient.invalidateQueries({ queryKey: ["all-officers"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update profile");
    },
  });

  const createProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Prepare profile data
      const profileData: any = {
        email: data.email,
        full_name: data.full_name,
        phone: data.phone,
        badge_number: data.badge_number,
        rank: data.rank,
        hire_date: hireDate ? format(hireDate, "yyyy-MM-dd") : null,
        service_credit_override: serviceCreditOverride ? Number(serviceCreditOverride) : null,
      };

      // Only include PTO balances if they are enabled in settings
      if (settings?.show_pto_balances) {
        profileData.vacation_hours = Number(data.vacation_hours) || 0;
        profileData.sick_hours = Number(data.sick_hours) || 0;
        profileData.comp_hours = Number(data.comp_hours) || 0;
        profileData.holiday_hours = Number(data.holiday_hours) || 0;
      }

      const response = await fetch('https://ywghefarrcwbnraqyfgk.supabase.co/functions/v1/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user')
      }
      
      return result
    },
    onSuccess: (result) => {
      toast.success(result.message || "Profile created successfully");
      queryClient.invalidateQueries({ queryKey: ["all-officers"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  })

  const updatePasswordMutation = useMutation({
    mutationFn: async () => {
      if (!officer?.id) throw new Error("No officer ID provided");
      if (!newPassword) throw new Error("New password is required");

      if (newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      // Get the current user's session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("You must be logged in to update passwords");
      }

      const response = await fetch('https://ywghefarrcwbnraqyfgk.supabase.co/functions/v1/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId: officer.id,
          newPassword: newPassword
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update password');
      }

      return result;
    },
    onSuccess: () => {
      toast.success("Password updated successfully");
      setNewPassword("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update password");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.email) {
      toast.error("Name and email are required");
      return;
    }

    if (isEditing) {
      updateProfileMutation.mutate(formData);
    } else {
      createProfileMutation.mutate(formData);
    }
  };

  const handlePasswordUpdate = () => {
    if (newPassword) {
      updatePasswordMutation.mutate();
    } else {
      toast.error("Please enter a new password");
    }
  };

  const isPending = updateProfileMutation.isPending || createProfileMutation.isPending || updatePasswordMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Officer Profile" : "Create New Officer Profile"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update officer information" : "Create a new officer profile"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="badge_number">Badge Number</Label>
            <Input
              id="badge_number"
              value={formData.badge_number}
              onChange={(e) => setFormData({ ...formData, badge_number: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rank">Rank</Label>
            <Select
              value={formData.rank}
              onValueChange={(value) => setFormData({ ...formData, rank: value })}
            >
              <SelectTrigger id="rank">
                <SelectValue placeholder="Select rank" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Probationary">Probationary</SelectItem>
                <SelectItem value="Officer">Officer</SelectItem>
                <SelectItem value="Sergeant">Sergeant</SelectItem>
                <SelectItem value="Lieutenant">Lieutenant</SelectItem>
                <SelectItem value="Deputy Chief">Deputy Chief</SelectItem>
                <SelectItem value="Chief">Chief</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Hire Date</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={hireDate ? format(hireDate, "yyyy-MM-dd") : ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value) {
                    // Parse date as local time to avoid timezone issues
                    const [year, month, day] = value.split('-').map(Number);
                    setHireDate(new Date(year, month - 1, day));
                  } else {
                    setHireDate(undefined);
                  }
                }}
                max={format(new Date(), "yyyy-MM-dd")}
                className="flex-1"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                  >
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={hireDate}
                    onSelect={setHireDate}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="service_credit_override" className="flex items-center gap-2">
                <Award className="h-4 w-4" />
                Service Credit Adjustment (Years)
              </Label>
              <Input
                id="service_credit_override"
                type="number"
                placeholder="0 (no adjustment)"
                value={serviceCreditOverride}
                onChange={(e) => setServiceCreditOverride(e.target.value)}
                step="0.1"
              />
              <p className="text-sm text-muted-foreground">
                {hireDate ? (
                  <>
                    Calculated from hire date: <strong>{(calculatedCredit - (Number(serviceCreditOverride) || 0)).toFixed(1)} years</strong>
                    {serviceCreditOverride && ` + adjustment (${Number(serviceCreditOverride).toFixed(1)}) = ${calculatedCredit.toFixed(1)} years total`}
                  </>
                ) : (
                  <>Current service credit: <strong>{calculatedCredit.toFixed(1)} years</strong></>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Enter positive values to add credit, negative to deduct (e.g., -2 to subtract 2 years)
              </p>
            </div>
          )}

          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                New Password
              </Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handlePasswordUpdate}
                disabled={updatePasswordMutation.isPending}
              >
                {updatePasswordMutation.isPending ? "Updating..." : "Update Password"}
              </Button>
            </div>
          )}

          {/* PTO Balances Section - Conditionally Rendered */}
          {settings?.show_pto_balances ? (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                PTO Balances
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="vacation_hours">Vacation Hours</Label>
                  <Input
                    id="vacation_hours"
                    type="number"
                    value={formData.vacation_hours}
                    onChange={(e) => setFormData({ ...formData, vacation_hours: e.target.value })}
                    step="0.5"
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sick_hours">Sick Hours</Label>
                  <Input
                    id="sick_hours"
                    type="number"
                    value={formData.sick_hours}
                    onChange={(e) => setFormData({ ...formData, sick_hours: e.target.value })}
                    step="0.5"
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comp_hours">Comp Hours</Label>
                  <Input
                    id="comp_hours"
                    type="number"
                    value={formData.comp_hours}
                    onChange={(e) => setFormData({ ...formData, comp_hours: e.target.value })}
                    step="0.5"
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="holiday_hours">Holiday Hours</Label>
                  <Input
                    id="holiday_hours"
                    type="number"
                    value={formData.holiday_hours}
                    onChange={(e) => setFormData({ ...formData, holiday_hours: e.target.value })}
                    step="0.5"
                    min="0"
                  />
                </div>
              </div>
            </div>
          ) : (
            // Show message when PTO balances are disabled
            <div className="p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <div>
                  <p className="text-sm font-medium">PTO Management</p>
                  <p className="text-xs">PTO balances are currently managed as indefinite</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : (isEditing ? "Save Changes" : "Create Profile")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
