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

// Helper function to check if officer is PPO
const isPPO = (rank: string | undefined | null): boolean => {
  if (!rank) return false;
  const rankLower = rank.toLowerCase();
  return rankLower.includes('probationary') || rankLower.includes('ppo');
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
    } else {
      // Reset form when dialog closes or no officer/shift
      setPtoType("");
      setIsFullShift(true);
      setStartTime("");
      setEndTime("");
    }
  }, [open, officer, shift]);

  const calculateHours = (start: string, end: string) => {
    const [startHour, startMin] = start.split(":").map(Number);
    const [endHour, endMin] = end.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return (endMinutes - startMinutes) / 60;
  };

  // Function to handle partnership suspension when officer goes on PTO
  const suspendPartnershipForPTO = async (officerId: string, partnerId: string | null) => {
    if (!partnerId) {
      console.log("No partner to suspend");
      return;
    }

    console.log(`🔄 Suspending partnership: ${officerId} with ${partnerId} for PTO`, {
      officerIsPPO: isOfficerPPO,
      partnerIsPPO: isPartnerPPO
    });

    try {
      // Get officer's name for logging
      const { data: officerData } = await supabase
        .from("profiles")
        .select("full_name, rank")
        .eq("id", officerId)
        .single();

      // Get partner's name for logging
      const { data: partnerData } = await supabase
        .from("profiles")
        .select("full_name, rank")
        .eq("id", partnerId)
        .single();

      // 1. Check for existing schedule exceptions for partner
      const { data: partnerException } = await supabase
        .from("schedule_exceptions")
        .select("id, is_partnership, position_name, unit_number, notes, is_off")
        .eq("officer_id", partnerId)
        .eq("date", date)
        .eq("shift_type_id", shift!.id)
        .single();

      // 2. Handle partner's record (still working but partnership suspended)
      // IMPORTANT: Only update if partner is NOT already on PTO
      if (partnerException && !partnerException.is_off) {
        // Update existing exception for partner
        await supabase
          .from("schedule_exceptions")
          .update({
            is_partnership: false,
            partnership_suspended: true,
            partnership_suspension_reason: `${officerData?.full_name || 'Partner'} on ${ptoType}`,
            partner_officer_id: officerId,
            schedule_type: "working_partner_suspended",
            // Store PPO info in notes for emergency assignment lookup
            notes: partnerException.notes || null,
          })
          .eq("id", partnerException.id);
        
        console.log(`✅ Updated partner's existing record for partnership suspension`);
      } else if (!partnerException) {
        // Get partner's recurring schedule details if no exception exists
        const dayOfWeek = new Date(date).getDay();
        const { data: partnerRecurring } = await supabase
          .from("recurring_schedules")
          .select("position_name, unit_number, notes")
          .eq("officer_id", partnerId)
          .eq("shift_type_id", shift!.id)
          .eq("day_of_week", dayOfWeek)
          .single();

        // Create new exception for partner (still working but partnership suspended)
        await supabase
          .from("schedule_exceptions")
          .insert({
            officer_id: partnerId,
            date: date,
            shift_type_id: shift!.id,
            is_off: false,
            is_partnership: false,
            partnership_suspended: true,
            partnership_suspension_reason: `${officerData?.full_name || 'Partner'} on ${ptoType}`,
            partner_officer_id: officerId,
            position_name: partnerRecurring?.position_name || "",
            unit_number: partnerRecurring?.unit_number || "",
            notes: partnerRecurring?.notes || "Partnership suspended - partner on PTO",
            schedule_type: "working_partner_suspended"
          });
        
        console.log(`✅ Created new record for partner's partnership suspension`);
      } else {
        console.log(`⚠️ Partner already has a PTO record, skipping partnership suspension update`);
      }

      // 3. Log the partnership suspension
      await supabase
        .from("partnership_exceptions")
        .insert({
          officer_id: officerId,
          partner_officer_id: partnerId,
          date: date,
          shift_type_id: shift!.id,
          reason: `Officer ${officerData?.full_name} on ${ptoType} leave`,
          exception_type: 'pto_suspension',
          created_at: new Date().toISOString(),
          is_ppo_partnership: isOfficerPPO || isPartnerPPO,
          can_emergency_reassign: isPartnerPPO
        });

      console.log(`✅ Partnership suspended: ${officerData?.full_name} ↔ ${partnerData?.full_name}`);
      
      // Show different messages based on who is the PPO
      if (isPartnerPPO) {
        console.log(`ℹ️ PPO ${partnerData?.full_name} is now available for emergency reassignment.`);
        toast.info(`Partnership suspended. PPO ${partnerData?.full_name} can now be assigned an emergency partner for today.`);
      } else if (isOfficerPPO) {
        console.log(`ℹ️ ${partnerData?.full_name} is available for reassignment while PPO ${officerData?.full_name} is on PTO.`);
        toast.info(`Partnership suspended. ${partnerData?.full_name} is available for reassignment.`);
      } else {
        console.log(`ℹ️ ${partnerData?.full_name} is now available for reassignment.`);
        toast.info(`Partnership suspended. ${partnerData?.full_name} is available for reassignment.`);
      }

    } catch (error) {
      console.error("Error suspending partnership:", error);
      toast.error("Failed to suspend partnership, but will continue with PTO assignment.");
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

      // 1. Handle partnership suspension BEFORE PTO assignment
      if (officerHasPartnership && partnerInfo) {
        console.log(`⚠️ Officer is in a partnership. Suspending partnership for PTO...`);
        await suspendPartnershipForPTO(officer.officerId, partnerInfo.id);
      }

      // 2. If editing existing PTO, first restore the previous PTO balance (if balances enabled)
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

      // 3. ONLY CHECK BALANCES IF PTO BALANCES ARE ENABLED
      if (ptoBalancesEnabled) {
        // Get current PTO balance for the new PTO type
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", officer.officerId)
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
          .eq("id", officer.officerId);

        if (updateError) throw updateError;
      }

      // 4. Create PTO exception - ONLY ONE RECORD
      const ptoRecordData = {
        officer_id: officer.officerId,
        date: date,
        shift_type_id: shift.id,
        is_off: true,
        reason: ptoType,
        custom_start_time: isFullShift ? null : ptoStartTime,
        custom_end_time: isFullShift ? null : ptoEndTime,
        partnership_suspended: officerHasPartnership,
        partnership_suspension_reason: officerHasPartnership ? `${ptoType} - Partner unavailable` : null,
        partner_officer_id: officerHasPartnership ? partnerInfo?.id : null,
        schedule_type: "pto",
        hours_worked: hoursUsed,
        is_partial_shift: !isFullShift,
        notes: officerHasPartnership && isOfficerPPO ? 
               `PPO on PTO - Partner ${partnerInfo?.full_name} available for emergency assignment` : 
               null
      };

      const { error: ptoError } = await supabase
        .from("schedule_exceptions")
        .insert(ptoRecordData);

      if (ptoError) throw ptoError;
      console.log(`✅ Created PTO record for officer ${officer.officerId}`);

      // 5. Return data for audit logging
      return {
        officerId: officer.officerId,
        officerName: officer.name,
        ptoType,
        date,
        startTime: ptoStartTime,
        endTime: ptoEndTime,
        hoursUsed,
        isFullShift,
        shiftName: shift.name,
        hadPartnership: officerHasPartnership,
        partnerName: partnerInfo?.full_name,
        partnerIsPPO: isPartnerPPO,
        officerIsPPO: isOfficerPPO,
        balancesEnabled: ptoBalancesEnabled
      };
    },
    onSuccess: (ptoData) => {
      let successMessage = officer?.existingPTO ? "PTO updated successfully" : "PTO assigned successfully";
      
      if (ptoData.hadPartnership) {
        if (ptoData.partnerIsPPO) {
          successMessage += `. PPO ${ptoData.partnerName}'s partnership is suspended and they can be assigned an emergency partner for today.`;
        } else if (ptoData.officerIsPPO) {
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
        (ptoData.partnerIsPPO ? ' - PPO partner available for emergency assignment' : '') +
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
          {/* Partnership Warning */}
          {officerHasPartnership && partnerInfo && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium text-amber-800 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Partnership Alert
                  </h4>
                  <p className="text-sm text-amber-700 mt-1">
                    This officer is partnered with <span className="font-semibold">{partnerInfo.full_name}</span>.
                  </p>
                  <p className="text-sm text-amber-700">
                    Assigning PTO will suspend the partnership for today.
                  </p>
                  {isPartnerPPO && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-sm text-yellow-800 font-medium">
                        ⚠️ PPO Partner Special Handling
                      </p>
                      <p className="text-sm text-yellow-700">
                        Since {partnerInfo.full_name} is a PPO, they can be temporarily assigned an emergency partner for today without breaking the original partnership.
                      </p>
                    </div>
                  )}
                  <div className="mt-2">
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                      Partner: {partnerInfo.full_name} ({partnerInfo.badge_number})
                    </Badge>
                    {isPartnerPPO && (
                      <Badge variant="outline" className="ml-2 bg-yellow-100 text-yellow-800 border-yellow-300">
                        PPO - Emergency Partner Available
                      </Badge>
                    )}
                    {isOfficerPPO && (
                      <Badge variant="outline" className="ml-2 bg-purple-100 text-purple-800 border-purple-300">
                        PPO on PTO
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
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
            <div className="text-sm text-muted-foreground">
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
              className={officerHasPartnership ? "bg-amber-600 hover:bg-amber-700" : ""}
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
