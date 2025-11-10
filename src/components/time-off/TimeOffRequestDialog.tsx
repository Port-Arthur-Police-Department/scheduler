import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, AlertCircle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useWebsiteSettings } from "@/hooks/useWebsiteSettings";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TimeOffRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export const TimeOffRequestDialog = ({ open, onOpenChange, userId }: TimeOffRequestDialogProps) => {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState("");
  const [ptoType, setPtoType] = useState<string>("vacation");
  const [hoursRequired, setHoursRequired] = useState<number>(0);
  const queryClient = useQueryClient();

  // Add website settings hook
  const { data: settings } = useWebsiteSettings();

  // Fetch user's current PTO balances
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile-pto", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("vacation_hours, sick_hours, comp_hours, holiday_hours")
        .eq("id", userId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open && settings?.show_pto_balances, // Only fetch if PTO is enabled and dialog is open
  });

  // Calculate hours required when dates change
  useEffect(() => {
    if (startDate && endDate && settings?.show_pto_balances) {
      const days = differenceInDays(endDate, startDate) + 1; // Inclusive of both dates
      const hours = days * 8; // Assuming 8-hour work days
      setHoursRequired(hours);
    } else {
      setHoursRequired(0);
    }
  }, [startDate, endDate, settings?.show_pto_balances]);

  // Get current balance for selected PTO type
  const getCurrentBalance = () => {
    if (!userProfile || !settings?.show_pto_balances) return 0;
    
    switch (ptoType) {
      case "vacation":
        return userProfile.vacation_hours || 0;
      case "sick":
        return userProfile.sick_hours || 0;
      case "comp":
        return userProfile.comp_hours || 0;
      case "holiday":
        return userProfile.holiday_hours || 0;
      default:
        return 0;
    }
  };

  const hasSufficientBalance = () => {
    // If PTO balances are disabled, always allow requests
    if (!settings?.show_pto_balances) return true;
    
    // If PTO balances are enabled, check if user has enough hours
    const currentBalance = getCurrentBalance();
    return currentBalance >= hoursRequired;
  };

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      if (!startDate || !endDate) {
        throw new Error("Please select start and end dates");
      }

      // Validate PTO balance if balances are enabled
      if (settings?.show_pto_balances && !hasSufficientBalance()) {
        const currentBalance = getCurrentBalance();
        throw new Error(`Insufficient ${ptoType} hours. Required: ${hoursRequired}h, Available: ${currentBalance}h`);
      }

      // Calculate hours used (for tracking purposes)
      const days = differenceInDays(endDate, startDate) + 1;
      const hoursUsed = days * 8;

      const { error } = await supabase.from("time_off_requests").insert({
        officer_id: userId,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        reason: reason || null,
        status: "pending",
        pto_type: ptoType,
        hours_used: hoursUsed,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-off-requests"] });
      toast.success("Time off request submitted");
      onOpenChange(false);
      setStartDate(undefined);
      setEndDate(undefined);
      setReason("");
      setPtoType("vacation");
      setHoursRequired(0);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const currentBalance = getCurrentBalance();
  const canSubmit = hasSufficientBalance();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Time Off</DialogTitle>
          <DialogDescription>
            Submit a request for time off. Your supervisor will review it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>PTO Type</Label>
            <Select value={ptoType} onValueChange={setPtoType}>
              <SelectTrigger>
                <SelectValue placeholder="Select PTO type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vacation">Vacation</SelectItem>
                <SelectItem value="sick">Sick</SelectItem>
                <SelectItem value="comp">Comp Time</SelectItem>
                <SelectItem value="holiday">Holiday</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* PTO Balance Information */}
          {settings?.show_pto_balances && startDate && endDate && (
            <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Hours Required:</span>
                <span className="text-sm">{hoursRequired}h</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Current Balance:</span>
                <span className="text-sm">{currentBalance}h</span>
              </div>
              {!canSubmit && (
                <Alert className="bg-red-50 border-red-200 mt-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800 text-sm">
                    Insufficient {ptoType} hours for this request
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {!settings?.show_pto_balances && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                PTO balances are currently managed as indefinite. All requests are allowed.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Textarea
              id="reason"
              placeholder="Brief description of your time off request"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          <Button
            className="w-full"
            onClick={() => createRequestMutation.mutate()}
            disabled={createRequestMutation.isPending || (settings?.show_pto_balances && !canSubmit)}
          >
            {createRequestMutation.isPending ? "Submitting..." : "Submit Request"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
