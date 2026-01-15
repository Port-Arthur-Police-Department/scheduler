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
  ptoBalancesEnabled = false, // Default to false (indefinite PTO)
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

  // Check for partnerships when dialog opens
  useEffect(() => {
    const checkPartnership = async () => {
      if (open && officer && shift) {
        console.log("🔍 Checking for partnerships for officer:", officer.officerId);
        
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
          } else {
            setOfficerHasPartnership(false);
            setPartnerInfo(null);
          }
        }
      } else {
        setOfficerHasPartnership(false);
        setPartnerInfo(null);
      }
    };

    if (open && officer && shift) {
      checkPartnership();
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

  console.log(`🔄 Suspending partnership: ${officerId} with ${partnerId} for PTO`);

  try {
    // Get officer's name for logging
    const { data: officerData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", officerId)
      .single();

    // Get partner's name for logging
    const { data: partnerData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", partnerId)
      .single();

    // 1. Check for existing schedule exceptions for both officers
    const { data: officerException } = await supabase
      .from("schedule_exceptions")
      .select("id, is_partnership")
      .eq("officer_id", officerId)
      .eq("date", date)
      .eq("shift_type_id", shift!.id)
      .single();

    const { data: partnerException } = await supabase
      .from("schedule_exceptions")
      .select("id, is_partnership")
      .eq("officer_id", partnerId)
      .eq("date", date)
      .eq("shift_type_id", shift!.id)
      .single();

    // 2. Update or create schedule exceptions with suspended partnership - ONLY FOR PARTNER
    const updates = [];

    // Officer's record - DO NOT create here, will be created by main PTO assignment
    if (officerException) {
      // If officer already has an exception, update it to mark partnership suspended
      updates.push(
        supabase
          .from("schedule_exceptions")
          .update({
            is_partnership: false,
            partnership_suspended: true,
            partnership_suspension_reason: ptoType,
            partner_officer_id: partnerId // Keep for tracking
          })
          .eq("id", officerException.id)
      );
    }
    // NOTE: We DON'T create a new exception for the officer here
    // The main PTO assignment will handle that

    // Partner's record - they should still be working
    if (partnerException) {
      updates.push(
        supabase
          .from("schedule_exceptions")
          .update({
            is_partnership: false,
            partnership_suspended: true,
            partnership_suspension_reason: ptoType,
            partner_officer_id: officerId // Keep for tracking
          })
          .eq("id", partnerException.id)
      );
    } else {
      // Create a new exception for the partner (still working but partnership suspended)
      updates.push(
        supabase
          .from("schedule_exceptions")
          .insert({
            officer_id: partnerId,
            date: date,
            shift_type_id: shift!.id,
            is_off: false,
            is_partnership: false,
            partnership_suspended: true,
            partnership_suspension_reason: ptoType,
            partner_officer_id: officerId,
            schedule_type: "working_partner_suspended"
          })
      );
    }

    // 3. Execute all updates
    const results = await Promise.all(updates);
    results.forEach((result, index) => {
      if (result.error) {
        console.error(`Error updating record ${index}:`, result.error);
      }
    });

    // 4. Log the partnership suspension
    await supabase
      .from("partnership_exceptions")
      .insert({
        officer_id: officerId,
        partner_officer_id: partnerId,
        date: date,
        shift_type_id: shift!.id,
        reason: `Officer on ${ptoType} leave`,
        exception_type: 'pto_suspension',
        created_at: new Date().toISOString()
      });

    console.log(`✅ Partnership suspended: ${officerData?.full_name} ↔ ${partnerData?.full_name}`);
    console.log(`ℹ️ ${partnerData?.full_name} is now available for emergency reassignment.`);

  } catch (error) {
    console.error("Error suspending partnership:", error);
    toast.error("Failed to suspend partnership, but will continue with PTO assignment.");
  }
};

  // UPDATED: Only restore credit if PTO balances are enabled
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

const suspendPartnershipForPTO = async (officerId: string, partnerId: string | null) => {
  if (!partnerId) {
    console.log("No partner to suspend");
    return;
  }

  console.log(`🔄 Suspending partnership: ${officerId} with ${partnerId} for PTO`);

  try {
    // Get officer's name for logging
    const { data: officerData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", officerId)
      .single();

    // Get partner's name for logging
    const { data: partnerData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", partnerId)
      .single();

    // 1. Check for existing schedule exceptions for both officers
    const { data: officerException } = await supabase
      .from("schedule_exceptions")
      .select("id, is_partnership")
      .eq("officer_id", officerId)
      .eq("date", date)
      .eq("shift_type_id", shift!.id)
      .single();

    const { data: partnerException } = await supabase
      .from("schedule_exceptions")
      .select("id, is_partnership")
      .eq("officer_id", partnerId)
      .eq("date", date)
      .eq("shift_type_id", shift!.id)
      .single();

    // 2. Update or create schedule exceptions with suspended partnership - ONLY FOR PARTNER
    const updates = [];

    // Officer's record - DO NOT create here, will be created by main PTO assignment
    if (officerException) {
      // If officer already has an exception, update it to mark partnership suspended
      updates.push(
        supabase
          .from("schedule_exceptions")
          .update({
            is_partnership: false,
            partnership_suspended: true,
            partnership_suspension_reason: ptoType,
            partner_officer_id: partnerId // Keep for tracking
          })
          .eq("id", officerException.id)
      );
    }
    // NOTE: We DON'T create a new exception for the officer here
    // The main PTO assignment will handle that

    // Partner's record - they should still be working
    if (partnerException) {
      updates.push(
        supabase
          .from("schedule_exceptions")
          .update({
            is_partnership: false,
            partnership_suspended: true,
            partnership_suspension_reason: ptoType,
            partner_officer_id: officerId // Keep for tracking
          })
          .eq("id", partnerException.id)
      );
    } else {
      // Create a new exception for the partner (still working but partnership suspended)
      updates.push(
        supabase
          .from("schedule_exceptions")
          .insert({
            officer_id: partnerId,
            date: date,
            shift_type_id: shift!.id,
            is_off: false,
            is_partnership: false,
            partnership_suspended: true,
            partnership_suspension_reason: ptoType,
            partner_officer_id: officerId,
            schedule_type: "working_partner_suspended"
          })
      );
    }

    // 3. Execute all updates
    const results = await Promise.all(updates);
    results.forEach((result, index) => {
      if (result.error) {
        console.error(`Error updating record ${index}:`, result.error);
      }
    });

    // 4. Log the partnership suspension
    await supabase
      .from("partnership_exceptions")
      .insert({
        officer_id: officerId,
        partner_officer_id: partnerId,
        date: date,
        shift_type_id: shift!.id,
        reason: `Officer on ${ptoType} leave`,
        exception_type: 'pto_suspension',
        created_at: new Date().toISOString()
      });

    console.log(`✅ Partnership suspended: ${officerData?.full_name} ↔ ${partnerData?.full_name}`);
    console.log(`ℹ️ ${partnerData?.full_name} is now available for emergency reassignment.`);

  } catch (error) {
    console.error("Error suspending partnership:", error);
    toast.error("Failed to suspend partnership, but will continue with PTO assignment.");
  }
};
Now, update the assignPTOMutation to properly handle the officer's PTO record with partnership suspension flags:

typescript
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
    if (officer.existingPTO && ptoBalancesEnabled) {
      await restorePTOCredit(officer.existingPTO);
      
      // Delete the existing PTO exception
      const { error: deleteError } = await supabase
        .from("schedule_exceptions")
        .delete()
        .eq("id", officer.existingPTO.id);

      if (deleteError) throw deleteError;

      // Also delete any associated working time exception for partial shifts
      await supabase
        .from("schedule_exceptions")
        .delete()
        .eq("officer_id", officer.officerId)
        .eq("date", date)
        .eq("shift_type_id", shift.id)
        .eq("is_off", false);
    }

    // 3. Check if officer already has a schedule exception (created by partnership suspension)
    const { data: existingOfficerException } = await supabase
      .from("schedule_exceptions")
      .select("id")
      .eq("officer_id", officer.officerId)
      .eq("date", date)
      .eq("shift_type_id", shift.id)
      .single();

    // 4. ONLY CHECK BALANCES IF PTO BALANCES ARE ENABLED
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

    // 5. Create or update PTO exception
    if (existingOfficerException) {
      // Update existing exception to add PTO details
      const { error: ptoError } = await supabase
        .from("schedule_exceptions")
        .update({
          is_off: true,
          reason: ptoType,
          custom_start_time: isFullShift ? null : ptoStartTime,
          custom_end_time: isFullShift ? null : ptoEndTime,
          partnership_suspended: officerHasPartnership,
          partnership_suspension_reason: officerHasPartnership ? ptoType : null,
          partner_officer_id: officerHasPartnership ? partnerInfo?.id : null
        })
        .eq("id", existingOfficerException.id);

      if (ptoError) throw ptoError;
    } else {
      // Create new PTO exception
      const { error: ptoError } = await supabase.from("schedule_exceptions").insert({
        officer_id: officer.officerId,
        date: date,
        shift_type_id: shift.id,
        is_off: true,
        reason: ptoType,
        custom_start_time: isFullShift ? null : ptoStartTime,
        custom_end_time: isFullShift ? null : ptoEndTime,
        partnership_suspended: officerHasPartnership,
        partnership_suspension_reason: officerHasPartnership ? ptoType : null,
        partner_officer_id: officerHasPartnership ? partnerInfo?.id : null
      });

      if (ptoError) throw ptoError;
    }

    // 6. If partial shift, create working time exception for the remaining time
    if (!isFullShift) {
      // Calculate the working portion (the part that's NOT PTO)
      const workStartTime = ptoEndTime;
      const workEndTime = shift.end_time;

      if (workStartTime !== workEndTime) {
        // Get the current position name from the original schedule
        let positionName = "";
        
        if (officer.type === "recurring") {
          const { data: recurringData } = await supabase
            .from("recurring_schedules")
            .select("position_name")
            .eq("id", officer.scheduleId)
            .single();
          positionName = recurringData?.position_name || "";
        } else {
          const { data: exceptionData } = await supabase
            .from("schedule_exceptions")
            .select("position_name")
            .eq("id", officer.scheduleId)
            .single();
          positionName = exceptionData?.position_name || "";
        }

        const { error: workError } = await supabase.from("schedule_exceptions").insert({
          officer_id: officer.officerId,
          date: date,
          shift_type_id: shift.id,
          is_off: false,
          position_name: positionName,
          custom_start_time: workStartTime,
          custom_end_time: workEndTime,
          partnership_suspended: officerHasPartnership,
          partnership_suspension_reason: officerHasPartnership ? ptoType : null,
          partner_officer_id: officerHasPartnership ? partnerInfo?.id : null
        });

        if (workError) throw workError;
      }
    }

    // 7. Return data for audit logging
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
      balancesEnabled: ptoBalancesEnabled
      };
    },
    onSuccess: (ptoData) => {
      let successMessage = officer?.existingPTO ? "PTO updated successfully" : "PTO assigned successfully";
      
      if (ptoData.hadPartnership) {
        successMessage += `. Partnership with ${ptoData.partnerName} has been suspended.`;
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

      // Delete the PTO exception
      const { error: deleteError } = await supabase
        .from("schedule_exceptions")
        .delete()
        .eq("id", officer.existingPTO.id);

      if (deleteError) throw deleteError;

      // Also delete any associated working time exception
      await supabase
        .from("schedule_exceptions")
        .delete()
        .eq("officer_id", officer.officerId)
        .eq("date", date)
        .eq("shift_type_id", shift!.id)
        .eq("is_off", false);

      // Check if we should restore the partnership
      const { data: suspendedPartnership } = await supabase
        .from("schedule_exceptions")
        .select(`
          id,
          partner_officer_id,
          partnership_suspended,
          partner_profile:profiles!schedule_exceptions_partner_officer_id_fkey (
            id,
            full_name
          )
        `)
        .eq("officer_id", officer.officerId)
        .eq("date", date)
        .eq("shift_type_id", shift!.id)
        .eq("partnership_suspended", true)
        .single();

      if (suspendedPartnership?.partnership_suspended && suspendedPartnership.partner_officer_id) {
        console.log("🔄 Restoring suspended partnership...");
        
        // Restore the partnership
        await supabase
          .from("schedule_exceptions")
          .update({
            is_partnership: true,
            partnership_suspended: false,
            partnership_suspension_reason: null
          })
          .eq("officer_id", officer.officerId)
          .eq("date", date)
          .eq("shift_type_id", shift!.id);

        // Also restore partner's record
        await supabase
          .from("schedule_exceptions")
          .update({
            is_partnership: true,
            partnership_suspended: false,
            partnership_suspension_reason: null
          })
          .eq("officer_id", suspendedPartnership.partner_officer_id)
          .eq("date", date)
          .eq("shift_type_id", shift!.id);

        // Log partnership restoration
        await supabase
          .from("partnership_exceptions")
          .update({
            resolved_at: new Date().toISOString(),
            resolved_by: officer.officerId
          })
          .eq("officer_id", officer.officerId)
          .eq("partner_officer_id", suspendedPartnership.partner_officer_id)
          .eq("date", date)
          .eq("exception_type", 'pto_suspension');
      }

      // Return data for audit logging
      return {
        officerId: officer.officerId,
        officerName: officer.name,
        ptoType: officer.existingPTO.ptoType,
        date,
        hoursUsed: calculateHours(officer.existingPTO.startTime, officer.existingPTO.endTime),
        restoredPartnership: !!suspendedPartnership,
        partnerName: suspendedPartnership?.partner_profile?.full_name,
        balancesEnabled: ptoBalancesEnabled
      };
    },
    onSuccess: (ptoData) => {
      let successMessage = "PTO removed successfully";
      
      if (ptoData.restoredPartnership) {
        successMessage += `. Partnership with ${ptoData.partnerName} has been restored.`;
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
                    Assigning PTO will suspend the partnership and make {partnerInfo.full_name} available for emergency reassignment.
                  </p>
                  <div className="mt-2">
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                      Partner: {partnerInfo.full_name} ({partnerInfo.badge_number})
                    </Badge>
                    {isPPO(partnerInfo.rank) && (
                      <Badge variant="outline" className="ml-2 bg-yellow-100 text-yellow-800 border-yellow-300">
                        PPO
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
