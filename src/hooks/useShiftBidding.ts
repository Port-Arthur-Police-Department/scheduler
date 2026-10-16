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
    mutationFn: async ({ year, division }: { year: number; division: 'FOD' | 'CID' | 'Admin' }) => {
      const { data, error } = await supabase
        .from("shift_bidding_rounds")
        .insert({ year, division, status: 'setup', current_turn_index: 0 })
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
      // 1. Update queue item
      const { error: queueError } = await supabase
        .from("shift_bidding_queue")
        .update({
          selected_shift_type_id: shiftTypeId,
          selected_position_name: positionName,
          status: 'completed',
          selected_at: new Date().toISOString(),
        })
        .eq("id", queueItemId);

      if (queueError) throw queueError;

      // 2. Check if there is a next officer in queue
      const { data: nextOfficer } = await supabase
        .from("shift_bidding_queue")
        .select("id")
        .eq("round_id", roundId)
        .eq("turn_index", nextTurnIndex)
        .single();

      if (nextOfficer) {
        // Set next officer to active
        await supabase
          .from("shift_bidding_queue")
          .update({ status: 'active' })
          .eq("id", nextOfficer.id);

        // Update round current turn index
        await supabase
          .from("shift_bidding_rounds")
          .update({ current_turn_index: nextTurnIndex, updated_at: new Date().toISOString() })
          .eq("id", roundId);
      } else {
        // Round completed!
        await supabase
          .from("shift_bidding_rounds")
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq("id", roundId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift_bidding_queue"] });
      queryClient.invalidateQueries({ queryKey: ["shift_bidding_rounds"] });
      toast.success("Shift selection confirmed successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to submit shift selection");
    },
  });

  const saveAllowedPositions = useMutation({
    mutationFn: async ({ shiftTypeId, positions }: { shiftTypeId: string; positions: string[] }) => {
      // Delete existing allowed positions for this shift type
      await supabase
        .from("shift_type_allowed_positions")
        .delete()
        .eq("shift_type_id", shiftTypeId);

      if (positions.length > 0) {
        const records = positions.map((pos) => ({
          shift_type_id: shiftTypeId,
          position_name: pos.trim(),
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
      toast.success("Allowed positions updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update allowed positions");
    },
  });

  return {
    createRound,
    updateRoundStatus,
    generateQueue,
    submitSelection,
    saveAllowedPositions,
  };
};
