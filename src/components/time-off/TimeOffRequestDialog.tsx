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
import { Calendar as CalendarIcon, AlertCircle, Clock, MapPin, Building, Users } from "lucide-react";
import { format, differenceInDays, eachDayOfInterval, isWeekend, parseISO, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useWebsiteSettings } from "@/hooks/useWebsiteSettings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { sendPTORequestNotification } from "@/utils/notifications";

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
  const [affectedShifts, setAffectedShifts] = useState<any[]>([]);
  const [calculating, setCalculating] = useState(false);
  const queryClient = useQueryClient();

  // Add website settings hook
  const { data: settings } = useWebsiteSettings();

  // Fetch user's current PTO balances
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile-pto", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("vacation_hours, sick_hours, comp_hours, holiday_hours, full_name")
        .eq("id", userId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open && settings?.show_pto_balances,
  });

  // Fetch user's recurring schedules and shift types
  const { data: shiftTypes } = useQuery({
    queryKey: ["shift-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_types")
        .select("*")
        .order("start_time");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

// Fetch and calculate affected shifts when dates change or dialog opens
useEffect(() => {
  if (startDate && endDate && userId && shiftTypes) {
    fetchAffectedShifts();
  } else {
    setAffectedShifts([]);
    setHoursRequired(0);
  }
}, [startDate, endDate, userId, shiftTypes, open]); // Added 'open' to dependencies

// Function to fetch affected shifts
const fetchAffectedShifts = async () => {
  if (!startDate || !endDate || !userId || !shiftTypes) {
    setAffectedShifts([]);
    return;
  }
  
  setCalculating(true);
  try {
    // Get all days in the date range
    const days = eachDayOfInterval({ 
      start: startOfDay(startDate), 
      end: endOfDay(endDate) 
    });
    
    // Format dates for Supabase query
    const startDateStr = format(startDate, "yyyy-MM-dd");
    
    // Get officer's recurring schedules that are active during this period
    const { data: recurringSchedules, error: scheduleError } = await supabase
      .from("recurring_schedules")
      .select("day_of_week, shift_type_id, unit_number, position_name, start_date, end_date")
      .eq("officer_id", userId)
      .or(`end_date.is.null,end_date.gte.${startDateStr}`)
      .lte("start_date", format(endDate, "yyyy-MM-dd"));

    if (scheduleError) throw scheduleError;

    const affectedShiftsData: any[] = [];

    for (const day of days) {
      const dayOfWeek = day.getDay();
      const dateStr = format(day, "yyyy-MM-dd");
      const dayName = format(day, "EEEE");
      
      // Check if officer has a recurring schedule for this day
      const daySchedules = recurringSchedules?.filter(s => {
        // Check if schedule applies to this day of week
        if (s.day_of_week !== dayOfWeek) return false;
        
        // Check if schedule is active on this specific date
        const scheduleStart = new Date(s.start_date);
        const scheduleEnd = s.end_date ? new Date(s.end_date) : null;
        
        const currentDate = new Date(dateStr);
        
        // Schedule is active if current date is on or after start date
        // AND (no end date OR current date is on or before end date)
        return currentDate >= scheduleStart && 
               (!scheduleEnd || currentDate <= scheduleEnd);
      }) || [];
      
      for (const schedule of daySchedules) {
        const shift = shiftTypes.find(s => s.id === schedule.shift_type_id);
        if (shift) {
          affectedShiftsData.push({
            date: dateStr,
            dayName: dayName,
            shiftName: shift.name,
            shiftTime: `${shift.start_time} - ${shift.end_time}`,
            unitNumber: schedule.unit_number,
            positionName: schedule.position_name,
            hours: calculateShiftHours(shift.start_time, shift.end_time)
          });
        }
      }
    }

    setAffectedShifts(affectedShiftsData);
  } catch (error) {
    console.error("Error fetching affected shifts:", error);
    toast.error("Failed to load scheduled shifts");
  } finally {
    setCalculating(false);
  }
};

const calculateShiftHours = (start: string, end: string) => {
  const [startHour, startMin] = start.split(":").map(Number);
  const [endHour, endMin] = end.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return (endMinutes - startMinutes) / 60;
};

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

    // Use actual hours from affected shifts, or calculate if none found
    const actualHours = affectedShifts.length > 0 
      ? affectedShifts.reduce((sum, shift) => sum + shift.hours, 0)
      : (differenceInDays(endDate, startDate) + 1) * 8;

    // Validate PTO balance if balances are enabled
    if (settings?.show_pto_balances) {
      const currentBalance = getCurrentBalance();
      if (currentBalance < actualHours) {
        throw new Error(`Insufficient ${ptoType} hours. Required: ${actualHours.toFixed(1)}h, Available: ${currentBalance}h`);
      }
    }

    // Get affected shifts details for the request notes
    const affectedShiftDetails = affectedShifts.map(s => 
      `${s.date} (${s.dayName}): ${s.shiftName} ${s.shiftTime}`
    ).join('; ');

    // Insert the request
    const { data: request, error } = await supabase
      .from("time_off_requests")
      .insert({
        officer_id: userId,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        reason: reason || null,
        status: "pending",
        pto_type: ptoType,
        hours_used: actualHours,
        affected_shifts: affectedShifts.length > 0 ? affectedShiftDetails : null,
      })
      .select()
      .single();

    if (error) throw error;
    
    return request;
  },
  onSuccess: (request) => {
    queryClient.invalidateQueries({ queryKey: ["time-off-requests"] });
    toast.success("Time off request submitted");
    
    // Send notification for new request
    if (request?.id) {
      sendPTORequestNotification(request.id, userId, 'created');
    }
    
    onOpenChange(false);
    setStartDate(undefined);
    setEndDate(undefined);
    setReason("");
    setPtoType("vacation");
    setHoursRequired(0);
    setAffectedShifts([]);
  },
  onError: (error: Error) => {
    toast.error(error.message);
  },
});

  const currentBalance = getCurrentBalance();
  const canSubmit = hasSufficientBalance();
  const totalAffectedHours = affectedShifts.reduce((sum, shift) => sum + shift.hours, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

{/* Affected Shifts Display */}
{startDate && endDate && affectedShifts.length > 0 && (
  <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
    <h4 className="font-semibold text-sm flex items-center gap-2">
      <Users className="h-4 w-4" />
      Affected Scheduled Shifts ({affectedShifts.length})
    </h4>
    
    <div className="text-sm space-y-2">
      <div className="flex justify-between items-center">
        <span className="font-medium">Total Shifts Affected:</span>
        <span>{affectedShifts.length}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="font-medium">Total Hours Affected:</span>
        <span>{affectedShifts.reduce((sum, shift) => sum + shift.hours, 0).toFixed(1)} hours</span>
      </div>
    </div>
    
    <div className="mt-2 max-h-40 overflow-y-auto">
      <p className="font-medium mb-1 text-sm">Shift Details:</p>
      {affectedShifts.map((shift, index) => (
        <div key={index} className="text-xs p-2 border-b last:border-b-0">
          <div className="flex justify-between items-center mb-1">
            <span className="font-medium">{shift.dayName}, {format(new Date(shift.date), "MMM d")}</span>
            <Badge variant="outline" className="text-xs">
              {shift.shiftName}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{shift.shiftTime}</span>
            {shift.unitNumber && (
              <>
                <MapPin className="h-3 w-3 ml-2" />
                <span>{shift.unitNumber}</span>
              </>
            )}
            {shift.positionName && (
              <>
                <Building className="h-3 w-3 ml-2" />
                <span>{shift.positionName}</span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
    
    <p className="text-xs text-muted-foreground mt-2">
      These are your regularly scheduled shifts that will be affected by this time off request.
    </p>
  </div>
)}

{startDate && endDate && affectedShifts.length === 0 && !calculating && (
  <Alert className="bg-yellow-50 border-yellow-200">
    <AlertCircle className="h-4 w-4 text-yellow-600" />
    <AlertDescription className="text-yellow-800 text-sm">
      No regularly scheduled shifts found in this date range. Please verify your schedule.
    </AlertDescription>
  </Alert>
)}

{calculating && (
  <div className="text-center py-2">
    <p className="text-sm text-muted-foreground">Loading scheduled shifts...</p>
  </div>
)}

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
                PTO balances are currently managed as indefinite. Verify your balance in Executime before making a request.
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
            disabled={createRequestMutation.isPending || (settings?.show_pto_balances && !canSubmit) || calculating}
          >
            {createRequestMutation.isPending ? "Submitting..." : "Submit Request"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
