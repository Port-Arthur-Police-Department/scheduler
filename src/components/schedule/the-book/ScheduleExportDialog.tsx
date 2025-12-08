// src/components/schedule/the-book/ScheduleExportDialog.tsx - UPDATED
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarRange, Download } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { auditLogger } from "@/lib/auditLogger";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

// Import your PDF export utilities
import { exportWeeklyPDF, exportMonthlyPDF } from "@/utils/pdfExportUtils";

interface ScheduleExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedShiftId: string;
  shiftTypes: any[];
  activeView: string;
  userEmail: string;
}

export const ScheduleExportDialog: React.FC<ScheduleExportDialogProps> = ({
  open,
  onOpenChange,
  selectedShiftId,
  shiftTypes,
  activeView,
  userEmail,
}) => {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Set default date range based on active view
  useEffect(() => {
    const today = new Date();
    if (activeView === "weekly") {
      const weekStart = startOfWeek(today, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
      setDateRange({ from: weekStart, to: weekEnd });
    } else if (activeView === "monthly") {
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);
      setDateRange({ from: monthStart, to: monthEnd });
    }
  }, [activeView, open]);

  // Fetch schedule data for the selected date range
  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ['export-schedule-data', selectedShiftId, dateRange?.from, dateRange?.to],
    queryFn: async () => {
      if (!selectedShiftId || !dateRange?.from || !dateRange?.to) {
        return null;
      }

      const dates = eachDayOfInterval({ start: dateRange.from, end: dateRange.to }).map(date => 
        format(date, "yyyy-MM-dd")
      );

      // Fetch all schedule data for the date range
      const { data: recurringData, error: recurringError } = await supabase
        .from("recurring_schedules")
        .select(`
          *,
          profiles:officer_id (
            id, full_name, badge_number, rank, hire_date
          ),
          shift_types (
            id, name, start_time, end_time
          )
        `)
        .eq("shift_type_id", selectedShiftId)
        .or(`end_date.is.null,end_date.gte.${format(dateRange.from, "yyyy-MM-dd")}`);

      if (recurringError) throw recurringError;

      const { data: exceptionsData, error: exceptionsError } = await supabase
        .from("schedule_exceptions")
        .select("*")
        .gte("date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("date", format(dateRange.to, "yyyy-MM-dd"))
        .eq("shift_type_id", selectedShiftId);

      if (exceptionsError) throw exceptionsError;

      // Get officer profiles for exceptions
      const officerIds = [...new Set(exceptionsData?.map(e => e.officer_id).filter(Boolean))];
      let officerProfiles = [];
      if (officerIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, badge_number, rank, hire_date")
          .in("id", officerIds);
        officerProfiles = profilesData || [];
      }

      // Combine and organize data
      const dailySchedules = dates.map(date => {
        const dateObj = new Date(date);
        const dayOfWeek = dateObj.getDay();
        
        // Filter recurring schedules for this day
        const recurringOfficers = recurringData?.filter(recurring => 
          recurring.day_of_week === dayOfWeek && 
          (!recurring.end_date || new Date(recurring.end_date) >= dateObj)
        ) || [];

        // Filter exceptions for this date
        const dateExceptions = exceptionsData?.filter(exception => 
          exception.date === date
        ) || [];

        // Combine officers for this day
        const officers = [
          ...recurringOfficers.map(recurring => ({
            officerId: recurring.officer_id,
            officerName: recurring.profiles?.full_name || "Unknown",
            badgeNumber: recurring.profiles?.badge_number,
            rank: recurring.profiles?.rank,
            shiftInfo: {
              type: recurring.shift_types?.name,
              time: `${recurring.shift_types?.start_time} - ${recurring.shift_types?.end_time}`,
              position: recurring.position_name,
              scheduleId: recurring.id,
              scheduleType: "recurring" as const,
              isOff: false,
              hasPTO: false
            }
          })),
          ...dateExceptions.map(exception => ({
            officerId: exception.officer_id,
            officerName: officerProfiles.find(p => p.id === exception.officer_id)?.full_name || "Unknown",
            badgeNumber: officerProfiles.find(p => p.id === exception.officer_id)?.badge_number,
            rank: officerProfiles.find(p => p.id === exception.officer_id)?.rank,
            shiftInfo: {
              type: exception.is_off ? "Off" : "Custom",
              time: exception.custom_start_time && exception.custom_end_time
                ? `${exception.custom_start_time} - ${exception.custom_end_time}`
                : "",
              position: exception.position_name || "",
              scheduleId: exception.id,
              scheduleType: "exception" as const,
              isOff: exception.is_off,
              hasPTO: exception.is_off,
              ptoData: exception.is_off ? {
                id: exception.id,
                ptoType: exception.reason,
                isFullShift: !exception.custom_start_time && !exception.custom_end_time
              } : undefined
            }
          }))
        ];

        return {
          date,
          dayOfWeek,
          officers
        };
      });

      return {
        dailySchedules,
        startDate: format(dateRange.from, "yyyy-MM-dd"),
        endDate: format(dateRange.to, "yyyy-MM-dd")
      };
    },
    enabled: !!selectedShiftId && !!dateRange?.from && !!dateRange?.to && open,
  });

  const handleExportPDF = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast.error("Please select a date range");
      return;
    }

    if (!selectedShiftId) {
      toast.error("Please select a shift");
      return;
    }

    if (!scheduleData) {
      toast.error("No schedule data available to export");
      return;
    }

    try {
      setIsExporting(true);
      toast.info("Generating PDF export...");

      const shiftName = shiftTypes?.find(s => s.id === selectedShiftId)?.name || "Unknown Shift";
      
      const exportOptions = {
        startDate: dateRange.from,
        endDate: dateRange.to,
        shiftName: shiftName,
        scheduleData: scheduleData.dailySchedules || []
      };

      let result;
      
      if (activeView === "weekly") {
        result = await exportWeeklyPDF(exportOptions);
      } else if (activeView === "monthly") {
        result = await exportMonthlyPDF(exportOptions);
      } else {
        toast.error(`Export not supported for ${activeView} view`);
        setIsExporting(false);
        return;
      }

      if (result.success) {
        // Log audit trail
        auditLogger.logExport(
          userEmail,
          `${activeView.toUpperCase()} Schedule`,
          `${format(dateRange.from, "yyyy-MM-dd")} to ${format(dateRange.to, "yyyy-MM-dd")}`,
          `Exported ${shiftName} ${activeView} schedule`
        );
        
        toast.success("PDF exported successfully");
        onOpenChange(false);
      } else {
        toast.error(`Export failed: ${result.error?.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Schedule to PDF
          </DialogTitle>
          <DialogDescription>
            Export recurring schedules and assignments for a specific time period.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date-range">Date Range</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="date-range"
                  variant={"outline"}
                  className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                  disabled={isExporting}
                >
                  <CalendarRange className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={(range) => {
                    setDateRange(range);
                    if (range?.from && range?.to) {
                      setCalendarOpen(false);
                    }
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="export-shift">Shift</Label>
            <Select value={selectedShiftId} onValueChange={() => {}}>
              <SelectTrigger>
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                {shiftTypes?.map((shift) => (
                  <SelectItem key={shift.id} value={shift.id}>
                    {shift.name} ({shift.start_time} - {shift.end_time})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 bg-muted/50 rounded-md">
            <div className="text-sm font-medium">Export Summary:</div>
            {dateRange?.from && dateRange?.to && (
              <div className="text-sm text-muted-foreground mt-1">
                {activeView === "weekly" ? "Weekly" : "Monthly"} view for {format(dateRange.from, "MMM d, yyyy")} to {format(dateRange.to, "MMM d, yyyy")}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleExportPDF} 
              disabled={!dateRange?.from || !dateRange?.to || !selectedShiftId || isExporting || isLoading}
            >
              {isExporting ? (
                "Exporting..."
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
