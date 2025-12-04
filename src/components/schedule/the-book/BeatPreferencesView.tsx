// BeatPreferencesView.tsx - Updated with PDF Export
import React, { useState } from 'react';
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
  const [beatPreferences, setBeatPreferences] = useState<{
    [key: string]: BeatPreference
  }>({});

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

      return {
        officers: uniqueOfficers,
        preferences: preferences || []
      };
    },
    enabled: !!selectedShiftId,
  });

  const handleExportPDF = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF("portrait", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Title
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(41, 128, 185);
      pdf.text(
        `Beat Preferences - ${shiftTypes?.find(s => s.id === selectedShiftId)?.name || "Shift"}`,
        pageWidth / 2,
        20,
        { align: "center" }
      );

      // Generation Date
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text(
        `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
        pageWidth - 10,
        30,
        { align: "right" }
      );

      let yPosition = 40;

      // Check if we have data
      if (!beatData || beatData.officers.length === 0) {
        pdf.setFontSize(12);
        pdf.setTextColor(150, 150, 150);
        pdf.text("No officer beat preferences available", pageWidth / 2, yPosition, { align: "center" });
        pdf.save("Beat_Preferences.pdf");
        return;
      }

      // Sort officers by last name for the PDF
      const sortedOfficers = [...beatData.officers].sort((a, b) => 
        getLastName(a.full_name).localeCompare(getLastName(b.full_name))
      );

      // Table headers
      pdf.setFillColor(41, 128, 185);
      pdf.rect(10, yPosition, pageWidth - 20, 8, "F");
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);

      let xPosition = 12;
      
      // Headers
      pdf.text("Officer", xPosition, yPosition + 6);
      xPosition += 35;
      
      pdf.text("Badge #", xPosition, yPosition + 6);
      xPosition += 20;
      
      pdf.text("Rank", xPosition, yPosition + 6);
      xPosition += 20;
      
      pdf.text("1st Choice", xPosition, yPosition + 6);
      xPosition += 25;
      
      pdf.text("2nd Choice", xPosition, yPosition + 6);
      xPosition += 25;
      
      pdf.text("3rd Choice", xPosition, yPosition + 6);
      xPosition += 25;
      
      pdf.text("Unavailable", xPosition, yPosition + 6);

      yPosition += 10;

      // Officer rows
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(0, 0, 0);

      const rowHeight = 8;
      const maxRowsPerPage = Math.floor((pageHeight - yPosition - 20) / rowHeight);

      sortedOfficers.forEach((officer, index) => {
        // Check if we need a new page
        if (index > 0 && index % maxRowsPerPage === 0) {
          pdf.addPage();
          yPosition = 20;
          
          // Add headers to new page
          pdf.setFillColor(41, 128, 185);
          pdf.rect(10, yPosition, pageWidth - 20, 8, "F");
          
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(255, 255, 255);

          xPosition = 12;
          pdf.text("Officer", xPosition, yPosition + 6);
          xPosition += 35;
          pdf.text("Badge #", xPosition, yPosition + 6);
          xPosition += 20;
          pdf.text("Rank", xPosition, yPosition + 6);
          xPosition += 20;
          pdf.text("1st Choice", xPosition, yPosition + 6);
          xPosition += 25;
          pdf.text("2nd Choice", xPosition, yPosition + 6);
          xPosition += 25;
          pdf.text("3rd Choice", xPosition, yPosition + 6);
          xPosition += 25;
          pdf.text("Unavailable", xPosition, yPosition + 6);

          yPosition += 10;
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(0, 0, 0);
        }

        const preferences = beatData.preferences.find(p => p.officer_id === officer.id);
        
        // Row background - alternate colors
        if (index % 2 === 0) {
          pdf.setFillColor(245, 245, 245);
          pdf.rect(10, yPosition, pageWidth - 20, rowHeight, "F");
        }

        xPosition = 12;
        
        // Officer name (last name only)
        pdf.text(getLastName(officer.full_name), xPosition, yPosition + 6);
        xPosition += 35;
        
        // Badge number
        pdf.text(officer.badge_number || "-", xPosition, yPosition + 6);
        xPosition += 20;
        
        // Rank
        pdf.text(getRankAbbreviation(officer.rank), xPosition, yPosition + 6);
        xPosition += 20;
        
        // 1st Choice
        if (preferences?.first_choice) {
          pdf.setTextColor(0, 100, 0); // Green
          pdf.text(preferences.first_choice, xPosition, yPosition + 6);
        } else {
          pdf.setTextColor(150, 150, 150); // Gray
          pdf.text("-", xPosition, yPosition + 6);
        }
        xPosition += 25;
        
        // 2nd Choice
        if (preferences?.second_choice) {
          pdf.setTextColor(0, 0, 150); // Blue
          pdf.text(preferences.second_choice, xPosition, yPosition + 6);
        } else {
          pdf.setTextColor(150, 150, 150);
          pdf.text("-", xPosition, yPosition + 6);
        }
        xPosition += 25;
        
        // 3rd Choice
        if (preferences?.third_choice) {
          pdf.setTextColor(128, 0, 128); // Purple
          pdf.text(preferences.third_choice, xPosition, yPosition + 6);
        } else {
          pdf.setTextColor(150, 150, 150);
          pdf.text("-", xPosition, yPosition + 6);
        }
        xPosition += 25;
        
        // Unavailable beats (truncated if too long)
        if (preferences?.unavailable_beats && preferences.unavailable_beats.length > 0) {
          pdf.setTextColor(150, 0, 0); // Red
          const unavailableText = preferences.unavailable_beats.join(', ');
          if (unavailableText.length > 20) {
            pdf.text(unavailableText.substring(0, 20) + "...", xPosition, yPosition + 6);
          } else {
            pdf.text(unavailableText, xPosition, yPosition + 6);
          }
        } else {
          pdf.setTextColor(150, 150, 150);
          pdf.text("-", xPosition, yPosition + 6);
        }

        // Reset text color for next row
        pdf.setTextColor(0, 0, 0);
        
        yPosition += rowHeight;
      });

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(
        `Total Officers: ${sortedOfficers.length} | Officers with Preferences: ${beatData.preferences.filter(p => p.first_choice && p.second_choice && p.third_choice).length}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );

      const shiftName = shiftTypes?.find(s => s.id === selectedShiftId)?.name.replace(/\s+/g, "_") || "Shift";
      const filename = `Beat_Preferences_${shiftName}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      pdf.save(filename);
      
      toast.success("PDF exported successfully");
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

  // Sort officers by last name
  const sortedOfficers = beatData?.officers?.sort((a, b) => 
    getLastName(a.full_name).localeCompare(getLastName(b.full_name))
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
                                        <option value="">Select 3rd Choice</Option>
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
