import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  // Add these to match desktop functionality
  ptoType?: string;
  isFullDay?: boolean;
  startTime?: string;
  endTime?: string;
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
  ptoType = "vacation",
  isFullDay = true,
  startTime = "08:00",
  endTime = "17:00",
}) => {
  const [selectedPtoType, setSelectedPtoType] = useState<string>(ptoType);
  const [selectedIsFullDay, setSelectedIsFullDay] = useState<boolean>(isFullDay);
  const [selectedStartTime, setSelectedStartTime] = useState<string>(startTime);
  const [selectedEndTime, setSelectedEndTime] = useState<string>(endTime);

  const handleSave = () => {
    const ptoData = {
      officerId,
      date,
      shiftTypeId,
      ptoType: selectedPtoType,
      isFullShift: selectedIsFullDay,
      startTime: selectedIsFullDay ? "00:00" : selectedStartTime,
      endTime: selectedIsFullDay ? "23:59" : selectedEndTime,
      // For mobile, we'll set these as needed
      isOff: true,
      reason: selectedPtoType,
      custom_start_time: selectedIsFullDay ? null : selectedStartTime,
      custom_end_time: selectedIsFullDay ? null : selectedEndTime,
    };
    onSave(ptoData);
  };

  // Generate time options from 00:00 to 23:00
  const generateTimeOptions = () => {
    const times = [];
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign PTO</DialogTitle>
          <p className="text-sm text-muted-foreground">
            For {officerName} on {format(new Date(date), "MMM d, yyyy")}
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
              <Label htmlFor="full-day">Full Day</Label>
              <Switch
                id="full-day"
                checked={selectedIsFullDay}
                onCheckedChange={setSelectedIsFullDay}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedIsFullDay ? "Officer will be off for the entire shift" : "Officer will be off for part of the day"}
            </p>
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
