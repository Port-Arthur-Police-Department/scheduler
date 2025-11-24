// src/components/admin/PasswordResetManager.tsx
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { KeyRound, Search, Loader2 } from "lucide-react";

export const PasswordResetManager = () => {
  const [selectedOfficer, setSelectedOfficer] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all officers
  const { data: officers, isLoading } = useQuery({
    queryKey: ["all-officers-for-password-reset"],
    queryFn: async () => {
      const { data: profilesData, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, rank")
        .order("full_name");

      if (error) throw error;
      return profilesData || [];
    },
  });

  // Filter officers based on search query
  const filteredOfficers = officers?.filter(officer => 
    officer.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    officer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    officer.rank?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Password reset mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOfficer) throw new Error("Please select an officer");
      if (!newPassword) throw new Error("Please enter a new password");

      if (newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      // Get the current user's session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("You must be logged in to reset passwords");
      }

      const response = await fetch('https://ywghefarrcwbnraqyfgk.supabase.co/functions/v1/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId: selectedOfficer,
          newPassword: newPassword
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reset password');
      }

      return result;
    },
    onSuccess: () => {
      toast.success("Password reset successfully");
      setNewPassword("");
      setSelectedOfficer("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reset password");
    },
  });

  const handleResetPassword = () => {
    resetPasswordMutation.mutate();
  };

  const selectedOfficerData = officers?.find(o => o.id === selectedOfficer);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Password Reset
        </CardTitle>
        <CardDescription>
          Reset passwords for officers and staff members
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Bar */}
        <div className="space-y-2">
          <Label htmlFor="officer-search">Search Officers</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="officer-search"
              placeholder="Search by name, email, or rank..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Officer Selection */}
        <div className="space-y-2">
          <Label htmlFor="officer-select">Select Officer</Label>
          <Select value={selectedOfficer} onValueChange={setSelectedOfficer}>
            <SelectTrigger id="officer-select">
              <SelectValue placeholder="Choose an officer to reset password" />
            </SelectTrigger>
            <SelectContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span>Loading officers...</span>
                </div>
              ) : filteredOfficers.length === 0 ? (
                <div className="text-center py-2 text-muted-foreground">
                  No officers found
                </div>
              ) : (
                filteredOfficers.map((officer) => (
                  <SelectItem key={officer.id} value={officer.id}>
                    <div className="flex flex-col">
                      <span>{officer.full_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {officer.email} • {officer.rank}
                      </span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Selected Officer Info */}
        {selectedOfficerData && (
          <div className="p-3 border rounded-lg bg-muted/30">
            <h4 className="font-medium text-sm">Selected Officer:</h4>
            <p className="text-sm">{selectedOfficerData.full_name}</p>
            <p className="text-xs text-muted-foreground">{selectedOfficerData.email}</p>
            <p className="text-xs text-muted-foreground">Rank: {selectedOfficerData.rank}</p>
          </div>
        )}

        {/* New Password Input */}
        <div className="space-y-2">
          <Label htmlFor="new-password">New Password</Label>
          <Input
            id="new-password"
            type="password"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={!selectedOfficer}
          />
          <p className="text-xs text-muted-foreground">
            Password must be at least 6 characters long
          </p>
        </div>

        {/* Reset Button */}
        <Button
          onClick={handleResetPassword}
          disabled={!selectedOfficer || !newPassword || resetPasswordMutation.isPending}
          className="w-full"
        >
          {resetPasswordMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Resetting Password...
            </>
          ) : (
            <>
              <KeyRound className="h-4 w-4 mr-2" />
              Reset Password
            </>
          )}
        </Button>

        {/* Security Notice */}
        <div className="p-3 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
          <h4 className="font-medium text-sm text-amber-800 dark:text-amber-300">
            Security Notice
          </h4>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
            • Passwords are reset immediately after clicking the button
            <br />
            • The officer will need to use the new password on their next login
            <br />
            • Consider notifying the officer about the password change
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
