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
      const dateToUse = officer.date || format(new Date(), "yyyy-MM-dd");
      const dayOfWeek = parseISO(dateToUse).getDay();

      console.log("=== START PARTNERSHIP QUERY ===");
      console.log("Officer requesting partner:", {
        id: officer.officerId,
        name: officer.name,
        rank: officer.rank,
        shift: officer.shift.name,
        date: dateToUse
      });

      // METHOD 1: Get ALL profiles and filter manually
      console.log("📥 Method 1: Getting all officer profiles...");
      const { data: allProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, badge_number, rank")
        .order("full_name");

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        throw profilesError;
      }

      console.log("📋 All profiles in system:", allProfiles?.length);
      
      // Find PPO profiles
      const ppoProfiles = allProfiles?.filter(profile => {
        const rank = profile.rank?.toLowerCase() || '';
        const isPPO = rank.includes('probationary') || rank.includes('ppo');
        return isPPO;
      }) || [];

      console.log("🎯 PPO profiles found:", ppoProfiles.map(p => ({
        id: p.id,
        name: p.full_name,
        rank: p.rank
      })));

      // METHOD 2: Check who's working today on this shift
      console.log("📥 Method 2: Checking who's scheduled for today...");
      
      // Get exceptions for today
      const { data: todayExceptions, error: todayError } = await supabase
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
        .eq("is_off", false);

      if (todayError) {
        console.error("Error fetching today exceptions:", todayError);
      }

      // Get recurring for today's day of week
      const { data: todayRecurring, error: recurringError } = await supabase
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
        .or(`end_date.is.null,end_date.gte.${dateToUse}`);

      if (recurringError) {
        console.error("Error fetching recurring schedules:", recurringError);
      }

      // Combine all officers working today
      const workingToday = [
        ...(todayExceptions || []).map((e: any) => ({
          ...e.profiles,
          scheduleId: e.id,
          isPartnership: e.is_partnership,
          partnerOfficerId: e.partner_officer_id,
          source: 'exception'
        })),
        ...(todayRecurring || []).map((r: any) => ({
          ...r.profiles,
          scheduleId: r.id,
          isPartnership: r.is_partnership,
          partnerOfficerId: r.partner_officer_id,
          source: 'recurring'
        }))
      ];

      // Remove duplicates
      const uniqueWorkingToday = workingToday.filter((o, index, self) =>
        o && o.id && index === self.findIndex(p => p?.id === o.id)
      );

      console.log("👮 Officers working today on this shift:", uniqueWorkingToday.map(o => ({
        id: o.id,
        name: o.full_name,
        rank: o.rank,
        isPartnership: o.isPartnership,
        partnerId: o.partnerOfficerId
      })));

      // Find PPO officers who are working today AND not already partnered
      const availablePPOs = ppoProfiles
        .filter(ppoProfile => {
          // Check if this PPO is working today
          const isWorkingToday = uniqueWorkingToday.some(o => o.id === ppoProfile.id);
          
          // Check if already in partnership
          const workingOfficer = uniqueWorkingToday.find(o => o.id === ppoProfile.id);
          const isAlreadyPartnered = workingOfficer?.isPartnership === true;
          
          // Exclude current officer
          const isCurrentOfficer = ppoProfile.id === officer.officerId;
          
          console.log(`🔍 PPO Check for ${ppoProfile.full_name}:`, {
            isWorkingToday,
            isAlreadyPartnered,
            isCurrentOfficer,
            passes: isWorkingToday && !isAlreadyPartnered && !isCurrentOfficer
          });
          
          return isWorkingToday && !isAlreadyPartnered && !isCurrentOfficer;
        })
        .sort((a, b) => {
          const lastNameA = getLastName(a.full_name).toLowerCase();
          const lastNameB = getLastName(b.full_name).toLowerCase();
          return lastNameA.localeCompare(lastNameB);
        });

      console.log("=== FINAL RESULTS ===");
      console.log("✅ Available PPO partners:", availablePPOs.map(p => ({
        id: p.id,
        name: p.full_name,
        rank: p.rank
      })));

      return availablePPOs;
    },
    enabled: open,
  });

  const handleCreatePartnership = async () => {
    if (!selectedPartner) return;
    
    const partner = availablePartners?.find(p => p.id === selectedPartner);
    console.log("🤝 Creating partnership:", {
      officer: officer.name,
      partner: partner?.full_name
    });

    onPartnershipChange(officer, selectedPartner);
    setOpen(false);
    setSelectedPartner("");
  };
  
  const handleRemovePartnership = async () => {
    console.log("🗑️ Removing partnership for:", officer.name);
    onPartnershipChange(officer, undefined);
    setOpen(false);
  };

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
                    Error: {error.message}
                  </div>
                ) : !availablePartners || availablePartners.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground space-y-2">
                    <div>No available Probationary (PPO) officers</div>
                    <div className="text-xs text-amber-600">
                      Check console for debugging information
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground p-2 border-b">
                      Available PPO Officers
                    </div>
                    {availablePartners.map((partner) => (
                      <SelectItem key={partner.id} value={partner.id}>
                        <div className="flex flex-col py-1">
                          <span className="font-medium">{partner.full_name}</span>
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
            
            <div className="text-xs text-muted-foreground p-2 bg-gray-50 rounded border">
              <div className="font-medium mb-1">Note:</div>
              <ul className="list-disc pl-4 space-y-1">
                <li>Only shows Probationary (PPO) officers</li>
                <li>Officers already in partnerships are excluded</li>
                <li>Open browser console (F12) for detailed logs</li>
              </ul>
            </div>
            
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
