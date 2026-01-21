// src/components/schedule/EmergencyPartnerReassignment.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Users, Shield } from "lucide-react";
import { toast } from "sonner";
import { parseISO, format } from "date-fns";

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
  
  // Helper function to determine if officer is a PPO
  const isPPO = (officer: any): boolean => {
    if (!officer || !officer.rank) return false;
    const rank = officer.rank.toLowerCase().trim();
    return (
      rank === 'probationary' ||
      rank.includes('probationary') ||
      rank.includes('ppo') ||
      rank.includes('probation') ||
      rank === 'ppo' ||
      rank.includes('probationary officer') ||
      rank.includes('probationary peace officer')
    );
  };

  // Query for available partners (regular officers not in partnerships and not on PTO)
  const { data: availablePartners, isLoading } = useQuery({
    queryKey: ["emergency-partners", ppoOfficer.officerId, date, shift.id],
    queryFn: async () => {
      console.log("🔍 Finding available partners for emergency reassignment...", {
        date,
        shiftId: shift.id,
        shiftName: shift.name,
        ppoOfficer: ppoOfficer.name
      });
      
      const dayOfWeek = parseISO(date).getDay();
      const currentDate = parseISO(date);

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

      console.log("📊 Raw data:", {
        exceptionsCount: exceptions?.length || 0,
        recurringCount: recurringSchedules?.length || 0
      });

      // Process all officers working today
      const allOfficers = new Map();

      // Process exceptions first (they override recurring schedules)
      if (exceptions) {
        for (const exception of exceptions) {
          if (!exception.profiles) continue;
          
          // Skip officers who are off duty (PTO)
          if (exception.is_off) {
            console.log(`⏸️ Skipping officer on PTO via exception: ${exception.profiles.full_name}`);
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
            notes: exception.notes
          });
        }
      }

      // Process recurring schedules
      if (recurringSchedules) {
        for (const recurring of recurringSchedules) {
          if (!recurring.profiles) continue;
          
          // Skip if already processed via exception
          if (allOfficers.has(recurring.officer_id)) {
            console.log(`⏸️ Skipping - has exception override: ${recurring.profiles.full_name}`);
            continue;
          }
          
          // Validate date range
          const startDate = parseISO(recurring.start_date);
          const endDate = recurring.end_date ? parseISO(recurring.end_date) : null;
          
          if (currentDate < startDate) {
            console.log(`⏸️ Skipping - date before start: ${recurring.profiles.full_name}`);
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
            notes: recurring.notes
          });
        }
      }

      console.log("👮 Total officers found (before filtering):", Array.from(allOfficers.values()).map(o => ({
        name: o.name,
        rank: o.rank,
        position: o.position,
        source: o.source,
        hasPartnership: o.isPartnership,
        partnershipSuspended: o.partnershipSuspended
      })));

      // Filter for available partners
      const availablePartners = Array.from(allOfficers.values()).filter(officer => {
        // Skip if officer is a PPO (PPOs can't partner with each other in emergencies)
        if (isPPO(officer)) {
          console.log(`❌ Skipping PPO for emergency assignment: ${officer.name} (Rank: ${officer.rank})`);
          return false;
        }
        
        // Skip if already in an active partnership (unless suspended)
        if (officer.isPartnership && !officer.partnershipSuspended) {
          console.log(`❌ Skipping - in active partnership: ${officer.name}`);
          return false;
        }
        
        // Officer is available for emergency assignment
        console.log(`✅ Available for emergency assignment: ${officer.name} (${officer.rank}) - Position: ${officer.position} - Source: ${officer.source}`);
        return true;
      });

      console.log("🚨 Emergency partners found:", availablePartners.map(p => ({
        name: p.name,
        rank: p.rank,
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
    enabled: open
  });

  // Mutation to create emergency partnership - UPDATED TO PRESERVE POSITIONS
 
const createEmergencyPartnership = useMutation({
  mutationFn: async (partnerId: string) => {
    const partner = availablePartners?.find(p => p.id === partnerId);
    if (!partner) throw new Error("Selected partner not found");

    console.log("🚨 Creating emergency partnership:", {
      ppo: ppoOfficer.name,
      ppoId: ppoOfficer.officerId,
      partner: partner.name,
      date,
      shift: shift.name
    });

    // Create partnership WITHOUT changing positions
    const ppoExceptionData: any = {
      officer_id: ppoOfficer.officerId,
      partner_officer_id: partnerId,
      date: date,
      shift_type_id: shift.id,
      is_partnership: true,
      partnership_suspended: false,
      notes: `Emergency partnership with ${partner.name} - original partner on PTO`,
      is_off: false,
      // DO NOT set position_name - let it remain null or keep existing
      // schedule_type will be determined by the system
    };

    // Only update partnership fields, not position
    const { error: ppoError } = await supabase
      .from("schedule_exceptions")
      .upsert(ppoExceptionData, {
        onConflict: 'officer_id,date,shift_type_id'
      });

    if (ppoError) {
      console.error("Error creating PPO exception:", ppoError);
      throw ppoError;
    }

    const partnerExceptionData: any = {
      officer_id: partnerId,
      partner_officer_id: ppoOfficer.officerId,
      date: date,
      shift_type_id: shift.id,
      is_partnership: true,
      partnership_suspended: false,
      notes: `Emergency partnership with PPO ${ppoOfficer.name}`,
      is_off: false,
      // DO NOT set position_name
    };

    const { error: partnerError } = await supabase
      .from("schedule_exceptions")
      .upsert(partnerExceptionData, {
        onConflict: 'officer_id,date,shift_type_id'
      });

    if (partnerError) {
      console.error("Error creating partner exception:", partnerError);
      throw partnerError;
    }

    return { partnerName: partner.name };
  },
    onSuccess: (data) => {
      toast.success(`Emergency partnership created with ${data.partnerName}. Positions preserved.`);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Emergency Partner Reassignment
          </DialogTitle>
          <DialogDescription>
            {ppoOfficer.name}'s regular partner is unavailable. Select a new partner for today.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* PPO Officer Info */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded">
            <p className="font-medium text-amber-800">PPO Officer:</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                <Shield className="h-3 w-3 mr-1" />
                PPO
              </Badge>
              <p className="font-medium">{ppoOfficer.name}</p>
              {ppoOfficer.badge && <span className="text-sm text-amber-700">({ppoOfficer.badge})</span>}
            </div>
            {ppoOfficer.position && (
              <p className="text-sm text-amber-700 mt-1">Current Position: {ppoOfficer.position}</p>
            )}
            <p className="text-sm text-amber-700">Shift: {shift.name}</p>
            <p className="text-sm text-amber-700">Date: {format(parseISO(date), "MMM d, yyyy")}</p>
            {ppoOfficer.partnerData?.partnerName && (
              <p className="text-sm text-amber-700 mt-1">
                Original partner: {ppoOfficer.partnerData.partnerName} (on PTO)
              </p>
            )}
          </div>
          
          {/* Partner Selection */}
          <div>
            <Select value={selectedPartner} onValueChange={setSelectedPartner}>
              <SelectTrigger>
                <SelectValue placeholder="Select available officer" />
              </SelectTrigger>
              <SelectContent>
                {isLoading ? (
                  <div className="p-2 text-sm text-muted-foreground">Loading available officers...</div>
                ) : availablePartners?.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground space-y-1">
                    <p>No available officers found for emergency assignment.</p>
                    <p className="text-xs">All regular officers are either:</p>
                    <ul className="text-xs list-disc pl-4 mt-1">
                      <li>Already in active partnerships</li>
                      <li>On PTO/off duty</li>
                      <li>PPOs (cannot partner with PPOs in emergencies)</li>
                      <li>Not scheduled for this shift today</li>
                    </ul>
                  </div>
                ) : (
                  availablePartners?.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      <div className="flex flex-col py-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{partner.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {partner.source === 'exception' ? 'Exception' : 'Recurring'}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Badge: {partner.badge} • {partner.rank}
                          {partner.position && ` • Position: ${partner.position}`}
                          {partner.partnershipSuspended && (
                            <span className="text-amber-600"> • Available (Partner on PTO)</span>
                          )}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            
            {availablePartners && availablePartners.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Select a regular officer (non-PPO) to partner with this PPO for today only.
                Their current positions will be preserved.
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
              "Assigning Emergency Partner..."
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Assign Emergency Partner
              </>
            )}
          </Button>
          
          {/* Warning Note */}
          <div className="text-xs text-muted-foreground p-2 bg-gray-50 rounded border">
            <p className="font-medium mb-1">Important:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>This is a one-time assignment for today only</li>
              <li>The original partnership will resume tomorrow</li>
              <li>Both officers will keep their current positions/assignments</li>
              <li>Only regular officers (non-PPOs) are available for emergency assignments</li>
              <li>Positions/districts will be assigned separately later</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
