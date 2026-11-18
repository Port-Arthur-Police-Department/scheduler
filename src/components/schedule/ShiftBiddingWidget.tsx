// src/components/schedule/ShiftBiddingWidget.tsx
import { useState, useEffect } from "react";
import { useShiftBiddingRounds, useBiddingQueue, useShiftBiddingMutations, useShiftTypeAllowedPositions } from "@/hooks/useShiftBidding";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, CheckCircle2, AlertCircle, Shield, ArrowRight, User } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ShiftBiddingWidgetProps {
  currentOfficerId?: string;
  officerDivision?: string | null;
}

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const ShiftBiddingWidget = ({ currentOfficerId, officerDivision }: ShiftBiddingWidgetProps) => {
  const { isAdminOrSupervisor, isSupervisor } = useUserRole(currentOfficerId);
  const { data: rounds = [], isLoading: roundsLoading } = useShiftBiddingRounds();

  // Find the active round for this officer.
  // We check for a division match, but also fall back to checking if the officer is in the queue
  // of ANY active round, or simply return ANY active round if the officer is currently picking or in the queue.
  const { data: activeRound } = useQuery({
    queryKey: ["active_round_for_officer", currentOfficerId, officerDivision],
    queryFn: async () => {
      if (!currentOfficerId || rounds.length === 0) return null;

      const activeRounds = rounds.filter(r => r.status === 'active');
      if (activeRounds.length === 0) return null;

      // 1. Check if officer has a queue entry in any active round
      const { data: queueItems } = await supabase
        .from("shift_bidding_queue")
        .select("*, shift_bidding_rounds(*)")
        .eq("officer_id", currentOfficerId)
        .in("round_id", activeRounds.map(r => r.id));

      if (queueItems && queueItems.length > 0) {
        // Prefer an active or pending turn
        const priorityItem = queueItems.find(q => q.status === 'active' || q.status === 'pending');
        if (priorityItem && priorityItem.shift_bidding_rounds) return priorityItem.shift_bidding_rounds;

        // Fallback to any item in an active round
        const anyItem = queueItems.find(q => q.shift_bidding_rounds);
        if (anyItem && anyItem.shift_bidding_rounds) return anyItem.shift_bidding_rounds;
      }

      // 2. Try matching by division
      const matchingRound = activeRounds.find(r => r.division === officerDivision);
      if (matchingRound) return matchingRound;

      // 3. Fallback: If there is an active round and the officer is an admin/supervisor or in the queue, show it
      return activeRounds[0];
    },
    enabled: !!currentOfficerId && rounds.length > 0,
  });

  const { data: queue = [], isLoading: queueLoading } = useBiddingQueue(activeRound?.id);
  const { submitSelection } = useShiftBiddingMutations();

  const [selectedShiftTypeId, setSelectedShiftTypeId] = useState<string>("");
  const [selectedPosition, setSelectedPosition] = useState<string>("");
  const [requestPtoDays, setRequestPtoDays] = useState<boolean>(false);
  // Block 1 (4 days)
  const [ptoStartDate1, setPtoStartDate1] = useState<string>("");
  const [ptoEndDate1, setPtoEndDate1] = useState<string>("");
  // Block 2 (4 days)
  const [ptoStartDate2, setPtoStartDate2] = useState<string>("");
  const [ptoEndDate2, setPtoEndDate2] = useState<string>("");

  useEffect(() => {
    if (activeRound?.year && requestPtoDays) {
      const year = activeRound.year;
      if (!ptoStartDate1) setPtoStartDate1(`${year}-01-01`);
      if (!ptoEndDate1) setPtoEndDate1(`${year}-01-05`);
      if (!ptoStartDate2) setPtoStartDate2(`${year}-02-01`);
      if (!ptoEndDate2) setPtoEndDate2(`${year}-02-05`);
    }
  }, [activeRound?.year, requestPtoDays]);

  // Fetch shift types
  const { data: shiftTypes = [] } = useQuery({
    queryKey: ["shift_types_for_bidding_widget"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shift_types").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch allowed positions for selected shift type
  const { data: allowedPositions = [] } = useShiftTypeAllowedPositions(selectedShiftTypeId);

  const myQueueItem = queue.find(q => q.officer_id === currentOfficerId);
  const officerRank = myQueueItem?.profiles?.rank || "";
  const officerRankLower = officerRank.toLowerCase();

  // Filter allowed positions based on rank restriction and whether already claimed by another officer
  const filteredAllowedPositions = allowedPositions.filter(ap => {
    const isClaimedByOther = queue.some(
      q => q.selected_shift_type_id === selectedShiftTypeId &&
           q.selected_position_name === ap.position_name &&
           q.officer_id !== currentOfficerId
    );
    if (isClaimedByOther) return false;

    if (!ap.allowed_rank || ap.allowed_rank === 'Any' || ap.allowed_rank === '') return true;
    const requiredRankLower = ap.allowed_rank.toLowerCase();
    return officerRankLower.includes(requiredRankLower);
  });

  const selectedPositionObj = allowedPositions.find(p => p.position_name === selectedPosition);

  const isMyTurn = myQueueItem?.status === 'active';
  const isCompleted = myQueueItem?.status === 'completed';

  const handleSubmitSelection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRound || !myQueueItem) return;
    if (!selectedShiftTypeId) {
      toast.error("Please select a shift type");
      return;
    }
    if (!selectedPosition) {
      toast.error("Please select a position");
      return;
    }
    if (requestPtoDays && ((!ptoStartDate1 || !ptoEndDate1) && (!ptoStartDate2 || !ptoEndDate2))) {
      toast.error("Please provide at least one 4-day PTO work week block");
      return;
    }

    const nextTurnIndex = myQueueItem.turn_index + 1;

    submitSelection.mutate({
      roundId: activeRound.id,
      queueItemId: myQueueItem.id,
      shiftTypeId: selectedShiftTypeId,
      positionName: selectedPosition,
      nextTurnIndex,
      requestPtoDays,
      ptoStartDate1,
      ptoEndDate1,
      ptoStartDate2,
      ptoEndDate2,
    }, {
      onSuccess: () => {
        setSelectedShiftTypeId("");
        setSelectedPosition("");
        setRequestPtoDays(false);
        setPtoStartDate1("");
        setPtoEndDate1("");
        setPtoStartDate2("");
        setPtoEndDate2("");
      }
    });
  };

  if (roundsLoading || queueLoading) {
    return (
      <Card className="shadow-md">
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Loading shift bidding status...
        </CardContent>
      </Card>
    );
  }

  if (!activeRound) {
    return null;
  }

  const currentlyActiveQueueItem = queue.find(q => q.status === 'active');
  const activeOfficerName = currentlyActiveQueueItem?.profiles?.full_name || "Another officer";

  // Supervisor override form state
  const [overrideOfficerId, setOverrideOfficerId] = useState<string>("");
  const [overrideShiftTypeId, setOverrideShiftTypeId] = useState<string>("");
  const [overridePosition, setOverridePosition] = useState<string>("");

  const selectedOverrideQueueItem = queue.find(q => q.officer_id === (overrideOfficerId || currentlyActiveQueueItem?.officer_id)) || currentlyActiveQueueItem;

  const { data: overrideAllowedPositions = [] } = useShiftTypeAllowedPositions(overrideShiftTypeId);
  const overrideRank = selectedOverrideQueueItem?.profiles?.rank || "";
  const overrideRankLower = overrideRank.toLowerCase();

  const filteredOverrideAllowedPositions = overrideAllowedPositions.filter(ap => {
    const isClaimedByOther = queue.some(
      q => q.selected_shift_type_id === overrideShiftTypeId &&
           q.selected_position_name === ap.position_name &&
           q.officer_id !== selectedOverrideQueueItem?.officer_id
    );
    if (isClaimedByOther) return false;
    if (!ap.allowed_rank || ap.allowed_rank === 'Any' || ap.allowed_rank === '') return true;
    return overrideRankLower.includes(ap.allowed_rank.toLowerCase());
  });

  const handleSupervisorOverrideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRound || !selectedOverrideQueueItem) return;
    if (!overrideShiftTypeId) {
      toast.error("Please select a shift type");
      return;
    }
    if (!overridePosition) {
      toast.error("Please select a position");
      return;
    }

    const isCurrentTurn = selectedOverrideQueueItem.status === 'active';
    const nextTurnIndex = isCurrentTurn ? activeRound.current_turn_index + 1 : activeRound.current_turn_index;

    submitSelection.mutate({
      roundId: activeRound.id,
      queueItemId: selectedOverrideQueueItem.id,
      shiftTypeId: overrideShiftTypeId,
      positionName: overridePosition,
      nextTurnIndex,
      isOverride: true,
    }, {
      onSuccess: () => {
        setOverrideShiftTypeId("");
        setOverridePosition("");
        toast.success(`Supervisor override successful for ${selectedOverrideQueueItem.profiles?.full_name}`);
      }
    });
  };

  return (
    <Card className={`shadow-md border-2 ${isMyTurn ? "border-primary bg-primary/5" : "border-border"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {activeRound.year} Division {activeRound.division} Shift Bidding
          </CardTitle>
          <Badge variant={isMyTurn ? "default" : "secondary"}>
            {isMyTurn ? "YOUR TURN TO PICK!" : isCompleted ? "SELECTION CONFIRMED" : "WAITING IN QUEUE"}
          </Badge>
        </div>
        <CardDescription className="space-y-1">
          <div>
            Seniority-based shift selection for Division {activeRound.division}. Officer Rank: {officerRank || "Officer"}
          </div>
          {activeRound.start_date && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary pt-0.5">
              <Calendar className="h-3.5 w-3.5" />
              Effective Start Date: {activeRound.start_date} ({activeRound.year})
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdminOrSupervisor && (
          <div className="p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400 text-sm">
                <Shield className="h-4 w-4" />
                Supervisor / Admin Override & Selection Panel
              </div>
              <Badge variant="outline" className="bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30 text-xs">
                Supervisor Mode
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Make shift selections or override turns on behalf of officers in the bidding queue directly from the home screen.
            </p>

            <form onSubmit={handleSupervisorOverrideSubmit} className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Select Officer / Queue Member</label>
                <Select
                  value={overrideOfficerId || currentlyActiveQueueItem?.officer_id || ""}
                  onValueChange={(val) => {
                    setOverrideOfficerId(val);
                    setOverrideShiftTypeId("");
                    setOverridePosition("");
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select officer from queue..." />
                  </SelectTrigger>
                  <SelectContent>
                    {queue.map(q => (
                      <SelectItem key={q.id} value={q.officer_id} className="text-xs">
                        #{q.turn_index + 1} — {q.profiles?.full_name || "Officer"} ({q.profiles?.rank || "Officer"}) {q.status === 'active' ? '⭐ [CURRENT PICKER]' : q.status === 'completed' ? '✓ [Completed]' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Select Shift Type</label>
                <Select
                  value={overrideShiftTypeId}
                  onValueChange={(val) => {
                    setOverrideShiftTypeId(val);
                    setOverridePosition("");
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Choose shift type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {shiftTypes.map(st => (
                      <SelectItem key={st.id} value={st.id} className="text-xs">
                        {st.name} ({st.start_time} - {st.end_time})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {overrideShiftTypeId && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Select Position / Assignment</label>
                  <Select
                    value={overridePosition}
                    onValueChange={setOverridePosition}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Choose allowed position for rank..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredOverrideAllowedPositions.length === 0 ? (
                        <div className="p-2 text-xs text-muted-foreground text-center">
                          No positions allowed for rank ({overrideRank || "Officer"}) in this shift.
                        </div>
                      ) : (
                        filteredOverrideAllowedPositions.map(ap => (
                          <SelectItem key={ap.id} value={ap.position_name} className="text-xs">
                            {ap.position_name} {ap.allowed_rank && ap.allowed_rank !== 'Any' ? `(Rank: ${ap.allowed_rank})` : ''}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                type="submit"
                size="sm"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                disabled={submitSelection.isPending || !overrideShiftTypeId || !overridePosition || !selectedOverrideQueueItem}
              >
                Submit Selection on Behalf (Supervisor Override)
              </Button>
            </form>
          </div>
        )}

        {isCompleted ? (
          <div className="p-4 bg-muted/40 rounded-lg border space-y-2 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto" />
            <h3 className="font-semibold text-foreground">Shift Selection Confirmed</h3>
            <p className="text-sm text-muted-foreground">
              You successfully selected your shift for {activeRound.year}.
            </p>
          </div>
        ) : isMyTurn ? (
          <form onSubmit={handleSubmitSelection} className="space-y-4 p-4 bg-card rounded-lg border shadow-sm">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <Clock className="h-4 w-4 animate-spin" />
              It is your turn in the seniority queue! Make your selection below.
            </div>

            {activeRound.start_date && (
              <div className="p-2.5 bg-primary/10 rounded-md text-xs text-primary font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>Your selected shift will be applied to your official schedule starting on <strong>{activeRound.start_date}</strong>.</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Select Shift Type</label>
              <Select
                value={selectedShiftTypeId}
                onValueChange={(val) => {
                  setSelectedShiftTypeId(val);
                  setSelectedPosition("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose shift type..." />
                </SelectTrigger>
                <SelectContent>
                  {shiftTypes.map(st => (
                    <SelectItem key={st.id} value={st.id}>
                      {st.name} ({st.start_time} - {st.end_time})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedShiftTypeId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Position / Assignment</label>
                <Select
                  value={selectedPosition}
                  onValueChange={setSelectedPosition}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose allowed position for your rank..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredAllowedPositions.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground text-center">
                        No positions allowed for your rank ({officerRank || "Officer"}) in this shift.
                      </div>
                    ) : (
                      filteredAllowedPositions.map(ap => (
                        <SelectItem key={ap.id} value={ap.position_name}>
                          {ap.position_name} {ap.allowed_rank && ap.allowed_rank !== 'Any' ? `(Rank: ${ap.allowed_rank})` : ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedPositionObj && selectedPositionObj.recurring_days && selectedPositionObj.recurring_days.length > 0 && (
                  <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border mt-1">
                    📅 Recurring Schedule Days: {selectedPositionObj.recurring_days.map(d => dayNames[d]).join(", ")} (Will automatically apply to your annual schedule upon confirmation)
                  </p>
                )}
              </div>
            )}

            {/* Optional PTO Request (Two 4-day work week blocks) */}
            <div className="pt-2 border-t space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="request-pto-checkbox"
                  checked={requestPtoDays}
                  onChange={(e) => setRequestPtoDays(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="request-pto-checkbox" className="text-sm font-medium text-foreground cursor-pointer">
                  Request two 4-day work week PTO blocks (8 days total) with this shift selection
                </label>
              </div>

              {requestPtoDays && (
                <div className="p-3 bg-muted/30 rounded-lg border space-y-4">
                  <p className="text-xs text-muted-foreground">
                    This will submit two separate pending PTO requests (4 days / 40 hours each, 8 days / 80 hours total) to <b>The Book</b> for supervisor review and approval.
                  </p>

                  {/* Block 1 */}
                  <div className="space-y-1.5 p-2 bg-background rounded border">
                    <label className="text-xs font-semibold text-primary">Work Week Block 1 (4 Days)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] text-muted-foreground">Start Date</label>
                        <input
                          type="date"
                          value={ptoStartDate1}
                          onChange={(e) => setPtoStartDate1(e.target.value)}
                          className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground shadow-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-muted-foreground">End Date</label>
                        <input
                          type="date"
                          value={ptoEndDate1}
                          onChange={(e) => setPtoEndDate1(e.target.value)}
                          className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground shadow-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Block 2 */}
                  <div className="space-y-1.5 p-2 bg-background rounded border">
                    <label className="text-xs font-semibold text-primary">Work Week Block 2 (4 Days)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] text-muted-foreground">Start Date</label>
                        <input
                          type="date"
                          value={ptoStartDate2}
                          onChange={(e) => setPtoStartDate2(e.target.value)}
                          className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground shadow-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-muted-foreground">End Date</label>
                        <input
                          type="date"
                          value={ptoEndDate2}
                          onChange={(e) => setPtoEndDate2(e.target.value)}
                          className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={submitSelection.isPending || !selectedShiftTypeId || !selectedPosition}>
              Confirm & Lock Shift Selection
            </Button>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-muted/40 rounded-lg border text-sm flex items-center justify-between">
              <div>
                <span className="text-muted-foreground">Your Queue Position:</span>{" "}
                <span className="font-semibold">
                  {myQueueItem ? `#${myQueueItem.turn_index + 1}` : "Not in queue"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Currently Picking:</span>{" "}
                <span className="font-semibold text-primary">{activeOfficerName}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              The system will notify you or allow you to pick as soon as officers ahead of you in seniority complete their selections.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
