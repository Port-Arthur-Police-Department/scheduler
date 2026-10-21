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
import { isSupervisorByRank } from "@/components/schedule/the-book/utils";

interface TimeOffRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  isAdminOrSupervisor?: boolean;
}

export const TimeOffRequestDialog = ({ open, onOpenChange, userId, isAdminOrSupervisor }: TimeOffRequestDialogProps) => {
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>(userId);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [ptoType, setPtoType] = useState<string>("vacation");
  const [hoursRequired, setHoursRequired] = useState<number>(0);
  const [affectedShifts, setAffectedShifts] = useState<any[]>([]);
  const [dailyStaffingSummary, setDailyStaffingSummary] = useState<any[]>([]);
  const [calculating, setCalculating] = useState(false);
  const queryClient = useQueryClient();

  // Add website settings hook
  const { data: settings } = useWebsiteSettings();

  // Reset selectedOfficerId when dialog opens or userId changes
  useEffect(() => {
    if (open) {
      setSelectedOfficerId(userId);
    }
  }, [open, userId]);

  // Fetch all profiles if supervisor/admin
  const { data: allOfficers } = useQuery({
    queryKey: ["all-officers-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, badge_number")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!isAdminOrSupervisor,
    staleTime: 10 * 60 * 1000,
  });

  // Fetch user's current PTO balances for selected officer
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile-pto", selectedOfficerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("vacation_hours, sick_hours, comp_hours, holiday_hours, full_name")
        .eq("id", selectedOfficerId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open && (!!settings?.show_pto_balances || isAdminOrSupervisor),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
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
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  // Fetch requesting officer's rank to determine staffing category
  const { data: requestingOfficer } = useQuery({
    queryKey: ["requesting-officer", selectedOfficerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("rank, full_name, badge_number")
        .eq("id", selectedOfficerId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!selectedOfficerId,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  // Fetch and calculate affected shifts and daily staffing when dates change or dialog opens
  useEffect(() => {
    if (startDate && endDate && selectedOfficerId && shiftTypes) {
      fetchAffectedShiftsAndStaffing();
    } else {
      setAffectedShifts([]);
      setDailyStaffingSummary([]);
      setHoursRequired(0);
    }
  }, [startDate, endDate, selectedOfficerId, shiftTypes, open]);

  // Function to fetch affected shifts and staffing
  const fetchAffectedShiftsAndStaffing = async () => {
    if (!startDate || !endDate || !selectedOfficerId || !shiftTypes) {
      setAffectedShifts([]);
      setDailyStaffingSummary([]);
      return;
    }

    setCalculating(true);
    try {
      const days = eachDayOfInterval({
        start: startOfDay(startDate),
        end: endOfDay(endDate)
      });

      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      // Get requesting officer rank
      const { data: reqProfile } = await supabase
        .from("profiles")
        .select("rank")
        .eq("id", selectedOfficerId)
        .single();

      const isReqSupervisor = reqProfile ? isSupervisorByRank(reqProfile) : false;

      // Fetch all profiles with rank for shift staffing calculations
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, rank");

      const profileRankMap = new Map();
      allProfiles?.forEach(p => profileRankMap.set(p.id, p.rank));

      // Get officer's recurring schedules that are active during this period
      const { data: recurringSchedules, error: scheduleError } = await supabase
        .from("recurring_schedules")
        .select("day_of_week, shift_type_id, unit_number, position_name, start_date, end_date")
        .eq("officer_id", selectedOfficerId)
        .or(`end_date.is.null,end_date.gte.${startDateStr}`)
        .lte("start_date", endDateStr);

      if (scheduleError) throw scheduleError;

      // Also get any officer exceptions (working shifts) for this period
      const { data: officerExceptions } = await supabase
        .from("schedule_exceptions")
        .select("date, shift_type_id, is_off, custom_start_time, custom_end_time")
        .eq("officer_id", selectedOfficerId)
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .eq("is_off", false);

      const affectedShiftsData: any[] = [];

      // Fetch all active schedules / exceptions for these days to calculate shift staffing
      const { data: allExceptions } = await supabase
        .from("schedule_exceptions")
        .select("*")
        .gte("date", startDateStr)
        .lte("date", endDateStr);

      const { data: allRecurring } = await supabase
        .from("recurring_schedules")
        .select("officer_id, day_of_week, shift_type_id, start_date, end_date")
        .or(`end_date.is.null,end_date.gte.${startDateStr}`)
        .lte("start_date", endDateStr);

      for (const day of days) {
        const dayOfWeek = day.getDay();
        const dateStr = format(day, "yyyy-MM-dd");
        const dayName = format(day, "EEEE");

        // Check if officer has a working exception on this date
        const dayException = officerExceptions?.find(e => e.date === dateStr);

        // Check if officer has a recurring schedule for this day
        const daySchedules = recurringSchedules?.filter(s => {
          if (s.day_of_week !== dayOfWeek) return false;
          const scheduleStart = new Date(s.start_date);
          const scheduleEnd = s.end_date ? new Date(s.end_date) : null;
          const currentDate = new Date(dateStr);
          return currentDate >= scheduleStart && (!scheduleEnd || currentDate <= scheduleEnd);
        }) || [];

        // If neither exception (working) nor recurring schedule exists for this day, skip it!
        if (!dayException && daySchedules.length === 0) {
          continue;
        }

        for (const schedule of daySchedules) {
          const shift = shiftTypes.find(s => s.id === schedule.shift_type_id);
          if (shift) {
            // Calculate shift-specific staffing for this shift_type_id on dateStr
            const shiftRecurringIds = allRecurring?.filter(r => {
              if (r.shift_type_id !== shift.id) return false;
              if (r.day_of_week !== dayOfWeek) return false;
              const rStart = new Date(r.start_date);
              const rEnd = r.end_date ? new Date(r.end_date) : null;
              const cur = new Date(dateStr);
              return cur >= rStart && (!rEnd || cur <= rEnd);
            }).map(r => r.officer_id) || [];

            const shiftExceptionIds = allExceptions?.filter(e => {
              if (e.date !== dateStr) return false;
              if (e.shift_type_id !== shift.id) return false;
              return !e.is_off && !e.is_pto;
            }).map(e => e.officer_id) || [];

            const offIdsSet = new Set(allExceptions?.filter(e => e.date === dateStr && (e.is_off || e.is_pto)).map(e => e.officer_id) || []);

            const shiftWorkingIds = new Set([
              ...shiftRecurringIds.filter(id => !offIdsSet.has(id)),
              ...shiftExceptionIds
            ]);
            shiftWorkingIds.delete(selectedOfficerId);

            let supCount = 0;
            let ofcCount = 0;
            shiftWorkingIds.forEach(id => {
              const rank = profileRankMap.get(id) || '';
              if (isSupervisorByRank({ rank })) {
                supCount++;
              } else {
                ofcCount++;
              }
            });

            const relevantCount = isReqSupervisor ? supCount : ofcCount;
            const shiftStaffingLabel = isReqSupervisor
              ? `${relevantCount} supervisor${relevantCount === 1 ? '' : 's'} working`
              : `${relevantCount} officer${relevantCount === 1 ? '' : 's'} working`;

            affectedShiftsData.push({
              date: dateStr,
              dayName: dayName,
              shiftName: shift.name,
              shiftTime: `${shift.start_time} - ${shift.end_time}`,
              unitNumber: schedule.unit_number,
              positionName: schedule.position_name,
              hours: calculateShiftHours(shift.start_time, shift.end_time),
              shiftStaffingLabel
            });
          }
        }

        if (dayException) {
          const shift = shiftTypes.find(s => s.id === dayException.shift_type_id);
          if (shift) {
            const startTime = dayException.custom_start_time || shift.start_time;
            const endTime = dayException.custom_end_time || shift.end_time;

            const shiftRecurringIds = allRecurring?.filter(r => {
              if (r.shift_type_id !== shift.id) return false;
              if (r.day_of_week !== dayOfWeek) return false;
              const rStart = new Date(r.start_date);
              const rEnd = r.end_date ? new Date(r.end_date) : null;
              const cur = new Date(dateStr);
              return cur >= rStart && (!rEnd || cur <= rEnd);
            }).map(r => r.officer_id) || [];

            const shiftExceptionIds = allExceptions?.filter(e => {
              if (e.date !== dateStr) return false;
              if (e.shift_type_id !== shift.id) return false;
              return !e.is_off && !e.is_pto;
            }).map(e => e.officer_id) || [];

            const offIdsSet = new Set(allExceptions?.filter(e => e.date === dateStr && (e.is_off || e.is_pto)).map(e => e.officer_id) || []);

            const shiftWorkingIds = new Set([
              ...shiftRecurringIds.filter(id => !offIdsSet.has(id)),
              ...shiftExceptionIds
            ]);
            shiftWorkingIds.delete(selectedOfficerId);

            let supCount = 0;
            let ofcCount = 0;
            shiftWorkingIds.forEach(id => {
              const rank = profileRankMap.get(id) || '';
              if (isSupervisorByRank({ rank })) {
                supCount++;
              } else {
                ofcCount++;
              }
            });

            const relevantCount = isReqSupervisor ? supCount : ofcCount;
            const shiftStaffingLabel = isReqSupervisor
              ? `${relevantCount} supervisor${relevantCount === 1 ? '' : 's'} working`
              : `${relevantCount} officer${relevantCount === 1 ? '' : 's'} working`;

            affectedShiftsData.push({
              date: dateStr,
              dayName: dayName,
              shiftName: shift.name,
              shiftTime: `${startTime} - ${endTime}`,
              hours: calculateShiftHours(startTime, endTime),
              shiftStaffingLabel
            });
          }
        }
      }

      setAffectedShifts(affectedShiftsData);
      setDailyStaffingSummary([]);
    } catch (error) {
      console.error("Error fetching affected shifts and staffing:", error);
      toast.error("Failed to load scheduled shifts and staffing impact");
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
          officer_id: selectedOfficerId,
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
        console.log('🔔 [DIALOG] PTO request submitted, calling sendPTORequestNotification');
        console.log('🔔 [DIALOG] Request ID:', request.id);
        console.log('🔔 [DIALOG] Officer ID:', selectedOfficerId);

        sendPTORequestNotification(request.id, selectedOfficerId, 'created');
      } else {
        console.error('❌ [DIALOG] No request ID returned after submission');
      }

      onOpenChange(false);;
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
          {isAdminOrSupervisor && allOfficers && allOfficers.length > 0 && (
            <div className="space-y-2">
              <Label>Officer</Label>
              <Select value={selectedOfficerId} onValueChange={setSelectedOfficerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select officer" />
                </SelectTrigger>
                <SelectContent>
                  {allOfficers.map((officer: any) => (
                    <SelectItem key={officer.id} value={officer.id}>
                      {officer.full_name} {officer.badge_number ? `(#${officer.badge_number})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
            <Popover open={startOpen} onOpenChange={setStartOpen}>
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
                  onSelect={(date) => {
                    setStartDate(date);
                    setStartOpen(false);
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>End Date</Label>
            <Popover open={endOpen} onOpenChange={setEndOpen}>
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
                  onSelect={(date) => {
                    setEndDate(date);
                    setEndOpen(false);
                  }}
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

              <div className="mt-2 max-h-60 overflow-y-auto space-y-2">
                <p className="font-medium mb-1 text-sm">Shift Details & Staffing:</p>
                {affectedShifts.map((shift, index) => (
                  <div key={index} className="text-xs p-2.5 border rounded-md bg-white space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">{shift.dayName}, {format(new Date(shift.date), "MMM d")}</span>
                      <Badge variant="outline" className="text-xs">
                        {shift.shiftName}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        <span>{shift.shiftTime}</span>
                        {shift.unitNumber && (
                          <>
                            <MapPin className="h-3 w-3 ml-1" />
                            <span>{shift.unitNumber}</span>
                          </>
                        )}
                        {shift.positionName && (
                          <>
                            <Building className="h-3 w-3 ml-1" />
                            <span>{shift.positionName}</span>
                          </>
                        )}
                      </div>
                      <Badge variant="secondary" className="bg-blue-50 text-blue-800 border border-blue-200">
                        {shift.shiftStaffingLabel}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                These are your regularly scheduled shifts affected by this time off request, along with shift staffing levels.
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
