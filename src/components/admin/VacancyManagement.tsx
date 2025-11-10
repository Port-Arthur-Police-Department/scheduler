// components/admin/VacancyManagement.tsx
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Plus, Users, RefreshCw, AlertTriangle, Mail, Check, X, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCreateVacancyAlert } from "@/hooks/useCreateVacancyAlert";
import { useUnderstaffedDetection } from "@/hooks/useUnderstaffedDetection";
import { useWebsiteSettings } from "@/hooks/useWebsiteSettings"; // Add this import

interface VacancyManagementProps {
  isOfficerView?: boolean;
  userId?: string;
}

export const VacancyManagement = ({ isOfficerView = false, userId }: VacancyManagementProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedShift, setSelectedShift] = useState<string>();
  const [minimumRequired, setMinimumRequired] = useState<string>("2");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [selectedShiftId, setSelectedShiftId] = useState<string>("all");
  const queryClient = useQueryClient();
  const [customMessage, setCustomMessage] = useState("");
  const [showCustomMessageDialog, setShowCustomMessageDialog] = useState(false);
  const [selectedShiftForCustomMessage, setSelectedShiftForCustomMessage] = useState<any>(null);
  const [detectionCustomMessage, setDetectionCustomMessage] = useState("");

  // Add website settings query
  const { data: websiteSettings } = useWebsiteSettings();
  const notificationsEnabled = websiteSettings?.enable_notifications || false;

  // Add real-time subscription for vacancy alerts
  useEffect(() => {
    const subscription = supabase
      .channel('vacancy-alerts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vacancy_alerts'
        },
        () => {
          // Invalidate and refetch when any changes occur
          queryClient.invalidateQueries({ queryKey: ["all-vacancy-alerts"] });
          queryClient.invalidateQueries({ queryKey: ["vacancy-alerts"] });
          setLastRefreshed(new Date());
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const { data: shiftTypes } = useQuery({
    queryKey: ["shift-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_types")
        .select("*")
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const { data: alerts, isLoading: alertsLoading, refetch: refetchAlerts } = useQuery({
    queryKey: ["all-vacancy-alerts"],
    queryFn: async () => {
      console.log("🔄 Fetching vacancy alerts...");
      
      const { data: alertsData, error } = await supabase
        .from("vacancy_alerts")
        .select(`
          *,
          shift_types (
            id, 
            name, 
            start_time, 
            end_time
          )
        `)
        .order("date", { ascending: false })
        .limit(20);
      
      if (error) {
        console.error("Error fetching vacancy alerts:", error);
        throw error;
      }
      
      return alertsData;
    },
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });

  const { data: responses, refetch: refetchResponses } = useQuery({
    queryKey: ["vacancy-responses-admin"],
    queryFn: async () => {
      console.log("🔄 Fetching officer responses...");
      
      const { data: responsesData, error: responsesError } = await supabase
        .from("vacancy_responses")
        .select(`
          id,
          created_at,
          status,
          officer_id,
          alert_id,
          vacancy_alert_id,
          approved_by,
          approved_at,
          rejection_reason,
          profiles!vacancy_responses_officer_id_fkey(
            full_name,
            badge_number
          )
        `)
        .order("created_at", { ascending: false });

      if (responsesError) {
        console.error("Error fetching responses:", responsesError);
        throw responsesError;
      }

      if (!responsesData || responsesData.length === 0) {
        return [];
      }

      const alertIds = responsesData
        .map(r => r.alert_id || r.vacancy_alert_id)
        .filter(Boolean);

      if (alertIds.length === 0) {
        console.log("No alert IDs found in responses");
        return responsesData.map(response => ({
          ...response,
          vacancy_alerts: null
        }));
      }

      const { data: alertsData, error: alertsError } = await supabase
        .from("vacancy_alerts")
        .select(`
          id,
          date,
          shift_type_id,
          shift_types(
            name
          )
        `)
        .in("id", alertIds);

      if (alertsError) {
        console.error("Error fetching alerts:", alertsError);
        return responsesData.map(response => ({
          ...response,
          vacancy_alerts: null
        }));
      }

      const combinedData = responsesData.map(response => {
        const alertId = response.alert_id || response.vacancy_alert_id;
        const alert = alertsData?.find(a => a.id === alertId);
        
        return {
          ...response,
          vacancy_alerts: alert
        };
      });

      console.log("📋 Final officer responses:", combinedData);
      return combinedData;
    },
  });

  const addOfficerToShift = async (responseId: string) => {
    try {
      const { data: response, error: responseError } = await supabase
        .from("vacancy_responses")
        .select(`
          *,
          profiles!vacancy_responses_officer_id_fkey(
            full_name,
            badge_number
          )
        `)
        .eq("id", responseId)
        .single();

      if (responseError) {
        console.error("Error fetching response details:", responseError);
        throw responseError;
      }

      if (!response) {
        console.error("No response data found");
        return;
      }

      const alertId = response.alert_id || response.vacancy_alert_id;
      if (!alertId) {
        console.error("No alert ID found in response");
        return;
      }

      const { data: alertData, error: alertError } = await supabase
        .from("vacancy_alerts")
        .select(`
          date,
          shift_type_id,
          shift_types(
            name,
            start_time,
            end_time
          )
        `)
        .eq("id", alertId)
        .single();

      if (alertError) {
        console.error("Error fetching alert details:", alertError);
        throw alertError;
      }

      const officer = response.profiles;

      console.log("Adding officer to shift as extra assignment:", {
        officer: officer?.full_name,
        officerId: response.officer_id,
        shift: alertData.shift_types?.name,
        shiftTypeId: alertData.shift_type_id,
        date: alertData.date
      });

      const { error: exceptionError } = await supabase
        .from("schedule_exceptions")
        .insert({
          officer_id: response.officer_id,
          shift_type_id: alertData.shift_type_id,
          date: alertData.date,
          is_off: false,
          position_name: "Extra Shift",
          unit_number: null,
          notes: `Approved vacancy request - ID: ${responseId}`,
          created_by: userId,
          custom_start_time: null,
          custom_end_time: null
        });

      if (exceptionError) {
        console.error("Error creating schedule exception:", exceptionError);
        throw exceptionError;
      }

      console.log("Successfully added officer to shift as extra assignment");

      await sendShiftAssignmentNotification(response.officer_id, alertData);

    } catch (error) {
      console.error("Error in addOfficerToShift:", error);
      throw error;
    }
  };

  const sendShiftAssignmentNotification = async (officerId: string, alert: any) => {
    try {
      const shiftName = alert.shift_types?.name || "Unknown Shift";
      const date = alert.date ? format(new Date(alert.date), "EEEE, MMM d, yyyy") : "Unknown Date";
      
      const { error } = await supabase.rpc('create_vacancy_notification', {
        officer_id: officerId,
        notification_title: "Extra Shift Assignment Confirmed",
        notification_message: `You have been assigned to ${shiftName} on ${date} as an extra shift. This assignment was approved from your vacancy alert response.`,
        notification_type: 'shift_assignment'
      });

      if (error) {
        console.error("Error sending assignment notification:", error);
      }
    } catch (err) {
      console.error("Error in sendShiftAssignmentNotification:", err);
    }
  };

  const sendResponseNotification = async (response: any, status: string, rejectionReason?: string) => {
    try {
      const officerId = response.officer_id;
      const alert = response.vacancy_alerts;
      const shiftName = alert?.shift_types?.name || "Unknown Shift";
      const date = alert?.date ? format(new Date(alert.date), "EEEE, MMM d, yyyy") : "Unknown Date";

      let title = "";
      let message = "";

      if (status === "approved") {
        title = "Vacancy Request Approved";
        message = `Your request for ${shiftName} on ${date} has been approved. You have been assigned to this shift.`;
      } else {
        title = "Vacancy Request Denied";
        message = `Your request for ${shiftName} on ${date} has been denied.`;
        if (rejectionReason) {
          message += ` Reason: ${rejectionReason}`;
        }
      }

      const { error } = await supabase.rpc('create_vacancy_notification', {
        officer_id: officerId,
        notification_title: title,
        notification_message: message,
        notification_type: 'vacancy_response'
      });

      if (error) {
        console.error("Error sending response notification:", error);
      }
    } catch (err) {
      console.error("Error in sendResponseNotification:", err);
    }
  };

  const updateResponseMutation = useMutation({
    mutationFn: async ({ 
      responseId, 
      status, 
      rejectionReason 
    }: { 
      responseId: string; 
      status: string; 
      rejectionReason?: string;
    }) => {
      const dbStatus = status === "approved" ? "accepted" : "rejected";

      const updateData: any = {
        status: dbStatus,
        approved_by: userId,
        approved_at: new Date().toISOString()
      };

      if (rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      }

      console.log("Updating response with data:", updateData);

      const { error } = await supabase
        .from("vacancy_responses")
        .update(updateData)
        .eq("id", responseId);

      if (error) {
        console.error("Supabase update error:", error);
        throw error;
      }

      if (status === "approved") {
        await addOfficerToShift(responseId);
      }

      const response = responses?.find(r => r.id === responseId);
      if (response) {
        await sendResponseNotification(response, status, rejectionReason);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vacancy-responses-admin"] });
      queryClient.invalidateQueries({ queryKey: ["understaffed-shifts-detection"] });
      queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
      toast.success("Response updated successfully");
    },
    onError: (error) => {
      console.error("Update response error:", error);
      toast.error("Failed to update response: " + error.message);
    },
  });

  const { 
    data: understaffedShifts, 
    isLoading: understaffedLoading, 
    error: understaffedError,
    refetch: refetchUnderstaffed 
  } = useUnderstaffedDetection(selectedShiftId);

  const { data: existingAlerts } = useQuery({
    queryKey: ["existing-vacancy-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacancy_alerts")
        .select("*")
        .eq("status", "open");

      if (error) throw error;
      return data;
    },
  });

  const handleRefreshAll = () => {
    refetchAlerts();
    refetchResponses();
    refetchUnderstaffed();
    setLastRefreshed(new Date());
    toast.success("Data refreshed");
  };

  const createAlertMutation = useCreateVacancyAlert();

  const handleCreateManualAlert = () => {
    if (!selectedDate || !selectedShift) {
      toast.error("Please select date and shift");
      return;
    }

    let positionType = "";
    if (parseInt(minimumRequired) > 0) {
      positionType = `Need ${minimumRequired} officer(s)`;
    }

    createAlertMutation.mutate({
      shift_type_id: selectedShift,
      date: format(selectedDate, "yyyy-MM-dd"),
      current_staffing: 0,
      minimum_required: parseInt(minimumRequired),
      custom_message: customMessage,
      position_type: positionType,
      manual_notification_sent: true,
    }, {
      onSuccess: () => {
        setDialogOpen(false);
        setSelectedDate(undefined);
        setSelectedShift(undefined);
        setMinimumRequired("2");
        setCustomMessage("");
      }
    });
  };

  const closeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from("vacancy_alerts")
        .update({ status: "closed" })
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-vacancy-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["vacancy-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Alert closed");
    },
  });

  const sendAlertMutation = useMutation({
    mutationFn: async (alertData: any) => {
      console.log("🔍 DEBUG - Starting sendAlertMutation:", {
        alertId: alertData.alertId,
        custom_message: alertData.custom_message,
        timestamp: new Date().toISOString()
      });

      if (!alertData.custom_message) {
        console.log("No custom message - skipping notifications");
        
        const { error } = await supabase
          .from("vacancy_alerts")
          .update({ 
            notification_sent: true,
            notified_at: new Date().toISOString()
          })
          .eq("id", alertData.alertId);

        if (error) throw error;
        return;
      }

      const { data: officers, error: officersError } = await supabase
        .from("profiles")
        .select("id, email, phone, notification_preferences")
        .eq('active', true);

      if (officersError) {
        console.error("Error fetching officers:", officersError);
        throw officersError;
      }

      console.log(`🔍 DEBUG - Found ${officers?.length || 0} active officers`);

      const emailPromises = [];
      const textPromises = [];

      const alertMessage = alertData.custom_message;
      const emailSubject = `Vacancy Alert - ${format(new Date(alertData.date), "MMM d, yyyy")} - ${alertData.shift_types?.name}`;
      
      console.log("🔍 DEBUG - Sending message:", alertMessage);

      for (const officer of officers || []) {
        const preferences = officer.notification_preferences || { receiveEmails: true, receiveTexts: true };
        
        if (preferences.receiveEmails !== false && officer.email) {
          console.log(`🔍 DEBUG - Sending email to: ${officer.email}`);
          emailPromises.push(
            fetch('https://ywghefarrcwbnraqyfgk.supabase.co/functions/v1/send-vacancy-alert', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: officer.email,
                subject: emailSubject,
                message: alertMessage,
                alertId: alertData.alertId,
                customMessage: alertData.custom_message
              }),
            }).catch(err => {
              console.error(`Failed to send email to ${officer.email}:`, err);
            })
          );
        }

        if (preferences.receiveTexts !== false && officer.phone) {
          console.log(`🔍 DEBUG - Sending text to: ${officer.phone}`);
          textPromises.push(
            fetch('https://ywghefarrcwbnraqyfgk.supabase.co/functions/v1/send-text-alert', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: officer.phone,
                message: alertMessage,
                customMessage: alertData.custom_message
              }),
            }).catch(err => {
              console.error(`Failed to send text to ${officer.phone}:`, err);
            })
          );
        }
      }

      await Promise.all([...emailPromises, ...textPromises]);
      
      const { error } = await supabase
        .from("vacancy_alerts")
        .update({ 
          notification_sent: true,
          notified_at: new Date().toISOString()
        })
        .eq("id", alertData.alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alerts sent successfully to all officers");
      queryClient.invalidateQueries({ queryKey: ["existing-vacancy-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["all-vacancy-alerts"] });
    },
    onError: (error) => {
      console.error("Send alert error:", error);
      toast.error("Failed to send alerts: " + error.message);
    },
  });

  const isAlertCreated = (shift: any) => {
    return existingAlerts?.some(alert => 
      alert.date === shift.date && 
      alert.shift_type_id === shift.shift_type_id
    );
  };

  const handleCreateAlertFromDetection = (shift: any) => {
    console.log("Opening custom message dialog for shift:", shift);
    setSelectedShiftForCustomMessage(shift);
    setDetectionCustomMessage("");
    setShowCustomMessageDialog(true);
  };
  
  const handleConfirmDetectionAlert = () => {
    if (!selectedShiftForCustomMessage) {
      toast.error("No shift selected");
      return;
    }

    const finalMessage = detectionCustomMessage.trim() || 
      `Urgent: ${selectedShiftForCustomMessage.minimum_required - selectedShiftForCustomMessage.current_staffing} more officers needed for ${selectedShiftForCustomMessage.shift_types?.name} shift on ${format(new Date(selectedShiftForCustomMessage.date), "MMM d")}`;

    createAlertMutation.mutate({
      shift_type_id: selectedShiftForCustomMessage.shift_type_id,
      date: selectedShiftForCustomMessage.date,
      current_staffing: selectedShiftForCustomMessage.current_staffing,
      minimum_required: selectedShiftForCustomMessage.minimum_required,
      custom_message: finalMessage
    }, {
      onSuccess: () => {
        setShowCustomMessageDialog(false);
        setSelectedShiftForCustomMessage(null);
        setDetectionCustomMessage("");
        toast.success("Vacancy alert created with custom message");
      }
    });
  };

  const handleCreateAllAlerts = () => {
    if (!understaffedShifts) return;

    const shiftsWithoutAlerts = understaffedShifts.filter(shift => !isAlertCreated(shift));
    
    if (shiftsWithoutAlerts.length === 0) {
      toast.info("All understaffed shifts already have alerts");
      return;
    }

    shiftsWithoutAlerts.forEach(shift => {
      const defaultMessage = `Urgent: ${shift.minimum_required - shift.current_staffing} more officers needed for ${shift.shift_types?.name} shift on ${format(new Date(shift.date), "MMM d")}`;
      
      createAlertMutation.mutate({
        shift_type_id: shift.shift_type_id,
        date: shift.date,
        current_staffing: shift.current_staffing,
        minimum_required: shift.minimum_required,
        custom_message: defaultMessage
      });
    });

    toast.success(`Creating ${shiftsWithoutAlerts.length} alerts with default messages`);
  };

  const handleSendAlert = (shift: any) => {
    const alert = existingAlerts?.find(a => 
      a.date === shift.date && a.shift_type_id === shift.shift_type_id
    );

    if (!alert) {
      toast.error("Please create an alert first");
      return;
    }

    sendAlertMutation.mutate({
      ...shift,
      alertId: alert.id
    });
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "interested":
        return "outline";
      case "accepted":
        return "default";
      case "rejected":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "interested":
        return "Pending";
      case "accepted":
        return "Approved";
      case "rejected":
        return "Denied";
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "interested":
        return <Clock className="h-3 w-3" />;
      case "accepted":
        return <Check className="h-3 w-3" />;
      case "rejected":
        return <X className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

   // If this is officer view, hide all create alert functionality
  if (isOfficerView) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Vacancy Alerts</h2>
            <p className="text-sm text-muted-foreground">
              Last refreshed: {lastRefreshed.toLocaleTimeString()}
            </p>
          </div>
          <Button variant="outline" onClick={handleRefreshAll}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Current Vacancy Alerts</CardTitle>
            <CardDescription>Open shifts that need coverage</CardDescription>
          </CardHeader>
          <CardContent>
            {alertsLoading ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Loading alerts...</p>
              </div>
            ) : !alerts || alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No vacancy alerts at this time.</p>
            ) : (
              <div className="space-y-4">
                {alerts.map((alert) => {
                  const shiftName = alert.shift_types?.name || `Shift ID: ${alert.shift_type_id}`;
                  const shiftTime = alert.shift_types 
                    ? `${alert.shift_types.start_time} - ${alert.shift_types.end_time}`
                    : "Time not available";

                  return (
                    <div key={alert.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-medium">{shiftName}</p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(alert.date), "EEEE, MMM d, yyyy")} • {shiftTime}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Staffing: {alert.current_staffing} / {alert.minimum_required}
                          </p>
                          
                          {alert.position_type && (
                            <div className="mt-2">
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                {alert.position_type} needed
                              </Badge>
                            </div>
                          )}
                          
                          {alert.custom_message && (
                            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                              <p className="text-sm text-blue-800">{alert.custom_message}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 ml-4">
                          <span
                            className={cn(
                              "text-xs px-2 py-1 rounded",
                              alert.status === "open"
                                ? "bg-green-500/10 text-green-700"
                                : "bg-gray-500/10 text-gray-700"
                            )}
                          >
                            {alert.status}
                          </span>
                          {alert.status === "open" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => closeAlertMutation.mutate(alert.id)}
                            >
                              Close Alert
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Vacancy Management</h2>
          <p className="text-sm text-muted-foreground">
            Last refreshed: {lastRefreshed.toLocaleTimeString()}
          </p>
        </div>
        <Button variant="outline" onClick={handleRefreshAll}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh All
        </Button>
      </div>

      {/* Only show Officer Responses card if notifications are enabled */}
      {notificationsEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Officer Responses
            </CardTitle>
            <CardDescription>Review and manage officer responses to vacancy alerts</CardDescription>
          </CardHeader>
          <CardContent>
            {!responses || responses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No responses yet.</p>
            ) : (
              <div className="space-y-4">
                {responses.map((response) => {
                  const alert = response.vacancy_alerts;
                  const shiftName = alert?.shift_types?.name || "Unknown Shift";
                  const date = alert?.date ? format(new Date(alert.date), "MMM d, yyyy") : "Unknown Date";

                  return (
                    <div key={response.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-medium">
                              {response.profiles?.full_name} (#{response.profiles?.badge_number})
                            </p>
                            <Badge 
                              variant={getStatusVariant(response.status)}
                              className="flex items-center gap-1 capitalize"
                            >
                              {getStatusIcon(response.status)}
                              {getStatusDisplay(response.status)}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-muted-foreground">
                            {shiftName} - {date}
                          </p>
                          
                          {response.approved_by && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {response.status === "accepted" ? "Approved" : "Denied"} on{" "}
                              {format(new Date(response.approved_at), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          )}

                          {response.rejection_reason && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                              <p className="text-sm text-red-800">
                                <strong>Reason:</strong> {response.rejection_reason}
                              </p>
                            </div>
                          )}
                        </div>

                        {response.status === "interested" && (
                          <div className="flex flex-col gap-2 ml-4">
                            <Button
                              size="sm"
                              onClick={() => updateResponseMutation.mutate({ 
                                responseId: response.id, 
                                status: "approved" 
                              })}
                              disabled={updateResponseMutation.isPending}
                              className="flex items-center gap-1"
                            >
                              <Check className="h-3 w-3" />
                              Approve
                            </Button>
                            
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={updateResponseMutation.isPending}
                                  className="flex items-center gap-1"
                                >
                                  <X className="h-3 w-3" />
                                  Deny
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Deny Response</DialogTitle>
                                  <DialogDescription>
                                    Provide a reason for denying this shift request from {response.profiles?.full_name}.
                                  </DialogDescription>
                                </DialogHeader>
                                
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="rejection-reason">Reason for Denial</Label>
                                    <textarea
                                      id="rejection-reason"
                                      placeholder="Enter reason for denial (optional but recommended)"
                                      className="w-full min-h-[80px] p-2 border rounded-md text-sm resize-y"
                                      maxLength={500}
                                    />
                                  </div>
                                  
                                  <Button
                                    onClick={() => {
                                      const textarea = document.getElementById('rejection-reason') as HTMLTextAreaElement;
                                      updateResponseMutation.mutate({ 
                                        responseId: response.id, 
                                        status: "denied",
                                        rejectionReason: textarea.value
                                      });
                                    }}
                                    disabled={updateResponseMutation.isPending}
                                    variant="destructive"
                                  >
                                    {updateResponseMutation.isPending ? "Denying..." : "Confirm Denial"}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
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
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Automatic Understaffed Shift Detection
              </CardTitle>
              <CardDescription>
                Detects understaffing based on ACTUAL assigned positions in the daily schedule
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => refetchUnderstaffed()}
                disabled={understaffedLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${understaffedLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {/* Only show Create All Alerts button if notifications are enabled */}
              {notificationsEnabled && (
                <Button
                  variant="outline"
                  onClick={handleCreateAllAlerts}
                  disabled={createAlertMutation.isPending || !understaffedShifts?.length}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create All Alerts
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <Label htmlFor="shift-select" className="text-sm font-medium mb-2 block">
              Select Shift to Scan
            </Label>
            <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a shift to scan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Shifts</SelectItem>
                {shiftTypes?.map((shift) => (
                  <SelectItem key={shift.id} value={shift.id}>
                    {shift.name} ({shift.start_time} - {shift.end_time})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {understaffedLoading ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Scanning for understaffed shifts...</p>
            </div>
          ) : !understaffedShifts || understaffedShifts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                No understaffed shifts found in the next 7 days.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Check browser console for detailed scan results.
              </p>
            </div>
          ) : (
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
                        <p className="font-medium">{shiftName}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(shift.date + 'T12:00:00'), "EEEE, MMM d, yyyy")} • {shiftTime}
                        </p>
                        
                        <div className="bg-gray-100 p-2 rounded text-xs mt-2">
                          <p className="text-gray-600">
                            <strong>Staffing:</strong> {shift.current_staffing}/{shift.minimum_required} |
                            <strong> Supervisors:</strong> {shift.current_supervisors}/{shift.min_supervisors} |
                            <strong> Officers:</strong> {shift.current_officers}/{shift.min_officers}
                          </p>
                          {shift.position_type && (
                            <p className="text-gray-600 mt-1">
                              <strong>Positions Needed:</strong> {shift.position_type}
                            </p>
                          )}
                          <p className="text-gray-500 mt-1">
                            <strong>Assigned:</strong> {shift.assigned_officers?.map(o => 
                              `${o.name} (${o.position || 'No position'} - ${o.isSupervisor ? 'Supervisor' : 'Officer'})`
                            ).join(', ') || 'None'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="destructive">
                            Total: {shift.current_staffing}/{shift.minimum_required}
                          </Badge>
                          {shift.isSupervisorsUnderstaffed && (
                            <Badge variant="destructive">
                              Needs {shift.min_supervisors - shift.current_supervisors} supervisor(s)
                            </Badge>
                          )}
                          {shift.isOfficersUnderstaffed && (
                            <Badge variant="destructive">
                              Needs {shift.min_officers - shift.current_officers} officer(s)
                            </Badge>
                          )}
                          {alertExists && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-700">
                              Alert Created
                            </Badge>
                          )}
                        </div>
                      </div>
                      {/* Only show Create Alert/Send Alert buttons if notifications are enabled */}
                      {notificationsEnabled && (
                        <div className="flex flex-col gap-2">
                          {!alertExists ? (
                            <Button
                              size="sm"
                              onClick={() => handleCreateAlertFromDetection(shift)}
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
                              Send Alert
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

      {/* Only show Manual Vacancy Alert Creation card if notifications are enabled */}
      {notificationsEnabled && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Manual Vacancy Alert Creation</CardTitle>
                <CardDescription>Manually create vacancy alerts for specific shifts</CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Manual Alert
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Vacancy Alert</DialogTitle>
                    <DialogDescription>
                      Create an alert to request volunteers for an understaffed shift
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !selectedDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>Shift Type</Label>
                      <Select value={selectedShift} onValueChange={setSelectedShift}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select shift" />
                        </SelectTrigger>
                        <SelectContent>
                          {shiftTypes?.map((shift) => (
                            <SelectItem key={shift.id} value={shift.id}>
                              {shift.name} ({shift.start_time} - {shift.end_time})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Minimum Required Officers</Label>
                      <Input
                        type="number"
                        min="1"
                        value={minimumRequired}
                        onChange={(e) => setMinimumRequired(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="custom-message">Custom Message (Optional)</Label>
                      <textarea
                        id="custom-message"
                        placeholder="Add a custom message for this vacancy alert (e.g., 'Urgent coverage needed for special event')"
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        className="w-full min-h-[80px] p-2 border rounded-md text-sm resize-y"
                        maxLength={500}
                      />
                      <p className="text-xs text-muted-foreground">
                        {customMessage.length}/500 characters
                      </p>
                    </div>

                    <Button
                      className="w-full"
                      onClick={handleCreateManualAlert}
                      disabled={createAlertMutation.isPending}
                    >
                      {createAlertMutation.isPending ? "Creating..." : "Create Alert"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {alertsLoading ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Loading alerts...</p>
              </div>
            ) : !alerts || alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No vacancy alerts created yet.</p>
            ) : (
              <div className="space-y-4">
                {alerts.map((alert) => {
                  const shiftName = alert.shift_types?.name || `Shift ID: ${alert.shift_type_id}`;
                  const shiftTime = alert.shift_types 
                    ? `${alert.shift_types.start_time} - ${alert.shift_types.end_time}`
                    : "Time not available";

                  return (
                    <div key={alert.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-medium">{shiftName}</p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(alert.date), "EEEE, MMM d, yyyy")} • {shiftTime}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Staffing: {alert.current_staffing} / {alert.minimum_required}
                          </p>
                          {alert.custom_message && (
                            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                              <p className="text-sm text-blue-800">{alert.custom_message}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 ml-4">
                          <span
                            className={cn(
                              "text-xs px-2 py-1 rounded",
                              alert.status === "open"
                                ? "bg-green-500/10 text-green-700"
                                : "bg-gray-500/10 text-gray-700"
                            )}
                          >
                            {alert.status}
                          </span>
                          {alert.status === "open" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => closeAlertMutation.mutate(alert.id)}
                            >
                              Close Alert
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rest of your dialogs remain the same */}
      <Dialog open={showCustomMessageDialog} onOpenChange={setShowCustomMessageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Message</DialogTitle>
            <DialogDescription>
              Add a custom message for the vacancy alert for{" "}
              {selectedShiftForCustomMessage?.shift_types?.name} on{" "}
              {selectedShiftForCustomMessage &&
                format(new Date(selectedShiftForCustomMessage.date), "EEEE, MMM d, yyyy")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedShiftForCustomMessage && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium">
                  {selectedShiftForCustomMessage.shift_types?.name} •{" "}
                  {format(new Date(selectedShiftForCustomMessage.date), "MMM d, yyyy")}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Staffing: {selectedShiftForCustomMessage.current_staffing} /{" "}
                  {selectedShiftForCustomMessage.minimum_required} •
                  Needs {selectedShiftForCustomMessage.minimum_required - selectedShiftForCustomMessage.current_staffing} more officers
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="detection-custom-message">Custom Message (Optional)</Label>
              <textarea
                id="detection-custom-message"
                placeholder="Add a custom message for this vacancy alert (e.g., 'Urgent coverage needed for special event', 'Mandatory overtime available', etc.)"
                value={detectionCustomMessage}
                onChange={(e) => setDetectionCustomMessage(e.target.value)}
                className="w-full min-h-[100px] p-3 border rounded-md text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={500}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Leave blank to use default message</span>
                <span>{detectionCustomMessage.length}/500 characters</span>
              </div>
            </div>

            {!detectionCustomMessage.trim() && (
              <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                <p className="text-xs text-blue-700 font-medium">Default message that will be used:</p>
                <p className="text-xs text-blue-600 mt-1">
                  Urgent: {selectedShiftForCustomMessage?.minimum_required - selectedShiftForCustomMessage?.current_staffing} more officers needed for {selectedShiftForCustomMessage?.shift_types?.name} shift on {selectedShiftForCustomMessage && format(new Date(selectedShiftForCustomMessage.date), "MMM d")}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowCustomMessageDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDetectionAlert}
                disabled={createAlertMutation.isPending}
                className="flex-1"
              >
                {createAlertMutation.isPending ? "Creating..." : "Create Alert"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
