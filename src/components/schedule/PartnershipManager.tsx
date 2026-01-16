// src/components/schedule/PartnershipManager.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Users, AlertTriangle } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { isPPOByRank } from "@/utils/sortingUtils";

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

// Enhanced PPO check function with comprehensive matching
const isPPO = (officer: any): boolean => {
  if (!officer || !officer.rank) {
    console.log("❌ isPPO: No officer or rank", { 
      officer: officer?.full_name || officer?.name, 
      rank: officer?.rank 
    });
    return false;
  }
  
  const rank = officer.rank.toLowerCase().trim();
  
  // Comprehensive PPO matching
  const isProbationary = (
    rank === 'probationary' ||
    rank.includes('probationary') ||
    rank.includes('ppo') ||
    rank.includes('probation') ||
    rank === 'ppo' ||
    rank.includes('probationary officer') ||
    rank.includes('probationary peace officer')
  );
  
  return isProbationary;
};

export const PartnershipManager = ({ officer, onPartnershipChange }: PartnershipManagerProps) => {
  const [open, setOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState("");
  const [emergencyMode, setEmergencyMode] = useState(false);

  // Check if officer is on PTO or has suspended partnership
  if (officer.hasPTO && officer.ptoData?.isFullShift) {
    console.log("📋 Officer is on full day PTO, hiding partnership manager:", officer.name);
    return null;
  }

  // Check partnership status
  const hasActivePartnership = officer.isPartnership && !officer.partnershipSuspended;
  const hasSuspendedPartnership = officer.isPartnership && officer.partnershipSuspended;
  const isOfficerPPO = isPPOByRank(officer.rank);

  // Emergency partner query (regular officers, not PPOs)
  const { data: emergencyPartners, isLoading: emergencyLoading, error: emergencyError } = useQuery({
    queryKey: ["emergency-partners", officer.shift.id, officer.date || format(new Date(), "yyyy-MM-dd")],
    queryFn: async () => {
      const dateToUse = officer.date || format(new Date(), "yyyy-MM-dd");
      const dayOfWeek = parseISO(dateToUse).getDay();
      
      console.log("🚨 EMERGENCY PARTNER QUERY for PPO:", officer.name, {
        officerId: officer.officerId,
        isPPO: isOfficerPPO,
        hasSuspendedPartnership,
        shift: officer.shift.name,
        date: dateToUse,
        dayOfWeek: dayOfWeek
      });

      // Get ALL officers scheduled for this shift today
      const allOfficers = [];

      // 1. Get officers from exceptions for this date and shift
      const { data: exceptionsData, error: exceptionsError } = await supabase
        .from("schedule_exceptions")
        .select(`
          id,
          officer_id,
          is_off,
          is_partnership,
          partnership_suspended,
          profiles:officer_id (
            id,
            full_name,
            badge_number,
            rank
          )
        `)
        .eq("date", dateToUse)
        .eq("shift_type_id", officer.shift.id)
        .neq("officer_id", officer.officerId); // Exclude current officer

      if (exceptionsError) {
        console.error("Error fetching exceptions:", exceptionsError);
        throw exceptionsError;
      }

      // Process exceptions
      if (exceptionsData) {
        for (const record of exceptionsData) {
          if (!record.profiles) continue;
          
          // Skip if officer is on PTO
          if (record.is_off) continue;
          
          allOfficers.push({
            id: record.officer_id,
            name: record.profiles.full_name,
            badge: record.profiles.badge_number,
            rank: record.profiles.rank,
            isOff: record.is_off,
            isPartnership: record.is_partnership,
            partnershipSuspended: record.partnership_suspended,
            scheduleId: record.id,
            source: 'exception'
          });
        }
      }

      // 2. Get officers from recurring schedules for this day of week and shift
      const { data: recurringData, error: recurringError } = await supabase
        .from("recurring_schedules")
        .select(`
          id,
          officer_id,
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
        .neq("officer_id", officer.officerId)
        .lte("start_date", dateToUse)
        .or(`end_date.is.null,end_date.gte.${dateToUse}`);

      if (recurringError) {
        console.error("Error fetching recurring schedules:", recurringError);
        throw recurringError;
      }

      // Process recurring schedules
      if (recurringData) {
        const currentDate = parseISO(dateToUse);
        
        for (const record of recurringData) {
          if (!record.profiles) continue;
          
          // Check if officer already has an exception (exception overrides recurring)
          const existingException = allOfficers.find(o => o.id === record.officer_id);
          if (existingException) {
            console.log(`   ⏸️ Skipping recurring - has exception: ${record.profiles.full_name}`);
            continue;
          }
          
          allOfficers.push({
            id: record.officer_id,
            name: record.profiles.full_name,
            badge: record.profiles.badge_number,
            rank: record.profiles.rank,
            isOff: false, // Recurring schedules are assumed to be working
            isPartnership: record.is_partnership,
            partnershipSuspended: false, // Recurring schedules don't track this
            scheduleId: record.id,
            source: 'recurring'
          });
        }
      }

      console.log("🚨 All officers found for shift:", allOfficers.map(o => ({
        name: o.name,
        rank: o.rank,
        source: o.source,
        isOff: o.isOff,
        isPartnership: o.isPartnership
      })));

      // Filter for available emergency partners (REGULAR officers, not PPOs)
      const emergencyPartners = allOfficers.filter(officerRecord => {
        console.log(`\n--- Checking officer for emergency: ${officerRecord.name} ---`);
        
        // Skip if officer is on PTO
        if (officerRecord.isOff) {
          console.log(`❌ Skipping - on PTO: ${officerRecord.name}`);
          return false;
        }
        
        // Skip if officer is a PPO (PPOs can't partner with each other in emergencies)
        const isPartnerPPO = isPPOByRank(officerRecord.rank);
        if (isPartnerPPO) {
          console.log(`❌ Skipping PPO for emergency assignment: ${officerRecord.name}`);
          return false;
        }
        
        // Skip if already in an active partnership
        if (officerRecord.isPartnership) {
          console.log(`❌ Skipping - in active partnership: ${officerRecord.name}`);
          return false;
        }
        
        // Officer is available for emergency assignment
        console.log(`✅ Available for emergency assignment: ${officerRecord.name}`);
        return true;
      });

      console.log("🚨 Emergency partners found:", emergencyPartners.map(p => ({
        name: p.name,
        rank: p.rank,
        source: p.source
      })));

      return emergencyPartners.sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: open && emergencyMode && isOfficerPPO && hasSuspendedPartnership,
  });

  // Regular query for PPO partners (for "Add Partner" button)

const { data: availablePartners, isLoading, error } = useQuery({
  queryKey: ["available-partners", officer.shift.id, officer.date || format(new Date(), "yyyy-MM-dd")],
  queryFn: async () => {
    const dateToUse = officer.date || format(new Date(), "yyyy-MM-dd");
    const dayOfWeek = parseISO(dateToUse).getDay();

    console.log("🤝 === UPDATED PPO PARTNERSHIP QUERY ===");
    console.log("📋 Looking for PPO partners for:", officer.name);
    console.log("📅 Date:", dateToUse, "Day of week:", dayOfWeek);
    console.log("🌙 Shift:", officer.shift.name, "ID:", officer.shift.id);

    // FIRST: Get all PPO officers from profiles table
    const { data: allPPOs, error: ppoError } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        badge_number,
        rank
      `)
      .or(`rank.ilike.%probationary%,rank.ilike.%ppo%`)
      .order("full_name");

    if (ppoError) {
      console.error("❌ Error fetching PPO profiles:", ppoError);
    }

    console.log("👮 All PPO officers in system:", allPPOs?.map(p => ({
      name: p.full_name,
      rank: p.rank,
      id: p.id
    })));

    const availablePPOs = [];

    // SECOND: Check each PPO to see if they're scheduled for this shift today
    for (const ppo of allPPOs || []) {
      // Skip the officer requesting the partnership
      if (ppo.id === officer.officerId) {
        console.log(`   ⏸️ Skipping - same officer: ${ppo.full_name}`);
        continue;
      }

      // Check if PPO is scheduled for this shift today
      let isScheduledToday = false;
      let isOnPTO = false;
      let isAlreadyPartnered = false;

      // Check schedule exceptions first
      const { data: exception } = await supabase
        .from("schedule_exceptions")
        .select(`
          id,
          is_off,
          is_partnership,
          partner_officer_id,
          position_name
        `)
        .eq("officer_id", ppo.id)
        .eq("date", dateToUse)
        .eq("shift_type_id", officer.shift.id)
        .maybeSingle();

      if (exception) {
        if (exception.is_off) {
          console.log(`   ❌ PPO on PTO: ${ppo.full_name}`);
          isOnPTO = true;
        } else if (exception.is_partnership) {
          console.log(`   ❌ PPO already partnered: ${ppo.full_name} with ${exception.partner_officer_id}`);
          isAlreadyPartnered = true;
        } else {
          isScheduledToday = true;
          console.log(`   ✅ PPO has schedule exception: ${ppo.full_name}`);
        }
      }

      // If no exception found, check recurring schedules
      if (!exception && !isOnPTO && !isAlreadyPartnered) {
        const { data: recurring } = await supabase
          .from("recurring_schedules")
          .select(`
            id,
            is_partnership,
            partner_officer_id,
            start_date,
            end_date
          `)
          .eq("officer_id", ppo.id)
          .eq("shift_type_id", officer.shift.id)
          .eq("day_of_week", dayOfWeek)
          .lte("start_date", dateToUse)
          .or(`end_date.is.null,end_date.gte.${dateToUse}`)
          .maybeSingle();

        if (recurring) {
          // Validate date range
          const currentDate = parseISO(dateToUse);
          const startDate = parseISO(recurring.start_date);
          const endDate = recurring.end_date ? parseISO(recurring.end_date) : null;
          
          if (currentDate < startDate) {
            console.log(`   ❌ PPO schedule not started yet: ${ppo.full_name}`);
          } else if (endDate && currentDate > endDate) {
            console.log(`   ❌ PPO schedule ended: ${ppo.full_name}`);
          } else if (recurring.is_partnership) {
            console.log(`   ❌ PPO already in recurring partnership: ${ppo.full_name}`);
            isAlreadyPartnered = true;
          } else {
            isScheduledToday = true;
            console.log(`   ✅ PPO has recurring schedule: ${ppo.full_name}`);
          }
        } else {
          console.log(`   ❌ PPO not scheduled for this shift: ${ppo.full_name}`);
        }
      }

      // If PPO is scheduled today, not on PTO, and not already partnered, add to available list
      if (isScheduledToday && !isOnPTO && !isAlreadyPartnered) {
        availablePPOs.push({
          id: ppo.id,
          full_name: ppo.full_name,
          badge_number: ppo.badge_number,
          rank: ppo.rank,
          // Include additional info for debugging
          source: exception ? 'exception' : 'recurring',
          scheduleId: exception?.id || recurring?.id
        });
      }
    }

    console.log("✅ Available PPO partners:", availablePPOs.map(p => ({
      name: p.full_name,
      rank: p.rank,
      source: p.source
    })));

    if (availablePPOs.length === 0) {
      console.warn("⚠️ No PPO partners found. Possible issues:");
      console.warn("1. Check if PPOs have correct rank in profiles table");
      console.warn("2. Check if PPOs are scheduled for this shift/day");
      console.warn("3. Check if PPOs already have partnerships");
      console.warn("4. Check if PPOs are on PTO");
    }

    return availablePPOs;
  },
  enabled: open && !emergencyMode && !hasActivePartnership,
});

  const handleCreatePartnership = async () => {
    if (!selectedPartner) return;
    
    if (emergencyMode) {
      const partner = emergencyPartners?.find(p => p.id === selectedPartner);
      console.log("🚨 Creating EMERGENCY partnership:", {
        ppo: officer.name,
        ppoRank: officer.rank,
        partner: partner?.name,
        partnerRank: partner?.rank,
        partnerId: selectedPartner,
        shift: officer.shift.name,
        date: officer.date || format(new Date(), "yyyy-MM-dd")
      });

      onPartnershipChange(officer, selectedPartner);
    } else {
      const partner = availablePartners?.find(p => p.id === selectedPartner);
      console.log("🤝 Creating regular partnership:", {
        officer: officer.name,
        officerRank: officer.rank,
        partner: partner?.full_name,
        partnerRank: partner?.rank,
        partnerId: selectedPartner,
        shift: officer.shift.name,
        date: officer.date || format(new Date(), "yyyy-MM-dd")
      });

      onPartnershipChange(officer, selectedPartner);
    }
    
    setOpen(false);
    setSelectedPartner("");
    setEmergencyMode(false);
  };
  
  const handleRemovePartnership = async () => {
    console.log("🗑️ Removing partnership for:", {
      officer: officer.name,
      officerId: officer.officerId,
      partnerData: officer.partnerData,
      partnerOfficerId: officer.partnerOfficerId
    });
    onPartnershipChange(officer, undefined);
    setOpen(false);
  };

  if (hasActivePartnership) {
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
              <p>{officer.partnerData?.partnerName || 'Unknown Partner'} ({officer.partnerData?.partnerBadge || 'N/A'})</p>
              <p className="text-sm text-muted-foreground">{officer.partnerData?.partnerRank || 'Unknown Rank'}</p>
              {officer.partnerData?.partnerRank?.toLowerCase().includes('probationary') && (
                <Badge variant="outline" className="mt-1 bg-yellow-100 text-yellow-800 border-yellow-300">
                  Probationary Officer
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
  }

  if (hasSuspendedPartnership) {
    if (isOfficerPPO) {
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
              onClick={() => {
                setEmergencyMode(true);
                setOpen(true);
              }}
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              Emergency Partner
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Emergency Partner Assignment
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                <p className="font-medium text-amber-800">PPO Officer:</p>
                <p className="font-semibold">{officer.name}</p>
                <p className="text-sm text-amber-700">
                  Partnership suspended: {officer.partnershipSuspensionReason || 'Partner on PTO'}
                </p>
                {officer.partnerData?.partnerName && (
                  <p className="text-sm text-amber-700 mt-1">
                    Original partner: {officer.partnerData.partnerName}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="emergency-partner">Select Emergency Partner</Label>
                <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select available officer" />
                  </SelectTrigger>
                  <SelectContent>
                    {emergencyLoading ? (
                      <div className="p-2 text-sm text-muted-foreground">Loading available officers...</div>
                    ) : emergencyError ? (
                      <div className="p-2 text-sm text-red-600">
                        Error loading officers: {emergencyError.message}
                      </div>
                    ) : !emergencyPartners || emergencyPartners.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground space-y-1">
                        <p>No available officers found for emergency assignment.</p>
                        <p className="text-xs">All regular officers are either:</p>
                        <ul className="text-xs list-disc pl-4 mt-1">
                          <li>Already partnered</li>
                          <li>On PTO</li>
                          <li>Assigned to special duty</li>
                        </ul>
                      </div>
                    ) : (
                      <>
                        <div className="text-xs text-muted-foreground p-2 border-b">
                          Select a regular officer (non-PPO) for temporary assignment
                        </div>
                        {emergencyPartners.map((partner) => (
                          <SelectItem key={partner.id} value={partner.id}>
                            <div className="flex flex-col py-1">
                              <span className="font-medium">{partner.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {partner.badge && `Badge: ${partner.badge}`}
                                {partner.rank && ` • ${partner.rank}`}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                onClick={handleCreatePartnership}
                disabled={!selectedPartner || emergencyLoading}
                className="w-full bg-amber-600 hover:bg-amber-700"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Assign Emergency Partner
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      );
    } else {
      return (
        <div className="text-sm text-amber-600">
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Partnership Suspended
          </Badge>
          <p className="text-xs mt-1">{officer.partnershipSuspensionReason || 'Partner unavailable'}</p>
        </div>
      );
    }
  }

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
              <SelectValue placeholder="Select Probationary partner" />
            </SelectTrigger>
            <SelectContent>
              {isLoading ? (
                <div className="p-2 text-sm text-muted-foreground">Loading Probationary officers...</div>
              ) : error ? (
                <div className="p-2 text-sm text-red-600">
                  Error loading officers: {error.message}
                </div>
              ) : !availablePartners || availablePartners.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground space-y-2">
                  <div>No available Probationary officers on this shift</div>
                  <div className="text-xs text-amber-600">
                    Check browser console (F12) for debugging details
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Shift: {officer.shift.name} ({officer.shift.start_time} - {officer.shift.end_time})
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground p-2 border-b">
                    Select a Probationary officer to partner with
                  </div>
                  {availablePartners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      <div className="flex flex-col py-1">
                        <span className="font-medium">{partner.full_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {partner.badge_number && `Badge: ${partner.badge_number}`}
                          {partner.rank && ` • ${partner.rank}`}
                          {partner.source && ` • ${partner.source}`}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
          
          <div className="text-xs text-muted-foreground p-2 bg-gray-50 rounded border">
            <div className="font-medium mb-1">Requirements:</div>
            <ul className="list-disc pl-4 space-y-1">
              <li>Officer must be marked as "Probationary"</li>
              <li>Officer must be scheduled for this shift</li>
              <li>Officer must not already be in a partnership</li>
              <li>Officer must not be on PTO/off duty</li>
            </ul>
          </div>
          
          <Button 
            onClick={handleCreatePartnership}
            disabled={!selectedPartner || isLoading}
            className="w-full"
          >
            Create Partnership
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
