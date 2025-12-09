// src/components/schedule/the-book/ScheduleExportDialog.tsx - UPDATED
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarRange, Download } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isBefore, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { auditLogger } from "@/lib/auditLogger";
import { exportWeeklyPDF, exportMonthlyPDF } from "@/utils/pdfExportUtils";
import { useColorSettings } from "@/hooks/useColorSettings";

interface ScheduleExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedShiftId: string;
  shiftTypes: any[];
  activeView: string;
  userEmail: string;
  scheduleData: any; // Add this prop
  currentDate: Date; // Add this prop
}

export const ScheduleExportDialog: React.FC<ScheduleExportDialogProps> = ({
  open,
  onOpenChange,
  selectedShiftId,
  shiftTypes,
  activeView,
  userEmail,
  scheduleData, // Destructure new prop
  currentDate, // Destructure new prop
}) => {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { pdf: pdfColorSettings } = useColorSettings();

  // Set default date range based on active view
  useEffect(() => {
    if (open) {
      const today = new Date();
      if (activeView === "weekly") {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
        setDateRange({ from: weekStart, to: weekEnd });
      } else if (activeView === "monthly") {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        setDateRange({ from: monthStart, to: monthEnd });
      }
    }
  }, [open, activeView, currentDate]);

  const handleExportPDF = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast.error("Please select a date range");
      return;
    }

    if (!selectedShiftId) {
      toast.error("Please select a shift");
      return;
    }

    if (!scheduleData || !scheduleData.dailySchedules) {
      toast.error("No schedule data available to export");
      return;
    }

    // Validate date range
    if (isBefore(dateRange.to, dateRange.from)) {
      toast.error("End date must be after start date");
      return;
    }

    try {
      setIsExporting(true);
      toast.info("Generating PDF export...");

      const shiftName = shiftTypes?.find(s => s.id === selectedShiftId)?.name || "Unknown Shift";
      
      console.log("Starting export with:", {
        activeView,
        shiftName,
        dateRange: `${format(dateRange.from, 'yyyy-MM-dd')} to ${format(dateRange.to, 'yyyy-MM-dd')}`,
        scheduleDataCount: scheduleData.dailySchedules?.length || 0,
        selectedShiftId
      });

      let result;
      
      if (activeView === "weekly") {
        const exportOptions = {
          startDate: dateRange.from,
          endDate: dateRange.to,
          shiftName: shiftName,
          scheduleData: scheduleData.dailySchedules || [],
          minimumStaffing: scheduleData.minimumStaffing,
          selectedShiftId: selectedShiftId,
          colorSettings: pdfColorSettings
        };
        
        console.log("Weekly export options:", exportOptions);
        result = await exportWeeklyPDF(exportOptions);
      } else if (activeView === "monthly") {
        const exportOptions = {
          startDate: dateRange.from,
          endDate: dateRange.to,
          shiftName: shiftName,
          scheduleData: scheduleData.dailySchedules || [],
          colorSettings: pdfColorSettings
        };
        
        console.log("Monthly export options:", exportOptions);
        result = await exportMonthlyPDF(exportOptions);
      } else {
        toast.error(`Export not supported for ${activeView} view`);
        setIsExporting(false);
        return;
      }

      console.log("Export result:", result);

      if (result.success) {
        // Log audit trail
        try {
          auditLogger.logExport(
            userEmail,
            `${activeView.toUpperCase()} Schedule`,
            `${format(dateRange.from, "yyyy-MM-dd")} to ${format(dateRange.to, "yyyy-MM-dd")}`,
            `Exported ${shiftName} ${activeView} schedule`
          );
        } catch (auditError) {
          console.error("Audit logging failed:", auditError);
        }
        
        toast.success("PDF exported successfully");
        onOpenChange(false);
      } else {
        console.error("Export failed with error:", result.error);
        toast.error(`Export failed: ${result.error?.message || "Please check console for details"}`);
      }
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error(`Failed to export PDF: ${error.message || "Unknown error"}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleQuickSelect = (type: 'week' | 'month' | 'year') => {
    const today = new Date();
    
    switch (type) {
      case 'week':
        const weekStart = startOfWeek(today, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
        setDateRange({ from: weekStart, to: weekEnd });
        break;
      case 'month':
        const monthStart = startOfMonth(today);
        const monthEnd = endOfMonth(today);
        setDateRange({ from: monthStart, to: monthEnd });
        break;
      case 'year':
        const yearStart = new Date(today.getFullYear(), 0, 1);
        const yearEnd = new Date(today.getFullYear(), 11, 31);
        setDateRange({ from: yearStart, to: yearEnd });
        break;
    }
    setCalendarOpen(false);
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
            <div className="flex gap-2 mb-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleQuickSelect('week')}
                className="text-xs"
              >
                This Week
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleQuickSelect('month')}
                className="text-xs"
              >
                This Month
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleQuickSelect('year')}
                className="text-xs"
              >
                This Year
              </Button>
            </div>
            
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
                        {format(dateRange.from, "MMM d, yyyy")} -{" "}
                        {format(dateRange.to, "MMM d, yyyy")}
                      </>
                    ) : (
                      format(dateRange.from, "MMM d, yyyy")
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
                  disabled={{ before: new Date(2020, 0, 1) }}
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

          <div className="space-y-2">
            <Label htmlFor="export-view">View Type</Label>
            <div className="p-2 border rounded-md bg-muted/50">
              {activeView === "weekly" ? "Weekly Schedule" : "Monthly PTO Schedule"}
            </div>
            <p className="text-xs text-muted-foreground">
              {activeView === "weekly" 
                ? "Exports complete schedule with assignments" 
                : "Exports only Holiday & Vacation PTO schedule"}
            </p>
          </div>

          {dateRange?.from && dateRange?.to && (
            <div className="p-3 bg-muted/50 rounded-md">
              <div className="text-sm font-medium">Export Summary:</div>
              <div className="text-sm text-muted-foreground mt-1">
                Exporting {activeView} view for {format(dateRange.from, "MMM d, yyyy")} to {format(dateRange.to, "MMM d, yyyy")}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {activeView === "weekly" 
                  ? "File will include: Employee numbers, names, daily assignments, PTO, and staffing counts"
                  : "File will include: Officer names with badge numbers, Holiday/Vacation PTO only with rank badges for supervisors"}
              </div>
            </div>
          )}

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
              disabled={!dateRange?.from || !dateRange?.to || !selectedShiftId || isExporting}
              className="min-w-[120px]"
            >
              {isExporting ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Exporting...
                </div>
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
