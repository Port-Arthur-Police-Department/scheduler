// src/components/schedule/EmergencyPartnerReassignment.tsx
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Users, Shield, Clock } from "lucide-react";
import { toast } from "sonner";
import { parseISO, format, isValid } from "date-fns";

interface EmergencyPartnerReassignmentProps {
  ppoOfficer: any;
  date: string;
  shift: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EmergencyPartnerReassignment = ({
  ppoOfficer,
  date,
  shift,
  open,
  onOpenChange
}: EmergencyPartnerReassignmentProps) => {
  const [selectedPartner, setSelectedPartner] = useState("");
  const queryClient = useQueryClient();
  
  // Helper function to determine if officer is a PPO - STRICTER CHECK
  const isPPO = (officer: any): boolean => {
    if (!officer || !officer.rank) return false;
    const rank = officer.rank.toString().toLowerCase().trim();
    
    // Only match exact PPO-related ranks
    return (
      rank === 'ppo' ||
      rank === 'probationary' ||
      rank === 'probationary officer' ||
      rank === 'probationary peace officer' ||
      rank === 'probationary police officer' ||
      rank.includes('ppo') ||
      rank.includes('probationary officer') ||
      rank.includes('probationary peace officer')
    );
  };

  // Validate that this component is only used for PPOs
  useEffect(() => {
    if (open && ppoOfficer) {
      const officerIsPPO = isPPO(ppoOfficer);
      console.log("🔍 PPO Validation Check:", {
        officerName: ppoOfficer.name,
        officerRank: ppoOfficer.rank,
        isPPO: officerIsPPO
      });

      if (!officerIsPPO) {
        toast.error("Emergency partner reassignment is only available for Probationary Officers (PPOs)");
        onOpenChange(false);
        return;
      }

      // Additional check: ensure officer has a suspended partnership
      if (!ppoOfficer.partnershipSuspended) {
        toast.error("Emergency partners are only needed when the original partnership is suspended");
        onOpenChange(false);
      }
    }
  }, [open, ppoOfficer, onOpenChange]);

  // Query for available partners - only regular officers (non-PPOs) who are not in active partnerships
  const { data: availablePartners, isLoading } = useQuery({
    queryKey: ["emergency-partners", ppoOfficer?.officerId, date, shift?.id],
    queryFn: async () => {
      if (!ppoOfficer || !shift) {
        console.log("❌ Missing officer or shift data");
        return [];
      }

      console.log("🔍 Finding emergency partners for PPO:", {
        ppoOfficer: ppoOfficer.name,
        ppoRank: ppoOfficer.rank,
        date,
        shiftId: shift.id,
        shiftName: shift.name
      });

      // Validate date
      let parsedDate;
      try {
        parsedDate = parseISO(date);
        if (!isValid(parsedDate)) {
          throw new Error("Invalid date");
        }
      } catch (error) {
        console.error("Invalid date format:", date);
        toast.error("Invalid date format");
        return [];
      }

      const dayOfWeek = parsedDate.getDay();
      const currentDate = parsedDate;

      console.log("📅 Parsed date info:", { 
        dayOfWeek, 
        currentDate: format(currentDate, "yyyy-MM-dd"),
        isValid: isValid(currentDate)
      });

      // Step 1: Get schedule exceptions for this date and shift
      const { data: exceptions, error: exceptionsError } = await supabase
        .from("schedule_exceptions")
        .select(`
          id,
          officer_id,
          is_partnership,
          partnership_suspended,
          is_off,
          notes,
          position_name,
          unit_number,
          profiles:officer_id (
            id,
            full_name,
            badge_number,
            rank
          )
        `)
        .eq("date", date)
        .eq("shift_type_id", shift.id)
        .neq("officer_id", ppoOfficer.officerId); // Exclude the PPO

      if (exceptionsError) {
        console.error("Error finding schedule exceptions:", exceptionsError);
        throw exceptionsError;
      }

      // Step 2: Get recurring schedules for this day of week and shift
      const { data: recurringSchedules, error: recurringError } = await supabase
        .from("recurring_schedules")
        .select(`
          id,
          officer_id,
          is_partnership,
          partnership_suspended,
          day_of_week,
          start_date,
          end_date,
          notes,
          position_name,
          unit_number,
          profiles:profiles!recurring_schedules_officer_id_fkey (
            id,
            full_name,
            badge_number,
            rank
          )
        `)
        .eq("shift_type_id", shift.id)
        .eq("day_of_week", dayOfWeek);

      if (recurringError) {
        console.error("Error finding recurring schedules:", recurringError);
        throw recurringError;
      }

      console.log("📊 Raw data counts:", {
        exceptionsCount: exceptions?.length || 0,
        recurringCount: recurringSchedules?.length || 0
      });

      // Process all officers working today
      const allOfficers = new Map();

      // Process exceptions first (they override recurring schedules)
      if (exceptions) {
        for (const exception of exceptions) {
          if (!exception.profiles) {
            console.log("❌ Skipping exception without profile");
            continue;
          }
          
          // Skip officers who are off duty (PTO)
          if (exception.is_off) {
            console.log(`⏸️ Skipping officer on PTO via exception: ${exception.profiles.full_name}`);
            continue;
          }
          
          // Skip if already in this map (shouldn't happen but safety check)
          if (allOfficers.has(exception.officer_id)) {
            console.log(`⏸️ Skipping duplicate officer in exceptions: ${exception.profiles.full_name}`);
            continue;
          }
          
          allOfficers.set(exception.officer_id, {
            id: exception.officer_id,
            name: exception.profiles.full_name,
            badge: exception.profiles.badge_number,
            rank: exception.profiles.rank,
            position: exception.position_name,
            unitNumber: exception.unit_number,
            isPartnership: exception.is_partnership,
            partnershipSuspended: exception.partnership_suspended,
            source: 'exception',
            scheduleId: exception.id,
            notes: exception.notes,
            isPPO: isPPO(exception.profiles) // Add PPO check
          });
        }
      }

      // Process recurring schedules
      if (recurringSchedules) {
        for (const recurring of recurringSchedules) {
          if (!recurring.profiles) {
            console.log("❌ Skipping recurring schedule without profile");
            continue;
          }
          
          // Skip if already processed via exception
          if (allOfficers.has(recurring.officer_id)) {
            console.log(`⏸️ Skipping - has exception override: ${recurring.profiles.full_name}`);
            continue;
          }
          
          // Validate date range
          const startDate = parseISO(recurring.start_date);
          const endDate = recurring.end_date ? parseISO(recurring.end_date) : null;
          
          if (!isValid(startDate)) {
            console.log(`❌ Invalid start date: ${recurring.start_date} for ${recurring.profiles.full_name}`);
            continue;
          }
          
          if (currentDate < startDate) {
            console.log(`⏸️ Skipping - date before start: ${recurring.profiles.full_name}`);
            continue;
          }
          
          if (endDate && !isValid(endDate)) {
            console.log(`❌ Invalid end date: ${recurring.end_date} for ${recurring.profiles.full_name}`);
            continue;
          }
          
          if (endDate && currentDate > endDate) {
            console.log(`⏸️ Skipping - date after end: ${recurring.profiles.full_name}`);
            continue;
          }
          
          // Skip if officer is marked as off in recurring (shouldn't happen but just in case)
          if (recurring.is_off) {
            console.log(`⏸️ Skipping officer marked as off in recurring: ${recurring.profiles.full_name}`);
            continue;
          }
          
          allOfficers.set(recurring.officer_id, {
            id: recurring.officer_id,
            name: recurring.profiles.full_name,
            badge: recurring.profiles.badge_number,
            rank: recurring.profiles.rank,
            position: recurring.position_name,
            unitNumber: recurring.unit_number,
            isPartnership: recurring.is_partnership,
            partnershipSuspended: recurring.partnership_suspended,
            source: 'recurring',
            scheduleId: recurring.id,
            notes: recurring.notes,
            isPPO: isPPO(recurring.profiles) // Add PPO check
          });
        }
      }

      console.log("👮 Total officers found (before filtering):", Array.from(allOfficers.values()).map(o => ({
        name: o.name,
        rank: o.rank,
        isPPO: o.isPPO,
        position: o.position,
        source: o.source,
        hasPartnership: o.isPartnership,
        partnershipSuspended: o.partnershipSuspended
      })));

      // Filter for available partners - STRICT RULES
      const availablePartners = Array.from(allOfficers.values()).filter(officer => {
        // Rule 1: Must NOT be a PPO (PPOs can't partner with PPOs in emergencies)
        if (officer.isPPO) {
          console.log(`❌ Strictly excluding PPO: ${officer.name} (Rank: ${officer.rank})`);
          return false;
        }
        
        // Rule 2: Must NOT be in an active partnership (unless suspended)
        if (officer.isPartnership && !officer.partnershipSuspended) {
          console.log(`❌ Skipping - in active partnership: ${officer.name}`);
          return false;
        }
        
        // Rule 3: Officer is available for emergency assignment
        console.log(`✅ Available for emergency assignment: ${officer.name} (${officer.rank}) - Position: ${officer.position} - Source: ${officer.source}`);
        return true;
      });

      console.log("🚨 Emergency partners found:", availablePartners.map(p => ({
        name: p.name,
        rank: p.rank,
        isPPO: p.isPPO,
        position: p.position,
        source: p.source,
        hasSuspendedPartnership: p.partnershipSuspended
      })));

      // Sort alphabetically by last name
      return availablePartners.sort((a, b) => {
        const getLastName = (fullName: string) => {
          const parts = fullName.trim().split(' ');
          return parts[parts.length - 1] || '';
        };
        const lastNameA = getLastName(a.name).toLowerCase();
        const lastNameB = getLastName(b.name).toLowerCase();
        return lastNameA.localeCompare(lastNameB);
      });
    },
    enabled: open && ppoOfficer && shift && isPPO(ppoOfficer) // Only enable if officer is PPO
  });

  // Mutation to create emergency partnership
  const createEmergencyPartnership = useMutation({
    mutationFn: async (partnerId: string) => {
      if (!partnerId || !ppoOfficer || !shift) {
        throw new Error("Missing required data for emergency partnership");
      }

      const partner = availablePartners?.find(p => p.id === partnerId);
      if (!partner) throw new Error("Selected partner not found");

      // Double-check: partner must NOT be a PPO
      if (isPPO(partner)) {
        throw new Error("Cannot assign a PPO as an emergency partner to another PPO");
      }

      console.log("🚨 Creating emergency partnership for PPO:", {
        ppo: ppoOfficer.name,
        ppoRank: ppoOfficer.rank,
        ppoId: ppoOfficer.officerId,
        ppoPosition: ppoOfficer.position,
        partner: partner.name,
        partnerRank: partner.rank,
        partnerId: partnerId,
        partnerPosition: partner.position,
        date,
        shift: shift.name,
        shiftId: shift.id
      });

      // 1. Get existing schedule data for PPO
      const { data: ppoExistingSchedule, error: ppoScheduleError } = await supabase
        .from("schedule_exceptions")
        .select("*")
        .eq("officer_id", ppoOfficer.officerId)
        .eq("date", date)
        .eq("shift_type_id", shift.id)
        .maybeSingle();

      if (ppoScheduleError && ppoScheduleError.code !== 'PGRST116') {
        console.error("Error fetching PPO schedule:", ppoScheduleError);
        throw ppoScheduleError;
      }

      // 2. Get existing schedule data for partner
      const { data: partnerExistingSchedule, error: partnerScheduleError } = await supabase
        .from("schedule_exceptions")
        .select("*")
        .eq("officer_id", partnerId)
        .eq("date", date)
        .eq("shift_type_id", shift.id)
        .maybeSingle();

      if (partnerScheduleError && partnerScheduleError.code !== 'PGRST116') {
        console.error("Error fetching partner schedule:", partnerScheduleError);
        throw partnerScheduleError;
      }

      // 3. Preserve existing positions or use null
      const ppoPosition = ppoExistingSchedule?.position_name || ppoOfficer.position || null;
      const partnerPosition = partnerExistingSchedule?.position_name || partner.position || null;

      // 4. Create emergency partnership exception for the PPO
      const ppoExceptionData: any = {
        officer_id: ppoOfficer.officerId,
        partner_officer_id: partnerId,
        date: date,
        shift_type_id: shift.id,
        is_partnership: true,
        is_emergency_partnership: true, // Mark as emergency
        partnership_suspended: false,
        partnership_suspension_reason: null,
        schedule_type: "emergency_partnership",
        notes: `EMERGENCY: Partnered with ${partner.name} while original partner on PTO`,
        is_off: false,
        position_name: ppoPosition
      };

      // Add unit number if it exists
      if (ppoExistingSchedule?.unit_number) {
        ppoExceptionData.unit_number = ppoExistingSchedule.unit_number;
      } else if (ppoOfficer.unitNumber) {
        ppoExceptionData.unit_number = ppoOfficer.unitNumber;
      }

      const { error: ppoError } = await supabase
        .from("schedule_exceptions")
        .upsert(ppoExceptionData, {
          onConflict: 'officer_id,date,shift_type_id'
        });

      if (ppoError) {
        console.error("Error creating PPO emergency exception:", ppoError);
        throw ppoError;
      }

      // 5. Create emergency partnership exception for the partner
      const partnerExceptionData: any = {
        officer_id: partnerId,
        partner_officer_id: ppoOfficer.officerId,
        date: date,
        shift_type_id: shift.id,
        is_partnership: true,
        is_emergency_partnership: true, // Mark as emergency
        partnership_suspended: false,
        partnership_suspension_reason: null,
        schedule_type: "emergency_partnership",
        notes: `EMERGENCY: Partnered with PPO ${ppoOfficer.name} (original partner on PTO)`,
        is_off: false,
        position_name: partnerPosition
      };

      // Add unit number if it exists
      if (partnerExistingSchedule?.unit_number) {
        partnerExceptionData.unit_number = partnerExistingSchedule.unit_number;
      } else if (partner.unitNumber) {
        partnerExceptionData.unit_number = partner.unitNumber;
      }

      const { error: partnerError } = await supabase
        .from("schedule_exceptions")
        .upsert(partnerExceptionData, {
          onConflict: 'officer_id,date,shift_type_id'
        });

      if (partnerError) {
        console.error("Error creating partner emergency exception:", partnerError);
        throw partnerError;
      }

      // 6. Log the emergency assignment
      const { error: logError } = await supabase
        .from("partnership_exceptions")
        .insert({
          officer_id: ppoOfficer.officerId,
          partner_officer_id: partnerId,
          date: date,
          shift_type_id: shift.id,
          reason: "Emergency assignment - original PPO partner on PTO",
          exception_type: "emergency_reassignment",
          created_at: new Date().toISOString(),
          is_ppo_partnership: true,
          can_emergency_reassign: false, // This is the emergency assignment, no further reassignment needed
          is_emergency_assignment: true
        });

      if (logError) {
        console.error("Error logging emergency partnership exception:", logError);
        // Don't throw here - the partnership was created successfully
      }

      // 7. Update the original partnership exception to mark it as having emergency assignment
      if (ppoOfficer.partnerData?.partnerOfficerId) {
        await supabase
          .from("partnership_exceptions")
          .update({
            has_emergency_assignment: true,
            emergency_assigned_to: partnerId
          })
          .eq("officer_id", ppoOfficer.officerId)
          .eq("partner_officer_id", ppoOfficer.partnerData.partnerOfficerId)
          .eq("date", date)
          .eq("exception_type", "pto_suspension");
      }

      return { 
        partnerName: partner.name,
        ppoPosition: ppoPosition,
        partnerPosition: partnerPosition,
        ppoName: ppoOfficer.name
      };
    },
    onSuccess: (data) => {
      toast.success(`Emergency partnership created: PPO ${data.ppoName} paired with ${data.partnerName}. Positions preserved.`);
      queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["emergency-partners"] });
      onOpenChange(false);
      setSelectedPartner("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create emergency partnership");
      console.error("Emergency partnership error:", error);
    }
  });

  // Don't render if officer is not PPO
  if (!ppoOfficer || !isPPO(ppoOfficer)) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Emergency Partner Reassignment
          </DialogTitle>
          <DialogDescription>
            {ppoOfficer.name}'s regular partner is unavailable. Select a temporary emergency partner for today.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* PPO Officer Info */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-amber-800">PPO Officer:</p>
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                <Shield className="h-3 w-3 mr-1" />
                PPO
              </Badge>
            </div>
            <p className="font-semibold text-lg">{ppoOfficer.name}</p>
            <div className="grid grid-cols-2 gap-2 text-sm mt-2">
              <div>
                <span className="text-amber-700">Badge:</span>
                <span className="ml-2 font-medium">{ppoOfficer.badge || 'N/A'}</span>
              </div>
              <div>
                <span className="text-amber-700">Rank:</span>
                <span className="ml-2 font-medium">{ppoOfficer.rank || 'N/A'}</span>
              </div>
              {ppoOfficer.position && (
                <div className="col-span-2">
                  <span className="text-amber-700">Current Position:</span>
                  <span className="ml-2 font-medium">{ppoOfficer.position}</span>
                </div>
              )}
            </div>
            <div className="mt-2 text-sm">
              <div className="flex items-center gap-2 text-amber-700">
                <Clock className="h-3 w-3" />
                <span>Shift: {shift.name}</span>
              </div>
              <div className="text-amber-700">
                Date: {format(parseISO(date), "MMM d, yyyy")}
              </div>
            </div>
            {ppoOfficer.partnerData?.partnerName && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800 font-medium">Original Partnership:</p>
                <p className="text-sm text-yellow-700">
                  {ppoOfficer.partnerData.partnerName} is on PTO
                </p>
              </div>
            )}
          </div>
          
          {/* Partner Selection */}
          <div>
            <Label htmlFor="emergency-partner-select">Select Emergency Partner</Label>
            <Select value={selectedPartner} onValueChange={setSelectedPartner}>
              <SelectTrigger id="emergency-partner-select">
                <SelectValue placeholder="Choose available officer" />
              </SelectTrigger>
              <SelectContent>
                {isLoading ? (
                  <div className="p-4 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600 mx-auto mb-2"></div>
                    <div className="text-sm text-muted-foreground">Loading available officers...</div>
                  </div>
                ) : availablePartners?.length === 0 ? (
                  <div className="p-4 text-center space-y-2">
                    <AlertTriangle className="h-8 w-8 text-amber-600 mx-auto" />
                    <p className="text-sm font-medium">No available officers found</p>
                    <p className="text-xs text-muted-foreground">
                      All regular officers are either:
                    </p>
                    <ul className="text-xs text-left text-muted-foreground list-disc pl-4 space-y-1">
                      <li>Already in active partnerships</li>
                      <li>On PTO/off duty</li>
                      <li>PPOs (cannot partner with PPOs)</li>
                      <li>Not scheduled for this shift</li>
                    </ul>
                  </div>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto">
                    <div className="text-xs text-muted-foreground p-2 border-b sticky top-0 bg-background">
                      Select a regular officer (non-PPO) for temporary assignment
                    </div>
                    {availablePartners?.map((partner) => (
                      <SelectItem key={partner.id} value={partner.id}>
                        <div className="flex flex-col py-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{partner.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {partner.source === 'exception' ? 'Exception' : 'Recurring'}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1 mt-1">
                            <div className="flex items-center gap-2">
                              <span>Badge: {partner.badge || 'N/A'}</span>
                              <span>•</span>
                              <span>{partner.rank || 'Officer'}</span>
                            </div>
                            {partner.position && (
                              <div className="text-blue-600">Position: {partner.position}</div>
                            )}
                            {partner.partnershipSuspended && (
                              <div className="text-amber-600">
                                <Users className="h-3 w-3 inline mr-1" />
                                Available (Partner on PTO)
                              </div>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                )}
              </SelectContent>
            </Select>
            
            {availablePartners && availablePartners.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Select a regular officer (non-PPO) to temporarily partner with this PPO for today only.
              </p>
            )}
          </div>
          
          {/* Action Button */}
          <Button
            onClick={() => createEmergencyPartnership.mutate(selectedPartner)}
            disabled={!selectedPartner || createEmergencyPartnership.isPending}
            className="w-full bg-amber-600 hover:bg-amber-700"
          >
            {createEmergencyPartnership.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Assigning Emergency Partner...
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Assign Emergency Partner
              </>
            )}
          </Button>
          
          {/* Important Information */}
          <div className="text-xs text-muted-foreground p-3 bg-gray-50 rounded border space-y-2">
            <div className="font-medium text-gray-800">Emergency Assignment Rules:</div>
            <ul className="list-disc pl-4 space-y-1">
              <li>This is a temporary assignment for today only</li>
              <li>The original partnership will automatically resume tomorrow</li>
              <li>Only regular officers (non-PPOs) can be emergency partners</li>
              <li>Both officers will keep their current positions/assignments</li>
              <li>Emergency assignments are only for PPOs whose trainers are on PTO</li>
            </ul>
            <div className="pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2 text-amber-700">
                <Shield className="h-3 w-3" />
                <span className="font-medium">PPO Requirement:</span>
              </div>
              <p className="mt-1">
                Probationary Officers (PPOs) must always be partnered with a regular officer and cannot work alone.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
