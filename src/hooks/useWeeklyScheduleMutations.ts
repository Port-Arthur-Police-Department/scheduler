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
  officerData?: any;
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

  // Define all mutations first
  const updatePositionMutation = useMutation({
    mutationFn: async (params: UpdatePositionParams) => {
      console.log('📝 Updating position:', params);
      
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
      console.error('❌ Error updating position:', error);
      toast.error(error.message || "Failed to update position");
    },
  });

  // Define removeOfficerMutation BEFORE using it
  const removeOfficerMutation = useMutation({
    mutationFn: async (params: RemoveOfficerParams) => {
      console.log('🗑️ Removing officer from schedule:', params);
      
      if (!params.scheduleId) {
        throw new Error("Missing schedule ID");
      }

      if (params.type === "exception") {
        // Delete from schedule_exceptions table
        const { error } = await supabase
          .from("schedule_exceptions")
          .delete()
          .eq("id", params.scheduleId);

        if (error) throw error;
      } else if (params.type === "recurring") {
        // For recurring schedules, we need to end the recurring schedule
        // by setting an end date (today's date)
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
    onError: (error: any) => {
      console.error('❌ Error removing officer:', error);
      toast.error(error.message || "Failed to remove officer");
    },
  });

  // Define removePTOMutation
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
      console.log('🗑️ Removing PTO:', ptoData);
      
      // Validate required fields
      if (!ptoData.id) {
        throw new Error("Missing PTO ID");
      }
      
      if (!ptoData.officerId) {
        throw new Error("Missing officer ID");
      }

      // First, try to get the actual PTO exception from the database to ensure it exists
      const { data: ptoRecord, error: fetchError } = await supabase
        .from("schedule_exceptions")
        .select("id, officer_id, date, shift_type_id, reason, custom_start_time, custom_end_time")
        .eq("id", ptoData.id)
        .single();

      if (fetchError) {
        console.error('Error fetching PTO record:', fetchError);
        // Try an alternative approach - look for any PTO for this officer on this date
        const { data: alternativeRecords, error: altError } = await supabase
          .from("schedule_exceptions")
          .select("id, officer_id, date, shift_type_id, reason, custom_start_time, custom_end_time")
          .eq("officer_id", ptoData.officerId)
          .eq("date", ptoData.date)
          .eq("is_off", true);

        if (altError) {
          throw new Error(`Could not find PTO record: ${fetchError.message}`);
        }

        if (!alternativeRecords || alternativeRecords.length === 0) {
          throw new Error("No PTO record found for this officer and date");
        }

        // Use the first found record
        const foundRecord = alternativeRecords[0];
        console.log('Found alternative PTO record:', foundRecord);
        
        // Update ptoData with the found record's information
        ptoData.id = foundRecord.id;
        ptoData.shiftTypeId = foundRecord.shift_type_id || ptoData.shiftTypeId;
        ptoData.ptoType = foundRecord.reason || ptoData.ptoType;
        ptoData.startTime = foundRecord.custom_start_time || ptoData.startTime;
        ptoData.endTime = foundRecord.custom_end_time || ptoData.endTime;
      }
      
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

      if (deleteError) {
        console.error('Error deleting PTO exception:', deleteError);
        throw deleteError;
      }

      // Also delete any associated working time exception
      await supabase
        .from("schedule_exceptions")
        .delete()
        .eq("officer_id", ptoData.officerId)
        .eq("date", ptoData.date)
        .eq("shift_type_id", ptoData.shiftTypeId)
        .eq("is_off", false);

      console.log('✅ PTO successfully removed');
      return { success: true };
    },
    onSuccess: () => {
      toast.success("PTO removed and balance restored");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: any) => {
      console.error('❌ Mutation error:', error);
      toast.error(error.message || "Failed to remove PTO");
    },
  });

  // Return all mutations in the correct order
  return {
    updatePositionMutation,
    removeOfficerMutation, // This was being referenced before it was defined
    removePTOMutation,
    queryKey
  };
};
