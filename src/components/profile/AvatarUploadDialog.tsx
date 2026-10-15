// src/components/profile/AvatarUploadDialog.tsx
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Upload, User, Image as ImageIcon } from "lucide-react";
import { auditLogger } from "@/lib/auditLogger";

interface AvatarUploadDialogProps {
  userId: string;
  userEmail: string;
  currentAvatarUrl?: string;
  currentFullName?: string;
  onSuccess?: () => void;
  children?: React.ReactNode;
}

export const AvatarUploadDialog = ({
  userId,
  userEmail,
  currentAvatarUrl,
  currentFullName,
  onSuccess,
  children,
}: AvatarUploadDialogProps) => {
  const [open, setOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl || "");
  const [uploading, setUploading] = useState(false);

  const updateAvatarMutation = useMutation({
    mutationFn: async (newAvatarUrl: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: newAvatarUrl || null })
        .eq("id", userId);

      if (error) throw error;

      await auditLogger.log({
        user_id: userId,
        user_email: userEmail,
        action_type: 'profile_update',
        table_name: 'profiles',
        record_id: userId,
        description: `User updated profile avatar`,
      });

      return newAvatarUrl;
    },
    onSuccess: () => {
      toast.success("Profile picture updated successfully");
      setOpen(false);
      if (onSuccess) onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update profile picture");
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to lesson-photos or a dedicated avatars bucket (falling back to lesson-photos or public storage)
      const { error: uploadError } = await supabase.storage
        .from('lesson-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('lesson-photos')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      updateAvatarMutation.mutate(publicUrl);
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload image. You can also paste an image URL directly.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateAvatarMutation.mutate(avatarUrl.trim());
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Picture
          </DialogTitle>
          <DialogDescription>
            Upload a photo or enter an image URL to use as your profile avatar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="flex flex-col items-center justify-center gap-4">
            <Avatar className="h-24 w-24 border-2 border-primary/20 shadow-md">
              <AvatarImage src={avatarUrl} alt={currentFullName || "User"} />
              <AvatarFallback className="text-xl bg-primary/10 text-primary font-bold">
                {getInitials(currentFullName)}
              </AvatarFallback>
            </Avatar>

            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <Button type="button" variant="outline" disabled={uploading} asChild>
                  <span>
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Upload Image
                  </span>
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>
              {avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    setAvatarUrl("");
                    updateAvatarMutation.mutate("");
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatar-url">Image URL</Label>
            <div className="flex gap-2">
              <Input
                id="avatar-url"
                placeholder="https://example.com/avatar.jpg"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Paste a direct link to an image or upload one from your device.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateAvatarMutation.isPending || uploading}>
              {updateAvatarMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Save Avatar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
