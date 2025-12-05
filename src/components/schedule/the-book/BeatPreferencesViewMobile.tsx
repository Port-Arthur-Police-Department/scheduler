import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Star, Filter, Download, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getLastName, getRankAbbreviation, isSupervisorByRank } from "./utils";
import { PREDEFINED_POSITIONS } from "@/constants/positions";

interface BeatPreferencesViewMobileProps {
  isAdminOrSupervisor: boolean;
  selectedShiftId: string;
  setSelectedShiftId: (id: string) => void;
  shiftTypes: any[];
}

export const BeatPreferencesViewMobile: React.FC<BeatPreferencesViewMobileProps> = ({
  isAdminOrSupervisor,
  selectedShiftId,
  setSelectedShiftId,
  shiftTypes
}) => {
  const [selectedOfficer, setSelectedOfficer] = useState<string | null>(null);
  const [editingPrefs, setEditingPrefs] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Fetch beat preferences
  const { data: beatData, isLoading, refetch } = useQuery({
    queryKey: ['mobile-beat-preferences', selectedShiftId],
    queryFn: async () => {
      if (!selectedShiftId) return null;

      // Fetch officers for this shift (non-supervisors only)
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
        // Return empty preferences if table doesn't exist
      }

      const officers = recurringSchedules?.map(schedule => schedule.profiles) || [];
      
      // Filter out supervisors and PPOs
      const nonSupervisorOfficers = officers.filter(officer => 
        !isSupervisorByRank(officer) && officer.rank?.toLowerCase() !== 'probationary'
      );
      
      const uniqueOfficers = Array.from(
        new Map(nonSupervisorOfficers.map(officer => [officer.id, officer])).values()
      );

      // Fetch service credits
      const officersWithCredits = await Promise.all(
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

      // Sort by service credit (highest to lowest)
      const sortedOfficers = [...officersWithCredits].sort((a, b) => {
        const aCredit = a.service_credit || 0;
        const bCredit = b.service_credit || 0;
        if (bCredit !== aCredit) {
          return bCredit - aCredit;
        }
        return getLastName(a.full_name).localeCompare(getLastName(b.full_name));
      });

      return {
        officers: sortedOfficers,
        preferences: preferences || []
      };
    },
    enabled: !!selectedShiftId,
  });

  // Get beat positions (filter out Supervisor and Other)
  const beatPositions = PREDEFINED_POSITIONS.filter(pos => 
    pos !== "Supervisor" && pos !== "Other (Custom)"
  );

  // Get preferences for an officer
  const getOfficerPreferences = (officerId: string) => {
    return beatData?.preferences.find(p => p.officer_id === officerId);
  };

  const handleEditPreferences = (officer: any) => {
    const existingPrefs = getOfficerPreferences(officer.id);
    setSelectedOfficer(officer.id);
    setEditingPrefs({
      officer,
      preferences: existingPrefs ? {
        first_choice: existingPrefs.first_choice || '',
        second_choice: existingPrefs.second_choice || '',
        third_choice: existingPrefs.third_choice || '',
        unavailable_beats: existingPrefs.unavailable_beats || [],
        notes: existingPrefs.notes || ''
      } : {
        first_choice: '',
        second_choice: '',
        third_choice: '',
        unavailable_beats: [],
        notes: ''
      }
    });
    setShowEditDialog(true);
  };

  const handleSavePreferences = async () => {
    if (!editingPrefs || !selectedOfficer) return;

    const { first_choice, second_choice, third_choice, unavailable_beats, notes } = editingPrefs.preferences;

    // Validation
    if (!first_choice || !second_choice || !third_choice) {
      alert("Please select all three beat preferences");
      return;
    }

    const choices = [first_choice, second_choice, third_choice];
    const uniqueChoices = new Set(choices);
    if (uniqueChoices.size !== 3) {
      alert("Please select three different beats");
      return;
    }

    try {
      const { error } = await supabase
        .from("officer_beat_preferences")
        .upsert({
          officer_id: selectedOfficer,
          first_choice,
          second_choice,
          third_choice,
          unavailable_beats: unavailable_beats || [],
          notes: notes || '',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'officer_id'
        });

      if (error) throw error;

      alert("Beat preferences saved successfully");
      setShowEditDialog(false);
      setSelectedOfficer(null);
      setEditingPrefs(null);
      refetch();
    } catch (error: any) {
      console.error("Error saving preferences:", error);
      alert(`Error saving preferences: ${error.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Beat Preferences</h2>
        </div>
        <Button size="sm" variant="outline">
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
      </div>

      {/* Beat Positions */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-3">Available Beats</h3>
          <div className="flex flex-wrap gap-1">
            {beatPositions.slice(0, 12).map((beat) => (
              <Badge key={beat} variant="outline" className="text-xs">
                {beat.replace('District ', 'D')}
              </Badge>
            ))}
            {beatPositions.length > 12 && (
              <Badge variant="outline" className="text-xs">
                +{beatPositions.length - 12} more
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-8">Loading beat preferences...</div>
      ) : !selectedShiftId ? (
        <div className="text-center py-8 text-muted-foreground">
          Please select a shift
        </div>
      ) : !beatData ? (
        <div className="text-center py-8 text-muted-foreground">
          No beat data found
        </div>
      ) : (
        <>
          {/* Officers with Preferences */}
          <div>
            <h3 className="font-semibold mb-2">Officers ({beatData.officers.length})</h3>
            <div className="space-y-2">
              {beatData.officers.slice(0, 10).map((officer) => {
                const prefs = getOfficerPreferences(officer.id);
                const hasPrefs = prefs && (prefs.first_choice || prefs.second_choice || prefs.third_choice);
                
                return (
                  <Card key={officer.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-medium">
                            {getLastName(officer.full_name)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            #{officer.badge_number} • {officer.service_credit?.toFixed(1) || '0.0'} yrs
                          </div>
                        </div>
                        {hasPrefs ? (
                          <Badge variant="outline" className="bg-green-50">
                            Has Prefs
                          </Badge>
                        ) : (
                          <Badge variant="outline">No Prefs</Badge>
                        )}
                      </div>

                      {hasPrefs ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {prefs.first_choice && (
                              <Badge variant="outline" className="bg-green-50 border-green-200 text-green-800 text-xs">
                                1st: {prefs.first_choice}
                              </Badge>
                            )}
                            {prefs.second_choice && (
                              <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-800 text-xs">
                                2nd: {prefs.second_choice}
                              </Badge>
                            )}
                            {prefs.third_choice && (
                              <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-800 text-xs">
                                3rd: {prefs.third_choice}
                              </Badge>
                            )}
                          </div>
                          {prefs.unavailable_beats && prefs.unavailable_beats.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Unavailable: {prefs.unavailable_beats.slice(0, 2).join(', ')}
                              {prefs.unavailable_beats.length > 2 && ` +${prefs.unavailable_beats.length - 2}`}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground italic">
                          No preferences set
                        </div>
                      )}

                      {isAdminOrSupervisor && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-3"
                          onClick={() => handleEditPreferences(officer)}
                        >
                          {hasPrefs ? "Edit" : "Set"} Preferences
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {beatData.officers.length > 10 && (
                <div className="text-center text-sm text-muted-foreground">
                  +{beatData.officers.length - 10} more officers
                </div>
              )}
            </div>
          </div>

          {/* Edit Preferences Dialog - FIXED with proper DialogTitle */}
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Edit Preferences for {editingPrefs ? getLastName(editingPrefs.officer.full_name) : ''}
                </DialogTitle>
              </DialogHeader>
              
              {editingPrefs && (
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label className="text-sm">1st Choice</Label>
                    <Select 
                      value={editingPrefs.preferences.first_choice}
                      onValueChange={(value) => setEditingPrefs({
                        ...editingPrefs,
                        preferences: {
                          ...editingPrefs.preferences,
                          first_choice: value
                        }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select 1st choice" />
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

                  <div className="space-y-2">
                    <Label className="text-sm">2nd Choice</Label>
                    <Select 
                      value={editingPrefs.preferences.second_choice}
                      onValueChange={(value) => setEditingPrefs({
                        ...editingPrefs,
                        preferences: {
                          ...editingPrefs.preferences,
                          second_choice: value
                        }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select 2nd choice" />
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

                  <div className="space-y-2">
                    <Label className="text-sm">3rd Choice</Label>
                    <Select 
                      value={editingPrefs.preferences.third_choice}
                      onValueChange={(value) => setEditingPrefs({
                        ...editingPrefs,
                        preferences: {
                          ...editingPrefs.preferences,
                          third_choice: value
                        }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select 3rd choice" />
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

                  <div className="space-y-2">
                    <Label className="text-sm">Notes</Label>
                    <Textarea
                      value={editingPrefs.preferences.notes || ''}
                      onChange={(e) => setEditingPrefs({
                        ...editingPrefs,
                        preferences: {
                          ...editingPrefs.preferences,
                          notes: e.target.value
                        }
                      })}
                      placeholder="Additional notes..."
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        setShowEditDialog(false);
                        setSelectedOfficer(null);
                        setEditingPrefs(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      className="flex-1"
                      onClick={handleSavePreferences}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};
