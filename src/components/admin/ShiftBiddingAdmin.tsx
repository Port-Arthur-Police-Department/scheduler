// src/components/admin/ShiftBiddingAdmin.tsx
import { useState } from "react";
import { useShiftBiddingRounds, useBiddingQueue, useShiftBiddingMutations, useAllAllowedPositions } from "@/hooks/useShiftBidding";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Users, Shield, Play, Pause, CheckCircle2, RefreshCw, Plus, Trash2, Settings, UserCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  const [configuredPositions, setConfiguredPositions] = useState<string[]>([]);

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
      .map(p => p.position_name);
    setConfiguredPositions(existing);
  };

  const handleAddPosition = () => {
    if (!positionInput.trim()) return;
    if (configuredPositions.includes(positionInput.trim())) {
      toast.error("Position already added");
      return;
    }
    const updated = [...configuredPositions, positionInput.trim()];
    setConfiguredPositions(updated);
    setPositionInput("");
  };

  const handleRemovePosition = (pos: string) => {
    const updated = configuredPositions.filter(p => p !== pos);
    setConfiguredPositions(updated);
  };

  const handleSavePositions = () => {
    if (!selectedShiftTypeId) {
      toast.error("Please select a shift type first");
      return;
    }
    saveAllowedPositions.mutate({ shiftTypeId: selectedShiftTypeId, positions: configuredPositions });
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
            Manage division-scoped annual seniority shift bidding rounds, generate queue order, and configure allowed positions per shift.
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
                Configure which positions are eligible to be picked for each shift type during shift bidding.
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
                      <div className="space-y-2">
                        <Label htmlFor="position-name">Add Allowed Position Name</Label>
                        <div className="flex gap-2">
                          <Input
                            id="position-name"
                            placeholder="e.g. Patrol Officer, Supervisor, Desk, Traffic"
                            value={positionInput}
                            onChange={(e) => setPositionInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPosition(); } }}
                          />
                          <Button type="button" onClick={handleAddPosition}>
                            <Plus className="h-4 w-4 mr-1" /> Add
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Configured Positions ({configuredPositions.length})</Label>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {configuredPositions.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">No positions configured for this shift type yet.</p>
                          ) : (
                            configuredPositions.map((pos) => (
                              <Badge key={pos} variant="secondary" className="flex items-center gap-1.5 py-1.5 px-3">
                                {pos}
                                <button
                                  type="button"
                                  onClick={() => handleRemovePosition(pos)}
                                  className="text-muted-foreground hover:text-destructive ml-1"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>

                      <Button onClick={handleSavePositions} className="w-full mt-4" disabled={saveAllowedPositions.isPending}>
                        Save Allowed Positions
                      </Button>
                    </div>
                  )}
                </div>

                <div className="bg-muted/30 p-5 rounded-lg border space-y-3">
                  <h3 className="font-semibold text-sm">How Shift Positions Work</h3>
                  <p className="text-sm text-muted-foreground">
                    During annual seniority shift bidding, officers pick both a shift type (e.g., Day Shift) and an allowed position (e.g., Patrol Officer or Beat 1) configured here by administrators.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Make sure to assign allowed positions for each active shift type before officers begin their bidding turns.
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
