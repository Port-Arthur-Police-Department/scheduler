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

export const PartnershipManager = ({ officer, onPartnershipChange }: PartnershipManagerProps) => {
  const [open, setOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState("");

  const { data: availablePartners, isLoading, error } = useQuery({
    queryKey: ["available-partners", officer.shift.id, officer.date || format(new Date(), "yyyy-MM-dd")],
    queryFn: async () => {
      // Get all officers working on the same shift and day
      const dateToUse = officer.date || format(new Date(), "yyyy-MM-dd");
      const dayOfWeek = parseISO(dateToUse).getDay();

      console.log("🔍 Fetching partners for officer:", {
        name: officer.name,
        id: officer.officerId,
        shift: officer.shift.name,
        date: dateToUse
      });

      // IMPORTANT: We need to check both recurring AND exceptions for ALL officers on shift
      // First, get ALL officers on this shift (not just available for partnership)
      const { data: allShiftOfficers, error: allError } = await supabase
        .from("schedule_exceptions")
        .select(`
          id,
          officer_id,
          partner_officer_id,
          is_partnership,
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

      if (allError) {
        console.error("Error fetching all shift officers:", allError);
        throw allError;
      }

      console.log("📋 All officers on shift (exceptions):", allShiftOfficers?.map(o => ({
        id: o.officer_id,
        name: o.profiles?.full_name,
        rank: o.profiles?.rank,
        isPartnership: o.is_partnership,
        partnerId: o.partner_officer_id
      })));

      // Also get recurring officers for this day
      const { data: recurringOfficers, error: recurringError } = await supabase
        .from("recurring_schedules")
        .select(`
          id,
          officer_id,
          partner_officer_id,
          is_partnership,
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

      console.log("📋 All officers on shift (recurring):", recurringOfficers?.map(o => ({
        id: o.officer_id,
        name: o.profiles?.full_name,
        rank: o.profiles?.rank,
        isPartnership: o.is_partnership,
        partnerId: o.partner_officer_id
      })));

      // Combine all officers from both sources
      const allOfficers = [
        ...(allShiftOfficers || []).map((o: any) => ({
          ...o.profiles,
          scheduleId: o.id,
          isPartnership: o.is_partnership,
          partnerOfficerId: o.partner_officer_id,
          source: 'exception'
        })),
        ...(recurringOfficers || []).map((o: any) => ({
          ...o.profiles,
          scheduleId: o.id,
          isPartnership: o.is_partnership,
          partnerOfficerId: o.partner_officer_id,
          source: 'recurring'
        }))
      ];

      console.log("📊 Combined officers:", allOfficers.map(o => ({
        id: o.id,
        name: o.full_name,
        rank: o.rank,
        isPartnership: o.isPartnership,
        partnerId: o.partnerOfficerId
      })));

      // Remove duplicates (same officer might be in both recurring and exceptions)
      const uniqueOfficers = allOfficers
        .filter((officer, index, self) => 
          officer && 
          officer.id && 
          index === self.findIndex(o => o?.id === officer.id)
        )
        .filter(officer => officer.id !== officer.officerId) // Double-check exclusion
        // Filter: Only show PPO officers who are NOT already in a partnership
        .filter(officer => {
          const rank = officer.rank?.toLowerCase() || '';
          const isPPO = rank.includes('probationary') || rank.includes('ppo');
          const isAlreadyInPartnership = officer.isPartnership === true;
          
          console.log("🔍 Officer filter check:", {
            name: officer.full_name,
            rank: officer.rank,
            isPPO,
            isAlreadyInPartnership,
            passes: isPPO && !isAlreadyInPartnership
          });
          
          return isPPO && !isAlreadyInPartnership;
        })
        .sort((a, b) => {
          const lastNameA = getLastName(a.full_name).toLowerCase();
          const lastNameB = getLastName(b.full_name).toLowerCase();
          return lastNameA.localeCompare(b.lastNameB);
        });

      console.log("🎯 Final available PPO partners:", uniqueOfficers.map(o => ({
        id: o.id,
        name: o.full_name,
        rank: o.rank,
        isPartnership: o.isPartnership
      })));

      return uniqueOfficers || [];
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
                ) : error ? (
                  <div className="p-2 text-sm text-red-600">
                    Error loading officers
                    <div className="text-xs mt-1">Check console for details</div>
                  </div>
                ) : !availablePartners || availablePartners.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    <div>No available Probationary (PPO) officers on this shift</div>
                    <div className="text-xs mt-1 text-amber-600">
                      PPO officers might already be in partnerships
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground p-2 border-b">
                      Select a PPO officer not already partnered
                    </div>
                    {availablePartners.map((partner) => (
                      <SelectItem key={partner.id} value={partner.id}>
                        <div className="flex flex-col">
                          <span>{partner.full_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {partner.badge_number && `Badge: ${partner.badge_number}`}
                            {partner.rank && ` • ${partner.rank}`}
                          </span>
                        </div>
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
