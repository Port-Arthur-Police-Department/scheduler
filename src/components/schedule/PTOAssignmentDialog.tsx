// src/components/schedule/PTOAssignmentDialog.tsx
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { auditLogger } from "@/lib/auditLogger";
import { useUser } from "@/contexts/UserContext";
import { AlertTriangle, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isPPOByRank } from "@/utils/ppoUtils";

interface PTOAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  officer: {
    officerId: string;
    name: string;
    scheduleId: string;
    type: "recurring" | "exception";
    existingPTO?: {
      id: string;
      ptoType: string;
      startTime: string;
      endTime: string;
      isFullShift: boolean;
    };
  } | null;
  shift: {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
  } | null;
  date: string;
  ptoBalancesEnabled?: boolean;
  onSuccess?: (ptoData: any) => void;
}

const PTO_TYPES = [
  { value: "vacation", label: "Vacation", column: "vacation_hours" },
  { value: "sick", label: "Sick Leave", column: "sick_hours" },
  { value: "comp", label: "Comp Time", column: "comp_hours" },
  { value: "holiday", label: "Holiday", column: "holiday_hours" },
];


// ADD THIS HELPER FUNCTION - IT WAS MISSING
const calculateHours = (start: string, end: string) => {
  if (!start || !end) return 0;
  
  const [startHour, startMin] = start.split(":").map(Number);
  const [endHour, endMin] = end.split(":").map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  // Handle overnight shifts (end time less than start time)
  let diffMinutes = endMinutes - startMinutes;
  if (diffMinutes < 0) {
    diffMinutes += 24 * 60; // Add 24 hours in minutes
  }
  
  return diffMinutes / 60;
};

export const PTOAssignmentDialog = ({
  open,
  onOpenChange,
  officer,
  shift,
  date,
  ptoBalancesEnabled = false,
  onSuccess
}: PTOAssignmentDialogProps) => {
  const queryClient = useQueryClient();
  const { userEmail } = useUser();
  const [ptoType, setPtoType] = useState("");
  const [isFullShift, setIsFullShift] = useState(true);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [officerHasPartnership, setOfficerHasPartnership] = useState(false);
  const [partnerInfo, setPartnerInfo] = useState<any>(null);
  const [isPartnerPPO, setIsPartnerPPO] = useState(false);
  const [isOfficerPPO, setIsOfficerPPO] = useState(false);
  const [ptoAssignedTo, setPtoAssignedTo] = useState<"clickedOfficer" | "partner">("clickedOfficer");

  // Check for partnerships and PPO status when dialog opens
  useEffect(() => {
    const checkPartnershipAndPPO = async () => {
      if (open && officer && shift) {
        console.log("🔍 Checking for partnerships and PPO status for officer:", officer.officerId);
        
        // Check if officer is PPO
        const { data: officerProfile } = await supabase
          .from("profiles")
          .select("rank")
          .eq("id", officer.officerId)
          .single();
        
        setIsOfficerPPO(isPPO(officerProfile?.rank));

        // Check for existing partnership on this date/shift
        const { data: partnership } = await supabase
          .from("schedule_exceptions")
          .select(`
            id,
            partner_officer_id,
            is_partnership,
            partner_profile:profiles!schedule_exceptions_partner_officer_id_fkey (
              id,
              full_name,
              badge_number,
              rank
            )
          `)
          .eq("officer_id", officer.officerId)
          .eq("date", date)
          .eq("shift_type_id", shift.id)
          .eq("is_partnership", true)
          .single();

        if (partnership?.is_partnership && partnership.partner_officer_id) {
          console.log("✅ Officer has a partnership:", partnership);
          setOfficerHasPartnership(true);
          setPartnerInfo(partnership.partner_profile);
          setIsPartnerPPO(isPPO(partnership.partner_profile?.rank));
        } else {
          // Check recurring partnerships
          const dayOfWeek = new Date(date).getDay();
          const { data: recurringPartnership } = await supabase
            .from("recurring_schedules")
            .select(`
              id,
              partner_officer_id,
              is_partnership,
              partner_profile:profiles!recurring_schedules_partner_officer_id_fkey (
                id,
                full_name,
                badge_number,
                rank
              )
            `)
            .eq("officer_id", officer.officerId)
            .eq("shift_type_id", shift.id)
            .eq("day_of_week", dayOfWeek)
            .eq("is_partnership", true)
            .single();

          if (recurringPartnership?.is_partnership && recurringPartnership.partner_officer_id) {
            console.log("✅ Officer has a recurring partnership:", recurringPartnership);
            setOfficerHasPartnership(true);
            setPartnerInfo(recurringPartnership.partner_profile);
            setIsPartnerPPO(isPPO(recurringPartnership.partner_profile?.rank));
          } else {
            setOfficerHasPartnership(false);
            setPartnerInfo(null);
            setIsPartnerPPO(false);
          }
        }
      } else {
        setOfficerHasPartnership(false);
        setPartnerInfo(null);
        setIsPartnerPPO(false);
        setIsOfficerPPO(false);
      }
    };

    if (open && officer && shift) {
      checkPartnershipAndPPO();
    }
  }, [open, officer, shift, date]);

  // Reset form when dialog opens/closes or officer changes
  useEffect(() => {
    if (open && officer && shift) {
      setPtoType(officer.existingPTO?.ptoType || "");
      setIsFullShift(officer.existingPTO?.isFullShift ?? true);
      setStartTime(officer.existingPTO?.startTime || shift.start_time);
      setEndTime(officer.existingPTO?.endTime || shift.end_time);
      // Reset partner selection to default
      setPtoAssignedTo("clickedOfficer");
    } else {
      // Reset form when dialog closes or no officer/shift
      setPtoType("");
      setIsFullShift(true);
      setStartTime("");
      setEndTime("");
      setPtoAssignedTo("clickedOfficer");
    }
  }, [open, officer, shift]);

  // Function to handle partnership suspension when officer goes on PTO
  const suspendPartnershipForPTO = async (ptoOfficerId: string, workingOfficerId: string) => {
    console.log(`🔄 Suspending partnership: ${ptoOfficerId} with ${workingOfficerId} for PTO`);
    
    // Get PTO officer's name
    const { data: ptoOfficerData } = await supabase
      .from("profiles")
      .select("full_name, rank")
      .eq("id", ptoOfficerId)
      .single();

    // Get working officer's name
    const { data: workingOfficerData } = await supabase
      .from("profiles")
      .select("full_name, rank")
      .eq("id", workingOfficerId)
      .single();

    const isWorkingOfficerPPO = isPPO(workingOfficerData?.rank);
    const isPtoOfficerPPO = isPPO(ptoOfficerData?.rank);

    console.log("🔍 Partnership suspension check:", {
      ptoOfficer: ptoOfficerData?.full_name,
      ptoOfficerIsPPO: isPtoOfficerPPO,
      workingOfficer: workingOfficerData?.full_name,
      workingOfficerIsPPO: isWorkingOfficerPPO
    });

    // CRITICAL FIX: Check if working officer is a PPO
    if (isWorkingOfficerPPO) {
      // Working officer is a PPO (their partner is on PTO) - they need a suspended partnership record
      console.log(`🔄 Creating suspended partnership for PPO: ${workingOfficerData?.full_name}`);
      
      // Check if PPO already has an exception
      const { data: ppoException } = await supabase
        .from("schedule_exceptions")
        .select("id, position_name, unit_number, notes, is_off")
        .eq("officer_id", workingOfficerId)
        .eq("date", date)
        .eq("shift_type_id", shift!.id)
        .single();

      if (ppoException && !ppoException.is_off) {
        // Update existing exception for PPO
        await supabase
          .from("schedule_exceptions")
          .update({
            partnership_suspended: true,
            partnership_suspension_reason: `${ptoOfficerData?.full_name || 'Partner'} on ${ptoType}`,
            partner_officer_id: ptoOfficerId,
            schedule_type: "working_partner_suspended",
            notes: ppoException.notes || null,
            is_partnership: false, // Important: not in active partnership
          })
          .eq("id", ppoException.id);
        
        console.log(`✅ Updated PPO's existing record for partnership suspension`);
      } else if (!ppoException) {
        // Get recurring schedule details for PPO
        const dayOfWeek = new Date(date).getDay();
        const { data: recurringSchedule } = await supabase
          .from("recurring_schedules")
          .select("position_name, unit_number, notes")
          .eq("officer_id", workingOfficerId)
          .eq("shift_type_id", shift!.id)
          .eq("day_of_week", dayOfWeek)
          .single();

        // Create suspended partnership exception for PPO
        const ppoExceptionData = {
          officer_id: workingOfficerId,
          date: date,
          shift_type_id: shift!.id,
          is_off: false,
          is_partnership: false, // Important: not in active partnership
          partnership_suspended: true,
          partnership_suspension_reason: `${ptoOfficerData?.full_name || 'Partner'} on ${ptoType}`,
          partner_officer_id: ptoOfficerId,
          position_name: recurringSchedule?.position_name || "",
          unit_number: recurringSchedule?.unit_number || "",
          notes: recurringSchedule?.notes || `Partnership suspended - partner ${ptoOfficerData?.full_name} on PTO`,
          schedule_type: "working_partner_suspended",
          // Mark as eligible for emergency partner
          is_emergency_eligible: true
        };

        await supabase
          .from("schedule_exceptions")
          .insert(ppoExceptionData);
        
        console.log(`✅ Created suspended partnership record for PPO ${workingOfficerData?.full_name}`);
      } else {
        console.log(`⚠️ PPO already has a PTO record, skipping partnership suspension update`);
      }
    } else if (isPtoOfficerPPO) {
      // PPO is on PTO, regular officer is working - regular officer should return to normal schedule
      console.log(`✅ PPO ${ptoOfficerData?.full_name} on PTO - regular officer ${workingOfficerData?.full_name} returns to regular schedule`);
      
      // Check if regular officer has a suspended partnership record and remove it
      const { data: regularOfficerException } = await supabase
        .from("schedule_exceptions")
        .select("id")
        .eq("officer_id", workingOfficerId)
        .eq("date", date)
        .eq("shift_type_id", shift!.id)
        .eq("partnership_suspended", true)
        .single();

      if (regularOfficerException) {
        await supabase
          .from("schedule_exceptions")
          .delete()
          .eq("id", regularOfficerException.id);
        console.log(`🗑️ Removed suspended partnership record for regular officer`);
      }
    }

    // Log the partnership suspension
    await supabase
      .from("partnership_exceptions")
      .insert({
        officer_id: ptoOfficerId,
        partner_officer_id: workingOfficerId,
        date: date,
        shift_type_id: shift!.id,
        reason: `Officer ${ptoOfficerData?.full_name} on ${ptoType} leave`,
        exception_type: 'pto_suspension',
        created_at: new Date().toISOString(),
        is_ppo_partnership: isPtoOfficerPPO || isWorkingOfficerPPO,
        can_emergency_reassign: isWorkingOfficerPPO, // True if working officer is PPO
        pto_assigned_to: ptoOfficerId
      });

    // Show appropriate message
    if (isWorkingOfficerPPO) {
      toast.info(`Partnership suspended. PPO ${workingOfficerData?.full_name} needs an emergency partner and will appear in "Partnerships (Suspended)" section.`);
    } else if (isPtoOfficerPPO) {
      toast.info(`Partnership suspended. PPO ${ptoOfficerData?.full_name} is on PTO. ${workingOfficerData?.full_name} will return to regular schedule.`);
    } else {
      toast.info(`Partnership suspended. ${ptoOfficerData?.full_name} is on PTO. ${workingOfficerData?.full_name} will return to regular schedule.`);
    }
  };

  // Only restore credit if PTO balances are enabled
  const restorePTOCredit = async (existingPTO: any) => {
    if (!ptoBalancesEnabled) {
      console.log("PTO balances disabled, skipping balance restoration");
      return;
    }

    const ptoType = existingPTO.ptoType;
    const startTime = existingPTO.startTime;
    const endTime = existingPTO.endTime;
    const hoursUsed = calculateHours(startTime, endTime);

    const ptoColumn = PTO_TYPES.find((t) => t.value === ptoType)?.column;
    if (ptoColumn) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", officer!.officerId)
        .single();

      if (profileError) throw profileError;

      const currentBalance = profile[ptoColumn as keyof typeof profile] as number;
      
      const { error: restoreError } = await supabase
        .from("profiles")
        .update({
          [ptoColumn]: currentBalance + hoursUsed,
        })
        .eq("id", officer!.officerId);

      if (restoreError) throw restoreError;
    }
  };

  const assignPTOMutation = useMutation({
    mutationFn: async () => {
      if (!officer || !shift) throw new Error("Officer or shift not available");

      const ptoStartTime = isFullShift ? shift.start_time : startTime;
      const ptoEndTime = isFullShift ? shift.end_time : endTime;
      const hoursUsed = calculateHours(ptoStartTime, ptoEndTime);

      // Determine which officer gets PTO
      let officerGettingPTO = officer.officerId;
      let partnerId = partnerInfo?.id;
      
      if (officerHasPartnership && partnerInfo) {
        if (ptoAssignedTo === "partner") {
          // The partner is getting PTO instead
          officerGettingPTO = partnerInfo.id;
          partnerId = officer.officerId;
        }
        
        console.log(`⚠️ Suspending partnership for PTO assignment to ${ptoAssignedTo === "partner" ? partnerInfo.full_name : officer.name}...`);
        await suspendPartnershipForPTO(officerGettingPTO, partnerId);
      }

      // 1. If editing existing PTO, first restore the previous PTO balance (if balances enabled)
      // and delete ALL related schedule exceptions for this officer on this date/shift
      if (officer.existingPTO) {
        if (ptoBalancesEnabled) {
          await restorePTOCredit(officer.existingPTO);
        }
        
        // Delete ALL schedule exceptions for this officer on this date/shift
        // This cleans up any duplicates or partial shift records
        const { error: deleteError } = await supabase
          .from("schedule_exceptions")
          .delete()
          .eq("officer_id", officer.officerId)
          .eq("date", date)
          .eq("shift_type_id", shift.id);

        if (deleteError) throw deleteError;
        console.log(`✅ Deleted all existing schedule exceptions for officer ${officer.officerId}`);
      }

      // 2. ONLY CHECK BALANCES IF PTO BALANCES ARE ENABLED
      if (ptoBalancesEnabled) {
        // Get current PTO balance for the new PTO type
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", officerGettingPTO)
          .single();

        if (profileError) throw profileError;

        const ptoColumn = PTO_TYPES.find((t) => t.value === ptoType)?.column;
        if (!ptoColumn) throw new Error("Invalid PTO type");

        const currentBalance = profile[ptoColumn as keyof typeof profile] as number;
        if (currentBalance < hoursUsed) {
          throw new Error(`Insufficient ${ptoType} balance. Available: ${currentBalance} hours`);
        }

        // Deduct PTO from balance
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            [ptoColumn]: currentBalance - hoursUsed,
          })
          .eq("id", officerGettingPTO);

        if (updateError) throw updateError;
      }

      // 3. Create PTO exception - ONLY ONE RECORD
      const ptoRecordData = {
        officer_id: officerGettingPTO,
        date: date,
        shift_type_id: shift.id,
        is_off: true,
        reason: ptoType,
        custom_start_time: isFullShift ? null : ptoStartTime,
        custom_end_time: isFullShift ? null : ptoEndTime,
        partnership_suspended: officerHasPartnership,
        partnership_suspension_reason: officerHasPartnership ? `${ptoType} - Partner unavailable` : null,
        partner_officer_id: officerHasPartnership ? partnerId : null,
        schedule_type: "pto",
        hours_worked: hoursUsed,
        is_partial_shift: !isFullShift,
        notes: officerHasPartnership && ((ptoAssignedTo === "clickedOfficer" && isPartnerPPO) || (ptoAssignedTo === "partner" && isOfficerPPO)) ? 
               `PPO on PTO - Partner ${ptoAssignedTo === "clickedOfficer" ? partnerInfo?.full_name : officer.name} available for emergency assignment` : 
               null
      };

      const { error: ptoError } = await supabase
        .from("schedule_exceptions")
        .insert(ptoRecordData);

      if (ptoError) throw ptoError;
      console.log(`✅ Created PTO record for officer ${officerGettingPTO}`);

      // 4. Return data for audit logging
      return {
        officerId: officerGettingPTO,
        officerName: ptoAssignedTo === "partner" ? partnerInfo.full_name : officer.name,
        ptoType,
        date,
        startTime: ptoStartTime,
        endTime: ptoEndTime,
        hoursUsed,
        isFullShift,
        shiftName: shift.name,
        hadPartnership: officerHasPartnership,
        partnerName: ptoAssignedTo === "partner" ? officer.name : partnerInfo?.full_name,
        partnerId: partnerId,
        ptoAssignedTo,
        balancesEnabled: ptoBalancesEnabled
      };
    },
    onSuccess: (ptoData) => {
      let successMessage = officer?.existingPTO ? "PTO updated successfully" : "PTO assigned successfully";
      
      if (ptoData.hadPartnership) {
        if (ptoData.partnerName && isPPO(officer.rank)) {
          successMessage += `. PPO ${ptoData.partnerName}'s partnership is suspended and they can be assigned an emergency partner for today.`;
        } else if (ptoData.officerName && isPPO(partnerInfo?.rank)) {
          successMessage += `. ${ptoData.partnerName} is available for reassignment while PPO ${officer?.name} is on PTO.`;
        } else {
          successMessage += `. Partnership with ${ptoData.partnerName} has been suspended.`;
        }
      }
      
      if (!ptoData.balancesEnabled) {
        successMessage += " (Unlimited PTO - no balance deducted)";
      }
      
      toast.success(successMessage);
      
      // Log the PTO assignment
      auditLogger.logPTOAssignment(
        ptoData.officerId,
        ptoData.ptoType,
        ptoData.date,
        ptoData.hoursUsed,
        userEmail,
        `${officer?.existingPTO ? 'Updated' : 'Assigned'} ${ptoData.ptoType} PTO to ${ptoData.officerName} on ${ptoData.date} (${ptoData.hoursUsed} hours)` +
        (ptoData.hadPartnership ? ` - Partnership with ${ptoData.partnerName} suspended` : '') +
        (ptoData.partnerName && isPPO(officer.rank) ? ' - PPO partner available for emergency assignment' : '') +
        (!ptoData.balancesEnabled ? ' - Unlimited PTO mode' : '')
      );

      // Call the onSuccess callback if provided
      if (onSuccess) {
        onSuccess(ptoData);
      }

      queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-schedule"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to assign PTO");
    },
  });

  const removePTOMutation = useMutation({
    mutationFn: async () => {
      if (!officer?.existingPTO) return;

      // UPDATED: Only restore credit if PTO balances are enabled
      if (ptoBalancesEnabled) {
        await restorePTOCredit(officer.existingPTO);
      }

      // Delete ALL schedule exceptions for this officer on this date/shift
      // This cleans up the PTO record and any potential duplicates
      const { error: deleteError } = await supabase
        .from("schedule_exceptions")
        .delete()
        .eq("officer_id", officer.officerId)
        .eq("date", date)
        .eq("shift_type_id", shift!.id);

      if (deleteError) throw deleteError;
      console.log(`✅ Deleted all schedule exceptions for officer ${officer.officerId}`);

      // Check for partner's suspended partnership record
      const { data: partnerSuspendedRecord } = await supabase
        .from("schedule_exceptions")
        .select(`
          id,
          officer_id,
          partnership_suspended,
          partnership_suspension_reason,
          partner_officer_id,
          notes,
          is_emergency_partnership,
          profiles:officer_id (
            full_name,
            rank
          )
        `)
        .eq("date", date)
        .eq("shift_type_id", shift!.id)
        .eq("partnership_suspended", true)
        .eq("partner_officer_id", officer.officerId)
        .single();

      console.log("Found partner's suspended partnership record:", partnerSuspendedRecord);

      let partnerName = "";
      let partnerIsPPO = false;
      let restoredPartnership = false;

      if (partnerSuspendedRecord) {
        partnerName = partnerSuspendedRecord.profiles?.full_name || "Partner";
        partnerIsPPO = isPPO(partnerSuspendedRecord.profiles?.rank);
        
        // Check if partner has an emergency assignment by looking at schedule_type
        const hasEmergencyAssignment = partnerSuspendedRecord.is_emergency_partnership || 
                                       (partnerSuspendedRecord.notes && 
                                        partnerSuspendedRecord.notes.includes('[EMERGENCY_ASSIGNMENT]'));

        if (hasEmergencyAssignment) {
          console.log("Partner has emergency assignment, keeping partnership suspended");
          // Partner has emergency assignment, keep partnership suspended
          // Just update the suspension reason
          await supabase
            .from("schedule_exceptions")
            .update({
              partnership_suspension_reason: "Original partner returned but emergency assignment active"
            })
            .eq("id", partnerSuspendedRecord.id);
        } else {
          console.log("No emergency assignment, restoring partnership");
          // Restore the partnership for partner by removing the suspended record
          await supabase
            .from("schedule_exceptions")
            .delete()
            .eq("id", partnerSuspendedRecord.id);
          
          restoredPartnership = true;

          // Log partnership restoration
          await supabase
            .from("partnership_exceptions")
            .update({
              resolved_at: new Date().toISOString(),
              resolved_by: officer.officerId
            })
            .eq("officer_id", officer.officerId)
            .eq("partner_officer_id", partnerSuspendedRecord.officer_id)
            .eq("date", date)
            .eq("exception_type", 'pto_suspension');
        }
      }

      // Return data for audit logging
      return {
        officerId: officer.officerId,
        officerName: officer.name,
        ptoType: officer.existingPTO.ptoType,
        date,
        hoursUsed: calculateHours(officer.existingPTO.startTime, officer.existingPTO.endTime),
        restoredPartnership,
        partnerName,
        partnerIsPPO,
        officerIsPPO: isOfficerPPO,
        balancesEnabled: ptoBalancesEnabled
      };
    },
    onSuccess: (ptoData) => {
      let successMessage = "PTO removed successfully";
      
      if (ptoData.restoredPartnership) {
        if (ptoData.partnerIsPPO) {
          successMessage += `. Partnership with PPO ${ptoData.partnerName} has been restored.`;
        } else {
          successMessage += `. Partnership with ${ptoData.partnerName} has been restored.`;
        }
      }
      
      if (ptoData.balancesEnabled) {
        successMessage += ` ${ptoData.hoursUsed} hours restored to balance.`;
      } else {
        successMessage += " (Unlimited PTO mode - no balance affected)";
      }
      
      toast.success(successMessage);
      
      // Log the PTO removal
      auditLogger.logPTORemoval(
        ptoData.officerId,
        ptoData.ptoType,
        ptoData.date,
        userEmail,
        `Removed ${ptoData.ptoType} PTO from ${ptoData.officerName} on ${ptoData.date}` +
        (ptoData.balancesEnabled ? ` (${ptoData.hoursUsed} hours restored)` : '') +
        (ptoData.restoredPartnership ? ` - Partnership with ${ptoData.partnerName} restored` : '')
      );

      queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-schedule"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove PTO");
    },
  });

  // Don't render the dialog content if officer or shift is null
  if (!officer || !shift) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {officer.existingPTO ? "Edit PTO" : "Assign PTO"}
            {!ptoBalancesEnabled && (
              <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                Unlimited PTO
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {officer.existingPTO 
              ? `Edit PTO for ${officer.name} on ${shift.name}`
              : `Assign PTO for ${officer.name} on ${shift.name}`
            }
            {!ptoBalancesEnabled && " - Unlimited PTO mode"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Partnership Selection */}
          {officerHasPartnership && partnerInfo && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Partnership Detected
              </h4>
              <p className="text-sm text-blue-700 mb-3">
                This officer is partnered with <span className="font-semibold">{partnerInfo.full_name}</span>.
              </p>
              
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-blue-800">Select Officer for PTO:</h5>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="ptoClickedOfficer"
                    name="ptoOfficer"
                    value="clickedOfficer"
                    checked={ptoAssignedTo === "clickedOfficer"}
                    onChange={(e) => setPtoAssignedTo(e.target.value as any)}
                  />
                  <Label htmlFor="ptoClickedOfficer" className="cursor-pointer">
                    {officer.name} {isOfficerPPO && (
                      <Badge className="ml-2 bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">
                        PPO
                      </Badge>
                    )}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="ptoPartner"
                    name="ptoOfficer"
                    value="partner"
                    checked={ptoAssignedTo === "partner"}
                    onChange={(e) => setPtoAssignedTo(e.target.value as any)}
                  />
                  <Label htmlFor="ptoPartner" className="cursor-pointer">
                    {partnerInfo.full_name} {isPartnerPPO && (
                      <Badge className="ml-2 bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">
                        PPO
                      </Badge>
                    )}
                  </Label>
                </div>
              </div>
              
              {isPartnerPPO && ptoAssignedTo === "clickedOfficer" && (
                <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800 font-medium">⚠️ PPO Partner Notice:</p>
                  <p className="text-sm text-yellow-700">
                    Assigning PTO to {officer.name} will suspend partnership. PPO {partnerInfo.full_name} will need an emergency partner.
                  </p>
                </div>
              )}
              
              {isOfficerPPO && ptoAssignedTo === "partner" && (
                <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800 font-medium">⚠️ PPO Officer Notice:</p>
                  <p className="text-sm text-yellow-700">
                    Assigning PTO to {partnerInfo.full_name} will suspend partnership. PPO {officer.name} will need an emergency partner.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Unlimited PTO Notice */}
          {!ptoBalancesEnabled && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center gap-2">
                <span className="text-green-600 font-medium">Unlimited PTO Mode</span>
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                  No Balance Tracking
                </Badge>
              </div>
              <p className="text-sm text-green-700 mt-1">
                PTO balances are disabled. Hours will not be deducted from or restored to officer balances.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>PTO Type</Label>
            <Select value={ptoType} onValueChange={setPtoType}>
              <SelectTrigger>
                <SelectValue placeholder="Select PTO type" />
              </SelectTrigger>
              <SelectContent>
                {PTO_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="fullShift"
              checked={isFullShift}
              onCheckedChange={(checked) => {
                setIsFullShift(checked === true);
                if (checked) {
                  setStartTime(shift.start_time);
                  setEndTime(shift.end_time);
                }
              }}
            />
            <Label htmlFor="fullShift" className="cursor-pointer">
              Full shift ({shift.start_time} - {shift.end_time})
            </Label>
          </div>

          {!isFullShift && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>PTO Start Time</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>PTO End Time</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {ptoType && (
            <div className="text-sm text-muted-foreground p-2 bg-gray-50 rounded">
              Hours: {calculateHours(
                isFullShift ? shift.start_time : startTime,
                isFullShift ? shift.end_time : endTime
              ).toFixed(2)}
              {ptoBalancesEnabled && ` (will be deducted from balance)`}
              {!ptoBalancesEnabled && ` (no balance deduction)`}
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {officer.existingPTO && (
              <Button
                variant="destructive"
                onClick={() => removePTOMutation.mutate()}
                disabled={removePTOMutation.isPending}
              >
                {removePTOMutation.isPending ? "Removing..." : "Remove PTO"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => assignPTOMutation.mutate()}
              disabled={!ptoType || assignPTOMutation.isPending}
              className={officerHasPartnership ? "bg-blue-600 hover:bg-blue-700" : ""}
            >
              {assignPTOMutation.isPending 
                ? (officer.existingPTO ? "Updating..." : "Assigning...")
                : (officer.existingPTO ? "Update PTO" : "Assign PTO")
              }
              {officerHasPartnership && !assignPTOMutation.isPending && " & Suspend Partnership"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
