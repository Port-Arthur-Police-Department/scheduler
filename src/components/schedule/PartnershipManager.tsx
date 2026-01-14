// src/components/schedule/PartnershipManager.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { isPPO } from "@/utils/sortingUtils";

interface PartnershipManagerProps {
  officer: any;
  onPartnershipChange: (officer: any, partnerOfficerId?: string) => void;
}

// Helper function to extract last name
const getLastName = (fullName: string) => {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  return parts[parts.length - 1] || '';
};

export const PartnershipManager = ({ officer, onPartnershipChange }: PartnershipManagerProps) => {
  const [open, setOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState("");

  // Check if current officer is PPO
  const isCurrentOfficerPPO = isPPO({
    id: officer.officerId,
    full_name: officer.name,
    rank: officer.rank
  });

  // If officer is not PPO, don't show partnership option
  if (!isCurrentOfficerPPO) {
    console.log("Officer is not PPO, hiding partnership option:", {
      name: officer.name,
      rank: officer.rank,
      isPPO: isCurrentOfficerPPO
    });
    return null;
  }

  const { data: availablePartners, isLoading } = useQuery({
    queryKey: ["available-partners", officer.shift.id, officer.date || format(new Date(), "yyyy-MM-dd")],
    queryFn: async () => {
      // Get all officers working on the same shift and day
      const dateToUse = officer.date || format(new Date(), "yyyy-MM-dd");
      const dayOfWeek = parseISO(dateToUse).getDay();

      // First, get recurring officers for this shift and day
      const { data: recurringOfficers, error: recurringError } = await supabase
        .from("recurring_schedules")
        .select(`
          officer_id,
          profiles:profiles!recurring_schedules_officer_id_fkey (
            id,
            full_name,
            badge_number,
            rank
          )
        `)
        .eq("shift_type_id", officer.shift.id)
        .eq("day_of_week", dayOfWeek)
        .or(`end_date.is.null,end_date.gte.${dateToUse}`)
        .neq("officer_id", officer.officerId); // Exclude current officer

      if (recurringError) {
        console.error("Error fetching recurring officers:", recurringError);
        throw recurringError;
      }

      // Then, get exception officers for this specific date and shift
      const { data: exceptionOfficers, error: exceptionError } = await supabase
        .from("schedule_exceptions")
        .select(`
          officer_id,
          profiles:officer_id (
            id,
            full_name,
            badge_number,
            rank
          )
        `)
        .eq("date", dateToUse)
        .eq("shift_type_id", officer.shift.id)
        .eq("is_off", false)
        .neq("officer_id", officer.officerId); // Exclude current officer

      if (exceptionError) {
        console.error("Error fetching exception officers:", exceptionError);
        throw exceptionError;
      }

      // Combine and deduplicate officers
      const allOfficers = [
        ...(recurringOfficers || []).map((ro: any) => ro.profiles),
        ...(exceptionOfficers || []).map((eo: any) => eo.profiles)
      ];

      // Remove duplicates and filter out null profiles
      const uniqueOfficers = allOfficers
        .filter((profile, index, self) => 
          profile && 
          profile.id && 
          index === self.findIndex(p => p?.id === profile.id)
        )
        .filter(profile => profile.id !== officer.officerId) // Double-check exclusion
        // ONLY SHOW PPO OFFICERS
        .filter(profile => {
          const officerForCheck = {
            id: profile.id,
            full_name: profile.full_name,
            rank: profile.rank
          };
          return isPPO(officerForCheck);
        })
        .sort((a, b) => {
          const lastNameA = getLastName(a.full_name).toLowerCase();
          const lastNameB = getLastName(b.full_name).toLowerCase();
          return lastNameA.localeCompare(lastNameB);
        });

      console.log("Available PPO partners:", uniqueOfficers);
      return uniqueOfficers;
    },
    enabled: open,
  });

  const handleCreatePartnership = async () => {
    if (!selectedPartner) return;
    
    console.log("Creating partnership:", {
      officerId: officer.officerId,
      officerName: officer.name,
      partnerOfficerId: selectedPartner,
      partnerName: availablePartners?.find(p => p.id === selectedPartner)?.full_name
    });

    // For creating partnerships, call onPartnershipChange with the selected partner ID
    onPartnershipChange(officer, selectedPartner);
    setOpen(false);
    setSelectedPartner("");
  };
  
  const handleRemovePartnership = async () => {
    console.log("Removing partnership for officer:", {
      officerId: officer.officerId,
      officerName: officer.name,
      partnerOfficerId: officer.partnerData?.partnerOfficerId,
      partnerName: officer.partnerData?.partnerName,
      scheduleId: officer.scheduleId,
      type: officer.type
    });
    
    onPartnershipChange(officer, undefined);
    setOpen(false);
  };

  // Display only version for non-editable view
  if (!officer.isPartnership) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-7">
            <Users className="h-3 w-3 mr-1" />
            Add Partner
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Partnership with PPO</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <Select value={selectedPartner} onValueChange={setSelectedPartner}>
              <SelectTrigger>
                <SelectValue placeholder="Select PPO partner officer" />
              </SelectTrigger>
              <SelectContent>
                {isLoading ? (
                  <div className="p-2 text-sm text-muted-foreground">Loading PPO officers...</div>
                ) : availablePartners?.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    No available PPO officers on this shift
                  </div>
                ) : (
                  availablePartners?.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.full_name} 
                      {partner.badge_number && ` (${partner.badge_number})`}
                      {partner.rank && ` - ${partner.rank}`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button 
              onClick={handleCreatePartnership}
              disabled={!selectedPartner || isLoading}
              className="w-full"
            >
              Create Partnership with PPO
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100">
          <Users className="h-3 w-3 mr-1" />
          Manage Partner
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage PPO Partnership</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-3 border rounded-lg bg-blue-50">
            <p className="font-medium">Current PPO Partner:</p>
            <p>{officer.partnerData.partnerName} ({officer.partnerData.partnerBadge})</p>
            <p className="text-sm text-muted-foreground">{officer.partnerData.partnerRank}</p>
          </div>
          <Button 
            variant="destructive" 
            onClick={handleRemovePartnership}
            className="w-full"
          >
            Remove PPO Partnership
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
