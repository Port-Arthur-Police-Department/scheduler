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
  
  // Use the same logic as isPPOByRank
  return isPPOByRank(officer.rank);
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
      
      console.log("🚨 === ENHANCED EMERGENCY PARTNERS QUERY ===");
      console.log("Looking for regular officers (non-PPOs) for emergency pairing");
      console.log("Date:", dateToUse, "Day:", dayOfWeek, "Shift:", officer.shift.id);

      // Get all officers scheduled for this date/shift
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
        .neq("officer_id", officer.officerId)
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

      // Get schedule exceptions for this date/shift
      const { data: exceptions, error: exceptionsError } = await supabase
        .from("schedule_exceptions")
        .select(`
          id,
          officer_id,
          is_partnership,
          partner_officer_id,
          is_off,
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
          processedOfficerIds.add(officerId);

          // Skip if officer is on PTO
          if (exception.is_off) {
            console.log(`   ⏸️ Skipping - on PTO via exception: ${exception.profiles.full_name}`);
            continue;
          }

          // Skip if already in an active partnership
          if (exception.is_partnership) {
            console.log(`   ❌ Skipping - already partnered via exception: ${exception.profiles.full_name}`);
            continue;
          }

          // Check if officer is a PPO
          const isPPO = isPPOByRank(exception.profiles.rank);
          if (isPPO) {
            console.log(`   ❌ Skipping PPO for emergency assignment: ${exception.profiles.full_name}`);
            continue;
          }

          // Officer is available for emergency assignment
          console.log(`   ✅ Available via exception: ${exception.profiles.full_name}`);
          availableOfficers.push({
            id: officerId,
            name: exception.profiles.full_name,
            badge: exception.profiles.badge_number,
            rank: exception.profiles.rank,
            isPartnership: exception.is_partnership,
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
          const currentDate = parseISO(dateToUse);
          const startDate = parseISO(schedule.start_date);
          const endDate = schedule.end_date ? parseISO(schedule.end_date) : null;
          
          if (currentDate < startDate) {
            console.log(`   ❌ Skipping - date before start: ${schedule.profiles.full_name}`);
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
          // Check both is_partnership AND partner_officer_id
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
            isPartnership: schedule.is_partnership,
            partnershipSuspended: false,
            scheduleId: schedule.id,
            source: 'recurring'
          });
        }
      }

      console.log("🚨 Emergency partners found:", availableOfficers.map(p => ({
        name: p.name,
        rank: p.rank,
        source: p.source,
        isPartnered: p.isPartnership
      })));

      return availableOfficers.sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: open && emergencyMode && isOfficerPPO && hasSuspendedPartnership,
  });

  // Regular PPO partners query
  const { data: availablePartners, isLoading, error } = useQuery({
    queryKey: ["available-ppo-partners", officer.shift.id, officer.date || format(new Date(), "yyyy-MM-dd")],
    queryFn: async () => {
      const dateToUse = officer.date || format(new Date(), "yyyy-MM-dd");
      const dayOfWeek = parseISO(dateToUse).getDay();
      const currentDate = parseISO(dateToUse);

      console.log("🔍 ULTIMATE PPO FINDER QUERY");
      console.log("Date:", dateToUse, "Day:", dayOfWeek, "Shift:", officer.shift.id);

      // SIMPLIFIED: Just get all active PPOs and we'll filter in memory
      const { data: allPPOs, error: pposError } = await supabase
        .from("profiles")
        .select("id, full_name, badge_number, rank")
        .eq("rank", "Probationary")
        .eq("active", true)
        .neq("id", officer.officerId) // Don't include self
        .order("full_name");

      if (pposError) {
        console.error("Error fetching PPOs:", pposError);
        throw pposError;
      }

      console.log("Found PPOs:", allPPOs?.length);

      if (!allPPOs || allPPOs.length === 0) {
        return [];
      }

      // Now check each PPO's schedule status for today
      const availablePPOs = [];

      for (const ppo of allPPOs) {
        console.log(`\n--- Checking ${ppo.full_name} ---`);
        
        try {
          // Check if PPO has any existing partnership for today
          const { data: existingPartnership } = await supabase
            .from("schedule_exceptions")
            .select("id, partner_officer_id, is_partnership")
            .eq("officer_id", ppo.id)
            .eq("date", dateToUse)
            .eq("shift_type_id", officer.shift.id)
            .eq("is_partnership", true)
            .maybeSingle();

          if (existingPartnership) {
            console.log(`❌ Already partnered via exception`);
            continue;
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

          // PPO is available!
          console.log(`✅ ${ppo.full_name} is available for partnership!`);
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

      console.log("\n✅ Available PPOs:", availablePPOs.map(p => p.full_name));
      return availablePPOs;

    },
    enabled: open && !emergencyMode && !hasActivePartnership,
  });
  
  // In PartnershipManager.tsx, update handleCreatePartnership:
const handleCreatePartnership = async () => {
  if (!selectedPartner) return;
  
  if (emergencyMode) {
    const partner = emergencyPartners?.find(p => p.id === selectedPartner);
    console.log("🚨 Creating EMERGENCY partnership:", {
      ppo: officer.name,
      partner: partner?.name,
      partnerId: selectedPartner,
      shift: officer.shift.name,
      date: officer.date || format(new Date(), "yyyy-MM-dd")
    });

    // For emergency partnerships, don't pass position
    onPartnershipChange(officer, selectedPartner);
  } else {
    const partner = availablePartners?.find(p => p.id === selectedPartner);
    console.log("🤝 Creating regular partnership:", {
      officer: officer.name,
      partner: partner?.full_name,
      partnerId: selectedPartner,
      shift: officer.shift.name,
      date: officer.date || format(new Date(), "yyyy-MM-dd")
    });

    // For regular partnerships, also don't pass position
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
              {officer.partnerData?.partnerRank && isPPOByRank(officer.partnerData.partnerRank) && (
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
                          <li>PPOs (cannot partner with PPOs in emergencies)</li>
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
                                {partner.source && ` • ${partner.source}`}
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
                  <div className="text-xs text-muted-foreground">
                    Date: {officer.date || format(new Date(), "yyyy-MM-dd")}
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
              <li>Date must be within officer's schedule date range</li>
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
