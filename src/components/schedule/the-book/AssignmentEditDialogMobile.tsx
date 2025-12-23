import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PREDEFINED_POSITIONS } from "@/constants/positions";
import { format } from "date-fns";

interface AssignmentEditDialogMobileProps {
  editingAssignment: { 
    officer: any; 
    dateStr: string;
    shiftTypeId?: string;
    officerId?: string;
    officerName?: string;
  } | null;
  onClose: () => void;
  onSave: (assignmentData: {
    scheduleId: string;
    type: "recurring" | "exception";
    positionName: string;
    unitNumber?: string;
    notes?: string;
    date?: string;
    officerId?: string;
    shiftTypeId?: string;
  }) => void;
  isUpdating?: boolean;
}

export const AssignmentEditDialogMobile: React.FC<AssignmentEditDialogMobileProps> = ({
  editingAssignment,
  onClose,
  onSave,
  isUpdating = false,
}) => {
  const [position, setPosition] = useState<string>("");
  const [customPosition, setCustomPosition] = useState<string>("");
  const [unitNumber, setUnitNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);

  // Initialize form when dialog opens
  useEffect(() => {
    if (editingAssignment) {
      const currentPosition = editingAssignment.officer?.shiftInfo?.position || "";
      const isCustomPosition = currentPosition && !PREDEFINED_POSITIONS.includes(currentPosition);
      
      if (isCustomPosition) {
        setPosition("other-custom");
        setCustomPosition(currentPosition);
        setShowCustomInput(true);
      } else {
        setPosition(currentPosition || "");
        setCustomPosition("");
        setShowCustomInput(false);
      }
      
      setUnitNumber(editingAssignment.officer?.shiftInfo?.unitNumber || "");
      setNotes(editingAssignment.officer?.shiftInfo?.notes || "");
    }
  }, [editingAssignment]);

  const handlePositionChange = (value: string) => {
    setPosition(value);
    setShowCustomInput(value === "other-custom");
    if (value !== "other-custom") {
      setCustomPosition("");
    }
  };

  const handleSave = () => {
    if (!editingAssignment || !editingAssignment.officer?.shiftInfo) {
      console.error('No assignment data available');
      return;
    }

    // Determine the final position name
    const finalPosition = position === "other-custom" && customPosition.trim() 
      ? customPosition.trim() 
      : position;

    if (!finalPosition) {
      console.error('Position is required');
      toast.error("Position is required");
      return;
    }

    const assignmentData = {
      scheduleId: editingAssignment.officer.shiftInfo.scheduleId,
      type: editingAssignment.officer.shiftInfo.scheduleType as "recurring" | "exception",
      positionName: finalPosition,
      unitNumber: unitNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      date: editingAssignment.dateStr,
      officerId: editingAssignment.officerId || editingAssignment.officer.officerId,
      shiftTypeId: editingAssignment.shiftTypeId
    };

    console.log('💾 Saving assignment data:', assignmentData);
    onSave(assignmentData);
  };

  if (!editingAssignment) return null;

  const officerName = editingAssignment.officerName || 
                     editingAssignment.officer?.officerName || 
                     editingAssignment.officer?.full_name || 
                     "Unknown Officer";
  
  const formattedDate = format(new Date(editingAssignment.dateStr), "MMM d, yyyy");

  return (
    <Dialog open={!!editingAssignment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Assignment</DialogTitle>
          <DialogDescription className="text-sm">
            For {officerName} on {formattedDate}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          {/* Position Selection */}
          <div className="space-y-2">
            <Label htmlFor="position-select">Position *</Label>
            <Select value={position} onValueChange={handlePositionChange}>
              <SelectTrigger id="position-select">
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                {PREDEFINED_POSITIONS.map((pos) => (
                  <SelectItem key={pos} value={pos}>
                    {pos}
                  </SelectItem>
                ))}
                <SelectItem value="other-custom">Other (Custom)</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Custom Position Input */}
            {showCustomInput && (
              <div className="pt-2">
                <Label htmlFor="custom-position">Custom Position *</Label>
                <Input
                  id="custom-position"
                  placeholder="Enter custom position name"
                  value={customPosition}
                  onChange={(e) => setCustomPosition(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
          </div>

          {/* Unit Number */}
          <div className="space-y-2">
            <Label htmlFor="unit-number">Unit Number</Label>
            <Input
              id="unit-number"
              placeholder="e.g., 101, 202, etc."
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this assignment..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={onClose}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              className="flex-1"
              disabled={isUpdating || !position || (position === "other-custom" && !customPosition.trim())}
            >
              {isUpdating ? "Saving..." : "Save Assignment"}
            </Button>
          </div>

          {/* Validation Message */}
          {(position === "other-custom" && !customPosition.trim()) && (
            <p className="text-xs text-destructive mt-2">
              Please enter a custom position name
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
