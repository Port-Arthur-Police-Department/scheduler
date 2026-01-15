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
  
  console.log("🔍 isPPO detailed check:", {
    name: officer.full_name || officer.name,
    originalRank: officer.rank,
    lowercaseRank: rank,
    isPPO: isProbationary,
    matches: {
      exactProbationary: rank === 'probationary',
      includesProbationary: rank.includes('probationary'),
      includesPPO: rank.includes('ppo'),
      includesProbation: rank.includes('probation'),
      exactPPO: rank === 'ppo'
    }
  });
  
  return isProbationary;
};

export const PartnershipManager = ({ officer, onPartnershipChange }: PartnershipManagerProps) => {
  const [open, setOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState("");
  const [emergencyMode, setEmergencyMode] = useState(false);

  // FIX: Check if officer is on PTO or has suspended partnership
  if (officer.hasPTO && officer.ptoData?.isFullShift) {
    console.log("📋 Officer is on full day PTO, hiding partnership manager:", officer.name);
    return null;
  }

  // Check partnership status
  const hasActivePartnership = officer.isPartnership && !officer.partnershipSuspended;
  const hasSuspendedPartnership = officer.isPartnership && officer.partnershipSuspended;
  const isOfficerPPO = isPPO(officer);

  // NEW: For emergency partner query (regular officers, not PPOs)
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

      // Get all exceptions for this shift today
      const { data: exceptionsData, error: exceptionsError } = await supabase
        .from("schedule_exceptions")
        .select(`
          id,
          officer_id,
          is_partnership,
          partnership_suspended,
          is_off,
          notes,
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
        console.error("Error fetching exceptions for emergency assignment:", exceptionsError);
        throw exceptionsError;
      }

      // Get all recurring schedules for this shift and day of week
      const { data: recurringData, error: recurringError } = await supabase
        .from("recurring_schedules")
        .select(`
          id,
          officer_id,
          is_partnership,
          partnership_suspended,
          day_of_week,
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
        .neq("officer_id", officer.officerId);

      if (recurringError) {
        console.error("Error fetching recurring schedules for emergency assignment:", recurringError);
        throw recurringError;
      }

      console.log("🚨 Raw data for emergency partners:", {
        exceptions: exceptionsData?.length || 0,
        recurring: recurringData?.length || 0
      });

      // Combine and filter all officers
      const allOfficers = [];
      
      // Process exceptions
      if (exceptionsData) {
        for (const record of exceptionsData) {
          if (!record.profiles) continue;
          
          // Check if there's already an officer record (exception overrides recurring)
          const existingIndex = allOfficers.findIndex(o => o.id === record.officer_id);
          if (existingIndex !== -1) {
            allOfficers[existingIndex] = {
              id: record.officer_id,
              name: record.profiles.full_name,
              badge: record.profiles.badge_number,
              rank: record.profiles.rank,
              isOff: record.is_off,
              isPartnership: record.is_partnership,
              partnershipSuspended: record.partnership_suspended,
              scheduleId: record.id,
              source: 'exception',
              notes: record.notes
            };
          } else {
            allOfficers.push({
              id: record.officer_id,
              name: record.profiles.full_name,
              badge: record.profiles.badge_number,
              rank: record.profiles.rank,
              isOff: record.is_off,
              isPartnership: record.is_partnership,
              partnershipSuspended: record.partnership_suspended,
              scheduleId: record.id,
              source: 'exception',
              notes: record.notes
            });
          }
        }
      }

      // Process recurring schedules
      if (recurringData) {
        const currentDate = parseISO(dateToUse);
        
        for (const record of recurringData) {
          if (!record.profiles) continue;
          
          // Check date range
          const startDate = parseISO(record.start_date);
          const endDate = record.end_date ? parseISO(record.end_date) : null;
          
          if (currentDate < startDate) {
            console.log(`   ⏸️ Skipping recurring - date before start: ${record.profiles.full_name}`);
            continue;
          }
          
          if (endDate && currentDate > endDate) {
            console.log(`   ⏸️ Skipping recurring - date after end: ${record.profiles.full_name}`);
            continue;
          }
          
          // Check if officer already has an exception (exception overrides recurring)
          const existingException = allOfficers.find(o => o.id === record.officer_id && o.source === 'exception');
          if (existingException) {
            console.log(`   ⏸️ Skipping recurring - has exception: ${record.profiles.full_name}`);
            continue;
          }
          
          // Check if officer is already in the list from exceptions
          const existingIndex = allOfficers.findIndex(o => o.id === record.officer_id);
          if (existingIndex === -1) {
            allOfficers.push({
              id: record.officer_id,
              name: record.profiles.full_name,
              badge: record.profiles.badge_number,
              rank: record.profiles.rank,
              isOff: false, // Recurring schedules don't have is_off field
              isPartnership: record.is_partnership,
              partnershipSuspended: record.partnership_suspended,
              scheduleId: record.id,
              source: 'recurring',
              notes: null
            });
          }
        }
      }

      console.log("🚨 All officers found:", allOfficers.map(o => ({
        name: o.name,
        rank: o.rank,
        source: o.source,
        isOff: o.isOff,
        isPartnership: o.isPartnership,
        partnershipSuspended: o.partnershipSuspended
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
        const isPartnerPPO = isPPO({ rank: officerRecord.rank });
        if (isPartnerPPO) {
          console.log(`❌ Skipping PPO for emergency assignment: ${officerRecord.name}`);
          return false;
        }
        
        // Skip if already in an active partnership (unless suspended)
        if (officerRecord.isPartnership && !officerRecord.partnershipSuspended) {
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
        source: p.source,
        hasPartnership: p.isPartnership,
        partnershipSuspended: p.partnershipSuspended
      })));

      return emergencyPartners;
    },
    enabled: open && emergencyMode && isOfficerPPO && hasSuspendedPartnership,
  });

  // Existing query for regular PPO partners (for "Add Partner")
  const { data: availablePartners, isLoading, error } = useQuery({
    queryKey: ["available-partners", officer.shift.id, officer.date || format(new Date(), "yyyy-MM-dd")],
    queryFn: async () => {
      const dateToUse = officer.date || format(new Date(), "yyyy-MM-dd");
      const dayOfWeek = parseISO(dateToUse).getDay();

      console.log("🤝 === START REGULAR PARTNERSHIP QUERY ===");
      console.log("📋 Officer requesting partner:", {
        id: officer.officerId,
        name: officer.name,
        rank: officer.rank,
        isPPO: isPPO(officer),
        hasActivePartnership,
        hasSuspendedPartnership,
        shift: officer.shift.name,
        shiftId: officer.shift.id,
        date: dateToUse,
        dayOfWeek: dayOfWeek,
      });

      // Get exceptions for today
      const { data: todayExceptions, error: todayError } = await supabase
        .from("schedule_exceptions")
        .select(`
          id,
          officer_id,
          partner_officer_id,
          is_partnership,
          date,
          shift_type_id,
          is_off,
          profiles:officer_id (
            id,
            full_name,
            badge_number,
            rank
          )
        `)
        .eq("date", dateToUse)
        .eq("shift_type_id", officer.shift.id);

      if (todayError) {
        console.error("❌ Error fetching today exceptions:", todayError);
      } else {
        console.log("✅ Today exceptions found:", todayExceptions?.length || 0);
      }

      // Get recurring for today's day of week
      const { data: todayRecurring, error: recurringError } = await supabase
        .from("recurring_schedules")
        .select(`
          id,
          officer_id,
          partner_officer_id,
          is_partnership,
          day_of_week,
          start_date,
          end_date,
          shift_type_id,
          profiles:profiles!recurring_schedules_officer_id_fkey (
            id,
            full_name,
            badge_number,
            rank
          )
        `)
        .eq("shift_type_id", officer.shift.id)
        .eq("day_of_week", dayOfWeek)
        .lte("start_date", dateToUse)  // Start date is on or before today
        .or(`end_date.is.null,end_date.gte.${dateToUse}`);  // End date is null or on/after today

      if (recurringError) {
        console.error("❌ Error fetching recurring schedules:", recurringError);
      } else {
        console.log("✅ Recurring schedules found:", todayRecurring?.length || 0);
      }

      // Combine all officers working today
      const workingToday = [];
      const currentDate = parseISO(dateToUse);
      
      // Process exceptions - only add if NOT off
      if (todayExceptions) {
        for (const exception of todayExceptions) {
          if (!exception.profiles) continue;
          
          // Skip if officer is marked as off
          if (exception.is_off === true) {
            console.log(`   ⏸️ Skipping officer marked OFF in exception: ${exception.profiles.full_name}`);
            continue;
          }
          
          workingToday.push({
            ...exception.profiles,
            scheduleId: exception.id,
            isPartnership: exception.is_partnership,
            partnerOfficerId: exception.partner_officer_id,
            source: 'exception',
            date: exception.date,
            shiftTypeId: exception.shift_type_id,
            isOff: exception.is_off
          });
        }
      }

      // Process recurring schedules
      if (todayRecurring) {
        for (const recurring of todayRecurring) {
          if (!recurring.profiles) continue;
          
          // Validate date range
          const startDate = parseISO(recurring.start_date);
          const endDate = recurring.end_date ? parseISO(recurring.end_date) : null;
          
          if (currentDate < startDate) {
            console.log(`   ⏸️ Skipping - date before start: ${recurring.profiles.full_name} (${dateToUse} < ${recurring.start_date})`);
            continue;
          }
          
          if (endDate && currentDate > endDate) {
            console.log(`   ⏸️ Skipping - date after end: ${recurring.profiles.full_name} (${dateToUse} > ${recurring.end_date})`);
            continue;
          }
          
          // Check if officer has an exception (exception overrides recurring)
          const hasException = todayExceptions?.find(e => 
            e.officer_id === recurring.officer_id && 
            e.shift_type_id === recurring.shift_type_id
          );
          
          if (hasException) {
            console.log(`   ⏸️ Skipping - has exception: ${recurring.profiles.full_name}`);
            continue;
          }
          
          workingToday.push({
            ...recurring.profiles,
            scheduleId: recurring.id,
            isPartnership: recurring.is_partnership,
            partnerOfficerId: recurring.partner_officer_id,
            source: 'recurring',
            dayOfWeek: recurring.day_of_week,
            startDate: recurring.start_date,
            endDate: recurring.end_date
          });
        }
      }

      console.log("👮 Officers found as working today:", workingToday.map(o => ({
        id: o.id,
        name: o.full_name,
        rank: o.rank,
        isPPO: isPPO(o),
        source: o.source,
        hasPartner: o.isPartnership || o.partnerOfficerId
      })));

      // Remove duplicates
      const uniqueWorkingToday = [];
      const seenOfficerIds = new Set();
      
      for (const officerRecord of workingToday) {
        if (!officerRecord.id || seenOfficerIds.has(officerRecord.id)) {
          continue;
        }
        
        seenOfficerIds.add(officerRecord.id);
        uniqueWorkingToday.push(officerRecord);
      }

      console.log("\n👮 Unique officers working today:", uniqueWorkingToday.length);
      uniqueWorkingToday.forEach(o => {
        console.log(`   - ${o.full_name} (${o.rank}) - Source: ${o.source}`);
      });

      // Filter for available PPOs
      const availablePPOs = uniqueWorkingToday
        .filter(officerRecord => {
          // Exclude current officer
          if (officerRecord.id === officer.officerId) {
            return false;
          }
          
          // Check if PPO
          if (!isPPO(officerRecord)) {
            return false;
          }
          
          // Check if already in a partnership
          if (officerRecord.isPartnership === true || officerRecord.partnerOfficerId) {
            return false;
          }
          
          return true;
        })
        .sort((a, b) => {
          const lastNameA = getLastName(a.full_name).toLowerCase();
          const lastNameB = getLastName(b.full_name).toLowerCase();
          return lastNameA.localeCompare(lastNameB);
        });

      console.log("\n✅ Available PPO partners:", availablePPOs.length);
      availablePPOs.forEach(p => {
        console.log(`   - ${p.full_name} (${p.rank})`);
      });

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
                                {partner.partnershipSuspended && (
                                  <span className="text-amber-600"> • Partnership suspended</span>
                                )}
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
