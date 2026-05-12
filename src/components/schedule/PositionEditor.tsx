import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X } from "lucide-react";
import { getPositionsForShift } from "@/utils/positionUtils";

interface PositionEditorProps {
  currentPosition: string;
  onSave: (positionName: string) => void;
  onCancel: () => void;
  isSaving?: boolean;
  shiftName?: string; // Optional shift name for dynamic positions
}

export const PositionEditor = ({ 
  currentPosition, 
  onSave, 
  onCancel, 
  isSaving = false,
  shiftName 
}: PositionEditorProps) => {
  const [editPosition, setEditPosition] = useState("");
  const [customPosition, setCustomPosition] = useState("");

  // Get positions based on shift type (Dispatch shifts get special positions)
  const availablePositions = getPositionsForShift(shiftName);

  // Initialize form when component mounts or currentPosition changes
  useEffect(() => {
    const isCustomPosition = currentPosition && !availablePositions.includes(currentPosition);
    
    if (isCustomPosition) {
      setEditPosition("Other (Custom)");
      setCustomPosition(currentPosition);
    } else {
      setEditPosition(currentPosition || "");
      setCustomPosition("");
    }
  }, [currentPosition, availablePositions]);

  const handleSave = () => {
    const finalPosition = editPosition === "Other (Custom)" ? customPosition : editPosition;
    if (!finalPosition) {
      return;
    }
    onSave(finalPosition);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="space-y-2">
        <Select value={editPosition} onValueChange={setEditPosition}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select position" />
          </SelectTrigger>
          <SelectContent>
            {availablePositions.map((pos) => (
              <SelectItem key={pos} value={pos}>
                {pos}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {editPosition === "Other (Custom)" && (
          <Input
            placeholder="Enter special assignment"
            value={customPosition}
            onChange={(e) => setCustomPosition(e.target.value)}
            className="w-48"
          />
        )}
      </div>
      <Button
        size="sm"
        onClick={handleSave}
        disabled={isSaving}
      >
        <Save className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onCancel}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
