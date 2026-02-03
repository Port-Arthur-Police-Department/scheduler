// src/components/schedule/PartnershipManager.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Users, AlertTriangle, Shield, Clock } from "lucide-react";
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

// Helper function to check if officer is a PPO
const isPPO = (officer: any): boolean => {
  if (!officer || !officer.rank) {
    console.log("❌ isPPO: No officer or rank", { 
      officer: officer?.full_name || officer?.name, 
      rank: officer?.rank 
    });
    return false;
  }
  
  // Use the same logic as isPPOByRank
  return isPPOByRank(officer.rank);
};

export const PartnershipManager = ({ officer, onPartnershipChange }: PartnershipManagerProps) => {
  const [open, setOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState("");
  const [emergencyMode, setEmergencyMode] = useState(false);

  // Check if officer is on full-day PTO or has suspended partnership
  if (officer.hasPTO && officer.ptoData?.isFullShift) {
    console.log("📋 Officer is on full day PTO, hiding partnership manager:", officer.name);
    return null;
  }

  // Check partnership status
  const hasActivePartnership = officer.isPartnership && !officer.partnershipSuspended;
  const hasSuspendedPartnership = officer.isPartnership && officer.partnershipSuspended;
  const isOfficerPPO = isPPOByRank(officer.rank?.toString() || '');

  console.log("🔍 PartnershipManager Debug:", {
    officerName: officer.name,
    officerRank: officer.rank,
    isOfficerPPO,
    hasActivePartnership,
    hasSuspendedPartnership,
    partnershipSuspended: officer.partnershipSuspended,
    partnerData: officer.partnerData
  });

// Emergency partners query - finds regular officers (non-PPOs) for emergency pairing
const { data: emergencyPartners, isLoading: emergencyLoading, error: emergencyError } = useQuery({
  queryKey: ["emergency-partners", officer.shift.id, officer.date || format(new Date(), "yyyy-MM-dd"), officer.officerId],
  queryFn: async () => {
    // Only run for PPO officers with suspended partnerships
    if (!isOfficerPPO || !hasSuspendedPartnership) {
      console.log("🚫 Emergency partners query skipped - not a PPO with suspended partnership");
      return [];
    }

    const dateToUse = officer.date || format(new Date(), "yyyy-MM-dd");
    
    // Validate date
    let parsedDate;
    try {
      parsedDate = parseISO(dateToUse);
      if (!isValid(parsedDate)) {
        throw new Error("Invalid date format");
      }
    } catch (error) {
      console.error("Invalid date format:", dateToUse);
      return [];
    }

    const dayOfWeek = parsedDate.getDay();
    const currentDate = parsedDate;
    
    console.log("🚨 === ENHANCED EMERGENCY PARTNERS QUERY ===");
    console.log("Looking for regular officers (non-PPOs) for PPO emergency pairing");
    console.log("Date:", dateToUse, "Day:", dayOfWeek, "Shift:", officer.shift.id);
    console.log("PPO Officer:", officer.name, "Rank:", officer.rank);

    // Step 1: Get all officers scheduled for this date/shift
    const { data: allScheduledOfficers, error: scheduleError } = await supabase
      .from("recurring_schedules")
      .select(`
        id,
        officer_id,
        is_partnership,
        partner_officer_id,
        start_date,
        end_date,
        profiles:profiles!recurring_schedules_officer_id_fkey (
          id,
          full_name,
          badge_number,
          rank
        )
      `)
      .eq("shift_type_id", officer.shift.id)
      .eq("day_of_week", dayOfWeek)
      .neq("officer_id", officer.officerId) // Exclude the PPO
      .lte("start_date", dateToUse)
      .or(`end_date.is.null,end_date.gte.${dateToUse}`);

    if (scheduleError) {
      console.error("Error fetching scheduled officers:", scheduleError);
      throw scheduleError;
    }

    console.log("📅 All scheduled officers for emergency check:", allScheduledOfficers?.map(o => ({
      name: o.profiles?.full_name,
      rank: o.profiles?.rank,
      isPartnership: o.is_partnership,
      partnerOfficerId: o.partner_officer_id
    })));

    // Step 2: Get schedule exceptions for this date/shift
    const { data: exceptions, error: exceptionsError } = await supabase
      .from("schedule_exceptions")
      .select(`
        id,
        officer_id,
        is_partnership,
        partner_officer_id,
        is_off,
        schedule_type,
        profiles:officer_id (
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

    console.log("📅 All exceptions for emergency check:", exceptions?.map(e => ({
      name: e.profiles?.full_name,
      rank: e.profiles?.rank,
      isPartnership: e.is_partnership,
      scheduleType: e.schedule_type,
      isOff: e.is_off
    })));

    // Process all officers and check availability
    const availableOfficers = [];
    const processedOfficerIds = new Set();

    // First process exceptions (they override recurring schedules)
    if (exceptions) {
      for (const exception of exceptions) {
        if (!exception.profiles) continue;
        
        const officerId = exception.officer_id;
        
        // Skip if already processed
        if (processedOfficerIds.has(officerId)) {
          continue;
        }
        
        processedOfficerIds.add(officerId);

        // Skip if officer is on PTO
        if (exception.is_off) {
          console.log(`   ⏸️ Skipping - on PTO via exception: ${exception.profiles.full_name}`);
          continue;
        }

        // Skip if already in an emergency partnership (check schedule_type)
        if (exception.schedule_type === "emergency_partnership") {
          console.log(`   ❌ Skipping - already in emergency partnership: ${exception.profiles.full_name}`);
          continue;
        }

        // Check if officer is a PPO
        const isPPO = isPPOByRank(exception.profiles.rank);
        if (isPPO) {
          console.log(`   ❌ Skipping PPO for emergency assignment: ${exception.profiles.full_name}`);
          continue;
        }

        // Skip if already in an active partnership (unless suspended)
        if (exception.is_partnership && !exception.partner_officer_id) {
          console.log(`   ❌ Skipping - already partnered via exception: ${exception.profiles.full_name}`);
          continue;
        }

        // Officer is available for emergency assignment
        console.log(`   ✅ Available via exception: ${exception.profiles.full_name}`);
        availableOfficers.push({
          id: officerId,
          name: exception.profiles.full_name,
          badge: exception.profiles.badge_number,
          rank: exception.profiles.rank,
          isPPO: isPPO,
          isPartnership: exception.is_partnership,
          scheduleType: exception.schedule_type,
          partnershipSuspended: false,
          scheduleId: exception.id,
          source: 'exception'
        });
      }
    }

    // Then process recurring schedules (only those not overridden by exceptions)
    if (allScheduledOfficers) {
      for (const schedule of allScheduledOfficers) {
        if (!schedule.profiles) continue;
        
        const officerId = schedule.officer_id;
        
        // Skip if already processed via exception
        if (processedOfficerIds.has(officerId)) {
          console.log(`   ⏸️ Skipping - has exception override: ${schedule.profiles.full_name}`);
          continue;
        }

        // Check date range
        const startDate = parseISO(schedule.start_date);
        const endDate = schedule.end_date ? parseISO(schedule.end_date) : null;
        
        if (!isValid(startDate)) {
          console.log(`   ❌ Invalid start date: ${schedule.start_date}`);
          continue;
        }
        
        if (currentDate < startDate) {
          console.log(`   ❌ Skipping - date before start: ${schedule.profiles.full_name}`);
          continue;
        }
        
        if (endDate && !isValid(endDate)) {
          console.log(`   ❌ Invalid end date: ${schedule.end_date}`);
          continue;
        }
        
        if (endDate && currentDate > endDate) {
          console.log(`   ❌ Skipping - date after end: ${schedule.profiles.full_name}`);
          continue;
        }

        // Check if officer is a PPO
        const isPPO = isPPOByRank(schedule.profiles.rank);
        if (isPPO) {
          console.log(`   ❌ Skipping PPO for emergency assignment: ${schedule.profiles.full_name}`);
          continue;
        }

        // Skip if already in an active partnership
        const isPartnered = schedule.is_partnership || schedule.partner_officer_id;
        if (isPartnered) {
          console.log(`   ❌ Skipping - already partnered in recurring: ${schedule.profiles.full_name}`);
          continue;
        }

        // Officer is available for emergency assignment
        console.log(`   ✅ Available via recurring: ${schedule.profiles.full_name}`);
        availableOfficers.push({
          id: officerId,
          name: schedule.profiles.full_name,
          badge: schedule.profiles.badge_number,
          rank: schedule.profiles.rank,
          isPPO: isPPO,
          isPartnership: schedule.is_partnership,
          scheduleType: null,
          partnershipSuspended: false,
          scheduleId: schedule.id,
          source: 'recurring'
        });
      }
    }

    console.log("🚨 Emergency partners found:", availableOfficers.map(p => ({
      name: p.name,
      rank: p.rank,
      isPPO: p.isPPO,
      source: p.source,
      isPartnered: p.isPartnership,
      scheduleType: p.scheduleType
    })));

    // Sort alphabetically by last name
    return availableOfficers.sort((a, b) => {
      const lastNameA = getLastName(a.name).toLowerCase();
      const lastNameB = getLastName(b.name).toLowerCase();
      return lastNameA.localeCompare(lastNameB);
    });
  },
  enabled: open && emergencyMode && isOfficerPPO && hasSuspendedPartnership,
  staleTime: 0, // Always fresh data
});

  // Regular PPO partners query - for creating NEW partnerships
  const { data: availablePartners, isLoading, error } = useQuery({
    queryKey: ["available-ppo-partners", officer.shift.id, officer.date || format(new Date(), "yyyy-MM-dd"), officer.officerId],
    queryFn: async () => {
      // Only run for creating new partnerships, not for PPOs (PPOs can't create new partnerships)
      if (isOfficerPPO) {
        console.log("🚫 PPOs cannot create new partnerships - only emergency assignments");
        return [];
      }

      const dateToUse = officer.date || format(new Date(), "yyyy-MM-dd");
      
      // Validate date
      let parsedDate;
      try {
        parsedDate = parseISO(dateToUse);
        if (!isValid(parsedDate)) {
          throw new Error("Invalid date format");
        }
      } catch (error) {
        console.error("Invalid date format:", dateToUse);
        return [];
      }

      const dayOfWeek = parsedDate.getDay();
      const currentDate = parsedDate;

      console.log("🔍 REGULAR PARTNERSHIP CREATION QUERY");
      console.log("Looking for available PPOs to partner with:", officer.name);
      console.log("Date:", dateToUse, "Day:", dayOfWeek, "Shift:", officer.shift.id);

      // Get all active PPOs
      const { data: allPPOs, error: pposError } = await supabase
        .from("profiles")
        .select("id, full_name, badge_number, rank")
        .eq("active", true)
        .neq("id", officer.officerId) // Don't include self
        .order("full_name");

      if (pposError) {
        console.error("Error fetching PPOs:", pposError);
        throw pposError;
      }

      console.log("Found potential PPOs:", allPPOs?.map(p => ({
        name: p.full_name,
        rank: p.rank,
        isPPO: isPPOByRank(p.rank)
      })));

      if (!allPPOs || allPPOs.length === 0) {
        console.log("No PPOs found in profiles");
        return [];
      }

      // Filter to only actual PPOs
      const filteredPPOs = allPPOs.filter(ppo => isPPOByRank(ppo.rank));
      
      console.log("Filtered to actual PPOs:", filteredPPOs.length);

      if (filteredPPOs.length === 0) {
        return [];
      }

      // Now check each PPO's schedule status for today
      const availablePPOs = [];

      for (const ppo of filteredPPOs) {
        console.log(`\n--- Checking PPO ${ppo.full_name} ---`);
        
        try {
          // Check if PPO has any existing partnership for today (exception)
          const { data: existingPartnership } = await supabase
            .from("schedule_exceptions")
            .select("id, partner_officer_id, is_partnership, is_emergency_partnership")
            .eq("officer_id", ppo.id)
            .eq("date", dateToUse)
            .eq("shift_type_id", officer.shift.id)
            .maybeSingle();

          if (existingPartnership) {
            // Skip if already in any partnership (regular or emergency)
            if (existingPartnership.is_partnership || existingPartnership.is_emergency_partnership) {
              console.log(`❌ Already partnered via exception`);
              continue;
            }
          }

          // Check recurring partnership
          const { data: recurringSchedule } = await supabase
            .from("recurring_schedules")
            .select("id, partner_officer_id, is_partnership, start_date, end_date")
            .eq("officer_id", ppo.id)
            .eq("shift_type_id", officer.shift.id)
            .eq("day_of_week", dayOfWeek)
            .maybeSingle();

          if (recurringSchedule) {
            // Check date range
            const startDate = parseISO(recurringSchedule.start_date);
            const endDate = recurringSchedule.end_date ? parseISO(recurringSchedule.end_date) : null;
            
            if (currentDate < startDate) {
              console.log(`❌ Date ${dateToUse} is before schedule start ${recurringSchedule.start_date}`);
              continue;
            }
            
            if (endDate && currentDate > endDate) {
              console.log(`❌ Date ${dateToUse} is after schedule end ${recurringSchedule.end_date}`);
              continue;
            }

            // Skip if already partnered in recurring
            if (recurringSchedule.is_partnership || recurringSchedule.partner_officer_id) {
              console.log(`❌ Already partnered in recurring schedule`);
              continue;
            }
          }

          // Check if PPO is on PTO today
          const { data: ptoCheck } = await supabase
            .from("schedule_exceptions")
            .select("id")
            .eq("officer_id", ppo.id)
            .eq("date", dateToUse)
            .eq("shift_type_id", officer.shift.id)
            .eq("is_off", true)
            .maybeSingle();

          if (ptoCheck) {
            console.log(`❌ On PTO today`);
            continue;
          }

          // PPO is available for regular partnership!
          console.log(`✅ ${ppo.full_name} is available for regular partnership!`);
          availablePPOs.push({
            id: ppo.id,
            full_name: ppo.full_name,
            badge_number: ppo.badge_number,
            rank: ppo.rank,
            source: 'available'
          });

        } catch (error) {
          console.error(`Error checking ${ppo.full_name}:`, error);
        }
      }

      console.log("\n✅ Available PPOs for regular partnership:", availablePPOs.map(p => p.full_name));
      return availablePPOs;

    },
    enabled: open && !emergencyMode && !hasActivePartnership && !isOfficerPPO, // Regular officers can create partnerships with PPOs
    staleTime: 0,
  });
  
  const handleCreatePartnership = async () => {
    if (!selectedPartner) {
      console.error("No partner selected");
      return;
    }
    
    if (emergencyMode) {
      // Emergency partnership for PPO
      const partner = emergencyPartners?.find(p => p.id === selectedPartner);
      console.log("🚨 Creating EMERGENCY partnership for PPO:", {
        ppo: officer.name,
        ppoRank: officer.rank,
        partner: partner?.name,
        partnerRank: partner?.rank,
        partnerId: selectedPartner,
        shift: officer.shift.name,
        date: officer.date || format(new Date(), "yyyy-MM-dd")
      });

      // Double-check this is a PPO
      if (!isOfficerPPO) {
        console.error("❌ Emergency partnerships only for PPOs!");
        return;
      }

      // For emergency partnerships
      onPartnershipChange(officer, selectedPartner);
    } else {
      // Regular partnership (regular officer with PPO)
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

      // Double-check this is NOT a PPO
      if (isOfficerPPO) {
        console.error("❌ Regular partnerships cannot be created by PPOs!");
        return;
      }

      // For regular partnerships
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
      isPPO: isOfficerPPO,
      partnerData: officer.partnerData,
      partnerOfficerId: officer.partnerOfficerId
    });
    onPartnershipChange(officer, undefined);
    setOpen(false);
  };

  // 1. Active Partnership - Show management options
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
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Manage Partnership
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-3 border rounded-lg bg-blue-50">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">Current Partner:</p>
                {officer.partnerData?.partnerIsPPO && (
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                    <Shield className="h-3 w-3 mr-1" />
                    PPO
                  </Badge>
                )}
              </div>
              <p className="font-semibold">{officer.partnerData?.partnerName || 'Unknown Partner'}</p>
              <div className="text-sm text-muted-foreground space-y-1 mt-1">
                <div className="flex items-center gap-2">
                  <span>Badge: {officer.partnerData?.partnerBadge || 'N/A'}</span>
                  <span>•</span>
                  <span>{officer.partnerData?.partnerRank || 'Unknown Rank'}</span>
                </div>
                {officer.partnerData?.partnerPosition && (
                  <div>Position: {officer.partnerData.partnerPosition}</div>
                )}
              </div>
            </div>
            
            <div className="p-2 bg-gray-50 rounded border">
              <div className="text-xs text-gray-600 space-y-1">
                <div className="flex items-center gap-2">
                  {isOfficerPPO ? (
                    <>
                      <Shield className="h-3 w-3 text-yellow-600" />
                      <span className="font-medium">You are a PPO</span>
                    </>
                  ) : officer.partnerData?.partnerIsPPO ? (
                    <>
                      <Shield className="h-3 w-3 text-yellow-600" />
                      <span className="font-medium">Your partner is a PPO</span>
                    </>
                  ) : (
                    <>
                      <Users className="h-3 w-3 text-blue-600" />
                      <span className="font-medium">Regular Partnership</span>
                    </>
                  )}
                </div>
                <p>Partnership active for {officer.shift.name} shift</p>
              </div>
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

  // 2. Suspended Partnership - Show different options for PPOs vs Regular Officers
  if (hasSuspendedPartnership) {
    if (isOfficerPPO) {
      // PPO with suspended partnership - show emergency partner option
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
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-amber-800">PPO Officer:</p>
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                    <Shield className="h-3 w-3 mr-1" />
                    PPO
                  </Badge>
                </div>
                <p className="font-semibold text-lg">{officer.name}</p>
                <p className="text-sm text-amber-700">
                  Partnership suspended: {officer.partnershipSuspensionReason || 'Partner on PTO'}
                </p>
                {officer.partnerData?.partnerName && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-sm text-yellow-800 font-medium">Original Partner:</p>
                    <p className="text-sm text-yellow-700">{officer.partnerData.partnerName} (on PTO)</p>
                  </div>
                )}
                <div className="mt-2 text-xs text-amber-800 bg-amber-100 p-2 rounded">
                  <p className="font-medium">⚠️ PPO Requirement:</p>
                  <p>Probationary Officers must always be partnered and cannot work alone.</p>
                </div>
              </div>

              <div>
                <Label htmlFor="emergency-partner">Select Emergency Partner</Label>
                <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                  <SelectTrigger id="emergency-partner">
                    <SelectValue placeholder="Select available officer" />
                  </SelectTrigger>
                  <SelectContent>
                    {emergencyLoading ? (
                      <div className="p-4 text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600 mx-auto mb-2"></div>
                        <div className="text-sm text-muted-foreground">Loading available officers...</div>
                      </div>
                    ) : emergencyError ? (
                      <div className="p-4 text-center">
                        <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                        <div className="text-sm text-red-600 font-medium">Error loading officers</div>
                        <div className="text-xs text-red-500 mt-1">{emergencyError.message}</div>
                      </div>
                    ) : !emergencyPartners || emergencyPartners.length === 0 ? (
                      <div className="p-4 text-center space-y-2">
                        <AlertTriangle className="h-8 w-8 text-amber-600 mx-auto" />
                        <div className="text-sm font-medium">No available officers found</div>
                        <div className="text-xs text-muted-foreground">
                          All regular officers are either:
                        </div>
                        <ul className="text-xs text-left text-muted-foreground list-disc pl-4 space-y-1">
                          <li>Already partnered</li>
                          <li>On PTO</li>
                          <li>Assigned to special duty</li>
                          <li>PPOs (cannot partner with PPOs in emergencies)</li>
                        </ul>
                      </div>
                    ) : (
                      <div className="max-h-[300px] overflow-y-auto">
                        <div className="text-xs text-muted-foreground p-2 border-b sticky top-0 bg-background">
                          Select a regular officer (non-PPO) for temporary assignment
                        </div>
{emergencyPartners.map((partner) => (
  <SelectItem key={partner.id} value={partner.id}>
    <div className="flex flex-col py-1">
      <span className="font-medium">{partner.name}</span>
      <span className="text-xs text-muted-foreground">
        Badge: {partner.badge || 'N/A'} • {partner.rank || 'Officer'}
      </span>
    </div>
  </SelectItem>
))}
                      </div>
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

              <div className="text-xs text-muted-foreground p-2 bg-gray-50 rounded border">
                <p className="font-medium mb-1">Emergency Partnership Details:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Temporary assignment for today only</li>
                  <li>Original partnership will resume tomorrow</li>
                  <li>Only regular officers (non-PPOs) available</li>
                  <li>Positions/districts preserved</li>
                </ul>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      );
    } else {
      // Regular officer with suspended partnership - no emergency option needed
      return (
        <div className="text-sm text-amber-600">
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Partnership Suspended
          </Badge>
          <p className="text-xs mt-1">{officer.partnershipSuspensionReason || 'Partner unavailable'}</p>
          {officer.partnerData?.partnerName && (
            <p className="text-xs mt-1">Partner: {officer.partnerData.partnerName}</p>
          )}
        </div>
      );
    }
  }

  // 3. No Partnership - Show create partnership option (only for regular officers)
  // PPOs cannot create new partnerships, only get emergency assignments
  if (isOfficerPPO) {
    return (
      <div className="text-sm text-gray-600">
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
          <Shield className="h-3 w-3 mr-1" />
          PPO
        </Badge>
        <p className="text-xs mt-1">PPOs must be assigned a partner</p>
      </div>
    );
  }

  // Regular officer - can create partnership with available PPO
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
              <SelectValue placeholder="Select Probationary Officer (PPO)" />
            </SelectTrigger>
            <SelectContent>
              {isLoading ? (
                <div className="p-4 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <div className="text-sm text-muted-foreground">Loading Probationary officers...</div>
                </div>
              ) : error ? (
                <div className="p-4 text-center">
                  <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                  <div className="text-sm text-red-600 font-medium">Error loading officers</div>
                  <div className="text-xs text-red-500 mt-1">{error.message}</div>
                </div>
              ) : !availablePartners || availablePartners.length === 0 ? (
                <div className="p-4 text-center space-y-2">
                  <div className="text-sm font-medium">No available Probationary officers</div>
                  <div className="text-xs text-muted-foreground">
                    Shift: {officer.shift.name} ({officer.shift.start_time} - {officer.shift.end_time})
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Date: {officer.date || format(new Date(), "yyyy-MM-dd")}
                  </div>
                  <div className="text-xs text-amber-600 mt-2">
                    Check browser console (F12) for debugging details
                  </div>
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto">
                  <div className="text-xs text-muted-foreground p-2 border-b sticky top-0 bg-background">
                    Select a Probationary Officer (PPO) to partner with
                  </div>
availablePartners.map
                </div>
              )}
            </SelectContent>
          </Select>
          
          <div className="text-xs text-muted-foreground p-2 bg-gray-50 rounded border">
            <div className="font-medium mb-1">PPO Partnership Requirements:</div>
            <ul className="list-disc pl-4 space-y-1">
              <li>Officer must be marked as "Probationary" (PPO)</li>
              <li>Officer must be scheduled for this shift</li>
              <li>Officer must not already be in a partnership</li>
              <li>Officer must not be on PTO/off duty</li>
              <li>Date must be within officer's schedule date range</li>
              <li className="font-medium text-blue-700">PPOs cannot work alone and must be partnered</li>
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
};
