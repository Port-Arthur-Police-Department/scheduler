// src/components/schedule/the-book/BeatPreferencesView.tsx
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Filter, Save, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getLastName, getRankAbbreviation, isSupervisorByRank } from "./utils";
import { PREDEFINED_POSITIONS } from "@/constants/positions";

export const BeatPreferencesView: React.FC = () => {
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [showAllBeats, setShowAllBeats] = useState<boolean>(true);
  const [editingOfficerId, setEditingOfficerId] = useState<string | null>(null);
  const [beatPreferences, setBeatPreferences] = useState<Record<string, any>>({});

  // Get shift types
  const { data: shiftTypes } = useQuery({
    queryKey: ["shift-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_types")
        .select("*")
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  // Filter out "Supervisor" and "Other (Custom)" from beat positions
  const beatPositions = PREDEFINED_POSITIONS.filter(pos => 
    pos !== "Supervisor" && pos !== "Other (Custom)"
  );

  // Fetch officers and their preferences
  const { data: beatData, isLoading, refetch } = useQuery({
    queryKey: ['beat-preferences', selectedShiftId],
    queryFn: async () => {
      if (!selectedShiftId) return null;

      // Fetch officers for this shift
      const { data: recurringSchedules, error } = await supabase
        .from("recurring_schedules")
        .select(`
          officer_id,
          profiles!recurring_schedules_officer_id_fkey (
            id,
            full_name,
            badge_number,
            rank,
            service_credit_override
          )
        `)
        .eq("shift_type_id", selectedShiftId)
        .is("end_date", null);

      if (error) throw error;

      // Fetch beat preferences
      const { data: preferences, error: prefError } = await supabase
        .from("officer_beat_preferences")
        .select("*");

      if (prefError && prefError.code !== 'PGRST116') { // Ignore "relation doesn't exist" error
        console.error("Error fetching preferences:", prefError);
      }

      const officers = recurringSchedules?.map(schedule => schedule.profiles) || [];
      const uniqueOfficers = Array.from(
        new Map(officers.map(officer => [officer.id, officer])).values()
      );

      return {
        officers: uniqueOfficers,
        preferences: preferences || []
      };
    },
    enabled: !!selectedShiftId,
  });

  const handleEditPreferences = (officerId: string) => {
    const officer = beatData?.officers.find(o => o.id === officerId);
    if (!officer) return;

    const existingPrefs = beatData?.preferences.find(p => p.officer_id === officerId);
    
    setBeatPreferences({
      [officerId]: {
        preferredBeats: existingPrefs?.preferred_beats?.split(',') || [],
        unavailableBeats: existingPrefs?.unavailable_beats?.split(',') || [],
        notes: existingPrefs?.notes || ''
      }
    });
    
    setEditingOfficerId(officerId);
  };

  const handleSavePreferences = async (officerId: string) => {
    const prefs = beatPreferences[officerId];
    if (!prefs) return;

    try {
      const { error } = await supabase
        .from("officer_beat_preferences")
        .upsert({
          officer_id: officerId,
          preferred_beats: prefs.preferredBeats.join(','),
          unavailable_beats: prefs.unavailableBeats.join(','),
          notes: prefs.notes,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'officer_id'
        });

      if (error) throw error;

      toast.success("Preferences saved successfully");
      setEditingOfficerId(null);
      refetch();
    } catch (error: any) {
      toast.error(`Error saving preferences: ${error.message}`);
    }
  };

  const toggleBeat = (officerId: string, beat: string, list: 'preferredBeats' | 'unavailableBeats') => {
    setBeatPreferences(prev => {
      const current = prev[officerId] || { preferredBeats: [], unavailableBeats: [], notes: '' };
      const currentList = [...current[list]];
      const otherList = list === 'preferredBeats' ? 'unavailableBeats' : 'preferredBeats';
      const otherListArray = [...current[otherList]];

      // Remove from other list if present
      const otherIndex = otherListArray.indexOf(beat);
      if (otherIndex > -1) {
        otherListArray.splice(otherIndex, 1);
      }

      // Toggle in current list
      const index = currentList.indexOf(beat);
      if (index > -1) {
        currentList.splice(index, 1);
      } else {
        currentList.push(beat);
      }

      return {
        ...prev,
        [officerId]: {
          ...current,
          [list]: currentList,
          [otherList]: otherListArray
        }
      };
    });
  };

  const getBeatStatus = (officerId: string, beat: string) => {
    const prefs = beatPreferences[officerId];
    if (!prefs) {
      const existing = beatData?.preferences.find(p => p.officer_id === officerId);
      if (!existing) return 'neutral';
      
      const preferred = existing.preferred_beats?.split(',') || [];
      const unavailable = existing.unavailable_beats?.split(',') || [];
      
      if (preferred.includes(beat)) return 'preferred';
      if (unavailable.includes(beat)) return 'unavailable';
      return 'neutral';
    }

    if (prefs.preferredBeats.includes(beat)) return 'preferred';
    if (prefs.unavailableBeats.includes(beat)) return 'unavailable';
    return 'neutral';
  };

  // Categorize officers
  const supervisors = beatData?.officers?.filter(officer => 
    isSupervisorByRank(officer)
  ) || [];

  const regularOfficers = beatData?.officers?.filter(officer => 
    !isSupervisorByRank(officer) && officer.rank?.toLowerCase() !== 'probationary'
  ) || [];

  const ppos = beatData?.officers?.filter(officer => 
    officer.rank?.toLowerCase() === 'probationary'
  ) || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Beat Preferences
            </CardTitle>
            <div className="flex items-center gap-3">
              <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select Shift" />
                </SelectTrigger>
                <SelectContent>
                  {shiftTypes?.map((shift) => (
                    <SelectItem key={shift.id} value={shift.id}>
                      {shift.name} ({shift.start_time} - {shift.end_time})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch
                  checked={showAllBeats}
                  onCheckedChange={setShowAllBeats}
                />
                <Label>Show All Beats</Label>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {!selectedShiftId ? (
            <div className="text-center py-8 text-muted-foreground">
              Please select a shift to view beat preferences
            </div>
          ) : isLoading ? (
            <div className="text-center py-8">Loading beat preferences...</div>
          ) : (
            <div className="space-y-6">
              {/* Beat Legend */}
              <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-green-500"></div>
                  <span className="text-sm">Preferred</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-red-500"></div>
                  <span className="text-sm">Unavailable</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-gray-300"></div>
                  <span className="text-sm">Neutral</span>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-2 gap-8">
                {/* Left Column - Supervisors */}
                <div className="space-y-4">
                  <div className="text-lg font-semibold border-b pb-2">
                    Supervisors
                  </div>
                  <div className="space-y-4">
                    {supervisors.map((officer) => (
                      <Card key={officer.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <div className="font-medium">
                                {getLastName(officer.full_name)}
                                <Badge variant="outline" className="ml-2">
                                  {getRankAbbreviation(officer.rank)}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {officer.badge_number}
                              </div>
                            </div>
                            {editingOfficerId === officer.id ? (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleSavePreferences(officer.id)}>
                                  <Save className="h-3 w-3 mr-1" />
                                  Save
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingOfficerId(null)}>
                                  <X className="h-3 w-3 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => handleEditPreferences(officer.id)}>
                                <Plus className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            )}
                          </div>

                          {/* Beat Selection Grid */}
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            {beatPositions.map((beat) => {
                              const status = getBeatStatus(officer.id, beat);
                              return (
                                <button
                                  key={beat}
                                  onClick={() => editingOfficerId === officer.id && toggleBeat(officer.id, beat, 'preferredBeats')}
                                  disabled={editingOfficerId !== officer.id}
                                  className={`
                                    p-2 text-xs border rounded text-center transition-colors
                                    ${status === 'preferred' ? 'bg-green-100 border-green-300 text-green-800' : ''}
                                    ${status === 'unavailable' ? 'bg-red-100 border-red-300 text-red-800' : ''}
                                    ${status === 'neutral' ? 'bg-gray-100 border-gray-300 text-gray-800' : ''}
                                    ${editingOfficerId === officer.id ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
                                  `}
                                >
                                  {beat.replace('District ', 'D')}
                                </button>
                              );
                            })}
                          </div>

                          {/* Notes */}
                          {editingOfficerId === officer.id && (
                            <div className="mt-3">
                              <Label htmlFor={`notes-${officer.id}`}>Notes</Label>
                              <Textarea
                                id={`notes-${officer.id}`}
                                value={beatPreferences[officer.id]?.notes || ''}
                                onChange={(e) => setBeatPreferences(prev => ({
                                  ...prev,
                                  [officer.id]: {
                                    ...prev[officer.id],
                                    notes: e.target.value
                                  }
                                }))}
                                placeholder="Any notes about beat preferences..."
                                className="mt-1"
                              />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Right Column - Regular Officers */}
                <div className="space-y-4">
                  <div className="text-lg font-semibold border-b pb-2">
                    Officers
                  </div>
                  <div className="space-y-4">
                    {regularOfficers.map((officer) => (
                      <Card key={officer.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <div className="font-medium">{getLastName(officer.full_name)}</div>
                              <div className="text-sm text-muted-foreground">
                                {officer.badge_number}
                              </div>
                            </div>
                            {editingOfficerId === officer.id ? (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleSavePreferences(officer.id)}>
                                  <Save className="h-3 w-3 mr-1" />
                                  Save
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingOfficerId(null)}>
                                  <X className="h-3 w-3 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => handleEditPreferences(officer.id)}>
                                <Plus className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            )}
                          </div>

                          {/* Beat Selection Grid */}
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            {beatPositions.map((beat) => {
                              const status = getBeatStatus(officer.id, beat);
                              return (
                                <button
                                  key={beat}
                                  onClick={() => editingOfficerId === officer.id && toggleBeat(officer.id, beat, 'preferredBeats')}
                                  disabled={editingOfficerId !== officer.id}
                                  className={`
                                    p-2 text-xs border rounded text-center transition-colors
                                    ${status === 'preferred' ? 'bg-green-100 border-green-300 text-green-800' : ''}
                                    ${status === 'unavailable' ? 'bg-red-100 border-red-300 text-red-800' : ''}
                                    ${status === 'neutral' ? 'bg-gray-100 border-gray-300 text-gray-800' : ''}
                                    ${editingOfficerId === officer.id ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
                                  `}
                                >
                                  {beat.replace('District ', 'D')}
                                </button>
                              );
                            })}
                          </div>

                          {/* Notes */}
                          {editingOfficerId === officer.id && (
                            <div className="mt-3">
                              <Label htmlFor={`notes-${officer.id}`}>Notes</Label>
                              <Textarea
                                id={`notes-${officer.id}`}
                                value={beatPreferences[officer.id]?.notes || ''}
                                onChange={(e) => setBeatPreferences(prev => ({
                                  ...prev,
                                  [officer.id]: {
                                    ...prev[officer.id],
                                    notes: e.target.value
                                  }
                                }))}
                                placeholder="Any notes about beat preferences..."
                                className="mt-1"
                              />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>

              {/* PPO Section */}
              {ppos.length > 0 && (
                <div className="space-y-4">
                  <div className="text-lg font-semibold border-b pb-2">
                    PPO Officers
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {ppos.map((officer) => (
                      <Card key={officer.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <div className="font-medium">
                                {getLastName(officer.full_name)}
                                <Badge variant="outline" className="ml-2 bg-blue-100">
                                  PPO
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {officer.badge_number}
                              </div>
                            </div>
                            {editingOfficerId === officer.id ? (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleSavePreferences(officer.id)}>
                                  <Save className="h-3 w-3 mr-1" />
                                  Save
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingOfficerId(null)}>
                                  <X className="h-3 w-3 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => handleEditPreferences(officer.id)}>
                                <Plus className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            )}
                          </div>

                          {/* Simplified Beat Display for PPOs */}
                          <div className="text-sm text-muted-foreground">
                            PPOs typically rotate through all beats for training
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="grid grid-cols-4 gap-4 pt-4 border-t">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{supervisors.length}</div>
                  <div className="text-sm text-muted-foreground">Supervisors</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{regularOfficers.length}</div>
                  <div className="text-sm text-muted-foreground">Officers</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{ppos.length}</div>
                  <div className="text-sm text-muted-foreground">PPOs</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">
                    {supervisors.length + regularOfficers.length + ppos.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
