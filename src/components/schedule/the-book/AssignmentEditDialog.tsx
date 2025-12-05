// src/components/schedule/the-book/AssignmentEditDialog.tsx
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PREDEFINED_POSITIONS } from "@/constants/positions";
import TheBookMobile from "./TheBookMobile";

interface AssignmentEditDialogProps {
  editingAssignment: { officer: any; dateStr: string } | null;
  onClose: () => void;
  onSave: () => void;
  updatePositionMutation: any;
}

export const AssignmentEditDialog: React.FC<AssignmentEditDialogProps> = ({
  editingAssignment,
  onClose,
  onSave,
  updatePositionMutation,
}) => {
  const [editPosition, setEditPosition] = useState("");
  const [customPosition, setCustomPosition] = useState("");

  if (!editingAssignment) return null;

  const { officer } = editingAssignment;
  const currentPosition = officer.shiftInfo?.position;
  const isCustomPosition = currentPosition && !PREDEFINED_POSITIONS.includes(currentPosition);

  return (
    <Dialog open={!!editingAssignment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Assignment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="position-select">Position</Label>
            <Select value={editPosition} onValueChange={setEditPosition}>
              <SelectTrigger id="position-select">
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                {PREDEFINED_POSITIONS.map((pos) => (
                  <SelectItem key={pos} value={pos}>
                    {pos}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editPosition === "Other (Custom)" && (
              <Input
                placeholder="Custom position"
                value={customPosition}
                onChange={(e) => setCustomPosition(e.target.value)}
                className="mt-2"
              />
            )}
          </div>
          <Button
            className="w-full"
            onClick={onSave}
            disabled={updatePositionMutation.isPending}
          >
            {updatePositionMutation.isPending ? "Saving..." : "Save Assignment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
