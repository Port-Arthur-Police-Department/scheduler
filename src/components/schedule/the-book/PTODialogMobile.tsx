import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Clock } from "lucide-react";
import { format } from "date-fns";

interface PTODialogMobileProps {
  officerName: string;
  date: string;
  onSave: (ptoData: any) => void;
  // New props for mobile integration
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isUpdating?: boolean;
  officerId?: string;
  shiftTypeId?: string;
  // Add shift times for proper full day PTO
  shiftStartTime?: string;
  shiftEndTime?: string;
}

export const PTODialogMobile: React.FC<PTODialogMobileProps> = ({
  officerName,
  date,
  onSave,
  open,
  onOpenChange,
  isUpdating = false,
  officerId,
  shiftTypeId,
  shiftStartTime = "08:00", // Default to 8 AM if not provided
  shiftEndTime = "17:00",   // Default to 5 PM if not provided
}) => {
  const [selectedPtoType, setSelectedPtoType] = useState<string>("vacation");
  const [selectedIsFullDay, setSelectedIsFullDay] = useState<boolean>(true);
  const [selectedStartTime, setSelectedStartTime] = useState<string>(shiftStartTime);
  const [selectedEndTime, setSelectedEndTime] = useState<string>(shiftEndTime);

  // Update times when shift times change
  useEffect(() => {
    if (selectedIsFullDay) {
      setSelectedStartTime(shiftStartTime);
      setSelectedEndTime(shiftEndTime);
    }
  }, [shiftStartTime, shiftEndTime, selectedIsFullDay]);

  const handleFullDayToggle = (checked: boolean) => {
    setSelectedIsFullDay(checked);
    if (checked) {
      // Reset to shift times for full day
      setSelectedStartTime(shiftStartTime);
      setSelectedEndTime(shiftEndTime);
    }
  };

  const handleSave = () => {
    const ptoData = {
      officerId,
      date,
      shiftTypeId,
      ptoType: selectedPtoType,
      isFullShift: selectedIsFullDay,
      // For full day, use the shift times
      startTime: selectedIsFullDay ? shiftStartTime : selectedStartTime,
      endTime: selectedIsFullDay ? shiftEndTime : selectedEndTime,
      isOff: true,
      reason: selectedPtoType,
      custom_start_time: selectedIsFullDay ? null : selectedStartTime,
      custom_end_time: selectedIsFullDay ? null : selectedEndTime,
    };
    
    console.log('📱 Saving PTO data:', ptoData);
    onSave(ptoData);
  };

  // Generate time options based on shift times
  const generateTimeOptions = () => {
    const times = [];
    // Generate times from 00:00 to 23:30 in 30-min increments
    for (let hour = 0; hour < 24; hour++) {
      const hourStr = hour.toString().padStart(2, '0');
      times.push(`${hourStr}:00`);
      if (hour < 23) {
        times.push(`${hourStr}:30`);
      }
    }
    return times;
  };

  const timeOptions = generateTimeOptions();

  // Format shift time display
  const formatShiftTimeDisplay = `${shiftStartTime} - ${shiftEndTime}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign PTO</DialogTitle>
          <p className="text-sm text-muted-foreground">
            For {officerName} on {format(new Date(date), "MMM d, yyyy")}
          </p>
          <p className="text-xs text-muted-foreground">
            Shift: {formatShiftTimeDisplay}
          </p>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>PTO Type</Label>
            <Select value={selectedPtoType} onValueChange={setSelectedPtoType}>
              <SelectTrigger>
                <SelectValue placeholder="Select PTO type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vacation">Vacation</SelectItem>
                <SelectItem value="sick">Sick Leave</SelectItem>
                <SelectItem value="holiday">Holiday</SelectItem>
                <SelectItem value="comp">Comp Time</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="full-day">Full Day</Label>
                <p className="text-xs text-muted-foreground">
                  {selectedIsFullDay 
                    ? `Full shift (${shiftStartTime} - ${shiftEndTime})`
                    : "Partial day (select times below)"
                  }
                </p>
              </div>
              <Switch
                id="full-day"
                checked={selectedIsFullDay}
                onCheckedChange={handleFullDayToggle}
              />
            </div>
          </div>

          {!selectedIsFullDay && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-time">Start Time</Label>
                  <Select value={selectedStartTime} onValueChange={setSelectedStartTime}>
                    <SelectTrigger id="start-time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {timeOptions.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time">End Time</Label>
                  <Select value={selectedEndTime} onValueChange={setSelectedEndTime}>
                    <SelectTrigger id="end-time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {timeOptions.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={() => onOpenChange(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              className="flex-1"
              disabled={isUpdating}
            >
              {isUpdating ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
