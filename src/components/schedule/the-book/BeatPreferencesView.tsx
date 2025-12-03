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
import { MapPin, Save, X, ChevronUp, ChevronDown, Eye, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getLastName, getRankAbbreviation, isSupervisorByRank } from "./utils";
import { PREDEFINED_POSITIONS } from "@/constants/positions";
import { useUser } from "@/contexts/UserContext";

interface BeatPreference {
  id?: string;
  officer_id: string;
  first_choice: string;
  second_choice: string;
  third_choice: string;
  unavailable_beats: string[];
  notes: string;
  updated_at: string;
}

interface Props {
  isAdminOrSupervisor: boolean;
}

export const BeatPreferencesView: React.FC<Props> = ({ isAdminOrSupervisor }) => {
  const { userRole } = useUser();
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [showAllBeats, setShowAllBeats] = useState<boolean>(true);
  const [editingOfficerId, setEditingOfficerId] = useState<string | null>(null);
  const [beatPreferences, setBeatPreferences] = useState<Record<string, BeatPreference>>({});

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

      // Fetch beat preferences - using a custom table for priority preferences
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
    
    // Initialize with empty preferences or existing ones
    setBeatPreferences({
      [officerId]: existingPrefs || {
        officer_id: officerId,
        first_choice: '',
        second_choice: '',
        third_choice: '',
        unavailable_beats: [],
        notes: ''
      }
    });
    
    setEditingOfficerId(officerId);
  };

  const handleSavePreferences = async (officerId: string) => {
    const prefs = beatPreferences[officerId];
    if (!prefs) return;

    // Validate that all three choices are selected and unique
    if (!prefs.first_choice || !prefs.second_choice || !prefs.third_choice) {
      toast.error("Please select all three beat preferences");
      return;
    }

    const choices = [prefs.first_choice, prefs.second_choice, prefs.third_choice];
    const uniqueChoices = new Set(choices);
    if (uniqueChoices.size !== 3) {
      toast.error("Please select three different beats");
      return;
    }

    // Check if unavailable beats conflict with choices
    const conflicts = choices.filter(choice => prefs.unavailable_beats.includes(choice));
    if (conflicts.length > 0) {
      toast.error(`Cannot mark ${conflicts.join(', ')} as both preferred and unavailable`);
      return;
    }

    try {
      const { error } = await supabase
        .from("officer_beat_preferences")
        .upsert({
          officer_id: officerId,
          first_choice: prefs.first_choice,
          second_choice: prefs.second_choice,
          third_choice: prefs.third_choice,
          unavailable_beats: prefs.unavailable_beats,
          notes: prefs.notes,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'officer_id'
        });

      if (error) throw error;

      toast.success("Beat preferences saved successfully");
      setEditingOfficerId(null);
      refetch();
    } catch (error: any) {
      toast.error(`Error saving preferences: ${error.message}`);
    }
  };

  const handleCancelEdit = (officerId: string) => {
    setEditingOfficerId(null);
  };

  const updatePreferenceChoice = (officerId: string, choice: 'first_choice' | 'second_choice' | 'third_choice', value: string) => {
    setBeatPreferences(prev => ({
      ...prev,
      [officerId]: {
        ...prev[officerId],
        [choice]: value
      }
    }));
  };

  const toggleUnavailableBeat = (officerId: string, beat: string) => {
    const prefs = beatPreferences[officerId];
    if (!prefs) return;

    const choices = [prefs.first_choice, prefs.second_choice, prefs.third_choice];
    if (choices.includes(beat)) {
      toast.error(`Cannot mark ${beat} as both preferred and unavailable`);
      return;
    }

    setBeatPreferences(prev => {
      const current = prev[officerId];
      const unavailable = [...current.unavailable_beats];
      const index = unavailable.indexOf(beat);
      
      if (index > -1) {
        unavailable.splice(index, 1);
      } else {
        unavailable.push(beat);
      }

      return {
        ...prev,
        [officerId]: {
          ...current,
          unavailable_beats: unavailable
        }
      };
    });
  };

  const getPreferenceDisplay = (prefs: any) => {
    if (!prefs) return null;
    
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-50 border-green-200">
            1st: {prefs.first_choice || 'Not set'}
          </Badge>
          <Badge variant="outline" className="bg-blue-50 border-blue-200">
            2nd: {prefs.second_choice || 'Not set'}
          </Badge>
          <Badge variant="outline" className="bg-purple-50 border-purple-200">
            3rd: {prefs.third_choice || 'Not set'}
          </Badge>
        </div>
        {prefs.unavailable_beats?.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Unavailable: {prefs.unavailable_beats.join(', ')}
          </div>
        )}
        {prefs.notes && (
          <div className="text-xs text-muted-foreground">
            Notes: {prefs.notes}
          </div>
        )}
      </div>
    );
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
                  disabled={!isAdminOrSupervisor}
                />
                <Label>Show All Beats</Label>
              </div>
            </div>
          </div>
          {!isAdminOrSupervisor && (
            <div className="text-sm text-muted-foreground mt-2">
              View-only mode. Only supervisors and admins can edit beat preferences.
            </div>
          )}
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
              {/* Two Column Layout */}
              <div className="grid grid-cols-2 gap-8">
                {/* Left Column - Supervisors */}
                <div className="space-y-4">
                  <div className="text-lg font-semibold border-b pb-2">
                    Supervisors
                  </div>
                  <div className="space-y-4">
                    {supervisors.map((officer) => {
                      const existingPrefs = beatData?.preferences.find(p => p.officer_id === officer.id);
                      const isEditing = editingOfficerId === officer.id;
                      
                      return (
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
                              {isAdminOrSupervisor ? (
                                isEditing ? (
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => handleSavePreferences(officer.id)}>
                                      <Save className="h-3 w-3 mr-1" />
                                      Save
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => handleCancelEdit(officer.id)}>
                                      <X className="h-3 w-3 mr-1" />
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <Button size="sm" variant="outline" onClick={() => handleEditPreferences(officer.id)}>
                                    <Edit className="h-3 w-3 mr-1" />
                                    Edit
                                  </Button>
                                )
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  View Only
                                </Badge>
                              )}
                            </div>

                            {isEditing ? (
                              <div className="space-y-3">
                                {/* Priority Selection */}
                                <div className="space-y-2">
                                  <Label>Priority Preferences</Label>
                                  <div className="grid grid-cols-3 gap-2">
                                    <Select
                                      value={beatPreferences[officer.id]?.first_choice || ''}
                                      onValueChange={(value) => updatePreferenceChoice(officer.id, 'first_choice', value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="1st Choice" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {beatPositions.map((beat) => (
                                          <SelectItem key={beat} value={beat}>
                                            {beat}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Select
                                      value={beatPreferences[officer.id]?.second_choice || ''}
                                      onValueChange={(value) => updatePreferenceChoice(officer.id, 'second_choice', value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="2nd Choice" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {beatPositions.map((beat) => (
                                          <SelectItem key={beat} value={beat}>
                                            {beat}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Select
                                      value={beatPreferences[officer.id]?.third_choice || ''}
                                      onValueChange={(value) => updatePreferenceChoice(officer.id, 'third_choice', value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="3rd Choice" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {beatPositions.map((beat) => (
                                          <SelectItem key={beat} value={beat}>
                                            {beat}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                {/* Unavailable Beats */}
                                <div className="space-y-2">
                                  <Label>Unavailable Beats</Label>
                                  <div className="flex flex-wrap gap-1">
                                    {beatPositions.map((beat) => {
                                      const isUnavailable = beatPreferences[officer.id]?.unavailable_beats?.includes(beat);
                                      const isPreferred = [
                                        beatPreferences[officer.id]?.first_choice,
                                        beatPreferences[officer.id]?.second_choice,
                                        beatPreferences[officer.id]?.third_choice
                                      ].includes(beat);
                                      
                                      return (
                                        <button
                                          key={beat}
                                          type="button"
                                          onClick={() => toggleUnavailableBeat(officer.id, beat)}
                                          disabled={isPreferred}
                                          className={`
                                            px-2 py-1 text-xs border rounded transition-colors
                                            ${isUnavailable ? 'bg-red-100 border-red-300 text-red-800' : 'bg-gray-100 border-gray-300 text-gray-800'}
                                            ${isPreferred ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}
                                          `}
                                          title={isPreferred ? "Cannot mark preferred beat as unavailable" : ""}
                                        >
                                          {beat.replace('District ', 'D')}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Notes */}
                                <div className="space-y-2">
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
                                    className="min-h-[80px]"
                                  />
                                </div>
                              </div>
                            ) : (
                              getPreferenceDisplay(existingPrefs)
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Right Column - Regular Officers */}
                <div className="space-y-4">
                  <div className="text-lg font-semibold border-b pb-2">
                    Officers
                  </div>
                  <div className="space-y-4">
                    {regularOfficers.map((officer) => {
                      const existingPrefs = beatData?.preferences.find(p => p.officer_id === officer.id);
                      const isEditing = editingOfficerId === officer.id;
                      
                      return (
                        <Card key={officer.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <div className="font-medium">{getLastName(officer.full_name)}</div>
                                <div className="text-sm text-muted-foreground">
                                  {officer.badge_number}
                                </div>
                              </div>
                              {isAdminOrSupervisor ? (
                                isEditing ? (
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => handleSavePreferences(officer.id)}>
                                      <Save className="h-3 w-3 mr-1" />
                                      Save
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => handleCancelEdit(officer.id)}>
                                      <X className="h-3 w-3 mr-1" />
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <Button size="sm" variant="outline" onClick={() => handleEditPreferences(officer.id)}>
                                    <Edit className="h-3 w-3 mr-1" />
                                    Edit
                                  </Button>
                                )
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  View Only
                                </Badge>
                              )}
                            </div>

                            {isEditing ? (
                              <div className="space-y-3">
                                {/* Priority Selection */}
                                <div className="space-y-2">
                                  <Label>Priority Preferences</Label>
                                  <div className="grid grid-cols-3 gap-2">
                                    <Select
                                      value={beatPreferences[officer.id]?.first_choice || ''}
                                      onValueChange={(value) => updatePreferenceChoice(officer.id, 'first_choice', value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="1st Choice" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {beatPositions.map((beat) => (
                                          <SelectItem key={beat} value={beat}>
                                            {beat}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Select
                                      value={beatPreferences[officer.id]?.second_choice || ''}
                                      onValueChange={(value) => updatePreferenceChoice(officer.id, 'second_choice', value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="2nd Choice" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {beatPositions.map((beat) => (
                                          <SelectItem key={beat} value={beat}>
                                            {beat}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Select
                                      value={beatPreferences[officer.id]?.third_choice || ''}
                                      onValueChange={(value) => updatePreferenceChoice(officer.id, 'third_choice', value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="3rd Choice" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {beatPositions.map((beat) => (
                                          <SelectItem key={beat} value={beat}>
                                            {beat}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                {/* Unavailable Beats */}
                                <div className="space-y-2">
                                  <Label>Unavailable Beats</Label>
                                  <div className="flex flex-wrap gap-1">
                                    {beatPositions.map((beat) => {
                                      const isUnavailable = beatPreferences[officer.id]?.unavailable_beats?.includes(beat);
                                      const isPreferred = [
                                        beatPreferences[officer.id]?.first_choice,
                                        beatPreferences[officer.id]?.second_choice,
                                        beatPreferences[officer.id]?.third_choice
                                      ].includes(beat);
                                      
                                      return (
                                        <button
                                          key={beat}
                                          type="button"
                                          onClick={() => toggleUnavailableBeat(officer.id, beat)}
                                          disabled={isPreferred}
                                          className={`
                                            px-2 py-1 text-xs border rounded transition-colors
                                            ${isUnavailable ? 'bg-red-100 border-red-300 text-red-800' : 'bg-gray-100 border-gray-300 text-gray-800'}
                                            ${isPreferred ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}
                                          `}
                                          title={isPreferred ? "Cannot mark preferred beat as unavailable" : ""}
                                        >
                                          {beat.replace('District ', 'D')}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Notes */}
                                <div className="space-y-2">
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
                                    className="min-h-[80px]"
                                  />
                                </div>
                              </div>
                            ) : (
                              getPreferenceDisplay(existingPrefs)
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
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
                    {ppos.map((officer) => {
                      const existingPrefs = beatData?.preferences.find(p => p.officer_id === officer.id);
                      
                      return (
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
                              <Badge variant="secondary" className="text-xs">
                                View Only
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {getPreferenceDisplay(existingPrefs) || "PPOs typically rotate through all beats for training"}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
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
                    {beatData?.preferences.filter(p => p.first_choice && p.second_choice && p.third_choice).length || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">With Preferences</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
