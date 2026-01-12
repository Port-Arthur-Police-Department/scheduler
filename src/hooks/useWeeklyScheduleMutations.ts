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

interface RemoveOfficerParams {
  scheduleId: string;
  type: "recurring" | "exception";
  officerData?: {
    id: string;
    name?: string;
    [key: string]: any;
  };
}

interface PTORemovalData {
  id: string;
  officerId: string;
  date: string;
  shiftTypeId: string;
  ptoType: string;
  startTime?: string;
  endTime?: string;
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

  // Helper function to calculate hours between times
  const calculateHours = (startTime: string, endTime: string): number => {
    try {
      const [startHour, startMin] = startTime.split(":").map(Number);
      const [endHour, endMin] = endTime.split(":").map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      return (endMinutes - startMinutes) / 60;
    } catch (error) {
      console.error('Error calculating hours:', error);
      return 8; // Default to 8 hours
    }
  };

  // Restore PTO balance to officer's profile
  const restorePTOBalance = async (officerId: string, ptoType: string, hours: number) => {
    const ptoColumn = PTO_TYPES.find((t) => t.value === ptoType)?.column;
    
    if (!ptoColumn) {
      console.warn(`No PTO column found for type: ${ptoType}`);
      return;
    }

    try {
      // Get current balance
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(ptoColumn)
        .eq("id", officerId)
        .single();

      if (profileError) throw profileError;

      const currentBalance = profile[ptoColumn as keyof typeof profile] as number || 0;
      
      // Update balance
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          [ptoColumn]: currentBalance + hours,
        })
        .eq("id", officerId);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error restoring PTO balance:', error);
      throw new Error(`Failed to restore PTO balance: ${error.message}`);
    }
  };

  // Update position mutation (unchanged)
  const updatePositionMutation = useMutation({
    mutationFn: async (params: UpdatePositionParams) => {
      console.log('📝 Updating position:', params);
      
      if (params.type === "recurring") {
        const { data: existingExceptions, error: checkError } = await supabase
          .from("schedule_exceptions")
          .select("id")
          .eq("officer_id", params.officerId)
          .eq("date", params.date)
          .eq("shift_type_id", params.shiftTypeId)
          .eq("is_off", false);

        if (checkError) throw checkError;

        const updateData = {
          position_name: params.positionName,
          unit_number: params.unitNumber,
          notes: params.notes
        };

        if (existingExceptions && existingExceptions.length > 0) {
          const { error } = await supabase
            .from("schedule_exceptions")
            .update(updateData)
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
              ...updateData,
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
    onError: (error: Error) => {
      console.error('❌ Error updating position:', error);
      toast.error(error.message || "Failed to update position");
    },
  });

  // Remove officer mutation (unchanged)
  const removeOfficerMutation = useMutation({
    mutationFn: async (params: RemoveOfficerParams) => {
      console.log('🗑️ Removing officer from schedule:', params);
      
      if (!params.scheduleId) {
        throw new Error("Missing schedule ID");
      }

      if (params.type === "exception") {
        const { error } = await supabase
          .from("schedule_exceptions")
          .delete()
          .eq("id", params.scheduleId);

        if (error) throw error;
      } else if (params.type === "recurring") {
        const { error } = await supabase
          .from("recurring_schedules")
          .update({
            end_date: new Date().toISOString().split('T')[0]
          })
          .eq("id", params.scheduleId);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Officer removed from schedule");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
      console.error('❌ Error removing officer:', error);
      toast.error(error.message || "Failed to remove officer");
    },
  });

  // Simplified and improved removePTOMutation
  const removePTOMutation = useMutation({
    mutationFn: async (ptoData: PTORemovalData) => {
      console.log('🗑️ Removing PTO:', ptoData);
      
      // Validate required fields
      if (!ptoData.id || !ptoData.officerId) {
        throw new Error("Missing required PTO data");
      }

      // Fetch the PTO record first
      const { data: ptoRecord, error: fetchError } = await supabase
        .from("schedule_exceptions")
        .select("*")
        .eq("id", ptoData.id)
        .single();

      if (fetchError) {
        throw new Error(`PTO record not found: ${fetchError.message}`);
      }

      // Verify this is actually a PTO record
      if (!ptoRecord.is_off) {
        throw new Error("Record is not marked as PTO");
      }

      // Get shift details or use provided times
      const startTime = ptoData.startTime || ptoRecord.custom_start_time;
      const endTime = ptoData.endTime || ptoRecord.custom_end_time;
      const shiftTypeId = ptoData.shiftTypeId || ptoRecord.shift_type_id;

      // If we have specific times, calculate hours; otherwise use default
      let hoursToRestore = 8; // Default
      
      if (startTime && endTime) {
        hoursToRestore = calculateHours(startTime, endTime);
      } else if (shiftTypeId) {
        // Get shift times from shift_types table
        const { data: shiftData } = await supabase
          .from("shift_types")
          .select("start_time, end_time")
          .eq("id", shiftTypeId)
          .single();

        if (shiftData?.start_time && shiftData?.end_time) {
          hoursToRestore = calculateHours(shiftData.start_time, shiftData.end_time);
        }
      }

      // Restore PTO balance before deleting
      await restorePTOBalance(ptoData.officerId, ptoData.ptoType, hoursToRestore);

      // Delete the PTO exception
      const { error: deleteError } = await supabase
        .from("schedule_exceptions")
        .delete()
        .eq("id", ptoData.id);

      if (deleteError) {
        throw deleteError;
      }

      console.log('✅ PTO successfully removed');
      return { success: true };
    },
    onSuccess: () => {
      toast.success("PTO removed and balance restored");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
      console.error('❌ Mutation error:', error);
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
