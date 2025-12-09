// src/components/profile/ChangePassword.tsx
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, Loader2, Eye, EyeOff } from "lucide-react";
import { auditLogger } from "@/lib/auditLogger";

interface ChangePasswordProps {
  userId: string;
  userEmail: string;
  onSuccess?: () => void;
}

export const ChangePassword = ({ userId, userEmail, onSuccess }: ChangePasswordProps) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (!currentPassword) throw new Error("Please enter your current password");
      if (!newPassword) throw new Error("Please enter a new password");
      if (!confirmPassword) throw new Error("Please confirm your new password");

      if (newPassword.length < 6) {
        throw new Error("New password must be at least 6 characters");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("New passwords do not match");
      }

      // First, verify current password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error("Current password is incorrect");
      }

      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Session expired. Please try again.");
      }

      // Update password using the Edge Function
      const response = await fetch('https://ywghefarrcwbnraqyfgk.supabase.co/functions/v1/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId: userId,
          newPassword: newPassword
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to change password');
      }

      // AUDIT LOGGING: Log password change
      await auditLogger.log({
        user_id: userId,
        user_email: userEmail,
        action_type: 'password_change',
        table_name: 'auth.users',
        record_id: userId,
        description: `User changed their own password`,
      });

      return result;
    },
    onSuccess: () => {
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      if (onSuccess) onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to change password");
    },
  });

  const handleChangePassword = () => {
    changePasswordMutation.mutate();
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Change Your Password
        </CardTitle>
        <CardDescription>
          Update your account password. You'll need to enter your current password first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Password */}
        <div className="space-y-2">
          <Label htmlFor="current-password">Current Password</Label>
          <div className="relative">
            <Input
              id="current-password"
              type={showCurrentPassword ? "text" : "password"}
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            >
              {showCurrentPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* New Password */}
        <div className="space-y-2">
          <Label htmlFor="new-password">New Password</Label>
          <div className="relative">
            <Input
              id="new-password"
              type={showNewPassword ? "text" : "password"}
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowNewPassword(!showNewPassword)}
            >
              {showNewPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Password must be at least 6 characters long
          </p>
        </div>

        {/* Confirm New Password */}
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm New Password</Label>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Change Button */}
        <Button
          onClick={handleChangePassword}
          disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
          className="w-full"
        >
          {changePasswordMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Changing Password...
            </>
          ) : (
            <>
              <KeyRound className="h-4 w-4 mr-2" />
              Change Password
            </>
          )}
        </Button>

        {/* Security Notice */}
        <div className="p-3 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
          <h4 className="font-medium text-sm text-amber-800 dark:text-amber-300">
            Security Notice
          </h4>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
            • Your password will be updated immediately
            <br />
            • You'll need to use the new password on your next login
            <br />
            • Make sure to remember your new password
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
