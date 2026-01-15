// src/components/schedule/PartnershipManager.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
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

  const { data: availablePartners, isLoading, error } = useQuery({
    queryKey: ["available-partners", officer.shift.id, officer.date || format(new Date(), "yyyy-MM-dd")],
    queryFn: async () => {
      const dateToUse = officer.date || format(new Date(), "yyyy-MM-dd");
      const dayOfWeek = parseISO(dateToUse).getDay();

      console.log("🤝 === START PARTNERSHIP QUERY ===");
      console.log("📋 Officer requesting partner:", {
        id: officer.officerId,
        name: officer.name,
        rank: officer.rank,
        isPPO: isPPO(officer),
        shift: officer.shift.name,
        shiftId: officer.shift.id,
        date: dateToUse,
        dayOfWeek: dayOfWeek,
        officerData: officer // Include full officer data for debugging
      });

      // STEP 1: Get all officers working on this shift today
      console.log(`📥 Step 1: Getting officers working on ${officer.shift.name} (ID: ${officer.shift.id}) today...`);
      
      // Get exceptions for today - FIXED: Include all fields needed
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
        .eq("shift_type_id", officer.shift.id)
        .eq("is_off", false);

      if (todayError) {
        console.error("❌ Error fetching today exceptions:", todayError);
      } else {
        console.log("✅ Today exceptions found:", todayExceptions?.length || 0);
        todayExceptions?.forEach(exception => {
          console.log("   - Exception:", {
            officerId: exception.officer_id,
            name: exception.profiles?.full_name,
            rank: exception.profiles?.rank,
            isPartnership: exception.is_partnership,
            partnerId: exception.partner_officer_id
          });
        });
      }

      // Get recurring for today's day of week - FIXED: Add date range validation
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
        .or(`end_date.is.null,end_date.gte.${dateToUse}`);

      if (recurringError) {
        console.error("❌ Error fetching recurring schedules:", recurringError);
      } else {
        console.log("✅ Recurring schedules found:", todayRecurring?.length || 0);
        todayRecurring?.forEach(recurring => {
          console.log("   - Recurring:", {
            officerId: recurring.officer_id,
            name: recurring.profiles?.full_name,
            rank: recurring.profiles?.rank,
            isPartnership: recurring.is_partnership,
            partnerId: recurring.partner_officer_id,
            startDate: recurring.start_date,
            endDate: recurring.end_date
          });
        });
      }

      // Combine all officers working today
      const workingToday = [];
      
      // Process exceptions
      if (todayExceptions) {
        for (const exception of todayExceptions) {
          if (!exception.profiles) continue;
          
          // Check if officer is actually working (not off)
          if (exception.is_off === true) {
            console.log(`   ⏸️ Skipping officer on PTO: ${exception.profiles.full_name}`);
            continue;
          }
          
          workingToday.push({
            ...exception.profiles,
            scheduleId: exception.id,
            isPartnership: exception.is_partnership,
            partnerOfficerId: exception.partner_officer_id,
            source: 'exception',
            date: exception.date,
            shiftTypeId: exception.shift_type_id
          });
        }
      }

      // Process recurring schedules with date validation
      if (todayRecurring) {
        const currentDate = parseISO(dateToUse);
        
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
          
          // Check if officer has an exception that overrides this recurring schedule
          const hasException = todayExceptions?.find(e => 
            e.officer_id === recurring.officer_id && 
            e.shift_type_id === recurring.shift_type_id
          );
          
          if (hasException) {
            console.log(`   ⏸️ Skipping - has exception override: ${recurring.profiles.full_name}`);
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

      console.log("👮 Raw working today (before deduplication):", workingToday.map(o => ({
        id: o.id,
        name: o.full_name,
        rank: o.rank,
        isPPO: isPPO(o),
        source: o.source,
        hasPartner: o.isPartnership || o.partnerOfficerId,
        partnerId: o.partnerOfficerId
      })));

      // Remove duplicates (keep the most recent/exception over recurring)
      const uniqueWorkingToday = [];
      const seenOfficerIds = new Set();
      
      for (const officer of workingToday) {
        if (!officer.id || seenOfficerIds.has(officer.id)) {
          continue;
        }
        
        seenOfficerIds.add(officer.id);
        uniqueWorkingToday.push(officer);
      }

      console.log("\n👮 Unique officers working today:", uniqueWorkingToday.map(o => ({
        id: o.id,
        name: o.full_name,
        rank: o.rank,
        isPPO: isPPO(o),
        isPartnership: o.isPartnership,
        partnerId: o.partnerOfficerId,
        source: o.source
      })));

      // STEP 2: Filter for PPO officers who are available
      console.log("\n🔍 Step 2: Filtering for available PPOs...");
      const availablePPOs = uniqueWorkingToday
        .filter(officer => {
          console.log(`\n--- Checking officer: ${officer.full_name} ---`);
          
          // Exclude current officer
          if (officer.id === officer.officerId) {
            console.log(`❌ Excluding current officer: ${officer.full_name}`);
            return false;
          }
          
          // Check if PPO
          const isPPOOfficer = isPPO(officer);
          console.log(`PPO check: ${isPPOOfficer} (Rank: ${officer.rank})`);
          
          if (!isPPOOfficer) {
            console.log(`❌ Not a PPO: ${officer.full_name} (Rank: ${officer.rank})`);
            return false;
          }
          
          // Check if already in a partnership
          const hasPartner = officer.isPartnership === true || officer.partnerOfficerId;
          console.log(`Partnership check: ${hasPartner} (isPartnership: ${officer.isPartnership}, partnerId: ${officer.partnerOfficerId})`);
          
          if (hasPartner) {
            console.log(`❌ Already in partnership: ${officer.full_name}`);
            return false;
          }

              // NEW: Check if partnership is suspended (partner on PTO)
    const hasSuspendedPartnership = officer.partnership_suspended === true;
    if (hasSuspendedPartnership) {
      console.log(`⚠️ Partnership suspended, available for reassignment: ${officer.full_name}`);
      return true; // This PPO is available for reassignment!
    }
          
          console.log(`✅ Available PPO: ${officer.full_name} (Rank: ${officer.rank})`);
          return true;
        })
        .sort((a, b) => {
          const lastNameA = getLastName(a.full_name).toLowerCase();
          const lastNameB = getLastName(b.full_name).toLowerCase();
          return lastNameA.localeCompare(lastNameB);
        });

      console.log("\n=== FINAL RESULTS ===");
      console.log("✅ Available PPO partners:", availablePPOs.map(p => ({
        id: p.id,
        name: p.full_name,
        rank: p.rank,
        isPartnership: p.isPartnership,
        partnerId: p.partnerOfficerId,
        source: p.source
      })));

      if (availablePPOs.length === 0) {
        console.log("\n⚠️ No PPO partners found. Detailed analysis:");
        console.log("- Total unique officers working today:", uniqueWorkingToday.length);
        console.log("- All working officers:", uniqueWorkingToday.map(o => ({
          name: o.full_name,
          rank: o.rank,
          isPPO: isPPO(o),
          hasPartner: o.isPartnership || o.partnerOfficerId,
          source: o.source
        })));
        console.log("- PPO officers found:", uniqueWorkingToday.filter(o => isPPO(o)).map(o => ({
          name: o.full_name,
          rank: o.rank,
          hasPartner: o.isPartnership || o.partnerOfficerId
        })));
        console.log("- Officers already partnered:", uniqueWorkingToday.filter(o => o.isPartnership || o.partnerOfficerId).map(o => ({
          name: o.full_name,
          partnerId: o.partnerOfficerId
        })));
        
        // Check database for PPOs in this shift
        console.log("\n🔧 Debugging database state:");
        
        // Direct query for PPO profiles
        const { data: allPPOs } = await supabase
          .from("profiles")
          .select("id, full_name, rank")
          .or('rank.ilike.%probationary%,rank.ilike.%ppo%');
        
        console.log("- All PPOs in database:", allPPOs?.length || 0);
        allPPOs?.forEach(ppo => {
          console.log(`   - ${ppo.full_name}: ${ppo.rank}`);
        });
        
        // Check for this specific shift's recurring schedules
        const { data: shiftRecurring } = await supabase
          .from("recurring_schedules")
          .select(`
            officer_id,
            profiles:profiles!recurring_schedules_officer_id_fkey (
              id,
              full_name,
              rank
            )
          `)
          .eq("shift_type_id", officer.shift.id)
          .eq("day_of_week", dayOfWeek);
        
        console.log("- Recurring schedules for this shift/day:", shiftRecurring?.length || 0);
        shiftRecurring?.forEach(r => {
          console.log(`   - ${r.profiles?.full_name}: ${r.profiles?.rank}`);
        });
      }

      return availablePPOs;
    },
    enabled: open,
  });

  const handleCreatePartnership = async () => {
    if (!selectedPartner) return;
    
    const partner = availablePartners?.find(p => p.id === selectedPartner);
    console.log("🤝 Creating partnership:", {
      officer: officer.name,
      officerRank: officer.rank,
      officerId: officer.officerId,
      partner: partner?.full_name,
      partnerRank: partner?.rank,
      partnerId: selectedPartner,
      shift: officer.shift.name,
      date: officer.date || format(new Date(), "yyyy-MM-dd")
    });

    onPartnershipChange(officer, selectedPartner);
    setOpen(false);
    setSelectedPartner("");
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
            {officer.partnerData.partnerRank?.toLowerCase().includes('probationary') && (
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
};
