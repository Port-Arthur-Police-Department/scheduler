import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const usePositionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scheduleId,
      type,
      positionName,
      date,
      officerId,
      shiftTypeId
    }: {
      scheduleId: string;
      type: "recurring" | "exception";
      positionName: string;
      date?: string;
      officerId?: string;
      shiftTypeId?: string;
    }) => {
      // If a date is provided, manage via schedule_exceptions for that specific date
      if (date && officerId && shiftTypeId) {
        // Check if an exception already exists for this officer on this date
        const { data: existing, error: checkError } = await supabase
          .from("schedule_exceptions")
          .select("id")
          .eq("officer_id", officerId)
          .eq("date", date)
          .maybeSingle();

        if (checkError) throw checkError;

        if (existing) {
          const { error } = await supabase
            .from("schedule_exceptions")
            .update({ position_name: positionName })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("schedule_exceptions")
            .insert({
              officer_id: officerId,
              date: date,
              shift_type_id: shiftTypeId,
              position_name: positionName,
              is_off: false
            });
          if (error) throw error;
        }
      } else {
        const table = type === "recurring" ? "recurring_schedules" : "schedule_exceptions";

        const { error } = await supabase
          .from(table)
          .update({
            position_name: positionName
          })
          .eq("id", scheduleId);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Position updated successfully");
      // Force refresh all schedule queries
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-schedule"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update position");
    },
  });
};
