// src/hooks/useWeeklyScheduleMutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PTO_TYPES } from "@/constants/positions";

interface UpdatePositionParams {
  scheduleId: string;
  type: "recurring" | "exception";
  positionName: string;
  date?: string;
  officerId?: string;
  shiftTypeId?: string;
  currentPosition?: string;
  unitNumber?: string;
  notes?: string;
}

export const useWeeklyScheduleMutations = (
  currentWeekStart: Date,
  currentMonth: Date,
  activeView: "weekly" | "monthly",
  selectedShiftId: string
) => {
  const queryClient = useQueryClient();
  
  const queryKey = [
    "schedule",
    currentWeekStart.toISOString(),
    currentMonth.toISOString(),
    activeView,
    selectedShiftId
  ];

  const updatePositionMutation = useMutation({
    mutationFn: async (params: UpdatePositionParams) => {
      if (params.type === "recurring") {
        // For recurring officers, update via exceptions table
        const { data: existingExceptions, error: checkError } = await supabase
          .from("schedule_exceptions")
          .select("id, position_name, unit_number, notes")
          .eq("officer_id", params.officerId)
          .eq("date", params.date)
          .eq("shift_type_id", params.shiftTypeId)
          .eq("is_off", false);

        if (checkError) throw checkError;

        if (existingExceptions && existingExceptions.length > 0) {
          const { error } = await supabase
            .from("schedule_exceptions")
            .update({
              position_name: params.positionName,
              unit_number: params.unitNumber,
              notes: params.notes
            })
            .eq("id", existingExceptions[0].id);
          
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("schedule_exceptions")
            .insert({
              officer_id: params.officerId,
              date: params.date,
              shift_type_id: params.shiftTypeId,
              is_off: false,
              position_name: params.positionName,
              unit_number: params.unitNumber,
              notes: params.notes,
              custom_start_time: null,
              custom_end_time: null
            });
          
          if (error) throw error;
        }
      } else {
        const { error } = await supabase
          .from("schedule_exceptions")
          .update({
            position_name: params.positionName,
            unit_number: params.unitNumber,
            notes: params.notes
          })
          .eq("id", params.scheduleId);
          
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Position updated");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update position");
    },
  });

const removePTOMutation = useMutation({
  mutationFn: async (ptoData: {
    id: string;
    officerId: string;
    date: string;
    shiftTypeId: string;
    ptoType: string;
    startTime: string;
    endTime: string;
  }) => {
    console.log('removePTOMutation called with:', ptoData);
    
    // Get shift details to calculate hours
    const { data: shiftData, error: shiftError } = await supabase
      .from("shift_types")
      .select("start_time, end_time")
      .eq("id", ptoData.shiftTypeId)
      .single();

    if (shiftError && shiftError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching shift data:', shiftError);
    }

    // Use provided times or shift times
    const startTime = ptoData.startTime || shiftData?.start_time || "00:00";
    const endTime = ptoData.endTime || shiftData?.end_time || "23:59";

    // Calculate hours to restore
    const calculateHours = (start: string, end: string) => {
      try {
        const [startHour, startMin] = start.split(":").map(Number);
        const [endHour, endMin] = end.split(":").map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        return (endMinutes - startMinutes) / 60;
      } catch (error) {
        console.error('Error calculating hours:', error);
        return 8; // Default to 8 hours if calculation fails
      }
    };

    const hoursUsed = calculateHours(startTime, endTime);
    const ptoColumn = PTO_TYPES.find((t) => t.value === ptoData.ptoType)?.column;
    
    if (ptoColumn) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", ptoData.officerId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      } else if (profile) {
        const currentBalance = profile[ptoColumn as keyof typeof profile] as number;
        
        const { error: restoreError } = await supabase
          .from("profiles")
          .update({
            [ptoColumn]: (currentBalance || 0) + hoursUsed,
          })
          .eq("id", ptoData.officerId);

        if (restoreError) {
          console.error('Error restoring PTO balance:', restoreError);
        }
      }
    }

    // Delete the PTO exception
    const { error: deleteError } = await supabase
      .from("schedule_exceptions")
      .delete()
      .eq("id", ptoData.id);

    if (deleteError) throw deleteError;

    // Also delete any associated working time exception
    await supabase
      .from("schedule_exceptions")
      .delete()
      .eq("officer_id", ptoData.officerId)
      .eq("date", ptoData.date)
      .eq("shift_type_id", ptoData.shiftTypeId)
      .eq("is_off", false);

    return { success: true };
  },
  onSuccess: () => {
    toast.success("PTO removed and balance restored");
    queryClient.invalidateQueries({ queryKey });
  },
  onError: (error: any) => {
    console.error('Mutation error:', error);
    toast.error(error.message || "Failed to remove PTO");
  },
});

  return {
    updatePositionMutation,
    removeOfficerMutation,
    removePTOMutation,
    queryKey
  };
};
