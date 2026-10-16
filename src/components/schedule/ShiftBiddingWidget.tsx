// src/components/schedule/ShiftBiddingWidget.tsx
import { useState } from "react";
import { useShiftBiddingRounds, useBiddingQueue, useShiftBiddingMutations, useShiftTypeAllowedPositions } from "@/hooks/useShiftBidding";
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
  const { data: rounds = [], isLoading: roundsLoading } = useShiftBiddingRounds();
  const activeRound = rounds.find(r => r.division === officerDivision && r.status === 'active');
  const { data: queue = [], isLoading: queueLoading } = useBiddingQueue(activeRound?.id);
  const { submitSelection } = useShiftBiddingMutations();

  const [selectedShiftTypeId, setSelectedShiftTypeId] = useState<string>("");
  const [selectedPosition, setSelectedPosition] = useState<string>("");

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

  // Filter allowed positions based on officer rank restriction
  const filteredAllowedPositions = allowedPositions.filter(ap => {
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

    const nextTurnIndex = myQueueItem.turn_index + 1;

    submitSelection.mutate({
      roundId: activeRound.id,
      queueItemId: myQueueItem.id,
      shiftTypeId: selectedShiftTypeId,
      positionName: selectedPosition,
      nextTurnIndex,
    }, {
      onSuccess: () => {
        setSelectedShiftTypeId("");
        setSelectedPosition("");
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
