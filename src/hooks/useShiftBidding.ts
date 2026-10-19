// src/hooks/useShiftBidding.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sortOfficersConsistently } from "@/utils/sortingUtils";
import { toast } from "sonner";

export interface ShiftBiddingRound {
  id: string;
  year: number;
  division: 'FOD' | 'CID' | 'Admin';
  status: 'setup' | 'active' | 'paused' | 'completed';
  current_turn_index: number;
  start_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShiftBiddingQueueItem {
  id: string;
  round_id: string;
  officer_id: string;
  turn_index: number;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  selected_shift_type_id: string | null;
  selected_position_name: string | null;
  selected_at: string | null;
  created_at: string;
  profiles?: {
    id: string;
    full_name: string;
    badge_number: string | null;
    rank: string | null;
    division: string | null;
    hire_date: string | null;
    promotion_date_sergeant: string | null;
    promotion_date_lieutenant: string | null;
    service_credit_override: number | null;
    avatar_url: string | null;
  };
  shift_types?: {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
  };
}

export interface ShiftTypeAllowedPosition {
  id: string;
  shift_type_id: string;
  position_name: string;
  allowed_rank: string | null;
  recurring_days: number[] | null;
  created_at: string;
}

export const useShiftBiddingRounds = () => {
  return useQuery({
    queryKey: ["shift_bidding_rounds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_bidding_rounds")
        .select("*")
        .order("year", { ascending: false });

      if (error) throw error;
      return data as ShiftBiddingRound[];
    },
  });
};

export const useBiddingQueue = (roundId?: string) => {
  return useQuery({
    queryKey: ["shift_bidding_queue", roundId],
    queryFn: async () => {
      if (!roundId) return [];
      const { data, error } = await supabase
        .from("shift_bidding_queue")
        .select(`
          *,
          profiles:officer_id (*),
          shift_types:selected_shift_type_id (id, name, start_time, end_time)
        `)
        .eq("round_id", roundId)
        .order("turn_index", { ascending: true });

      if (error) throw error;
      return data as ShiftBiddingQueueItem[];
    },
    enabled: !!roundId,
  });
};

export const useShiftTypeAllowedPositions = (shiftTypeId?: string) => {
  return useQuery({
    queryKey: ["shift_type_allowed_positions", shiftTypeId],
    queryFn: async () => {
      if (!shiftTypeId) return [];
      const { data, error } = await supabase
        .from("shift_type_allowed_positions")
        .select("*")
        .eq("shift_type_id", shiftTypeId);

      if (error) throw error;
      return data as ShiftTypeAllowedPosition[];
    },
    enabled: !!shiftTypeId,
  });
};

export const useAllAllowedPositions = () => {
  return useQuery({
    queryKey: ["all_shift_type_allowed_positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_type_allowed_positions")
        .select("*");

      if (error) throw error;
      return data as ShiftTypeAllowedPosition[];
    },
  });
};

export const useShiftBiddingMutations = () => {
  const queryClient = useQueryClient();

  const createRound = useMutation({
    mutationFn: async ({ year, division, startDate }: { year: number; division: 'FOD' | 'CID' | 'Admin'; startDate?: string }) => {
      const { data, error } = await supabase
        .from("shift_bidding_rounds")
        .insert({
          year,
          division,
          status: 'setup',
          current_turn_index: 0,
          start_date: startDate || `${year}-01-01`
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift_bidding_rounds"] });
      toast.success("Shift bidding round created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create bidding round");
    },
  });

  const updateRoundStatus = useMutation({
    mutationFn: async ({ roundId, status, currentTurnIndex }: { roundId: string; status: 'setup' | 'active' | 'paused' | 'completed'; currentTurnIndex?: number }) => {
      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (currentTurnIndex !== undefined) {
        updateData.current_turn_index = currentTurnIndex;
      }

      const { error } = await supabase
        .from("shift_bidding_rounds")
        .update(updateData)
        .eq("id", roundId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift_bidding_rounds"] });
      toast.success("Bidding round status updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update round status");
    },
  });

  const deleteRound = useMutation({
    mutationFn: async (roundId: string) => {
      await supabase
        .from("shift_bidding_queue")
        .delete()
        .eq("round_id", roundId);

      const { error } = await supabase
        .from("shift_bidding_rounds")
        .delete()
        .eq("id", roundId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift_bidding_rounds"] });
      queryClient.invalidateQueries({ queryKey: ["shift_bidding_queue"] });
      toast.success("Bidding round deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete bidding round");
    },
  });

  const generateQueue = useMutation({
    mutationFn: async ({ roundId, division }: { roundId: string; division: string }) => {
      // 1. Fetch profiles for this division
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("division", division);

      if (profileError) throw profileError;
      if (!profiles || profiles.length === 0) {
        throw new Error(`No officers found assigned to division ${division}`);
      }

      // 2. Sort officers consistently using seniority sorting algorithm
      const sortedOfficers = sortOfficersConsistently(profiles);

      // 3. Clear existing queue for this round
      await supabase
        .from("shift_bidding_queue")
        .delete()
        .eq("round_id", roundId);

      // 4. Insert sorted officers into queue
      const queueItems = sortedOfficers.map((officer, index) => ({
        round_id: roundId,
        officer_id: officer.id,
        turn_index: index,
        status: index === 0 ? 'active' : 'pending',
      }));

      const { error: insertError } = await supabase
        .from("shift_bidding_queue")
        .insert(queueItems);

      if (insertError) throw insertError;

      // 5. Update round status to active and set current turn index to 0
      const { error: roundError } = await supabase
        .from("shift_bidding_rounds")
        .update({ status: 'active', current_turn_index: 0, updated_at: new Date().toISOString() })
        .eq("id", roundId);

      if (roundError) throw roundError;

      return sortedOfficers.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["shift_bidding_queue"] });
      queryClient.invalidateQueries({ queryKey: ["shift_bidding_rounds"] });
      toast.success(`Seniority queue generated successfully with ${count} officers`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to generate seniority queue");
    },
  });

  const submitSelection = useMutation({
    mutationFn: async ({
      roundId,
      queueItemId,
      shiftTypeId,
      positionName,
      nextTurnIndex,
    }: {
      roundId: string;
      queueItemId: string;
      shiftTypeId: string;
      positionName: string;
      nextTurnIndex: number;
      isLastTurn?: boolean;
    }) => {
      // 1. Get queue item & round details (officer_id, round year)
      const { data: queueItem, error: queueItemError } = await supabase
        .from("shift_bidding_queue")
        .select("officer_id, round_id")
        .eq("id", queueItemId)
        .single();

      if (queueItemError || !queueItem) throw new Error("Queue item not found");

      const { data: round, error: roundError } = await supabase
        .from("shift_bidding_rounds")
        .select("year, start_date")
        .eq("id", roundId)
        .single();

      if (roundError || !round) throw new Error("Bidding round not found");

      // 2. Update queue item with selection
      const { error: updateQueueError } = await supabase
        .from("shift_bidding_queue")
        .update({
          selected_shift_type_id: shiftTypeId,
          selected_position_name: positionName,
          status: 'completed',
          selected_at: new Date().toISOString(),
        })
        .eq("id", queueItemId);

      if (updateQueueError) throw updateQueueError;

      // 3. Fetch allowed position configuration for recurring days & rank
      const { data: allowedPos } = await supabase
        .from("shift_type_allowed_positions")
        .select("*")
        .eq("shift_type_id", shiftTypeId)
        .eq("position_name", positionName)
        .single();

      // 4. If recurring days are configured, end existing overlapping schedules and populate new recurring schedules
      if (allowedPos && allowedPos.recurring_days && allowedPos.recurring_days.length > 0) {
        const year = round.year;
        const startDateStr = round.start_date || `${year}-01-01`;
        const endDateStr = `${year}-12-31`;

        // End any other recurring schedules the user has so they don't have overlapping schedules
        const prevDate = new Date(startDateStr);
        prevDate.setDate(prevDate.getDate() - 1);
        const dayBeforeStart = prevDate.toISOString().split('T')[0];

        await supabase
          .from("recurring_schedules")
          .update({ end_date: dayBeforeStart })
          .eq("officer_id", queueItem.officer_id)
          .or(`end_date.is.null,end_date.gte.${startDateStr}`);

        // Check if officer has a default assignment set in their profile for this start date
        const { data: defaultAssignments } = await supabase
          .from("officer_default_assignments")
          .select("*")
          .eq("officer_id", queueItem.officer_id)
          .lte("start_date", startDateStr)
          .or(`end_date.is.null,end_date.gte.${startDateStr}`)
          .order("start_date", { ascending: false })
          .limit(1);

        const activeDefaultAssignment = defaultAssignments && defaultAssignments.length > 0 ? defaultAssignments[0] : null;
        const defaultPositionName = activeDefaultAssignment ? activeDefaultAssignment.position_name : null;
        const defaultUnitNumber = activeDefaultAssignment ? activeDefaultAssignment.unit_number : null;

        const scheduleRecords = allowedPos.recurring_days.map((dayOfWeek: number) => ({
          officer_id: queueItem.officer_id,
          shift_type_id: shiftTypeId,
          day_of_week: dayOfWeek,
          start_date: startDateStr,
          end_date: endDateStr,
          position_name: defaultPositionName, // Blank by default unless a default assignment has been set in their profile
          unit_number: defaultUnitNumber,
          week_offset: null, // Every week
        }));

        const { error: scheduleInsertError } = await supabase
          .from("recurring_schedules")
          .insert(scheduleRecords);

        if (scheduleInsertError) {
          console.error("Error inserting recurring schedules from shift bidding:", scheduleInsertError);
          // Non-blocking for selection, but log error
        }
      }

      // 5. Advance queue to next officer or complete round
      // Only advance the active turn if it's a normal selection or if we are overriding the currently active person
      const isOutOfTurnOverride = isOverride && queueItem.status !== 'active';

      if (!isOutOfTurnOverride) {
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
        } else {
          await supabase
            .from("shift_bidding_rounds")
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq("id", roundId);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift_bidding_queue"] });
      queryClient.invalidateQueries({ queryKey: ["shift_bidding_rounds"] });
      queryClient.invalidateQueries({ queryKey: ["officer-schedules"] });
      toast.success("Shift selection confirmed and official schedule updated successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to submit shift selection");
    },
  });

  const saveAllowedPositions = useMutation({
    mutationFn: async ({
      shiftTypeId,
      positions,
    }: {
      shiftTypeId: string;
      positions: Array<{ position_name: string; allowed_rank?: string; recurring_days?: number[] }>;
    }) => {
      // Delete existing allowed positions for this shift type
      await supabase
        .from("shift_type_allowed_positions")
        .delete()
        .eq("shift_type_id", shiftTypeId);

      if (positions.length > 0) {
        const records = positions.map((pos) => ({
          shift_type_id: shiftTypeId,
          position_name: pos.position_name.trim(),
          allowed_rank: pos.allowed_rank || 'Any',
          recurring_days: pos.recurring_days || [],
        }));

        const { error } = await supabase
          .from("shift_type_allowed_positions")
          .insert(records);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift_type_allowed_positions"] });
      queryClient.invalidateQueries({ queryKey: ["all_shift_type_allowed_positions"] });
      toast.success("Allowed positions and schedule rules updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update allowed positions");
    },
  });

  return {
    createRound,
    updateRoundStatus,
    deleteRound,
    generateQueue,
    submitSelection,
    saveAllowedPositions,
  };
};
