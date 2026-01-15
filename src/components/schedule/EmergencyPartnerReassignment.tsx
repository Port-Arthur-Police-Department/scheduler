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

  // Query for available partners (regular officers not in partnerships and not on PTO)
  const { data: availablePartners, isLoading } = useQuery({
    queryKey: ["emergency-partners", ppoOfficer.officerId, date, shift.id],
    queryFn: async () => {
      console.log("🔍 Finding available partners for emergency reassignment...");
      
      // Get all officers working this shift today
      const { data: workingOfficers, error } = await supabase
        .from("schedule_exceptions")
        .select(`
          id,
          officer_id,
          is_partnership,
          partnership_suspended,
          is_off,
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

      if (error) {
        console.error("Error finding working officers:", error);
        throw error;
      }

      // Filter for available partners
     // In EmergencyPartnerReassignment.tsx, update the query filter:
const availablePartners = (workingOfficers || []).filter(record => {
  const officer = record.profiles;
  
  // Skip if officer is on PTO
  if (record.is_off) return false;
  
  // Skip if officer is a PPO (PPOs can't partner with each other)
  const isPPO = officer.rank?.toLowerCase().includes('probationary');
  if (isPPO) return false;
  
  // Skip if already in an active partnership (unless suspended due to partner's PTO)
  if (record.is_partnership && !record.partnership_suspended) {
    return false;
  }
  
  // Check if officer has the PPO emergency availability marker
  const hasPPOAvailabilityMarker = record.notes?.includes('[PPO_AVAILABLE_FOR_EMERGENCY]');
  if (hasPPOAvailabilityMarker) {
    console.log(`✅ Officer ${officer.full_name} marked as available for PPO emergency assignment`);
  }
  
  return true;
});

      console.log("Available partners found:", availablePartners.map(p => ({
        name: p.profiles.full_name,
        rank: p.profiles.rank,
        hasPartnership: p.is_partnership,
        partnershipSuspended: p.partnership_suspended
      })));

      return availablePartners.map(p => ({
        id: p.officer_id,
        name: p.profiles.full_name,
        badge: p.profiles.badge_number,
        rank: p.profiles.rank,
        scheduleId: p.id,
        hasSuspendedPartnership: p.partnership_suspended
      }));
    },
    enabled: open
  });

  // Mutation to create emergency partnership
  const createEmergencyPartnership = useMutation({
    mutationFn: async (partnerId: string) => {
      const partner = availablePartners?.find(p => p.id === partnerId);
      if (!partner) throw new Error("Selected partner not found");

      console.log("🚨 Creating emergency partnership:", {
        ppo: ppoOfficer.name,
        partner: partner.name,
        date,
        shift: shift.name
      });

      // Create new partnership exception
      const { error } = await supabase
        .from("schedule_exceptions")
        .insert([
          {
            officer_id: ppoOfficer.officerId,
            partner_officer_id: partnerId,
            date: date,
            shift_type_id: shift.id,
            is_partnership: true,
            partnership_suspended: false,
            schedule_type: "emergency_partnership",
            position_name: "Riding Partner (PPO)",
            notes: `Emergency assignment - original partner unavailable`,
            is_off: false
          },
          {
            officer_id: partnerId,
            partner_officer_id: ppoOfficer.officerId,
            date: date,
            shift_type_id: shift.id,
            is_partnership: true,
            partnership_suspended: false,
            schedule_type: "emergency_partnership",
            position_name: "Emergency Riding Partner",
            notes: `Emergency assignment with PPO ${ppoOfficer.name}`,
            is_off: false
          }
        ]);

      if (error) throw error;

      // Log the emergency assignment
      await supabase
        .from("partnership_exceptions")
        .insert({
          officer_id: ppoOfficer.officerId,
          partner_officer_id: partnerId,
          date: date,
          shift_type_id: shift.id,
          reason: "Emergency assignment - original partner unavailable",
          exception_type: "emergency_reassignment",
          created_at: new Date().toISOString()
        });

      return { partnerName: partner.name };
    },
    onSuccess: (data) => {
      toast.success(`Emergency partnership created with ${data.partnerName}`);
      queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-schedule"] });
      onOpenChange(false);
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
            <p className="text-sm text-amber-700 mt-1">Shift: {shift.name}</p>
            <p className="text-sm text-amber-700">Date: {date}</p>
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
                    <p>No available officers found.</p>
                    <p className="text-xs">All regular officers are either:</p>
                    <ul className="text-xs list-disc pl-4 mt-1">
                      <li>Already partnered</li>
                      <li>On PTO</li>
                      <li>Assigned to special duty</li>
                    </ul>
                  </div>
                ) : (
                  availablePartners?.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      <div className="flex flex-col py-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{partner.name}</span>
                          {partner.hasSuspendedPartnership && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              Available (Partner on PTO)
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Badge: {partner.badge} • {partner.rank}
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
            <p className="font-medium mb-1">Note:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>This is a one-time assignment for today only</li>
              <li>The original partnership will resume tomorrow</li>
              <li>Both officers will be marked as partnered for today's shift</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
