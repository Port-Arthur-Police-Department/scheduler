// src/components/schedule/PartialShiftTimeSelector.tsx
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock } from "lucide-react";

interface PartialShiftTimeSelectorProps {
  shift: {
    start_time: string;
    end_time: string;
    name: string;
  };
  isPartial: boolean;
  onPartialChange: (isPartial: boolean) => void;
  startTime: string;
  endTime: string;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  title?: string;
  showFullShiftLabel?: boolean;
}

export const PartialShiftTimeSelector = ({
  shift,
  isPartial,
  onPartialChange,
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  title = "Shift Hours",
  showFullShiftLabel = true
}: PartialShiftTimeSelectorProps) => {
  const [useCustomTimes, setUseCustomTimes] = useState(isPartial);

  // Generate time options
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute of ["00", "30"]) {
        const time = `${hour.toString().padStart(2, '0')}:${minute}`;
        options.push(time);
      }
    }
    return options;
  };

  useEffect(() => {
    if (!useCustomTimes) {
      // Reset to shift times when not partial
      onStartTimeChange(shift.start_time);
      onEndTimeChange(shift.end_time);
      onPartialChange(false);
    } else {
      onPartialChange(true);
    }
  }, [useCustomTimes, shift]);

  const timeOptions = generateTimeOptions();

  const calculateHours = () => {
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return (endMinutes - startMinutes) / 60;
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <h4 className="font-medium">{title}</h4>
        </div>
        
        {showFullShiftLabel && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="useCustomTimes"
              checked={useCustomTimes}
              onCheckedChange={(checked) => setUseCustomTimes(checked === true)}
            />
            <Label htmlFor="useCustomTimes" className="cursor-pointer">
              {useCustomTimes ? "Custom hours" : `Full shift (${shift.start_time} - ${shift.end_time})`}
            </Label>
          </div>
        )}

        {useCustomTimes && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Select value={startTime} onValueChange={onStartTimeChange}>
                <SelectTrigger>
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
              <Label>End Time</Label>
              <Select value={endTime} onValueChange={onEndTimeChange}>
                <SelectTrigger>
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
        )}
      </div>

      {useCustomTimes && (
        <div className="text-sm text-muted-foreground">
          Hours: {calculateHours().toFixed(2)} hours
        </div>
      )}
    </div>
  );
};
