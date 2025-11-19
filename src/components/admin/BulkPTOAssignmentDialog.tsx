// BulkPTOAssignmentDialog.tsx
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format, addDays, eachDayOfInterval, isWeekend, parseISO } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkPTOAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  officer: {
    id: string;
    full_name: string;
  } | null;
}

const PTO_TYPES = [
  { value: "vacation", label: "Vacation", column: "vacation_hours" },
  { value: "holiday", label: "Holiday", column: "holiday_hours" },
  { value: "sick", label: "Sick", column: "sick_hours" },
  { value: "comp", label: "Comp", column: "comp_hours" },
];

export const BulkPTOAssignmentDialog = ({
  open,
  onOpenChange,
  officer,
}: BulkPTOAssignmentDialogProps) => {
  const queryClient = useQueryClient();
  const [ptoType, setPtoType] = useState("vacation");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [excludeWeekends, setExcludeWeekends] = useState(true);
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [isFullShift, setIsFullShift] = useState(true);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [totalHours, setTotalHours] = useState(0);
  const [affectedDays, setAffectedDays] = useState<string[]>([]);

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
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open && officer) {
      setPtoType("vacation");
      setStartDate(undefined);
      setEndDate(undefined);
      setExcludeWeekends(true);
      setSelectedShifts([]);
      setIsFullShift(true);
      setStartTime("");
      setEndTime("");
      setTotalHours(0);
      setAffectedDays([]);
    }
  }, [open, officer]);

  // Calculate affected days and hours when parameters change
  useEffect(() => {
    if (startDate && endDate && selectedShifts.length > 0 && shiftTypes) {
      calculatePTOHours();
    } else {
      setTotalHours(0);
      setAffectedDays([]);
    }
  }, [startDate, endDate, excludeWeekends, selectedShifts, isFullShift, startTime, endTime]);

  const calculatePTOHours = async () => {
    if (!startDate || !endDate || selectedShifts.length === 0 || !shiftTypes) return;

    setCalculating(true);
    
    try {
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      const filteredDays = excludeWeekends 
        ? days.filter(day => !isWeekend(day))
        : days;

      const affectedDates: string[] = [];
      let totalHoursCalculated = 0;

      // Get officer's recurring schedules to determine which days they actually work
      const { data: recurringSchedules } = await supabase
        .from("recurring_schedules")
        .select("day_of_week, shift_type_id")
        .eq("officer_id", officer!.id)
        .or(`end_date.is.null,end_date.gte.${format(startDate, "yyyy-MM-dd")}`);

      for (const day of filteredDays) {
        const dayOfWeek = day.getDay();
        const dateStr = format(day, "yyyy-MM-dd");
        
        // Check if officer has a recurring schedule for this day
        const daySchedules = recurringSchedules?.filter(s => s.day_of_week === dayOfWeek) || [];
        
        // Only include shifts that are both selected AND in the officer's recurring schedule
        const applicableShifts = daySchedules.filter(s => 
          selectedShifts.includes(s.shift_type_id)
        );

        for (const schedule of applicableShifts) {
          const shift = shiftTypes.find(s => s.id === schedule.shift_type_id);
          if (shift) {
            affectedDates.push(`${dateStr} - ${shift.name}`);
            
            if (isFullShift) {
              const hours = calculateHours(shift.start_time, shift.end_time);
              totalHoursCalculated += hours;
            } else if (startTime && endTime) {
              const hours = calculateHours(startTime, endTime);
              totalHoursCalculated += hours;
            }
          }
        }
      }

      setAffectedDays(affectedDates);
      setTotalHours(totalHoursCalculated);
    } catch (error) {
      console.error("Error calculating PTO hours:", error);
    } finally {
      setCalculating(false);
    }
  };

  const calculateHours = (start: string, end: string) => {
    const [startHour, startMin] = start.split(":").map(Number);
    const [endHour, endMin] = end.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return (endMinutes - startMinutes) / 60;
  };

  const assignBulkPTOMutation = useMutation({
    mutationFn: async () => {
      if (!officer || !startDate || !endDate || selectedShifts.length === 0 || !shiftTypes) {
        throw new Error("Please fill in all required fields");
      }

      // Check PTO balance
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", officer.id)
        .single();

      if (profileError) throw profileError;

      const ptoColumn = PTO_TYPES.find((t) => t.value === ptoType)?.column;
      if (!ptoColumn) throw new Error("Invalid PTO type");

      const currentBalance = profile[ptoColumn as keyof typeof profile] as number;
      if (currentBalance < totalHours) {
        throw new Error(`Insufficient ${ptoType} balance. Available: ${currentBalance} hours, Required: ${totalHours.toFixed(1)} hours`);
      }

      const days = eachDayOfInterval({ start: startDate, end: endDate });
      const filteredDays = excludeWeekends 
        ? days.filter(day => !isWeekend(day))
        : days;

      // Get officer's recurring schedules
      const { data: recurringSchedules } = await supabase
        .from("recurring_schedules")
        .select("id, day_of_week, shift_type_id, position_name")
        .eq("officer_id", officer.id)
        .or(`end_date.is.null,end_date.gte.${format(startDate, "yyyy-MM-dd")}`);

      const ptoExceptions = [];

      for (const day of filteredDays) {
        const dayOfWeek = day.getDay();
        const dateStr = format(day, "yyyy-MM-dd");
        
        const daySchedules = recurringSchedules?.filter(s => s.day_of_week === dayOfWeek) || [];
        const applicableShifts = daySchedules.filter(s => 
          selectedShifts.includes(s.shift_type_id)
        );

        for (const schedule of applicableShifts) {
          const shift = shiftTypes.find(s => s.id === schedule.shift_type_id);
          if (shift) {
            const ptoStartTime = isFullShift ? shift.start_time : startTime;
            const ptoEndTime = isFullShift ? shift.end_time : endTime;

            // Create PTO exception
            ptoExceptions.push({
              officer_id: officer.id,
              date: dateStr,
              shift_type_id: schedule.shift_type_id,
              is_off: true,
              reason: ptoType,
              custom_start_time: isFullShift ? null : ptoStartTime,
              custom_end_time: isFullShift ? null : ptoEndTime,
            });

            // If partial shift, create working time exception
            if (!isFullShift) {
              const workStartTime = ptoEndTime;
              const workEndTime = shift.end_time;

              if (workStartTime !== workEndTime) {
                ptoExceptions.push({
                  officer_id: officer.id,
                  date: dateStr,
                  shift_type_id: schedule.shift_type_id,
                  is_off: false,
                  position_name: schedule.position_name,
                  custom_start_time: workStartTime,
                  custom_end_time: workEndTime,
                });
              }
            }
          }
        }
      }

      // Insert all PTO exceptions
      if (ptoExceptions.length > 0) {
        const { error: ptoError } = await supabase
          .from("schedule_exceptions")
          .insert(ptoExceptions);

        if (ptoError) throw ptoError;

        // Deduct PTO from balance
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            [ptoColumn]: currentBalance - totalHours,
          })
          .eq("id", officer.id);

        if (updateError) throw updateError;
      }

      return ptoExceptions.length;
    },
    onSuccess: (count) => {
      toast.success(`PTO assigned successfully for ${count} shift(s)`);
      queryClient.invalidateQueries({ queryKey: ["all-officers"] });
      queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-schedule"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to assign PTO");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Bulk PTO</DialogTitle>
          <DialogDescription>
            Assign PTO for {officer?.full_name} across multiple days and shifts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* PTO Type */}
          <div className="space-y-2">
            <Label>PTO Type</Label>
            <Select value={ptoType} onValueChange={setPtoType}>
              <SelectTrigger>
                <SelectValue />
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

          {/* Date Range */}
          <div className="space-y-4">
            <Label>Date Range</Label>
            <div className="grid grid-cols-2 gap-4">
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
                      {startDate ? format(startDate, "PPP") : "Select start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      disabled={(date) => date < new Date()}
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
                      {endDate ? format(endDate, "PPP") : "Select end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      disabled={(date) => date < (startDate || new Date())}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="excludeWeekends"
                checked={excludeWeekends}
                onCheckedChange={(checked) => setExcludeWeekends(checked === true)}
              />
              <Label htmlFor="excludeWeekends" className="cursor-pointer text-sm">
                Exclude weekends
              </Label>
            </div>
          </div>

          {/* Shift Selection */}
          <div className="space-y-2">
            <Label>Shifts</Label>
            <div className="grid grid-cols-2 gap-2">
              {shiftTypes?.map((shift) => (
                <div key={shift.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`shift-${shift.id}`}
                    checked={selectedShifts.includes(shift.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedShifts([...selectedShifts, shift.id]);
                      } else {
                        setSelectedShifts(selectedShifts.filter(id => id !== shift.id));
                      }
                    }}
                  />
                  <Label htmlFor={`shift-${shift.id}`} className="cursor-pointer text-sm">
                    {shift.name} ({shift.start_time} - {shift.end_time})
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Time Selection */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="fullShift"
                checked={isFullShift}
                onCheckedChange={(checked) => {
                  setIsFullShift(checked === true);
                  if (checked) {
                    setStartTime("");
                    setEndTime("");
                  }
                }}
              />
              <Label htmlFor="fullShift" className="cursor-pointer">
                Full shift
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
          </div>

          {/* Summary */}
          {affectedDays.length > 0 && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                PTO Summary
              </h4>
              <div className="text-sm">
                <p><strong>Total Hours:</strong> {totalHours.toFixed(1)} hours</p>
                <p><strong>Affected Shifts:</strong> {affectedDays.length}</p>
                <div className="mt-2 max-h-32 overflow-y-auto">
                  <p className="font-medium mb-1">Affected Days:</p>
                  {affectedDays.map((day, index) => (
                    <p key={index} className="text-xs text-muted-foreground">
                      {day}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={() => assignBulkPTOMutation.mutate()}
            disabled={
              !ptoType ||
              !startDate ||
              !endDate ||
              selectedShifts.length === 0 ||
              totalHours === 0 ||
              assignBulkPTOMutation.isPending ||
              calculating
            }
          >
            {assignBulkPTOMutation.isPending ? "Assigning..." : "Assign PTO"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
