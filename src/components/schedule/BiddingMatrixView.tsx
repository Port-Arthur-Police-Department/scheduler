// src/components/schedule/BiddingMatrixView.tsx
import { ShiftBiddingRound, ShiftBiddingQueueItem, ShiftTypeAllowedPosition } from "@/hooks/useShiftBidding";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Shield } from "lucide-react";

interface BiddingMatrixViewProps {
  round: ShiftBiddingRound | undefined;
  queue: ShiftBiddingQueueItem[];
  shiftTypes: any[];
  allAllowedPositions: ShiftTypeAllowedPosition[];
}

export const BiddingMatrixView = ({
  round,
  queue,
  shiftTypes,
  allAllowedPositions,
}: BiddingMatrixViewProps) => {
  if (!round) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No active bidding round selected.
      </div>
    );
  }

  const completedCount = queue.filter(q => q.status === 'completed').length;
  const totalCount = queue.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-primary/5 border-primary/20 shadow-sm">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Round</div>
          <div className="text-lg font-bold text-primary mt-1 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Division {round.division} ({round.year})
          </div>
        </Card>
        <Card className="p-4 bg-card shadow-sm">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Officers in Queue</div>
          <div className="text-lg font-bold mt-1">{totalCount}</div>
        </Card>
        <Card className="p-4 bg-card shadow-sm">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completed Selections</div>
          <div className="text-lg font-bold text-green-600 mt-1">
            {completedCount} / {totalCount} ({totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%)
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        {shiftTypes.map(shift => {
          const shiftPositions = allAllowedPositions.filter(p => p.shift_type_id === shift.id);
          if (shiftPositions.length === 0) return null;

          return (
            <div key={shift.id} className="border rounded-xl p-5 bg-card shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base">{shift.name}</h3>
                  <Badge variant="outline" className="text-xs font-normal">
                    {shift.start_time} - {shift.end_time}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground font-medium">
                  {shiftPositions.length} position{shiftPositions.length === 1 ? '' : 's'} configured
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {shiftPositions.map(pos => {
                  const claimedItem = queue.find(
                    q => q.selected_shift_type_id === shift.id && q.selected_position_name === pos.position_name
                  );

                  return (
                    <div
                      key={pos.id}
                      className={`p-3.5 rounded-lg border flex flex-col justify-between gap-2.5 transition-colors ${
                        claimedItem ? 'bg-secondary/20 border-secondary/60' : 'bg-card border-dashed border-muted-foreground/30 hover:border-primary/50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm truncate" title={pos.position_name}>
                            {pos.position_name}
                          </span>
                          <Badge variant={claimedItem ? "default" : "outline"} className="text-[10px] shrink-0">
                            {claimedItem ? "Claimed" : "Available"}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <span>Rank:</span>
                          <span className="font-medium text-foreground">{pos.allowed_rank || "Any"}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t mt-1 flex items-center justify-between text-xs">
                        {claimedItem ? (
                          <div className="flex items-center gap-1.5 text-foreground font-medium truncate">
                            <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="truncate" title={claimedItem.profiles?.full_name}>
                              {claimedItem.profiles?.full_name} (#{claimedItem.profiles?.badge_number || "N/A"})
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic flex items-center gap-1 text-[11px]">
                            <Clock className="h-3 w-3" /> Available for selection
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
