// components/time-off/TimeOffRequests.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Clock, Bell } from "lucide-react";
import { TimeOffRequestDialog } from "./TimeOffRequestDialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { useWebsiteSettings } from "@/hooks/useWebsiteSettings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { sendPTORequestNotification } from "@/utils/notifications"; // CORRECTED IMPORT

interface TimeOffRequestsProps {
  userId: string;
  isAdminOrSupervisor: boolean;
}

export const TimeOffRequests = ({ userId, isAdminOrSupervisor }: TimeOffRequestsProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Add website settings hook
  const { data: settings } = useWebsiteSettings();

  const { data: requests, isLoading } = useQuery({
    queryKey: ["time-off-requests", userId, isAdminOrSupervisor],
    queryFn: async () => {
      let query = supabase
        .from("time_off_requests")
        .select(`
          *,
          profiles!time_off_requests_officer_id_fkey(full_name, badge_number)
        `)
        .order("created_at", { ascending: false });

      if (!isAdminOrSupervisor) {
        query = query.eq("officer_id", userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;

      const { error } = await supabase
        .from("time_off_requests")
        .update({
          status,
          review_notes: notes,
          reviewed_by: currentUserId || userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      // Check shift bidding queue advancement if approved or denied
      if (status === 'approved' || status === 'denied') {
        const { data: tor } = await supabase
          .from("time_off_requests")
          .select("officer_id, pto_type, start_date, end_date")
          .eq("id", id)
          .single();

        if (tor) {
          // If approved, create schedule exceptions for the date range so it reflects on the calendar/schedule
          if (status === 'approved') {
            try {
              const startDate = parseISO(tor.start_date);
              const endDate = parseISO(tor.end_date);
              const days = eachDayOfInterval({ start: startDate, end: endDate });

              const { data: officerProfile } = await supabase
                .from("profiles")
                .select("shift_type_id")
                .eq("id", tor.officer_id)
                .single();

              const defaultShiftTypeId = officerProfile?.shift_type_id;

              for (const day of days) {
                const dateStr = format(day, "yyyy-MM-dd");
                const dayOfWeek = day.getDay();

                const { data: recSchedule } = await supabase
                  .from("recurring_schedules")
                  .select("shift_type_id")
                  .eq("officer_id", tor.officer_id)
                  .eq("day_of_week", dayOfWeek)
                  .maybeSingle();

                const shiftTypeId = recSchedule?.shift_type_id || defaultShiftTypeId;
                if (!shiftTypeId) continue;

                const { data: existingEx } = await supabase
                  .from("schedule_exceptions")
                  .select("id")
                  .eq("officer_id", tor.officer_id)
                  .eq("date", dateStr)
                  .eq("shift_type_id", shiftTypeId)
                  .maybeSingle();

                if (existingEx) {
                  await supabase
                    .from("schedule_exceptions")
                    .update({
                      is_off: true,
                      reason: tor.pto_type || 'vacation',
                      schedule_type: 'pto'
                    })
                    .eq("id", existingEx.id);
                } else {
                  await supabase
                    .from("schedule_exceptions")
                    .insert({
                      officer_id: tor.officer_id,
                      date: dateStr,
                      shift_type_id: shiftTypeId,
                      is_off: true,
                      reason: tor.pto_type || 'vacation',
                      schedule_type: 'pto'
                    });
                }
              }
            } catch (exErr) {
              console.error("Error creating schedule exceptions for approved PTO in TimeOffRequests:", exErr);
            }
          }

          const { data: queueItems } = await supabase
            .from("shift_bidding_queue")
            .select("*, shift_bidding_rounds(*)")
            .eq("officer_id", tor.officer_id)
            .eq("status", "completed");

          if (queueItems && queueItems.length > 0) {
            for (const item of queueItems) {
              if (item.shift_bidding_rounds && item.shift_bidding_rounds.status === 'active') {
                const { data: remainingPending } = await supabase
                  .from("time_off_requests")
                  .select("id")
                  .eq("officer_id", tor.officer_id)
                  .eq("status", "pending");

                if (!remainingPending || remainingPending.length === 0) {
                  const nextTurnIndex = item.turn_index + 1;
                  const roundId = item.round_id;

                  const { data: nextOfficer } = await supabase
                    .from("shift_bidding_queue")
                    .select("id")
                    .eq("round_id", roundId)
                    .eq("turn_index", nextTurnIndex)
                    .single();

                  if (nextOfficer) {
                    await supabase
                      .from("shift_bidding_queue")
                      .update({ status: 'active' })
                      .eq("id", nextOfficer.id);

                    await supabase
                      .from("shift_bidding_rounds")
                      .update({ current_turn_index: nextTurnIndex, updated_at: new Date().toISOString() })
                      .eq("id", roundId);

                    console.log(`✅ Bidding queue advanced to turn index ${nextTurnIndex} for round ${roundId}`);
                  } else {
                    await supabase
                      .from("shift_bidding_rounds")
                      .update({ status: 'completed', updated_at: new Date().toISOString() })
                      .eq("id", roundId);
                  }
                }
              }
            }
          }
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["time-off-requests"] });
      queryClient.invalidateQueries({ queryKey: ["shift_bidding_queue"] });
      queryClient.invalidateQueries({ queryKey: ["shift_bidding_rounds"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-data"] });
      toast.success("Request updated successfully");

      // Send notification based on status
      if (variables.status === 'approved' || variables.status === 'denied') {
        sendPTORequestNotification(
          variables.id,
          userId,
          variables.status === 'approved' ? 'approved' : 'denied'
        );
      }
    },
    onError: (error) => {
      toast.error("Failed to update request: " + error.message);
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
      case "denied":
        return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";
      default:
        return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20";
    }
  };

  // Check if vacancy alerts are enabled
  const showVacancyAlerts = settings?.enable_vacancy_alerts !== false;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Time Off Requests
            </CardTitle>
            <CardDescription>
              {isAdminOrSupervisor ? "Manage all time off requests" : "View and submit your time off requests"}
            </CardDescription>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        </div>

        {/* Add PTO status indicator */}
        {!isAdminOrSupervisor && !settings?.show_pto_balances && (
          <Alert className="mt-4 bg-blue-50 border-blue-200">
            <Clock className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              PTO balances are currently managed as indefinite. Verify your balance in Executime before making a request
            </AlertDescription>
          </Alert>
        )}

        {/* Notification Status */}
        {settings?.enable_notifications && (
          <Alert className="mt-4 bg-green-50 border-green-200">
            <Bell className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {isAdminOrSupervisor
                ? "You will be notified when officers submit new time off requests"
                : "You will be notified when your time off requests are approved or denied"}
            </AlertDescription>
          </Alert>
        )}

        {/* Vacancy Alerts Status */}
        {!showVacancyAlerts && isAdminOrSupervisor && (
          <Alert className="mt-4 bg-yellow-50 border-yellow-200">
            <AlertDescription className="text-yellow-800">
              Vacancy alerts are currently disabled in system settings
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !requests || requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No time off requests found.</p>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    {isAdminOrSupervisor && (
                      <p className="font-medium">
                        {request.profiles?.full_name} (#{request.profiles?.badge_number})
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(request.start_date), "MMM d, yyyy")} -{" "}
                      {format(new Date(request.end_date), "MMM d, yyyy")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium capitalize">{request.pto_type || 'vacation'}</span>
                      {request.hours_used > 0 && ` • ${request.hours_used} hours`}
                    </p>
                    {request.reason && (
                      <p className="text-sm mt-2">{request.reason}</p>
                    )}
                    {request.review_notes && (
                      <p className="text-sm text-muted-foreground mt-2">
                        <span className="font-medium">Review notes:</span> {request.review_notes}
                      </p>
                    )}
                    {request.affected_shifts && (
                      <p className="text-sm text-muted-foreground mt-2">
                        <span className="font-medium">Affected shifts:</span> {request.affected_shifts}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={getStatusColor(request.status)}>{request.status}</Badge>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(request.created_at), "MMM d, h:mm a")}
                    </p>
                  </div>
                </div>

                {isAdminOrSupervisor && request.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateRequestMutation.mutate({ id: request.id, status: "approved" })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateRequestMutation.mutate({ id: request.id, status: "denied" })
                      }
                    >
                      Deny
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <TimeOffRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        userId={userId}
        isAdminOrSupervisor={isAdminOrSupervisor}
      />
    </Card>
  );
};
