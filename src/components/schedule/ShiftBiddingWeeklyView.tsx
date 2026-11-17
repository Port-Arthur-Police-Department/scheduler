// src/components/schedule/ShiftBiddingWeeklyView.tsx
import React, { useState, useMemo } from "react";
import { useShiftBiddingRounds, useBiddingQueue, useShiftBiddingMutations, useShiftTypeAllowedPositions, useAllAllowedPositions } from "@/hooks/useShiftBidding";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, CheckCircle2, Shield, ChevronLeft, ChevronRight, CalendarDays, User, Layers } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, startOfWeek, isSameDay, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface ShiftBiddingWeeklyViewProps {
  currentOfficerId?: string;
  officerDivision?: string | null;
}

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const ShiftBiddingWeeklyView: React.FC<ShiftBiddingWeeklyViewProps> = ({ currentOfficerId, officerDivision }) => {
  const { data: rounds = [], isLoading: roundsLoading } = useShiftBiddingRounds();
  const { isAdminOrSupervisor } = useUserRole(currentOfficerId);

  // Find active round
  const { data: activeRound } = useQuery({
    queryKey: ["active_round_for_weekly_bidding", currentOfficerId, officerDivision],
    queryFn: async () => {
      if (!currentOfficerId || rounds.length === 0) return null;
      const activeRounds = rounds.filter(r => r.status === 'active');
      if (activeRounds.length === 0) return null;

      // 1. Check queue membership
      const { data: queueItems } = await supabase
        .from("shift_bidding_queue")
        .select("*, shift_bidding_rounds(*)")
        .eq("officer_id", currentOfficerId)
        .in("round_id", activeRounds.map(r => r.id));

      if (queueItems && queueItems.length > 0) {
        const priorityItem = queueItems.find(q => q.status === 'active' || q.status === 'pending');
        if (priorityItem?.shift_bidding_rounds) return priorityItem.shift_bidding_rounds;
        const anyItem = queueItems.find(q => q.shift_bidding_rounds);
        if (anyItem?.shift_bidding_rounds) return anyItem.shift_bidding_rounds;
      }

      // 2. Division match
      const matchingRound = activeRounds.find(r => r.division === officerDivision);
      if (matchingRound) return matchingRound;

      return activeRounds[0];
    },
    enabled: !!currentOfficerId && rounds.length > 0,
  });

  const { data: queue = [], isLoading: queueLoading } = useBiddingQueue(activeRound?.id);
  const { data: allAllowedPositions = [] } = useAllAllowedPositions();
  const { submitSelection } = useShiftBiddingMutations();

  // Shift types
  const { data: shiftTypes = [] } = useQuery({
    queryKey: ["shift_types_for_bidding_weekly"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shift_types").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Week navigation starting from activeRound start_date or today
  const defaultWeekStart = useMemo(() => {
    if (activeRound?.start_date) {
      try {
        return startOfWeek(parseISO(activeRound.start_date), { weekStartsOn: 0 });
      } catch (e) {
        // fallback
      }
    }
    return startOfWeek(new Date(), { weekStartsOn: 0 });
  }, [activeRound?.start_date]);

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(defaultWeekStart);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(currentWeekStart, i);
      return {
        date,
        dateStr: format(date, "yyyy-MM-dd"),
        dayName: format(date, "EEE").toUpperCase(),
        formattedDate: format(date, "MMM d"),
        isToday: isSameDay(date, new Date()),
        dayOfWeek: date.getDay()
      };
    });
  }, [currentWeekStart]);

  // Selection form state for officer
  const [selectedShiftTypeId, setSelectedShiftTypeId] = useState<string>("");
  const [selectedPosition, setSelectedPosition] = useState<string>("");

  // Supervisor override form state
  const [overrideOfficerId, setOverrideOfficerId] = useState<string>("");
  const [overrideShiftTypeId, setOverrideShiftTypeId] = useState<string>("");
  const [overridePosition, setOverridePosition] = useState<string>("");

  const { data: allowedPositions = [] } = useShiftTypeAllowedPositions(selectedShiftTypeId);
  const { data: overrideAllowedPositions = [] } = useShiftTypeAllowedPositions(overrideShiftTypeId);

  const myQueueItem = queue.find(q => q.officer_id === currentOfficerId);
  const officerRank = myQueueItem?.profiles?.rank || "";
  const officerRankLower = officerRank.toLowerCase();

  const filteredAllowedPositions = allowedPositions.filter(ap => {
    const isClaimedByOther = queue.some(
      q => q.selected_shift_type_id === selectedShiftTypeId &&
           q.selected_position_name === ap.position_name &&
           q.officer_id !== currentOfficerId
    );
    if (isClaimedByOther) return false;
    if (!ap.allowed_rank || ap.allowed_rank === 'Any' || ap.allowed_rank === '') return true;
    return officerRankLower.includes(ap.allowed_rank.toLowerCase());
  });

  const isMyTurn = myQueueItem?.status === 'active';
  const isCompleted = myQueueItem?.status === 'completed';
  const currentlyActiveQueueItem = queue.find(q => q.status === 'active');
  const activeOfficerName = currentlyActiveQueueItem?.profiles?.full_name || "Another officer";

  const selectedOverrideQueueItem = queue.find(q => q.officer_id === (overrideOfficerId || currentlyActiveQueueItem?.officer_id)) || currentlyActiveQueueItem;
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

  if (roundsLoading || queueLoading) {
    return (
      <Card className="shadow-md">
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Loading shift bidding weekly view...
        </CardContent>
      </Card>
    );
  }

  if (!activeRound) {
    return null;
  }

  // Map allowed positions and shift details by shift_type_id
  const shiftTypeMap = new Map(shiftTypes.map(st => [st.id, st]));
  const allowedPositionsMap = new Map();
  allAllowedPositions.forEach(ap => {
    if (!allowedPositionsMap.has(ap.shift_type_id)) {
      allowedPositionsMap.set(ap.shift_type_id, []);
    }
    allowedPositionsMap.get(ap.shift_type_id).push(ap);
  });

  return (
    <div className="space-y-6">
      {/* Header & Status Card */}
      <Card className={`shadow-md border-2 ${isMyTurn ? "border-primary bg-primary/5" : "border-border"}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {activeRound.year} Division {activeRound.division} Shift Bidding — Weekly View
            </CardTitle>
            <Badge variant={isMyTurn ? "default" : "secondary"}>
              {isMyTurn ? "YOUR TURN TO PICK!" : isCompleted ? "SELECTION CONFIRMED" : "WAITING IN QUEUE"}
            </Badge>
          </div>
          <CardDescription className="space-y-1">
            <div>
              Seniority-based shift selection table. Review queue status and make selections formatted like The Book weekly schedule.
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
          {/* Supervisor Panel if Admin/Supervisor */}
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
              <form onSubmit={handleSupervisorOverrideSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
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
                        #{q.turn_index + 1} — {q.profiles?.full_name || "Officer"} {q.status === 'active' ? '⭐ [Active]' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

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

                <Select
                  value={overridePosition}
                  onValueChange={setOverridePosition}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Choose position..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredOverrideAllowedPositions.map(ap => (
                      <SelectItem key={ap.id} value={ap.position_name} className="text-xs">
                        {ap.position_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="submit"
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white h-9 text-xs"
                  disabled={submitSelection.isPending || !overrideShiftTypeId || !overridePosition || !selectedOverrideQueueItem}
                >
                  Override & Submit
                </Button>
              </form>
            </div>
          )}

          {/* Officer Turn Form */}
          {isCompleted ? (
            <div className="p-4 bg-muted/40 rounded-lg border space-y-2 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto" />
              <h3 className="font-semibold text-foreground">Shift Selection Confirmed</h3>
              <p className="text-sm text-muted-foreground">
                You successfully selected your shift for {activeRound.year}. Your recurring schedule is active.
              </p>
            </div>
          ) : isMyTurn ? (
            <form onSubmit={handleSubmitSelection} className="space-y-4 p-4 bg-card rounded-lg border shadow-sm border-primary/50">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Clock className="h-4 w-4 animate-spin" />
                It is your turn in the seniority queue! Make your selection below.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      {filteredAllowedPositions.map(ap => (
                        <SelectItem key={ap.id} value={ap.position_name}>
                          {ap.position_name} {ap.allowed_rank && ap.allowed_rank !== 'Any' ? `(${ap.allowed_rank})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={submitSelection.isPending || !selectedShiftTypeId || !selectedPosition}>
                Confirm & Lock Shift Selection
              </Button>
            </form>
          ) : (
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
          )}
        </CardContent>
      </Card>

      {/* Available Shift Options Grouped by Shift with Recurring vs OFF Days Weekly Matrix */}
      <div className="space-y-4">
        <div className="bg-card p-4 rounded-xl border shadow-sm space-y-1">
          <div className="text-base font-bold flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Available Shift Options & Recurring Schedule Matrix (Grouped by Shift Type)
          </div>
          <p className="text-xs text-muted-foreground">
            Review available shifts, positions, and their weekly recurring (Working) vs OFF days before making your selection.
          </p>
        </div>

        <div className="space-y-4">
          {shiftTypes.map(st => {
            const positions = allowedPositionsMap.get(st.id) || [];
            if (positions.length === 0) return null;

            return (
              <Card key={st.id} className="shadow-sm border">
                <CardHeader className="py-3 bg-muted/30 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <span className="text-primary">🕒 {st.name}</span>
                      <span className="text-xs text-muted-foreground font-normal">({st.start_time} - {st.end_time})</span>
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {positions.length} Position{positions.length === 1 ? '' : 's'} Available
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse border border-border table-fixed">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border text-muted-foreground">
                          <th className="p-2.5 font-semibold border-r border-border w-[140px]">Position / Assignment</th>
                          <th className="p-2.5 font-semibold border-r border-border w-[80px]">Rank Req.</th>
                          {dayNames.map(day => (
                            <th key={day} className="p-2.5 text-center font-bold text-sm border-r border-border w-[55px]">{day}</th>
                          ))}
                          <th className="p-2.5 font-semibold text-center border-l border-border w-[110px]">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {positions.map((pos: any) => {
                          const recurringDays: number[] = pos.recurring_days || [1, 2, 3, 4, 5]; // Default Mon-Fri
                          const isClaimed = queue.some(
                            q => q.selected_shift_type_id === st.id && q.selected_position_name === pos.position_name && q.status === 'completed'
                          );
                          const claimedBy = queue.find(
                            q => q.selected_shift_type_id === st.id && q.selected_position_name === pos.position_name && q.status === 'completed'
                          )?.profiles?.full_name;

                          return (
                            <tr key={pos.id} className="border-b border-border hover:bg-muted/20">
                              <td className="p-2.5 font-medium border-r border-border w-[140px] truncate" title={pos.position_name}>
                                <div>{pos.position_name}</div>
                              </td>
                              <td className="p-2.5 text-muted-foreground border-r border-border w-[80px] truncate" title={pos.allowed_rank || 'Any'}>
                                {pos.allowed_rank || 'Any'}
                              </td>
                              {/* 7 Days of the week recurring vs off - Centered and evenly balanced */}
                              {[0, 1, 2, 3, 4, 5, 6].map(dayIndex => {
                                const isRecurring = recurringDays.includes(dayIndex);
                                return (
                                  <td key={dayIndex} className="p-2 text-center border-r border-border w-[55px] align-middle">
                                    {isRecurring ? (
                                      <span className="inline-block px-1.5 py-1 rounded bg-primary/15 text-primary font-bold text-[11px]" title="Recurring Working Day">
                                        WORK
                                      </span>
                                    ) : (
                                      <span className="inline-block px-1.5 py-1 rounded bg-muted text-muted-foreground font-medium text-[11px]" title="OFF Day">
                                        OFF
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="p-2.5 text-center border-l border-border w-[110px]">
                                {isClaimed ? (
                                  <Badge variant="secondary" className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px] truncate max-w-full">
                                    Taken
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px]">
                                    Available
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* The Book - Weekly Table View of Bidding Queue & Schedule */}
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-card p-4 rounded-xl border shadow-sm">
          <div className="text-base font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Bidding Queue & Weekly Schedule Preview ({format(currentWeekStart, "MMM d")} - {format(addDays(currentWeekStart, 6), "MMM d, yyyy")})
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(prev => addDays(prev, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
            >
              This Week
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(prev => addDays(prev, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mobile-scroll overflow-x-auto">
          <div className="border rounded-lg overflow-hidden min-w-[950px] bg-card shadow-sm">
            {/* Table Header */}
            <div className="grid grid-cols-9 bg-muted/50 border-b">
              <div className="p-3 font-semibold border-r text-xs">Empl#</div>
              <div className="p-3 font-semibold border-r text-xs">OFFICER / STATUS</div>
              {weekDays.map(({ dateStr, dayName, formattedDate, isToday }) => (
                <div key={dateStr} className={`p-3 text-center font-semibold border-r text-xs ${isToday ? 'bg-primary/10' : ''}`}>
                  <div>{dayName}</div>
                  <div className="text-[10px] text-muted-foreground font-normal">{formattedDate}</div>
                </div>
              ))}
            </div>

            {/* Queue Rows formatted like The Book */}
            {queue.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No officers in the bidding queue for this round.
              </div>
            ) : (
              queue.map(q => {
                const profile = q.profiles;
                const isItemActive = q.status === 'active';
                const isItemCompleted = q.status === 'completed';
                const shiftType = q.selected_shift_type_id ? shiftTypeMap.get(q.selected_shift_type_id) : null;
                const positionName = q.selected_position_name;

                // Find allowed position recurring days if completed
                const shiftPositions = q.selected_shift_type_id ? allowedPositionsMap.get(q.selected_shift_type_id) || [] : [];
                const matchedPos = shiftPositions.find((p: any) => p.position_name === positionName);
                const recurringDays: number[] = matchedPos?.recurring_days || [1, 2, 3, 4, 5]; // Default Mon-Fri if none

                return (
                  <div
                    key={q.id}
                    className={`grid grid-cols-9 border-b hover:bg-muted/30 items-center text-sm ${
                      isItemActive ? 'bg-primary/10 border-primary/40 font-medium' : ''
                    }`}
                  >
                    <div className="p-3 border-r font-mono text-xs">
                      {profile?.badge_number || '9999'}
                    </div>
                    <div className="p-3 border-r">
                      <div className="font-semibold flex items-center gap-1.5">
                        <span>{profile?.full_name || 'Officer'}</span>
                        {isItemActive && <span className="text-xs text-primary font-bold animate-pulse">⭐ [PICKING]</span>}
                        {isItemCompleted && <span className="text-xs text-green-600 font-semibold">✓</span>}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <span>Rank: {profile?.rank || 'Officer'}</span>
                        <span>•</span>
                        <span>Queue #{q.turn_index + 1}</span>
                      </div>
                      {isItemCompleted && shiftType && (
                        <div className="text-[11px] text-primary font-medium mt-0.5 truncate">
                          {shiftType.name} : {positionName}
                        </div>
                      )}
                    </div>

                    {/* Days of the week cells */}
                    {weekDays.map(({ dateStr, dayOfWeek, isToday }) => {
                      const isWorkingDay = isItemCompleted && recurringDays.includes(dayOfWeek);

                      return (
                        <div
                          key={dateStr}
                          className={`p-3 text-center border-r text-xs h-full flex flex-col items-center justify-center min-h-[60px] ${
                            isToday ? 'bg-primary/5' : ''
                          }`}
                        >
                          {isItemCompleted ? (
                            isWorkingDay ? (
                              <div className="bg-primary/10 text-primary border border-primary/20 rounded p-1 w-full text-[11px] font-semibold truncate">
                                {positionName || shiftType?.name || 'Assigned'}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-[10px] uppercase tracking-wider">OFF</span>
                            )
                          ) : isItemActive ? (
                            <span className="text-xs text-primary font-bold italic animate-pulse">
                              Active Turn
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[10px] italic">
                              Pending
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
