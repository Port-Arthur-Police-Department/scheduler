// components/admin/UnderstaffedDetection.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Mail, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { getScheduleData } from "@/components/schedule/DailyScheduleView";
import { useUnderstaffedDetection } from "@/hooks/useUnderstaffedDetection";
import { useWebsiteSettings } from "@/hooks/useWebsiteSettings";

export const UnderstaffedDetection = () => {
  const queryClient = useQueryClient();
  const [selectedShiftId, setSelectedShiftId] = useState<string>("all");

  // Add website settings query
  const { data: websiteSettings } = useWebsiteSettings();
  const notificationsEnabled = websiteSettings?.enable_notifications || false;


  // Get all shift types for the dropdown
  const { data: shiftTypes } = useQuery({
    queryKey: ["shift-types-for-detection"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_types")
        .select("*")
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  // Get existing vacancy alerts to check which ones already exist
  const { data: existingAlerts } = useQuery({
    queryKey: ["existing-vacancy-alerts"],
    queryFn: async () => {
      const today = new Date();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(today.getDate() + 7);

      const { data, error } = await supabase
        .from("vacancy_alerts")
        .select("*")
        .gte("date", format(today, "yyyy-MM-dd"))
        .lte("date", format(sevenDaysFromNow, "yyyy-MM-dd"));

      if (error) throw error;
      return data || [];
    },
  });



// THEN REPLACE the query with:
const { 
  data: understaffedShifts, 
  isLoading, 
  error,
  refetch
} = useUnderstaffedDetection(selectedShiftId);

  // Create vacancy alert mutation
  const createAlertMutation = useMutation({
    mutationFn: async (shift: any) => {
      // Calculate how many positions are needed
      const supervisorsNeeded = shift.isSupervisorsUnderstaffed 
        ? shift.min_supervisors - shift.current_supervisors 
        : 0;
      const officersNeeded = shift.isOfficersUnderstaffed 
        ? shift.min_officers - shift.current_officers 
        : 0;

      // Determine position type
      let positionType = "";
      if (supervisorsNeeded > 0 && officersNeeded > 0) {
        positionType = `${supervisorsNeeded} Supervisor(s), ${officersNeeded} Officer(s)`;
      } else if (supervisorsNeeded > 0) {
        positionType = `${supervisorsNeeded} Supervisor(s)`;
      } else {
        positionType = `${officersNeeded} Officer(s)`;
      }

      const { data, error } = await supabase
        .from("vacancy_alerts")
        .insert({
          shift_type_id: shift.shift_type_id,
          date: shift.date,
          current_staffing: shift.current_staffing,
          minimum_required: shift.minimum_required,
          status: "open"
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, shift) => {
      toast.success(`Alert created for ${shift.shift_types?.name} on ${format(new Date(shift.date), "MMM d")}`);
      queryClient.invalidateQueries({ queryKey: ["existing-vacancy-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["vacancy-alerts"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create alert");
    }
  });

  // Send notification mutation
  const sendAlertMutation = useMutation({
    mutationFn: async (shift: any) => {
      // Find the existing alert
      const alert = existingAlerts?.find(
        (a: any) => a.date === shift.date && a.shift_type_id === shift.shift_type_id
      );

      if (!alert) {
        throw new Error("Alert not found. Please create the alert first.");
      }

      // Get all supervisors and admins to notify
      const { data: usersToNotify, error: usersError } = await supabase
        .from("profiles")
        .select("id")
        .or("role.eq.supervisor,role.eq.admin");

      if (usersError) throw usersError;

      // Create notifications for each user
      const notifications = usersToNotify.map((user: any) => ({
        user_id: user.id,
        type: "vacancy_alert",
        title: `Understaffed: ${shift.shift_types?.name}`,
        message: `${shift.shift_types?.name} on ${format(new Date(shift.date), "MMM d, yyyy")} needs ${shift.minimum_required - shift.current_staffing} more officer(s)`,
        read: false
      }));

      const { error: notifError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notifError) throw notifError;

      // Update alert status
      const { error: updateError } = await supabase
        .from("vacancy_alerts")
        .update({ 
          status: "notified",
          updated_at: new Date().toISOString()
        })
        .eq("id", alert.id);

      if (updateError) throw updateError;

      return alert;
    },
    onSuccess: (data, shift) => {
      toast.success(`Notifications sent for ${shift.shift_types?.name} on ${format(new Date(shift.date), "MMM d")}`);
      queryClient.invalidateQueries({ queryKey: ["existing-vacancy-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["vacancy-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send notifications");
    }
  });

  // Check if alert is already created
  const isAlertCreated = (shift: any) => {
    return existingAlerts?.some(
      (alert: any) => alert.date === shift.date && alert.shift_type_id === shift.shift_type_id
    );
  };

  // Handle creating a single alert
  const handleCreateAlert = (shift: any) => {
    createAlertMutation.mutate(shift);
  };

  // Handle sending a single alert
  const handleSendAlert = (shift: any) => {
    sendAlertMutation.mutate(shift);
  };

  // Handle creating all alerts
  const handleCreateAllAlerts = () => {
    if (!understaffedShifts || understaffedShifts.length === 0) return;

    const shiftsToCreate = understaffedShifts.filter(shift => !isAlertCreated(shift));
    
    if (shiftsToCreate.length === 0) {
      toast.info("All alerts have already been created");
      return;
    }

    let successCount = 0;
    const totalCount = shiftsToCreate.length;

    shiftsToCreate.forEach((shift) => {
      createAlertMutation.mutate(shift, {
        onSuccess: () => {
          successCount++;
          if (successCount === totalCount) {
            toast.success(`Created ${successCount} alert(s) successfully`);
          }
        }
      });
    });
  };

   return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Automatic Understaffed Shift Detection
            </CardTitle>
            <CardDescription>
              Detects understaffing based on minimum staffing requirements from the database
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {/* Only show Create All Alerts button if notifications are enabled */}
            {notificationsEnabled && (
              <Button
                variant="outline"
                onClick={handleCreateAllAlerts}
                disabled={!understaffedShifts?.length || createAlertMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create All Alerts
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* ... existing content ... */}

        {!isLoading && !error && understaffedShifts && understaffedShifts.length > 0 && (
          <div className="space-y-4">
            {understaffedShifts.map((shift, index) => {
              const alertExists = isAlertCreated(shift);
              
              const shiftName = shift.shift_types?.name || `Shift ID: ${shift.shift_type_id}`;
              const shiftTime = shift.shift_types 
                ? `${shift.shift_types.start_time} - ${shift.shift_types.end_time}`
                : "Time not available";

              return (
                <div
                  key={`${shift.date}-${shift.shift_type_id}-${index}`}
                  className="p-4 border rounded-lg space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      {/* ... existing shift info display ... */}
                    </div>
                    {/* Only show Create Alert/Send Notifications buttons if notifications are enabled */}
                    {notificationsEnabled && (
                      <div className="flex flex-col gap-2">
                        {!alertExists ? (
                          <Button
                            size="sm"
                            onClick={() => handleCreateAlert(shift)}
                            disabled={createAlertMutation.isPending}
                          >
                            Create Alert
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleSendAlert(shift)}
                            disabled={sendAlertMutation.isPending}
                          >
                            <Mail className="h-3 w-3 mr-1" />
                            Send Notifications
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
