// BeatPreferencesView.tsx - Updated with service credit sorting
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Save, X, Edit, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getLastName, getRankAbbreviation, isSupervisorByRank } from "./utils";
import { PREDEFINED_POSITIONS } from "@/constants/positions";
import { useBeatPreferencesPDFExport } from "@/hooks/useBeatPreferencesPDFExport";
import TheBookMobile from "./TheBookMobile";
import { sortOfficersConsistently } from "@/utils/sortingUtils";

interface BeatPreference {
  id?: string;
  officer_id: string;
  first_choice?: string;
  second_choice?: string;
  third_choice?: string;
  unavailable_beats?: string[];
  notes?: string;
  updated_at?: string;
}

interface OfficerWithCredit {
  id: string;
  full_name: string;
  badge_number?: string | null;
  rank?: string | null;
  service_credit_override?: number | null;
  service_credit?: number;
}

interface Props {
  isAdminOrSupervisor: boolean;
  selectedShiftId: string;
  setSelectedShiftId: (shiftId: string) => void;
  shiftTypes: any[];
}

export const BeatPreferencesView: React.FC<Props> = ({ 
  isAdminOrSupervisor,
  selectedShiftId,
  setSelectedShiftId,
  shiftTypes 
}) => {
  const [showAllBeats, setShowAllBeats] = useState<boolean>(true);
  const [editingOfficerId, setEditingOfficerId] = useState<string | null>(null);
  const { exportToPDF: exportBeatPreferencesPDF } = useBeatPreferencesPDFExport();
  const [beatPreferences, setBeatPreferences] = useState<{
    [key: string]: BeatPreference
  }>({});
  const [sortedOfficers, setSortedOfficers] = useState<OfficerWithCredit[]>([]);

  // Filter out "Supervisor" and "Other (Custom)" from beat positions
  const beatPositions = PREDEFINED_POSITIONS.filter(pos => 
    pos !== "Supervisor" && pos !== "Other (Custom)"
  );

  // Fetch officers and their preferences
  const { data: beatData, isLoading, refetch } = useQuery({
    queryKey: ['beat-preferences', selectedShiftId],
    queryFn: async () => {
      if (!selectedShiftId) return null;

      // Fetch officers for this shift - EXCLUDE SUPERVISORS
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

      if (error) {
        console.error("Error fetching recurring schedules:", error);
        throw error;
      }

      // Fetch beat preferences
      const { data: preferences, error: prefError } = await supabase
        .from("officer_beat_preferences")
        .select("*");

      if (prefError) {
        console.error("Error fetching beat preferences:", prefError);
        // Return empty preferences if table doesn't exist or error
        return {
          officers: [],
          preferences: []
        };
      }

      const officers = recurringSchedules?.map(schedule => schedule.profiles) || [];
      
      // FILTER OUT SUPERVISORS - only include non-supervisors
      const nonSupervisorOfficers = officers.filter(officer => 
        !isSupervisorByRank(officer) && officer.rank?.toLowerCase() !== 'probationary'
      );
      
      const uniqueOfficers = Array.from(
        new Map(nonSupervisorOfficers.map(officer => [officer.id, officer])).values()
      );

      // Fetch service credit for each officer
      const officersWithCredit = await Promise.all(
        uniqueOfficers.map(async (officer) => {
          const { data: creditData } = await supabase.rpc("get_service_credit", {
            profile_id: officer.id,
          });
          return {
            ...officer,
            service_credit: creditData || 0,
          };
        })
      );

      return {
        officers: officersWithCredit,
        preferences: preferences || []
      };
    },
    enabled: !!selectedShiftId,
  });

  // Sort officers by service credit when data changes
  useEffect(() => {
    if (beatData?.officers) {
      const sorted = [...beatData.officers].sort((a, b) => {
        // Sort by service credit (highest to lowest)
        const aCredit = a.service_credit || 0;
        const bCredit = b.service_credit || 0;
        
        if (bCredit !== aCredit) {
          return bCredit - aCredit; // Descending order (most to least)
        }
        
        // If same service credit, sort by last name
        return getLastName(a.full_name).localeCompare(getLastName(b.full_name));
      });
      
      setSortedOfficers(sorted);
    } else {
      setSortedOfficers([]);
    }
  }, [beatData]);

  const handleExportPDF = async () => {
  try {
    if (!selectedShiftId || !beatData) {
      toast.error("No data available for export");
      return;
    }

    const result = await exportBeatPreferencesPDF({
      selectedDate: new Date(), // Or your selected date
      shiftName: shiftTypes?.find(s => s.id === selectedShiftId)?.name || "Shift",
      beatData: {
        officers: sortedOfficers,
        preferences: beatData.preferences || []
      },
      shiftTypes,
      selectedShiftId
    });

    if (result.success) {
      toast.success("PDF exported successfully");
    } else {
      throw result.error;
    }
  } catch (error) {
    console.error("PDF export error:", error);
    toast.error("Error exporting PDF");
  }
};

  const handleEditPreferences = (officerId: string) => {
    const officer = beatData?.officers.find(o => o.id === officerId);
    if (!officer) return;

    const existingPrefs = beatData?.preferences.find(p => p.officer_id === officerId);
    
    if (existingPrefs) {
      setBeatPreferences({
        [officerId]: {
          ...existingPrefs,
          officer_id: officerId,
          unavailable_beats: existingPrefs.unavailable_beats || [],
          notes: existingPrefs.notes || ''
        }
      });
    } else {
      setBeatPreferences({
        [officerId]: {
          officer_id: officerId,
          first_choice: '',
          second_choice: '',
          third_choice: '',
          unavailable_beats: [],
          notes: ''
        }
      });
    }
    
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
    const conflicts = choices.filter(choice => 
      (prefs.unavailable_beats || []).includes(choice)
    );
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
          unavailable_beats: prefs.unavailable_beats || [],
          notes: prefs.notes || '',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'officer_id'
        });

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      toast.success("Beat preferences saved successfully");
      setEditingOfficerId(null);
      refetch();
    } catch (error: any) {
      console.error("Full error details:", error);
      toast.error(`Error saving preferences: ${error.message || 'Unknown error'}`);
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
      const unavailable = [...(current.unavailable_beats || [])];
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

  const getPreferenceDisplay = (prefs: BeatPreference) => {
    if (!prefs || (!prefs.first_choice && !prefs.second_choice && !prefs.third_choice)) {
      return (
        <div className="text-sm text-muted-foreground italic">
          No preferences set
        </div>
      );
    }
    
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {prefs.first_choice && (
            <Badge variant="outline" className="bg-green-50 border-green-200 text-green-800">
              1st: {prefs.first_choice}
            </Badge>
          )}
          {prefs.second_choice && (
            <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-800">
              2nd: {prefs.second_choice}
            </Badge>
          )}
          {prefs.third_choice && (
            <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-800">
              3rd: {prefs.third_choice}
            </Badge>
          )}
        </div>
        {prefs.unavailable_beats && prefs.unavailable_beats.length > 0 && (
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
              <div className="text-sm font-medium text-muted-foreground">
                Shift: {shiftTypes?.find(s => s.id === selectedShiftId)?.name || "Not selected"}
              </div>
              <Button 
                onClick={handleExportPDF} 
                size="sm" 
                variant="outline"
                disabled={!selectedShiftId || isLoading}
              >
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={showAllBeats}
                onCheckedChange={setShowAllBeats}
                disabled={!isAdminOrSupervisor}
              />
              <Label>Show All Beats</Label>
            </div>
            
            {!isAdminOrSupervisor ? (
              <div className="text-sm text-muted-foreground">
                View-only mode. Only supervisors and admins can edit beat preferences.
              </div>
            ) : (
              <div className="text-sm text-green-600">
                ✓ Edit mode enabled. You can edit beat preferences for officers.
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          {!selectedShiftId ? (
            <div className="text-center py-8 text-muted-foreground">
              Please select a shift from the Weekly or Monthly tab first
            </div>
          ) : isLoading ? (
            <div className="text-center py-8">Loading beat preferences...</div>
          ) : (
            <div className="space-y-6">
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50 border-green-200 text-green-800">
                    1st Choice
                  </Badge>
                  <span className="text-sm">First Priority</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-800">
                    2nd Choice
                  </Badge>
                  <span className="text-sm">Second Priority</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-800">
                    3rd Choice
                  </Badge>
                  <span className="text-sm">Third Priority</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-800">
                    {sortedOfficers[0]?.service_credit?.toFixed(1) || '0.0'} yrs
                  </Badge>
                  <span className="text-sm">Highest Seniority First</span>
                </div>
              </div>

              {/* Officers Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    Officers ({sortedOfficers.length})
                  </h3>
                  <div className="text-sm text-muted-foreground">
                    {beatData?.preferences.filter(p => p.first_choice && p.second_choice && p.third_choice).length || 0} with preferences
                  </div>
                </div>
                <div className="space-y-4">
                  {sortedOfficers.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      No officers found for this shift
                    </div>
                  ) : (
                    sortedOfficers.map((officer) => {
                      const existingPrefs = beatData?.preferences.find(p => p.officer_id === officer.id);
                      const isEditing = editingOfficerId === officer.id;
                      
                      return (
                        <Card key={officer.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div>
                                  <div className="font-medium">
                                    {getLastName(officer.full_name)}
                                    {officer.rank && (
                                      <Badge variant="outline" className="ml-2">
                                        {getRankAbbreviation(officer.rank)}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    Badge: {officer.badge_number}
                                  </div>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  {officer.service_credit?.toFixed(1) || '0.0'} yrs
                                </Badge>
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
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">Priority Preferences *</Label>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                      <Label htmlFor={`first-${officer.id}`} className="text-xs">1st Choice</Label>
                                      <select
                                        id={`first-${officer.id}`}
                                        value={beatPreferences[officer.id]?.first_choice || ''}
                                        onChange={(e) => updatePreferenceChoice(officer.id, 'first_choice', e.target.value)}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                      >
                                        <option value="">Select 1st Choice</option>
                                        {beatPositions.map((beat) => (
                                          <option key={beat} value={beat}>
                                            {beat}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    
                                    <div className="space-y-1">
                                      <Label htmlFor={`second-${officer.id}`} className="text-xs">2nd Choice</Label>
                                      <select
                                        id={`second-${officer.id}`}
                                        value={beatPreferences[officer.id]?.second_choice || ''}
                                        onChange={(e) => updatePreferenceChoice(officer.id, 'second_choice', e.target.value)}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                      >
                                        <option value="">Select 2nd Choice</option>
                                        {beatPositions.map((beat) => (
                                          <option key={beat} value={beat}>
                                            {beat}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    
                                    <div className="space-y-1">
                                      <Label htmlFor={`third-${officer.id}`} className="text-xs">3rd Choice</Label>
                                      <select
                                        id={`third-${officer.id}`}
                                        value={beatPreferences[officer.id]?.third_choice || ''}
                                        onChange={(e) => updatePreferenceChoice(officer.id, 'third_choice', e.target.value)}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                      >
                                        <option value="">Select 3rd Choice</option>
                                        {beatPositions.map((beat) => (
                                          <option key={beat} value={beat}>
                                            {beat}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                </div>

                                {/* Unavailable Beats */}
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">Unavailable Beats</Label>
                                  <div className="flex flex-wrap gap-1">
                                    {beatPositions.map((beat) => {
                                      const isUnavailable = beatPreferences[officer.id]?.unavailable_beats?.includes(beat) || false;
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
                                  <Label htmlFor={`notes-${officer.id}`} className="text-sm font-medium">Notes</Label>
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
                                    className="min-h-[80px] text-sm"
                                  />
                                </div>
                              </div>
                            ) : (
                              getPreferenceDisplay(existingPrefs)
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
