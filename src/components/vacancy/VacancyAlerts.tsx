import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Bell, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface VacancyAlertsProps {
  userId: string;
  isAdminOrSupervisor: boolean;
}

export const VacancyAlerts = ({ userId, isAdminOrSupervisor }: VacancyAlertsProps) => {
  const queryClient = useQueryClient();

  // Fetch vacancy alerts with shift type information
  const { data: alerts, isLoading } = useQuery({
    queryKey: ["vacancy-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacancy_alerts")
        .select(`
          *,
          shift_types(name, start_time, end_time)
        `)
        .eq("status", "open")
        .order("date", { ascending: true });

      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Fetch user responses - include rejection_reason
  const { data: userResponses, refetch: refetchResponses } = useQuery({
    queryKey: ["vacancy-responses", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacancy_responses")
        .select("alert_id, status, rejection_reason, vacancy_alert_id")
        .eq("officer_id", userId);

      if (error) throw error;
      return data;
    },
    enabled: !!userId && !isAdminOrSupervisor,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Fetch notifications for the current user
  const { data: notifications } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select(`
          *,
          vacancy_alerts(
            date,
            shift_types(name)
          )
        `)
        .eq("officer_id", userId)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Mutation for responding to vacancies - with better state management
  const respondMutation = useMutation({
    mutationFn: async ({ alertId, status }: { alertId: string; status: string }) => {
      console.log("Submitting response for alert:", alertId, "status:", status);

      const { error } = await supabase.from("vacancy_responses").insert({
        vacancy_alert_id: alertId,
        officer_id: userId,
        status: status,
      });

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate and refetch the specific queries
      queryClient.invalidateQueries({ queryKey: ["vacancy-responses", userId] });
      queryClient.invalidateQueries({ queryKey: ["vacancy-responses-admin"] });

      // Also refetch the current data to ensure UI updates
      refetchResponses?.();

      toast.success("Response submitted successfully");
    },
    onError: (error: any) => {
      console.error("Response error:", error);

      if (error.code === '23505') {
        toast.error("You have already submitted a response for this vacancy alert");
      } else {
        toast.error("Failed to submit response: " + error.message);
      }
    },
  });

  // Mutation for marking notifications as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const getUserResponse = (alertId: string) => {
    return userResponses?.find((r) => r.alert_id === alertId || r.vacancy_alert_id === alertId);
  };

  return (
    <div className="space-y-6">
      {/* Notifications Section */}
      {notifications && notifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-yellow-600" />
              New Alerts ({notifications.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-center justify-between p-3 border border-yellow-200 rounded-lg bg-yellow-50"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{notification.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {notification.message}
                    </p>
                    {notification.vacancy_alerts && (
                      <Badge variant="outline" className="mt-2">
                        {format(new Date(notification.vacancy_alerts.date), "MMM d, yyyy")} - {notification.vacancy_alerts.shift_types?.name}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAsReadMutation.mutate(notification.id)}
                    className="ml-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vacancy Alerts Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Open Vacancy Alerts
          </CardTitle>
          <CardDescription>
            {isAdminOrSupervisor
              ? "Shifts that need coverage - officers will be notified automatically"
              : "Volunteer for open shifts to earn overtime"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading vacancy alerts...</p>
          ) : !alerts || alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open vacancies at this time.</p>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => {
                const userResponse = getUserResponse(alert.id);
                const isStaffed = alert.current_staffing >= alert.minimum_required;

                return (
                  <div
                    key={alert.id}
                    className={cn(
                      "p-4 border rounded-lg space-y-3",
                      userResponse?.status === "accepted"
                        ? "bg-green-50 border-green-200"
                        : userResponse?.status === "rejected"
                          ? "bg-gray-50 border-gray-200"
                          : isStaffed
                            ? "bg-green-50 border-green-200"
                            : "bg-red-50 border-red-200"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="font-medium">{alert.shift_types?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(alert.date), "EEEE, MMM d, yyyy")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {alert.shift_types?.start_time} - {alert.shift_types?.end_time}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant={isStaffed ? "outline" : "destructive"}
                            className={isStaffed ? "bg-green-100" : ""}
                          >
                            {alert.current_staffing} / {alert.minimum_required} staffed
                          </Badge>
                          {isStaffed && (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                        </div>

                        {/* ADD POSITION TYPE DISPLAY HERE */}
                        {alert.position_type && (
                          <div className="mt-2">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              {alert.position_type} needed
                            </Badge>
                          </div>
                        )}

                        {/* Show custom message if exists */}
                        {alert.custom_message && (
                          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                            <p className="text-sm text-blue-800">{alert.custom_message}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    // In VacancyAlerts.tsx - update the button rendering section
                    {!isAdminOrSupervisor && (
                      <div className="flex gap-2">
                        {userResponse ? (
                          <div className="space-y-2 w-full">
                            <Badge
                              variant={
                                userResponse.status === "accepted" ? "default" :
                                  userResponse.status === "rejected" ? "destructive" : "outline"
                              }
                              className="capitalize"
                            >
                              {userResponse.status === "accepted" ? "Approved" :
                                userResponse.status === "rejected" ? "Not Approved" :
                                  "Pending Review"}
                            </Badge>

                            {/* Show approval message when approved */}
                            {userResponse.status === "accepted" && (
                              <div className="p-2 bg-green-50 border border-green-200 rounded text-sm">
                                <p className="text-green-800 font-medium">✓ Your request has been approved</p>
                                <p className="text-green-700 mt-1">
                                  Your request for {alert.shift_types?.name} on {format(new Date(alert.date), "MMM d, yyyy")} has been approved.
                                  Please report for duty as scheduled.
                                </p>
                              </div>
                            )}

                            {/* Show rejection message when denied */}
                            {userResponse.status === "rejected" && userResponse.rejection_reason && (
                              <div className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                                <p className="text-red-800 font-medium">✗ Your request was not approved</p>
                                <p className="text-red-700 mt-1">
                                  {userResponse.rejection_reason}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() =>
                              respondMutation.mutate({
                                alertId: alert.id,
                                status: "interested",
                              })
                            }
                            disabled={respondMutation.isPending || isStaffed || !!userResponse}
                          >
                            {respondMutation.isPending ? "Submitting..." : "Request Shift"}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
