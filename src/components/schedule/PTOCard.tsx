import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit2, Save, X, Trash2 } from "lucide-react";
import { useState } from "react";

interface PTOCardProps {
  ptoRecord: any;
  canEdit: boolean;
  onSaveUnitNumber: (ptoRecord: any, unitNumber: string) => void;
  onSaveNotes: (ptoRecord: any, notes: string) => void;
  onEdit: (ptoRecord: any) => void;
  onRemove: (ptoRecord: any) => void;
  isUpdating: boolean;
  backgroundColor?: string; // ADD THIS LINE
}

export const PTOCard = ({
  ptoRecord,
  canEdit,
  onSaveUnitNumber,
  onSaveNotes,
  onEdit,
  onRemove,
  isUpdating,
  backgroundColor // ADD THIS LINE
}: PTOCardProps) => {
  const [editingUnitNumber, setEditingUnitNumber] = useState<string | null>(null);
  const [editUnitValue, setEditUnitValue] = useState("");
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editNotesValue, setEditNotesValue] = useState("");

  const handleEditUnitClick = () => {
    if (!canEdit) return;
    setEditingUnitNumber(`pto-${ptoRecord.id}`);
    setEditUnitValue(ptoRecord.unitNumber || "");
  };

  const handleEditNotesClick = () => {
    if (!canEdit) return;
    setEditingNotes(`pto-${ptoRecord.id}`);
    setEditNotesValue(ptoRecord.notes || "");
  };

  const handleSaveUnitNumber = () => {
    onSaveUnitNumber(ptoRecord, editUnitValue);
    setEditingUnitNumber(null);
    setEditUnitValue("");
  };

  const handleSaveNotes = () => {
    onSaveNotes(ptoRecord, editNotesValue);
    setEditingNotes(null);
    setEditNotesValue("");
  };

  return (
    // CHANGE THIS LINE: Remove bg-gray-50 and add style prop
    <div 
      className="flex items-center justify-between p-3 border border-gray-200 rounded-md"
      style={backgroundColor ? { backgroundColor } : {}}
    >
      {/* Officer Info - Left Side */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <div>
            <p className="font-medium truncate text-gray-900">{ptoRecord.name}</p>
            <p className="text-xs text-muted-foreground">
              {ptoRecord.rank || 'Officer'} • Badge #{ptoRecord.badge}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-200 border-green-200">
            {ptoRecord.ptoType}
          </Badge>
          <span className="text-gray-700">
            {ptoRecord.startTime} - {ptoRecord.endTime}
            {!ptoRecord.isFullShift && " (Partial Day)"}
          </span>
        </div>
      </div>

      {/* Unit & Notes - Middle Section */}
      <div className="flex items-center gap-4 mx-4 min-w-0 flex-1">
        {/* Unit Number */}
        <div className="text-center min-w-16">
          <Label htmlFor={`unit-pto-${ptoRecord.id}`} className="text-xs text-muted-foreground mb-1 block">
            Unit
          </Label>
          {canEdit && editingUnitNumber === `pto-${ptoRecord.id}` ? (
            <div className="flex items-center gap-1">
              <Input
                id={`unit-pto-${ptoRecord.id}`}
                placeholder="Unit #"
                value={editUnitValue}
                onChange={(e) => setEditUnitValue(e.target.value)}
                className="w-16 h-8 text-sm"
              />
              <Button
                size="sm"
                onClick={handleSaveUnitNumber}
                disabled={isUpdating}
                className="h-8 w-8"
              >
                <Save className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingUnitNumber(null);
                  setEditUnitValue("");
                }}
                className="h-8 w-8"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Badge 
              variant={ptoRecord.unitNumber ? "default" : "outline"} 
              className={`w-16 ${canEdit ? 'cursor-pointer hover:bg-muted transition-colors' : ''}`}
              onClick={handleEditUnitClick}
            >
              {ptoRecord.unitNumber || (canEdit ? "Add" : "-")}
            </Badge>
          )}
        </div>

        {/* Notes/Assignments */}
        <div className="text-center min-w-24 flex-1">
          <Label htmlFor={`notes-pto-${ptoRecord.id}`} className="text-xs text-muted-foreground mb-1 block">
            Notes
          </Label>
          {canEdit && editingNotes === `pto-${ptoRecord.id}` ? (
            <div className="flex items-center gap-1">
              <Input
                id={`notes-pto-${ptoRecord.id}`}
                placeholder="Notes..."
                value={editNotesValue}
                onChange={(e) => setEditNotesValue(e.target.value)}
                className="h-8 text-sm"
              />
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={isUpdating}
                className="h-8 w-8"
              >
                <Save className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingNotes(null);
                  setEditNotesValue("");
                }}
                className="h-8 w-8"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div 
              className={`text-xs p-2 rounded border border-dashed border-muted-foreground/30 ${canEdit ? 'cursor-pointer hover:bg-muted' : ''} transition-colors min-h-8 flex items-center justify-center`}
              onClick={handleEditNotesClick}
            >
              {ptoRecord.notes || (canEdit ? "Add notes" : "-")}
            </div>
          )}
        </div>
      </div>

      {/* Actions - Right Side */}
      {canEdit && (
        <div className="flex gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit(ptoRecord)}
            title="Edit PTO"
            className="h-6 w-6 text-red-600 hover:text-red-800 hover:bg-red-100"
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onRemove(ptoRecord)}
            disabled={isUpdating}
            title="Remove PTO"
            className="h-6 w-6 text-red-600 hover:text-red-800 hover:bg-red-100"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};
