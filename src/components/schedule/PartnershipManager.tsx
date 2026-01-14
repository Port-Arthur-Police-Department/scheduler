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

// Simple PPO check function with debugging
const isPPODebug = (officer: any): boolean => {
  const rank = officer.rank?.toLowerCase() || '';
  const isPPO = rank.includes('probationary') || rank.includes('ppo');
  
  console.log("PPO Check:", {
    name: officer.full_name || officer.name,
    rank: officer.rank,
    rankLower: rank,
    isPPO: isPPO,
    includesProbationary: rank.includes('probationary'),
    includesPPO: rank.includes('ppo')
  });
  
  return isPPO;
};

export const PartnershipManager = ({ officer, onPartnershipChange }: PartnershipManagerProps) => {
  const [open, setOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState("");

  const { data: availablePartners, isLoading } = useQuery({
    queryKey: ["available-partners", officer.shift.id, officer.date || format(new Date(), "yyyy-MM-dd")],
    queryFn: async () => {
      // Get all officers working on the same shift and day
      const dateToUse = officer.date || format(new Date(), "yyyy-MM-dd");
      const dayOfWeek = parseISO(dateToUse).getDay();

      console.log("🔍 Fetching partners for:", {
        officer: officer.name,
        officerId: officer.officerId,
        shiftId: officer.shift.id,
        date: dateToUse,
        dayOfWeek
      });

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

      console.log("📋 Recurring officers found:", recurringOfficers?.length);

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

      console.log("📋 Exception officers found:", exceptionOfficers?.length);

      // Combine and deduplicate officers
      const allOfficers = [
        ...(recurringOfficers || []).map((ro: any) => ro.profiles),
        ...(exceptionOfficers || []).map((eo: any) => eo.profiles)
      ];

      console.log("📊 All officers before filtering:", allOfficers.map(o => ({
        id: o?.id,
        name: o?.full_name,
        rank: o?.rank
      })));

      // Remove duplicates and filter out null profiles
      const uniqueOfficers = allOfficers
        .filter((profile, index, self) => {
          if (!profile) return false;
          const foundIndex = self.findIndex(p => p?.id === profile.id);
          const isUnique = foundIndex === index;
          if (!isUnique) {
            console.log("🔄 Duplicate removed:", profile.full_name);
          }
          return isUnique;
        })
        .filter(profile => {
          const isNotCurrent = profile.id !== officer.officerId;
          if (!isNotCurrent) {
            console.log("🔄 Excluding current officer:", profile.full_name);
          }
          return isNotCurrent;
        })
        // DEBUG: Log all officers before PPO filter
        .map(profile => {
          console.log("👮 Officer before PPO check:", {
            id: profile.id,
            name: profile.full_name,
            rank: profile.rank,
            rankLower: profile.rank?.toLowerCase()
          });
          return profile;
        })
        // ONLY SHOW PPO OFFICERS IN THE DROPDOWN
        .filter(profile => {
          const isPPO = isPPODebug(profile);
          if (!isPPO) {
            console.log("❌ Filtered out (not PPO):", profile.full_name, "Rank:", profile.rank);
          } else {
            console.log("✅ Kept (is PPO):", profile.full_name, "Rank:", profile.rank);
          }
          return isPPO;
        })
        .sort((a, b) => {
          const lastNameA = getLastName(a.full_name).toLowerCase();
          const lastNameB = getLastName(b.full_name).toLowerCase();
          return lastNameA.localeCompare(lastNameB);
        });

      console.log("🎯 Final available PPO partners:", uniqueOfficers.map(p => ({
        id: p.id,
        name: p.full_name,
        rank: p.rank
      })));

      return uniqueOfficers;
    },
    enabled: open,
  });

  const handleCreatePartnership = async () => {
    if (!selectedPartner) return;
    
    const partner = availablePartners?.find(p => p.id === selectedPartner);
    console.log("Creating partnership:", {
      officerId: officer.officerId,
      officerName: officer.name,
      officerRank: officer.rank,
      partnerOfficerId: selectedPartner,
      partnerName: partner?.full_name,
      partnerRank: partner?.rank
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
      partnerRank: officer.partnerData?.partnerRank,
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
            <DialogTitle>Create Partnership</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <Select value={selectedPartner} onValueChange={setSelectedPartner}>
              <SelectTrigger>
                <SelectValue placeholder="Select Probationary (PPO) partner" />
              </SelectTrigger>
              <SelectContent>
                {isLoading ? (
                  <div className="p-2 text-sm text-muted-foreground">Loading Probationary officers...</div>
                ) : availablePartners?.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    No available Probationary (PPO) officers on this shift
                    <div className="text-xs mt-1 text-amber-600">
                      (Check console for debugging info)
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground p-2 border-b">
                      Found {availablePartners.length} PPO officer(s)
                    </div>
                    {availablePartners?.map((partner) => (
                      <SelectItem key={partner.id} value={partner.id}>
                        {partner.full_name} 
                        {partner.badge_number && ` (${partner.badge_number})`}
                        {partner.rank && ` - ${partner.rank}`}
                      </SelectItem>
                    ))}
                  </>
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
          <DialogTitle>Manage Partnership</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-3 border rounded-lg bg-blue-50">
            <p className="font-medium">Current Partner:</p>
            <p>{officer.partnerData.partnerName} ({officer.partnerData.partnerBadge})</p>
            <p className="text-sm text-muted-foreground">{officer.partnerData.partnerRank}</p>
            {(officer.partnerData.partnerRank?.toLowerCase().includes('probationary') || 
              officer.partnerData.partnerRank?.toLowerCase().includes('ppo')) && (
              <Badge variant="outline" className="mt-1 bg-yellow-100 text-yellow-800 border-yellow-300">
                Probationary (PPO)
              </Badge>
            )}
          </div>
          <Button 
            variant="destructive" 
            onClick={handleRemovePartnership}
            className="w-full"
          >
            Remove Partnership
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
