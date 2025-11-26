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
import { auditLogger } from "@/lib/auditLogger"; // ADD THIS IMPORT
import { useUser } from "@/contexts/UserContext"; // ADD THIS IMPORT

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
  onSuccess?: (ptoData: any) => void; // ADD THIS PROP
}

const PTO_TYPES = [
  { value: "vacation", label: "Vacation", column: "vacation_hours" },
  { value: "sick", label: "Sick Leave", column: "sick_hours" },
  { value: "comp", label: "Comp Time", column: "comp_hours" },
  { value: "holiday", label: "Holiday", column: "holiday_hours" },
];

export const PTOAssignmentDialog = ({
  open,
  onOpenChange,
  officer,
  shift,
  date,
  ptoBalancesEnabled = true,
  onSuccess // ADD THIS PROP
}: PTOAssignmentDialogProps) => {
  const queryClient = useQueryClient();
  const { userEmail } = useUser(); // ADD THIS HOOK
  const [ptoType, setPtoType] = useState("");
  const [isFullShift, setIsFullShift] = useState(true);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

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

  const restorePTOCredit = async (existingPTO: any) => {
    if (!ptoBalancesEnabled) return;

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

      // If editing existing PTO, first restore the previous PTO balance
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

      // ONLY CHECK BALANCES IF PTO BALANCES ARE ENABLED
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

      // Create PTO exception (this should always happen regardless of balance settings)
      const { error: ptoError } = await supabase.from("schedule_exceptions").insert({
        officer_id: officer.officerId,
        date: date,
        shift_type_id: shift.id,
        is_off: true,
        reason: ptoType,
        custom_start_time: isFullShift ? null : ptoStartTime,
        custom_end_time: isFullShift ? null : ptoEndTime,
      });

      if (ptoError) throw ptoError;

      // If partial shift, create working time exception for the remaining time
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
          });

          if (workError) throw workError;
        }
      }

      // Return data for audit logging
      return {
        officerId: officer.officerId,
        officerName: officer.name,
        ptoType,
        date,
        startTime: ptoStartTime,
        endTime: ptoEndTime,
        hoursUsed,
        isFullShift,
        shiftName: shift.name
      };
    },
    onSuccess: (ptoData) => {
      toast.success(officer?.existingPTO ? "PTO updated successfully" : "PTO assigned successfully");
      
      // Log the PTO assignment
      auditLogger.logPTOAssignment(
        ptoData.officerId,
        ptoData.ptoType,
        ptoData.date,
        ptoData.hoursUsed,
        userEmail,
        `${officer?.existingPTO ? 'Updated' : 'Assigned'} ${ptoData.ptoType} PTO to ${ptoData.officerName} on ${ptoData.date} (${ptoData.hoursUsed} hours)`
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

      await restorePTOCredit(officer.existingPTO);

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

      // Return data for audit logging
      return {
        officerId: officer.officerId,
        officerName: officer.name,
        ptoType: officer.existingPTO.ptoType,
        date,
        hoursUsed: calculateHours(officer.existingPTO.startTime, officer.existingPTO.endTime)
      };
    },
    onSuccess: (ptoData) => {
      toast.success("PTO removed and balance restored");
      
      // Log the PTO removal
      auditLogger.logPTORemoval(
        ptoData.officerId,
        ptoData.ptoType,
        ptoData.date,
        userEmail,
        `Removed ${ptoData.ptoType} PTO from ${ptoData.officerName} on ${ptoData.date} (${ptoData.hoursUsed} hours restored)`
      );

      queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-schedule"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove PTO");
    },
  });

  // Remove the duplicate audit logging line that was outside the mutation
  // (The one that said: "After successful PTO assignment")

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
          </DialogTitle>
          <DialogDescription>
            {officer.existingPTO 
              ? `Edit PTO for ${officer.name} on ${shift.name}`
              : `Assign PTO for ${officer.name} on ${shift.name}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
              Hours to {officer.existingPTO ? 'update' : 'deduct'}: {calculateHours(
                isFullShift ? shift.start_time : startTime,
                isFullShift ? shift.end_time : endTime
              ).toFixed(2)}
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
            >
              {assignPTOMutation.isPending 
                ? (officer.existingPTO ? "Updating..." : "Assigning...")
                : (officer.existingPTO ? "Update PTO" : "Assign PTO")
              }
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
