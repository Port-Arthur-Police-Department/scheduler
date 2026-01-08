import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays, isToday } from "date-fns";
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

  // Navigation functions
  const goToPreviousDay = () => {
    setSelectedDate(prev => subDays(prev, 1));
  };

  const goToNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1));
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Format date for display with more context
  const formatDateDisplay = (date: Date) => {
    const today = isToday(date);
    const dateFormat = today ? "Today, MMM d, yyyy" : "EEE, MMM d, yyyy";
    return format(date, dateFormat);
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
              
              {/* Date Navigation Section */}
              <div className="flex items-center gap-1 border rounded-lg p-1">
                {/* Previous Day Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={goToPreviousDay}
                  className="h-8 w-8"
                  title="Previous day"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Date Display with Calendar Popover */}
                <div className="flex items-center">
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        className="gap-2 font-medium px-3 hover:bg-transparent"
                      >
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="min-w-[140px] text-center">
                          {formatDateDisplay(selectedDate)}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="center">
                      <Calendar
                        key="daily-schedule-calendar"
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleDateSelect}
                        initialFocus
                        className="rounded-md border"
                      />
                      <div className="p-3 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={goToToday}
                        >
                          Go to Today
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Next Day Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={goToNextDay}
                  className="h-8 w-8"
                  title="Next day"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              View and manage officer assignments by shift. Assign officers to specific positions
              and monitor staffing levels for each shift.
            </p>
            
            {/* Quick Date Navigation Buttons */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={goToToday}
                disabled={isToday(selectedDate)}
              >
                Today
              </Button>
              <div className="text-xs text-muted-foreground">
                Use arrows or calendar to navigate dates
              </div>
            </div>
          </div>
          
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
