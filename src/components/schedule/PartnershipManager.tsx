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
import { isPPOByRank } from "@/utils/ppoUtils";

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
  const isOfficerPPO = isPPOByRank(officer.rank?.toString() || '');

// Emergency partners query - finds regular officers (non-PPOs) for emergency pairing
const { data: emergencyPartners, isLoading: emergencyLoading, error: emergencyError } = useQuery({
  queryKey: ["emergency-partners", officer.shift.id, officer.date || format(new Date(), "yyyy-MM-dd")],
  queryFn: async () => {
    const dateToUse = officer.date || format(new Date(), "yyyy-MM-dd");
    const dayOfWeek = parseISO(dateToUse).getDay();
    
    console.log("🚨 === EMERGENCY PARTNERS QUERY ===");
    console.log("Looking for regular officers (non-PPOs) for emergency pairing");
    
    // Get exceptions data
    const { data: exceptionsData, error: exceptionsError } = await supabase
      .from("schedule_exceptions")
      .select(`
        id,
        officer_id,
        is_off,
        is_partnership,
        partnership_suspended,
        profiles!schedule_exceptions_officer_id_fkey (
          id,
          full_name,
          badge_number,
          rank
        )
      `)
      .eq("date", dateToUse)
      .eq("shift_type_id", officer.shift.id)
      .neq("officer_id", officer.officerId);

    if (exceptionsError) {
      console.error("Error fetching exceptions:", exceptionsError);
      throw exceptionsError;
    }

    // Get recurring schedules
    const { data: recurringData, error: recurringError } = await supabase
      .from("recurring_schedules")
      .select(`
        id,
        officer_id,
        is_partnership,
        partner_officer_id,
        profiles!recurring_schedules_officer_id_fkey (
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

    // Combine all officers
    const allOfficers = [];
    const processedOfficerIds = new Set();
    
    // Process exceptions first
    if (exceptionsData) {
      for (const record of exceptionsData) {
        if (!record.profiles) continue;
        
        // Skip if officer is on PTO
        if (record.is_off) {
          console.log(`   ⏸️ Skipping - on PTO: ${record.profiles.full_name}`);
          continue;
        }
        
        const officerData = {
          id: record.officer_id,
          name: record.profiles.full_name,
          badge: record.profiles.badge_number,
          rank: record.profiles.rank?.toString() || '', // Convert enum to string
          isOff: record.is_off,
          isPartnership: record.is_partnership,
          partnershipSuspended: record.partnership_suspended,
          scheduleId: record.id,
          source: 'exception'
        };
        
        allOfficers.push(officerData);
        processedOfficerIds.add(record.officer_id);
        
        console.log(`   📋 Added from exception: ${record.profiles.full_name} (${officerData.rank})`);
      }
    }

    // Process recurring schedules (exceptions override recurring)
    if (recurringData) {
      for (const record of recurringData) {
        if (!record.profiles) continue;
        
        // Skip if already processed from exceptions
        if (processedOfficerIds.has(record.officer_id)) {
          console.log(`   ⏸️ Skipping - has exception: ${record.profiles.full_name}`);
          continue;
        }
        
        const officerData = {
          id: record.officer_id,
          name: record.profiles.full_name,
          badge: record.profiles.badge_number,
          rank: record.profiles.rank?.toString() || '', // Convert enum to string
          isOff: false,
          isPartnership: record.is_partnership,
          partnershipSuspended: false,
          scheduleId: record.id,
          source: 'recurring'
        };
        
        allOfficers.push(officerData);
        processedOfficerIds.add(record.officer_id);
        
        console.log(`   📋 Added from recurring: ${record.profiles.full_name} (${officerData.rank})`);
      }
    }

    console.log("👥 All officers found:", allOfficers.map(o => ({
      name: o.name,
      rank: o.rank,
      source: o.source,
      isPartnership: o.isPartnership
    })));

    // Filter for available emergency partners (REGULAR officers only, no PPOs)
    const emergencyPartners = allOfficers.filter(officerRecord => {
      console.log(`\n--- Checking ${officerRecord.name} for emergency assignment ---`);
      
      // Skip if already in an active partnership
      if (officerRecord.isPartnership) {
        console.log(`❌ Skipping - already in partnership: ${officerRecord.name}`);
        return false;
      }
      
      // CRITICAL: Skip if officer is a PPO
      // Since rank is an enum converted to string, check exact value
      const isPPO = officerRecord.rank === 'Probationary';
      if (isPPO) {
        console.log(`❌ Skipping PPO for emergency assignment: ${officerRecord.name}`);
        return false;
      }
      
      // Officer is available for emergency assignment
      console.log(`✅ Available for emergency assignment: ${officerRecord.name} (${officerRecord.rank})`);
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

// For the regular query:
const { data: availablePartners, isLoading, error } = useQuery({
  queryKey: ["available-ppo-partners", officer.shift.id, officer.date || format(new Date(), "yyyy-MM-dd")],
  queryFn: async () => {
    const dateToUse = officer.date || format(new Date(), "yyyy-MM-dd");
    const dayOfWeek = parseISO(dateToUse).getDay();
    const currentDate = parseISO(dateToUse);

    console.log("🤝 === DATE-SPECIFIC PPO AVAILABILITY QUERY ===");
    console.log("Date:", dateToUse, "Day of week:", dayOfWeek, "Shift ID:", officer.shift.id);

    // First, get all PPO profiles
    const { data: allPPOs, error: pposError } = await supabase
      .from("profiles")
      .select("id, full_name, badge_number, rank")
      .eq("rank", "Probationary")
      .eq("active", true);

    if (pposError) {
      console.error("❌ Error fetching PPO profiles:", pposError);
      throw pposError;
    }

    console.log("👮 All active PPOs in system:", allPPOs);

    const availablePPOs = [];

    // Check each PPO individually
    for (const ppo of allPPOs || []) {
      if (ppo.id === officer.officerId) {
        console.log(`⏸️ Skipping self: ${ppo.full_name}`);
        continue;
      }

      console.log(`\n--- Checking ${ppo.full_name} for availability ---`);

      // 1. Check if PPO has a schedule exception for this date/shift
      const { data: exception, error: exceptionError } = await supabase
        .from("schedule_exceptions")
        .select("id, is_partnership, partner_officer_id, is_off")
        .eq("officer_id", ppo.id)
        .eq("date", dateToUse)
        .eq("shift_type_id", officer.shift.id)
        .maybeSingle();

      if (exceptionError) {
        console.error(`Error checking exceptions for ${ppo.full_name}:`, exceptionError);
        continue;
      }

      if (exception) {
        console.log(`   Found schedule exception:`, {
          isPartnership: exception.is_partnership,
          partnerOfficerId: exception.partner_officer_id,
          isOff: exception.is_off
        });

        // Skip if on PTO
        if (exception.is_off) {
          console.log(`   ❌ Skipping - on PTO`);
          continue;
        }

        // Skip if already partnered in exception
        if (exception.is_partnership || exception.partner_officer_id) {
          console.log(`   ❌ Skipping - already partnered via exception`);
          continue;
        }

        // PPO is available via exception (not partnered, not on PTO)
        availablePPOs.push({
          id: ppo.id,
          full_name: ppo.full_name,
          badge_number: ppo.badge_number,
          rank: ppo.rank,
          scheduleId: exception.id,
          source: 'exception',
          type: 'exception'
        });
        console.log(`   ✅ Available via exception`);
        continue;
      }

      // 2. Check if PPO has a recurring schedule for this day/shift
      const { data: recurring, error: recurringError } = await supabase
        .from("recurring_schedules")
        .select("id, is_partnership, partner_officer_id, start_date, end_date")
        .eq("officer_id", ppo.id)
        .eq("shift_type_id", officer.shift.id)
        .eq("day_of_week", dayOfWeek)
        .maybeSingle();

      if (recurringError) {
        console.error(`Error checking recurring for ${ppo.full_name}:`, recurringError);
        continue;
      }

      if (recurring) {
        console.log(`   Found recurring schedule:`, {
          isPartnership: recurring.is_partnership,
          partnerOfficerId: recurring.partner_officer_id,
          startDate: recurring.start_date,
          endDate: recurring.end_date
        });

        // Check date range
        const startDate = parseISO(recurring.start_date);
        const endDate = recurring.end_date ? parseISO(recurring.end_date) : null;
        
        if (currentDate < startDate) {
          console.log(`   ❌ Skipping - date ${dateToUse} is before schedule start ${recurring.start_date}`);
          continue;
        }
        
        if (endDate && currentDate > endDate) {
          console.log(`   ❌ Skipping - date ${dateToUse} is after schedule end ${recurring.end_date}`);
          continue;
        }

        // Skip if already partnered in recurring
        if (recurring.is_partnership || recurring.partner_officer_id) {
          console.log(`   ❌ Skipping - already partnered in recurring schedule`);
          continue;
        }

        // PPO is available via recurring schedule
        availablePPOs.push({
          id: ppo.id,
          full_name: ppo.full_name,
          badge_number: ppo.badge_number,
          rank: ppo.rank,
          scheduleId: recurring.id,
          source: 'recurring',
          type: 'recurring',
          start_date: recurring.start_date,
          end_date: recurring.end_date
        });
        console.log(`   ✅ Available via recurring schedule`);
        continue;
      }

      // 3. PPO is not scheduled at all for this shift
      console.log(`   ⚠️ Not scheduled for this shift/day`);
    }

    console.log("\n✅ FINAL available PPO partners:", availablePPOs.map(p => ({
      name: p.full_name,
      badge: p.badge_number,
      source: p.source
    })));

    // Sort by last name
    return availablePPOs.sort((a, b) => {
      const getLastName = (fullName: string) => {
        const parts = fullName.trim().split(' ');
        return parts[parts.length - 1] || '';
      };
      return getLastName(a.full_name).localeCompare(getLastName(b.full_name));
    });
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
