// src/components/admin/ShiftBiddingAdmin.tsx
import { useState, useEffect } from "react";
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
import { Calendar, Users, Shield, Play, Pause, CheckCircle2, RefreshCw, Plus, Trash2, Edit2, Settings, UserCheck, Clock, Sparkles, BookmarkPlus, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BiddingMatrixView } from "@/components/schedule/BiddingMatrixView";
import { toast } from "sonner";
import { sortOfficersByLastName, formatOfficerNameForDropdown } from "@/utils/sortingUtils";
import { supabase } from "@/integrations/supabase/client";

interface ConfiguredPosition {
  position_name: string;
  allowed_rank: string;
  recurring_days: number[];
}

interface SavedPreset {
  id: string;
  name: string;
  positions: ConfiguredPosition[];
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
  const { createRound, updateRoundStatus, deleteRound, generateQueue, submitSelection, saveAllowedPositions, addOfficerToQueue, removeOfficerFromQueue } = useShiftBiddingMutations();

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["profiles_for_bidding_admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const [isAddOfficerOpen, setIsAddOfficerOpen] = useState(false);
  const [officerToAddId, setOfficerToAddId] = useState<string>("");
  const officersNotInQueue = allProfiles.filter(p => !queue.some(q => q.officer_id === p.id));

  const handleAddOfficerToQueue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRound || !officerToAddId) return;
    addOfficerToQueue.mutate({
      roundId: activeRound.id,
      officerId: officerToAddId,
    }, {
      onSuccess: () => {
        setIsAddOfficerOpen(false);
        setOfficerToAddId("");
      }
    });
  };

  const handleRemoveFromQueue = (queueItemId: string, officerName: string) => {
    if (!activeRound) return;
    if (confirm(`Remove ${officerName} from the bidding queue? Their turn will be removed and remaining turns re-indexed.`)) {
      removeOfficerFromQueue.mutate({
        roundId: activeRound.id,
        queueItemId,
      });
    }
  };

  // New round form state
  const [newYear, setNewYear] = useState<number>(new Date().getFullYear() + 1);
  const [newDivision, setNewDivision] = useState<'FOD' | 'CID' | 'Admin'>('FOD');
  const [newStartDate, setNewStartDate] = useState<string>(`${newYear}-01-01`);

  useEffect(() => {
    setNewStartDate(`${newYear}-01-01`);
  }, [newYear]);

  // Shift type position config state
  const [selectedShiftTypeId, setSelectedShiftTypeId] = useState<string>("");
  const [positionInput, setPositionInput] = useState<string>("");
  const [selectedRank, setSelectedRank] = useState<string>("Any");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [configuredPositions, setConfiguredPositions] = useState<ConfiguredPosition[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Custom saved presets state (persisted in localStorage)
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(() => {
    try {
      const stored = localStorage.getItem("shift_bidding_custom_presets");
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to load presets from localStorage", e);
    }
    return [
      {
        id: "preset-patrol",
        name: "Standard Patrol Squad",
        positions: [
          { position_name: "Patrol Officer (Mon-Thu)", allowed_rank: "Officer", recurring_days: [1, 2, 3, 4] },
          { position_name: "Patrol Officer (Tue-Fri)", allowed_rank: "Officer", recurring_days: [2, 3, 4, 5] },
          { position_name: "Patrol Officer (Wed-Sat)", allowed_rank: "Officer", recurring_days: [3, 4, 5, 6] },
        ]
      },
      {
        id: "preset-supervisor",
        name: "Supervisor Squad",
        positions: [
          { position_name: "Shift Lieutenant (Mon-Thu)", allowed_rank: "Lieutenant", recurring_days: [1, 2, 3, 4] },
          { position_name: "Shift Sergeant (Mon-Thu)", allowed_rank: "Sergeant", recurring_days: [1, 2, 3, 4] },
          { position_name: "Shift Sergeant (Tue-Fri)", allowed_rank: "Sergeant", recurring_days: [2, 3, 4, 5] },
        ]
      }
    ];
  });
  const [newPresetName, setNewPresetName] = useState<string>("");

  useEffect(() => {
    try {
      localStorage.setItem("shift_bidding_custom_presets", JSON.stringify(savedPresets));
    } catch (e) {
      console.error("Failed to save presets to localStorage", e);
    }
  }, [savedPresets]);

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

  // Supervisor override dialog state
  const [overrideItem, setOverrideItem] = useState<any | null>(null);
  const [overrideShiftTypeId, setOverrideShiftTypeId] = useState<string>("");
  const [overridePosition, setOverridePosition] = useState<string>("");
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const overrideAllowedPositions = allAllowedPositions.filter(p => {
    if (p.shift_type_id !== overrideShiftTypeId) return false;
    const isClaimedByOther = queue.some(
      q => q.selected_shift_type_id === overrideShiftTypeId &&
           q.selected_position_name === p.position_name &&
           q.officer_id !== overrideItem?.officer_id
    );
    return !isClaimedByOther;
  });

  const handleSupervisorOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRound || !overrideItem) return;
    if (!overrideShiftTypeId) {
      toast.error("Please select a shift type");
      return;
    }
    if (!overridePosition) {
      toast.error("Please select a position");
      return;
    }

    const isCurrentTurn = overrideItem.turn_index === activeRound.current_turn_index;
    const nextTurnIndex = isCurrentTurn ? activeRound.current_turn_index + 1 : activeRound.current_turn_index;

    submitSelection.mutate({
      roundId: activeRound.id,
      queueItemId: overrideItem.id,
      shiftTypeId: overrideShiftTypeId,
      positionName: overridePosition,
      nextTurnIndex,
      isOverride: true,
    }, {
      onSuccess: () => {
        setIsOverrideOpen(false);
        setOverrideItem(null);
        setOverrideShiftTypeId("");
        setOverridePosition("");
        toast.success(`Supervisor override successful for ${overrideItem.profiles?.full_name}`);
      }
    });
  };

  const handleCreateRound = (e: React.FormEvent) => {
    e.preventDefault();
    createRound.mutate({ year: Number(newYear), division: newDivision, startDate: newStartDate }, {
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
    setEditingIndex(null);
    setPositionInput("");
    setSelectedRank("Any");
    setSelectedDays([]);
  };

  const handleToggleDay = (dayVal: number) => {
    setSelectedDays(prev =>
      prev.includes(dayVal) ? prev.filter(d => d !== dayVal) : [...prev, dayVal].sort()
    );
  };

  const handleSavePositionItem = () => {
    if (!positionInput.trim()) {
      toast.error("Please enter a position name");
      return;
    }

    if (editingIndex !== null) {
      const updated = [...configuredPositions];
      updated[editingIndex] = {
        position_name: positionInput.trim(),
        allowed_rank: selectedRank,
        recurring_days: selectedDays,
      };
      setConfiguredPositions(updated);
      setEditingIndex(null);
      toast.success("Position updated in staging");
    } else {
      if (configuredPositions.some(p => p.position_name.toLowerCase() === positionInput.trim().toLowerCase())) {
        toast.error("Position name already exists in this shift config");
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
      toast.success("Position added to staging");
    }

    setPositionInput("");
    setSelectedRank("Any");
    setSelectedDays([]);
  };

  const handleEditPosition = (index: number) => {
    const pos = configuredPositions[index];
    setPositionInput(pos.position_name);
    setSelectedRank(pos.allowed_rank);
    setSelectedDays(pos.recurring_days || []);
    setEditingIndex(index);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setPositionInput("");
    setSelectedRank("Any");
    setSelectedDays([]);
  };

  const handleRemovePosition = (index: number) => {
    const updated = configuredPositions.filter((_, i) => i !== index);
    setConfiguredPositions(updated);
    if (editingIndex === index) {
      handleCancelEdit();
    }
  };

  const handleLoadPreset = (preset: SavedPreset) => {
    setConfiguredPositions(preset.positions);
    toast.success(`Loaded preset "${preset.name}" successfully!`);
  };

  const handleSaveCurrentAsPreset = () => {
    if (!newPresetName.trim()) {
      toast.error("Please enter a name for your preset template");
      return;
    }
    if (configuredPositions.length === 0) {
      toast.error("Add at least one position to save as a preset template");
      return;
    }

    const newPreset: SavedPreset = {
      id: `preset-${Date.now()}`,
      name: newPresetName.trim(),
      positions: [...configuredPositions],
    };

    setSavedPresets(prev => [...prev, newPreset]);
    setNewPresetName("");
    toast.success(`Preset template "${newPreset.name}" saved successfully!`);
  };

  const handleDeletePreset = (presetId: string) => {
    setSavedPresets(prev => prev.filter(p => p.id !== presetId));
    toast.success("Preset template deleted");
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
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
          <TabsTrigger value="rounds">Bidding Rounds & Queue</TabsTrigger>
          <TabsTrigger value="positions">Shift Position Config</TabsTrigger>
          <TabsTrigger value="matrix">Availability Matrix</TabsTrigger>
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
                    <Label htmlFor="start_date">Schedule Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={newStartDate}
                      onChange={(e) => setNewStartDate(e.target.value)}
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

                      <Button
                        variant="outline"
                        onClick={() => setIsAddOfficerOpen(true)}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Officer to Queue
                      </Button>

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

                      {activeRound.status === 'completed' && (
                        <Button variant="default" onClick={() => handleToggleStatus('active')}>
                          <Play className="h-4 w-4 mr-2" />
                          Reopen / Resume Bidding
                        </Button>
                      )}

                      {activeRound.status !== 'completed' && (
                        <Button variant="secondary" onClick={() => handleToggleStatus('completed')}>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Mark Completed
                        </Button>
                      )}

                      <Button
                        variant="destructive"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete the bidding round for ${activeRound.year} - Division ${activeRound.division}? This will remove all queue and selection records for this round.`)) {
                            deleteRound.mutate(activeRound.id, {
                              onSuccess: () => setSelectedRoundId(null)
                            });
                          }
                        }}
                        disabled={deleteRound.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Round
                      </Button>
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
                            <TableHead className="text-right">Supervisor Override</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {queueLoading ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                                Loading queue...
                              </TableCell>
                            </TableRow>
                          ) : queue.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
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
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs gap-1"
                                        onClick={() => {
                                          setOverrideItem(item);
                                          setOverrideShiftTypeId(item.selected_shift_type_id || shiftTypes[0]?.id || "");
                                          setOverridePosition(item.selected_position_name || "");
                                          setIsOverrideOpen(true);
                                        }}
                                      >
                                        <UserCheck className="h-3 w-3" />
                                        {isCompleted ? "Modify Selection" : "Override Turn"}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                        onClick={() => handleRemoveFromQueue(item.id, officer?.full_name || "Officer")}
                                        title="Remove officer from queue"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
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
              <CardTitle className="text-lg">Shift Type Allowed Positions Configuration & Presets</CardTitle>
              <CardDescription>
                Configure allowed positions per shift, set rank restrictions, recurring schedules, and manage custom saved preset templates.
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
                      {/* Saved Preset Templates Management */}
                      <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                            <span>Preset Templates ({savedPresets.length})</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                          {savedPresets.map((preset) => (
                            <div key={preset.id} className="flex items-center bg-card border rounded-md px-2.5 py-1 text-xs gap-2">
                              <span
                                className="font-medium cursor-pointer hover:text-primary"
                                onClick={() => handleLoadPreset(preset)}
                                title="Click to load preset"
                              >
                                {preset.name} ({preset.positions.length} pos)
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePreset(preset.id)}
                                className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                                title="Delete preset template"
                              >
                                ×
                              </Button>
                            </div>
                          ))}
                        </div>

                        {/* Save Current as Preset */}
                        <div className="flex items-center gap-2 pt-2 border-t mt-2">
                          <Input
                            placeholder="New preset name..."
                            value={newPresetName}
                            onChange={(e) => setNewPresetName(e.target.value)}
                            className="h-8 text-xs"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={handleSaveCurrentAsPreset}
                            className="h-8 text-xs shrink-0 flex items-center gap-1"
                          >
                            <BookmarkPlus className="h-3.5 w-3.5" />
                            Save as Preset
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-3 p-4 border rounded-lg bg-card/50">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">
                            {editingIndex !== null ? `Editing Position #${editingIndex + 1}` : "Add New Position Rule"}
                          </h4>
                          {editingIndex !== null && (
                            <Button type="button" size="sm" variant="ghost" onClick={handleCancelEdit}>
                              Cancel Edit
                            </Button>
                          )}
                        </div>

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

                        <Button type="button" onClick={handleSavePositionItem} className="w-full mt-2">
                          {editingIndex !== null ? (
                            <>Update Position in Staging</>
                          ) : (
                            <><Plus className="h-4 w-4 mr-1" /> Add Position Rule</>
                          )}
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label>Configured Positions ({configuredPositions.length})</Label>
                        <div className="space-y-2 pt-1">
                          {configuredPositions.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">No positions configured for this shift type yet.</p>
                          ) : (
                            configuredPositions.map((pos, idx) => (
                              <div key={idx} className={`flex items-center justify-between p-3 border rounded-lg bg-card ${editingIndex === idx ? 'border-primary bg-primary/5' : ''}`}>
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
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditPosition(idx)}
                                    title="Edit position"
                                  >
                                    <Edit2 className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRemovePosition(idx)}
                                    title="Delete position"
                                    className="text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <Button onClick={handleSavePositions} className="w-full mt-4" disabled={saveAllowedPositions.isPending}>
                        Save All Position Rules to Database
                      </Button>
                    </div>
                  )}
                </div>

                <div className="bg-muted/30 p-5 rounded-lg border space-y-3">
                  <h3 className="font-semibold text-sm">How Custom Saved Presets Work</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure your desired positions and recurring schedules for any shift type, then click <b>"Save as Preset"</b> to save them as a custom template.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    You can load any saved preset template into other shift types instantly, and delete presets you no longer need.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Availability Matrix */}
        <TabsContent value="matrix" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Division Shift Bidding & Position Availability Matrix</CardTitle>
              <CardDescription>
                Real-time overview of claimed vs available positions grouped by shift type for Division {activeRound?.division || "N/A"}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BiddingMatrixView
                round={activeRound}
                queue={queue}
                shiftTypes={shiftTypes}
                allAllowedPositions={allAllowedPositions}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Supervisor Override Dialog */}
      <Dialog open={isOverrideOpen} onOpenChange={setIsOverrideOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Supervisor Override / Modify Selection
            </DialogTitle>
            <DialogDescription>
              Make or modify shift selection on behalf of <b>{overrideItem?.profiles?.full_name}</b> (Rank: {overrideItem?.profiles?.rank || "Officer"}).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSupervisorOverride} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Select Shift Type</Label>
              <Select
                value={overrideShiftTypeId}
                onValueChange={(val) => {
                  setOverrideShiftTypeId(val);
                  setOverridePosition("");
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

            {overrideShiftTypeId && (
              <div className="space-y-2">
                <Label>Select Position / Assignment</Label>
                <Select
                  value={overridePosition}
                  onValueChange={setOverridePosition}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose allowed position..." />
                  </SelectTrigger>
                  <SelectContent>
                    {overrideAllowedPositions.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground text-center">
                        No allowed positions configured for this shift type.
                      </div>
                    ) : (
                      overrideAllowedPositions.map(ap => (
                        <SelectItem key={ap.id} value={ap.position_name}>
                          {ap.position_name} {ap.allowed_rank && ap.allowed_rank !== 'Any' ? `(Rank: ${ap.allowed_rank})` : ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsOverrideOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitSelection.isPending || !overrideShiftTypeId || !overridePosition}>
                Confirm Override Selection
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Officer Dialog */}
      <Dialog open={isAddOfficerOpen} onOpenChange={setIsAddOfficerOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Officer to Bidding Queue</DialogTitle>
            <DialogDescription>
              Select an officer to add to the end of cemeteries/seniority queue for Division {activeRound?.division} ({activeRound?.year}).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddOfficerToQueue} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="officer-select">Select Officer</Label>
              <Select value={officerToAddId} onValueChange={setOfficerToAddId}>
                <SelectTrigger id="officer-select">
                  <SelectValue placeholder="Choose officer..." />
                </SelectTrigger>
                <SelectContent>
                  {officersNotInQueue.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground text-center">
                      All officers are already in the queue.
                    </div>
                  ) : (
                    sortOfficersByLastName(officersNotInQueue).map(prof => (
                      <SelectItem key={prof.id} value={prof.id}>
                        {formatOfficerNameForDropdown(prof.full_name, prof.badge_number, prof.rank)} {prof.division ? `• Div: ${prof.division}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddOfficerOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!officerToAddId || addOfficerToQueue.isPending}>
                Add to Queue
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
