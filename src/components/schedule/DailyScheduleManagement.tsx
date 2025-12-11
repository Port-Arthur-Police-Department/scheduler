import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { DailyScheduleView } from "./DailyScheduleView";

interface DailyScheduleManagementProps {
  isAdminOrSupervisor: boolean;
  userCurrentShift?: string;
}

export const DailyScheduleManagement = ({ 
  isAdminOrSupervisor,
  userCurrentShift = "all"
}: DailyScheduleManagementProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedShiftId, setSelectedShiftId] = useState<string>("all");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Initialize with userCurrentShift when component mounts
  useEffect(() => {
    console.log("📅 DailyScheduleManagement mounted - userCurrentShift:", userCurrentShift);
    if (userCurrentShift) {
      setSelectedShiftId(userCurrentShift);
    }
  }, [userCurrentShift]);

  // Debug logging
  console.log("🎯 DailyScheduleManagement - Current state:", {
    userCurrentShift,
    selectedShiftId,
    isCalendarOpen
  });

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

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setIsCalendarOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Daily Schedule Management</span>
            <div className="flex items-center gap-3">
              <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shifts</SelectItem>
                  {shiftTypes?.map((shift) => (
                    <SelectItem key={shift.id} value={shift.id}>
                      {shift.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {format(selectedDate, "MMM d, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    key="daily-schedule-calendar"
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            View and manage officer assignments by shift. Assign officers to specific positions
            and monitor staffing levels for each shift.
          </p>
          {userCurrentShift !== "all" && selectedShiftId === userCurrentShift && (
            <div className="mt-2 p-2 bg-primary/10 rounded text-xs text-primary">
              📍 Showing your assigned shift by default. You can change the shift filter above.
            </div>
          )}
        </CardContent>
      </Card>

      <DailyScheduleView 
        selectedDate={selectedDate} 
        filterShiftId={selectedShiftId} 
        key={`${selectedDate.toISOString()}-${selectedShiftId}`}
        isAdminOrSupervisor={isAdminOrSupervisor}
        userRole={isAdminOrSupervisor ? "admin" : "officer"}
      />
    </div>
  );
};
