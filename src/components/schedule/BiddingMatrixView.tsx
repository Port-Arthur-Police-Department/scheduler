// src/components/schedule/BiddingMatrixView.tsx
import { ShiftBiddingRound, ShiftBiddingQueueItem, ShiftTypeAllowedPosition } from "@/hooks/useShiftBidding";
import { Card } from "@/components/ui/card";
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

  // Flatten all positions with their shift type details
  const allPositionsWithShift = shiftTypes.flatMap(shift => {
    const shiftPositions = allAllowedPositions.filter(p => p.shift_type_id === shift.id);
    return shiftPositions.map(pos => {
      const claimedItem = queue.find(
        q => q.selected_shift_type_id === shift.id && q.selected_position_name === pos.position_name
      );
      return {
        ...pos,
        shiftName: shift.name,
        shiftTime: `${shift.start_time} - ${shift.end_time}`,
        claimedItem,
      };
    });
  });

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

      <div className="mobile-scroll overflow-x-auto">
        <div className="border rounded-lg overflow-hidden min-w-[900px] bg-card shadow-sm">
          <div className="grid grid-cols-6 bg-muted/50 border-b font-semibold text-sm">
            <div className="p-3 border-r">Shift Type</div>
            <div className="p-3 border-r">Position / Assignment</div>
            <div className="p-3 border-r">Allowed Rank</div>
            <div className="p-3 border-r text-center">Status</div>
            <div className="p-3 border-r">Claimed By Officer</div>
            <div className="p-3">Selected At</div>
          </div>

          {allPositionsWithShift.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No positions configured for shift types in this division. Configure positions in the "Shift Position Config" tab.
            </div>
          ) : (
            allPositionsWithShift.map((item, idx) => {
              const claimed = !!item.claimedItem;
              const officer = item.claimedItem?.profiles;
              const selectedAt = item.claimedItem?.selected_at
                ? new Date(item.claimedItem.selected_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                : '—';

              return (
                <div
                  key={item.id || idx}
                  className="grid grid-cols-6 border-b last:border-b-0 hover:bg-muted/30 items-center text-sm"
                >
                  <div className="p-3 border-r font-medium">
                    <div>{item.shiftName}</div>
                    <div className="text-xs text-muted-foreground">{item.shiftTime}</div>
                  </div>
                  <div className="p-3 border-r font-semibold text-foreground">
                    {item.position_name}
                  </div>
                  <div className="p-3 border-r text-muted-foreground">
                    {item.allowed_rank || "Any"}
                  </div>
                  <div className="p-3 border-r text-center">
                    <Badge variant={claimed ? "default" : "outline"} className="text-xs">
                      {claimed ? "Claimed" : "Available"}
                    </Badge>
                  </div>
                  <div className="p-3 border-r">
                    {claimed && officer ? (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary shrink-0" />
                        <div>
                          <div className="font-medium text-foreground">{officer.full_name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            Badge #{officer.badge_number || 'N/A'} • SC: {officer.service_credit_override ?? '0.0'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic text-xs flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Open position
                      </span>
                    )}
                  </div>
                  <div className="p-3 text-xs text-muted-foreground">
                    {selectedAt}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
