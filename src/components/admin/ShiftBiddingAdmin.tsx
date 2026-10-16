// src/components/admin/ShiftBiddingAdmin.tsx
import { useState } from "react";
import { useShiftBiddingRounds, useBiddingQueue, useShiftBiddingMutations, useAllAllowedPositions, ShiftTypeAllowedPosition } from "@/hooks/useShiftBidding";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Users, Shield, Play, Pause, CheckCircle2, RefreshCw, Plus, Trash2, Settings, UserCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ConfiguredPosition {
  position_name: string;
  allowed_rank: string;
  recurring_days: number[];
}

const daysOfWeek = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export const ShiftBiddingAdmin = () => {
  const { data: rounds = [], isLoading: roundsLoading } = useShiftBiddingRounds();
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const { data: queue = [], isLoading: queueLoading } = useBiddingQueue(selectedRoundId || rounds[0]?.id);
  const { data: allAllowedPositions = [] } = useAllAllowedPositions();
  const { createRound, updateRoundStatus, generateQueue, submitSelection, saveAllowedPositions } = useShiftBiddingMutations();

  // New round form state
  const [newYear, setNewYear] = useState<number>(new Date().getFullYear() + 1);
  const [newDivision, setNewDivision] = useState<'FOD' | 'CID' | 'Admin'>('FOD');

  // Shift type position config state
  const [selectedShiftTypeId, setSelectedShiftTypeId] = useState<string>("");
  const [positionInput, setPositionInput] = useState<string>("");
  const [selectedRank, setSelectedRank] = useState<string>("Any");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [configuredPositions, setConfiguredPositions] = useState<ConfiguredPosition[]>([]);

  // Fetch shift types
  const { data: shiftTypes = [] } = useQuery({
    queryKey: ["shift_types_for_bidding"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shift_types").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const activeRound = rounds.find(r => r.id === (selectedRoundId || rounds[0]?.id));

  const handleCreateRound = (e: React.FormEvent) => {
    e.preventDefault();
    createRound.mutate({ year: Number(newYear), division: newDivision }, {
      onSuccess: (data) => {
        if (data) setSelectedRoundId(data.id);
      }
    });
  };

  const handleGenerateQueue = () => {
    if (!activeRound) return;
    if (confirm(`Generate seniority queue for division ${activeRound.division} (${activeRound.year})? This will reset any existing queue for this round.`)) {
      generateQueue.mutate({ roundId: activeRound.id, division: activeRound.division });
    }
  };

  const handleToggleStatus = (newStatus: 'setup' | 'active' | 'paused' | 'completed') => {
    if (!activeRound) return;
    updateRoundStatus.mutate({ roundId: activeRound.id, status: newStatus });
  };

  const handleSelectShiftTypeForConfig = (shiftId: string) => {
    setSelectedShiftTypeId(shiftId);
    const existing = allAllowedPositions
      .filter(p => p.shift_type_id === shiftId)
      .map(p => ({
        position_name: p.position_name,
        allowed_rank: p.allowed_rank || "Any",
        recurring_days: p.recurring_days || [],
      }));
    setConfiguredPositions(existing);
  };

  const handleToggleDay = (dayVal: number) => {
    setSelectedDays(prev =>
      prev.includes(dayVal) ? prev.filter(d => d !== dayVal) : [...prev, dayVal].sort()
    );
  };

  const handleAddPosition = () => {
    if (!positionInput.trim()) return;
    if (configuredPositions.some(p => p.position_name.toLowerCase() === positionInput.trim().toLowerCase())) {
      toast.error("Position already added");
      return;
    }
    const updated = [
      ...configuredPositions,
      {
        position_name: positionInput.trim(),
        allowed_rank: selectedRank,
        recurring_days: selectedDays,
      }
    ];
    setConfiguredPositions(updated);
    setPositionInput("");
    setSelectedRank("Any");
    setSelectedDays([]);
  };

  const handleRemovePosition = (posName: string) => {
    const updated = configuredPositions.filter(p => p.position_name !== posName);
    setConfiguredPositions(updated);
  };

  const handleSavePositions = () => {
    if (!selectedShiftTypeId) {
      toast.error("Please select a shift type first");
      return;
    }
    saveAllowedPositions.mutate({
      shiftTypeId: selectedShiftTypeId,
      positions: configuredPositions
    });
  };

  const formatDaysSummary = (days: number[]) => {
    if (!days || days.length === 0) return "No recurring schedule";
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days.map(d => names[d]).join(", ");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card p-6 rounded-xl border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Annual Seniority Shift Bidding Management
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage division-scoped annual seniority shift bidding rounds, generate queue order, and configure allowed positions per shift with rank restrictions and recurring schedules.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {rounds.length > 0 && (
            <Select
              value={selectedRoundId || rounds[0]?.id}
              onValueChange={setSelectedRoundId}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select bidding round" />
              </SelectTrigger>
              <SelectContent>
                {rounds.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.year} — Division {r.division} ({r.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <Tabs defaultValue="rounds" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="rounds">Bidding Rounds & Queue</TabsTrigger>
          <TabsTrigger value="positions">Shift Position Config</TabsTrigger>
        </TabsList>

        {/* Tab 1: Rounds & Queue */}
        <TabsContent value="rounds" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Create Round Card */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Create Bidding Round</CardTitle>
                <CardDescription>Initialize a new annual shift bidding round for a division.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateRound} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="year">Bidding Year</Label>
                    <Input
                      id="year"
                      type="number"
                      value={newYear}
                      onChange={(e) => setNewYear(Number(e.target.value))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="division">Target Division</Label>
                    <Select value={newDivision} onValueChange={(val: any) => setNewDivision(val)}>
                      <SelectTrigger id="division">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FOD">FOD (Field Operations Division)</SelectItem>
                        <SelectItem value="CID">CID (Criminal Investigation Division)</SelectItem>
                        <SelectItem value="Admin">Admin (Administration)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="submit" className="w-full" disabled={createRound.isPending}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Bidding Round
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Active Round Controls & Summary */}
            <Card className="shadow-sm lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {activeRound ? `${activeRound.year} - Division ${activeRound.division}` : "No Bidding Round Selected"}
                  </CardTitle>
                  {activeRound && (
                    <Badge variant={
                      activeRound.status === 'active' ? 'default' :
                      activeRound.status === 'completed' ? 'secondary' : 'outline'
                    }>
                      {activeRound.status.toUpperCase()}
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  Control round status, generate seniority queue, and monitor turn progression.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeRound ? (
                  <>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {activeRound.status === 'setup' && (
                        <Button onClick={handleGenerateQueue} disabled={generateQueue.isPending}>
                          <Users className="h-4 w-4 mr-2" />
                          Generate Seniority Queue ({activeRound.division})
                        </Button>
                      )}

                      {activeRound.status === 'setup' && (
                        <Button variant="default" onClick={() => handleToggleStatus('active')}>
                          <Play className="h-4 w-4 mr-2" />
                          Start Bidding
                        </Button>
                      )}

                      {activeRound.status === 'active' && (
                        <Button variant="outline" onClick={() => handleToggleStatus('paused')}>
                          <Pause className="h-4 w-4 mr-2" />
                          Pause Bidding
                        </Button>
                      )}

                      {activeRound.status === 'paused' && (
                        <Button variant="default" onClick={() => handleToggleStatus('active')}>
                          <Play className="h-4 w-4 mr-2" />
                          Resume Bidding
                        </Button>
                      )}

                      {activeRound.status !== 'completed' && (
                        <Button variant="secondary" onClick={() => handleToggleStatus('completed')}>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Mark Completed
                        </Button>
                      )}
                    </div>

                    <div className="rounded-md border mt-4 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[80px]">Turn</TableHead>
                            <TableHead>Officer / Supervisor</TableHead>
                            <TableHead>Rank</TableHead>
                            <TableHead>Badge #</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Selection</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {queueLoading ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                                Loading queue...
                              </TableCell>
                            </TableRow>
                          ) : queue.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                                No officers in queue. Click "Generate Seniority Queue" above.
                              </TableCell>
                            </TableRow>
                          ) : (
                            queue.map((item) => {
                              const officer = item.profiles;
                              const isActiveTurn = item.status === 'active';
                              const isCompleted = item.status === 'completed';

                              return (
                                <TableRow key={item.id} className={isActiveTurn ? "bg-primary/5 font-medium" : ""}>
                                  <TableCell>#{item.turn_index + 1}</TableCell>
                                  <TableCell className="flex items-center gap-2">
                                    <span className="font-semibold">{officer?.full_name || "Unknown Officer"}</span>
                                  </TableCell>
                                  <TableCell>{officer?.rank || "Officer"}</TableCell>
                                  <TableCell>#{officer?.badge_number || "N/A"}</TableCell>
                                  <TableCell>
                                    <Badge variant={
                                      isCompleted ? "default" :
                                      isActiveTurn ? "destructive" : "outline"
                                    }>
                                      {item.status.toUpperCase()}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {isCompleted ? (
                                      <span className="text-xs text-muted-foreground">
                                        {item.shift_types?.name} ({item.selected_position_name})
                                      </span>
                                    ) : isActiveTurn ? (
                                      <span className="text-xs text-primary font-semibold animate-pulse">
                                        Currently Picking...
                                      </span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">Pending</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Create a bidding round on the left to get started.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Position Configuration */}
        <TabsContent value="positions" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Shift Type Allowed Positions Configuration</CardTitle>
              <CardDescription>
                Configure allowed positions per shift, set required rank restrictions, and define recurring work schedule days.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="shift-type-select">Select Shift Type</Label>
                    <Select
                      value={selectedShiftTypeId}
                      onValueChange={handleSelectShiftTypeForConfig}
                    >
                      <SelectTrigger id="shift-type-select">
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
                    <div className="space-y-4 pt-4 border-t">
                      <div className="space-y-3 p-4 border rounded-lg bg-card/50">
                        <h4 className="font-medium text-sm">Add New Position Rule</h4>

                        <div className="space-y-2">
                          <Label htmlFor="position-name">Position Name</Label>
                          <Input
                            id="position-name"
                            placeholder="e.g. Day - Shift Lieutenant, Patrol Officer"
                            value={positionInput}
                            onChange={(e) => setPositionInput(e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="required-rank">Required Rank Restriction</Label>
                          <Select value={selectedRank} onValueChange={setSelectedRank}>
                            <SelectTrigger id="required-rank">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Any">Any Rank (Open to all)</SelectItem>
                              <SelectItem value="Lieutenant">Lieutenant / LT</SelectItem>
                              <SelectItem value="Sergeant">Sergeant / SGT</SelectItem>
                              <SelectItem value="Officer">Police Officer</SelectItem>
                              <SelectItem value="Dispatcher">Dispatcher</SelectItem>
                              <SelectItem value="Coordinator for Support Services">Coordinator for Support Services</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Recurring Schedule Days</Label>
                          <div className="grid grid-cols-4 gap-2 pt-1">
                            {daysOfWeek.map((day) => (
                              <div key={day.value} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`day-chk-${day.value}`}
                                  checked={selectedDays.includes(day.value)}
                                  onCheckedChange={() => handleToggleDay(day.value)}
                                />
                                <Label htmlFor={`day-chk-${day.value}`} className="text-xs cursor-pointer font-normal">
                                  {day.label}
                                </Label>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Selecting days here will automatically populate the officer's recurring schedule upon selection.
                          </p>
                        </div>

                        <Button type="button" onClick={handleAddPosition} className="w-full mt-2">
                          <Plus className="h-4 w-4 mr-1" /> Add Position Rule
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label>Configured Positions ({configuredPositions.length})</Label>
                        <div className="space-y-2 pt-1">
                          {configuredPositions.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">No positions configured for this shift type yet.</p>
                          ) : (
                            configuredPositions.map((pos) => (
                              <div key={pos.position_name} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm">{pos.position_name}</span>
                                    <Badge variant="outline" className="text-xs">
                                      Rank: {pos.allowed_rank}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Recurring Days: {formatDaysSummary(pos.recurring_days)}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemovePosition(pos.position_name)}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <Button onClick={handleSavePositions} className="w-full mt-4" disabled={saveAllowedPositions.isPending}>
                        Save All Position Rules
                      </Button>
                    </div>
                  )}
                </div>

                <div className="bg-muted/30 p-5 rounded-lg border space-y-3">
                  <h3 className="font-semibold text-sm">How Shift Positions & Rank Restrictions Work</h3>
                  <p className="text-sm text-muted-foreground">
                    Administrators can specify supervisor and officer positions tied to specific ranks (e.g. only a Lieutenant can choose a Lieutenant position).
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Configuring recurring schedule days (e.g. Tuesday, Wednesday, Thursday, Friday) ensures that when an officer locks their shift bid, their official recurring work schedule for the year is populated automatically.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
