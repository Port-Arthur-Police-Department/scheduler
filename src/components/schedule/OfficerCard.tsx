// src/components/schedule/OfficerCard.tsx - UPDATED WITH BIRTHDAY/ANNIVERSARY BADGES

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit2, Save, X, Clock, Trash2, Users, Cake, Award } from "lucide-react"; // ADDED Cake and Award icons
import { PREDEFINED_POSITIONS } from "@/constants/positions";
import { useState } from "react";
import { PartnershipManager } from "./PartnershipManager";

interface OfficerCardProps {
  officer: any;
  canEdit: boolean;
  onSavePosition: (officer: any, position: string) => void;
  onSaveUnitNumber: (officer: any, unitNumber: string) => void;
  onSaveNotes: (officer: any, notes: string) => void;
  onAssignPTO: (officer: any) => void;
  onRemove?: (officer: any) => void;
  onPartnershipChange?: (officer: any, partnerOfficerId?: string) => void;
  isUpdating: boolean;
  sectionType?: "regular" | "special" | "pto";
  backgroundColor?: string;
  showSpecialOccasions?: boolean; // ADD THIS LINE
}

export const OfficerCard = ({
  officer,
  canEdit,
  onSavePosition,
  onSaveUnitNumber,
  onSaveNotes,
  onAssignPTO,
  onRemove,
  onPartnershipChange,
  isUpdating,
  sectionType = "regular",
  backgroundColor,
  showSpecialOccasions = true // ADD THIS LINE WITH DEFAULT
}: OfficerCardProps) => {
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [editPosition, setEditPosition] = useState("");
  const [customPosition, setCustomPosition] = useState("");
  const [editingUnitNumber, setEditingUnitNumber] = useState<string | null>(null);
  const [editUnitValue, setEditUnitValue] = useState("");
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editNotesValue, setEditNotesValue] = useState("");

  // Helper for checking the Probationary rank
  const isProbationary = officer.rank === 'Probationary';

  const handleEditClick = () => {
    if (!canEdit) return;
    
    setEditingSchedule(`${officer.scheduleId}-${officer.type}`);
    
    const isCustomPosition = officer.position && !PREDEFINED_POSITIONS.includes(officer.position);
    
    if (isCustomPosition) {
      setEditPosition("Other (Custom)");
      setCustomPosition(officer.position);
    } else {
      setEditPosition(officer.position || "");
      setCustomPosition("");
    }
  };

  const handleEditUnitClick = () => {
    if (!canEdit) return;
    setEditingUnitNumber(`${officer.scheduleId}-${officer.type}`);
    setEditUnitValue(officer.unitNumber || "");
  };

  const handleEditNotesClick = () => {
    if (!canEdit) return;
    setEditingNotes(`${officer.scheduleId}-${officer.type}`);
    setEditNotesValue(officer.notes || "");
  };

  const handleSavePosition = () => {
    const finalPosition = editPosition === "Other (Custom)" ? customPosition : editPosition;
    if (!finalPosition) return;
    
    onSavePosition(officer, finalPosition);
    setEditingSchedule(null);
    setEditPosition("");
    setCustomPosition("");
  };

  const handleSaveUnitNumber = () => {
    onSaveUnitNumber(officer, editUnitValue);
    setEditingUnitNumber(null);
    setEditUnitValue("");
  };

  const handleSaveNotes = () => {
    onSaveNotes(officer, editNotesValue);
    setEditingNotes(null);
    setEditNotesValue("");
  };

  // Skip officers with full-day PTO - they should only appear in PTO section
  if (officer.hasPTO && officer.ptoData?.isFullShift) {
    return null;
  }

  return (
    <div 
      className={`flex items-center justify-between p-3 rounded-md border ${officer.isPartnership ? 'border-blue-200' : 'border-transparent'}`}
      style={backgroundColor ? { backgroundColor } : {}}
    >
      {/* Officer Info - Left Side */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">{officer.name}</p>
              
              {/* 🚨 PPO Badge Display */}
              {isProbationary && (
                <Badge 
                  variant="outline" 
                  className="bg-yellow-100 text-yellow-800 border-yellow-800/50 hover:bg-yellow-100 font-bold"
                >
                  PPO
                </Badge>
              )}
              
              {/* 🎂🎖️ BIRTHDAY/ANNIVERSARY BADGES - ADD THIS SECTION */}
              {showSpecialOccasions && officer.isBirthdayToday && (
                <Badge 
                  className="text-xs bg-pink-100 text-pink-800 hover:bg-pink-200 border-pink-200 flex items-center gap-1"
                  title={`🎂 ${officer.name}'s Birthday`}
                >
                  <Cake className="h-3 w-3" />
                  Birthday
                </Badge>
              )}
              
              {showSpecialOccasions && officer.isAnniversaryToday && (
                <Badge 
                  className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200 flex items-center gap-1"
                  title={`🎖️ ${officer.name}'s Year ${officer.yearsOfService || 0} Anniversary`}
                >
                  <Award className="h-3 w-3" />
                  Year {officer.yearsOfService || 0}
                </Badge>
              )}
              
            </div>
            
            <p className="text-xs text-muted-foreground">
              {officer.rank || 'Officer'} • Badge #{officer.badge}
              {(officer.type === "exception" || officer.isExtraShift) && (
                <span className="ml-2 text-orange-600 font-medium">(Extra Shift)</span>
              )}
            </p>

            {/* Partnership Display */}
            {officer.isPartnership && officer.partnerData && (
              <div className="flex items-center gap-2 mt-1 p-2 bg-blue-100 rounded border border-blue-200">
                <Users className="h-3 w-3 text-blue-600" />
                <span className="text-sm text-blue-700">
                  Partner: <strong>{officer.partnerData.partnerName}</strong> 
                  {officer.partnerData.partnerBadge && ` (${officer.partnerData.partnerBadge})`}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {officer.customTime && (
            <Badge variant="secondary" className="text-xs">
              {officer.customTime}
            </Badge>
          )}
          {/* ADD THIS FOR PARTIAL OVERTIME */}
          {officer.isExtraShift && officer.custom_start_time && officer.custom_end_time && (
            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-300">
              {officer.custom_start_time} - {officer.custom_end_time}
            </Badge>
          )}
          {officer.type === "recurring" && (
            <Badge variant="secondary" className="text-xs">
              Regular
            </Badge>
          )}
          {officer.type === "exception" && (
            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
              Extra Shift
            </Badge>
          )}
          {/* Show partial PTO indicator */}
          {officer.hasPTO && !officer.ptoData?.isFullShift && (
            <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-200 border-green-200">
              Partial PTO
            </Badge>
          )}
          {/* Partnership indicator badge */}
          {officer.isPartnership && (
            <Badge className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200">
              Partnership
            </Badge>
          )}
        </div>
      </div>

      {/* Unit & Notes - Middle Section */}
      <div className="flex items-center gap-4 mx-4 min-w-0 flex-1">
        {/* Unit Number */}
        <div className="text-center min-w-16">
          <Label htmlFor={`unit-${officer.scheduleId}`} className="text-xs text-muted-foreground mb-1 block">
            Unit
          </Label>
          {canEdit && editingUnitNumber === `${officer.scheduleId}-${officer.type}` ? (
            <div className="flex items-center gap-1">
              <Input
                id={`unit-${officer.scheduleId}`}
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
              variant={officer.unitNumber ? "default" : "outline"} 
              className={`w-16 ${canEdit ? 'cursor-pointer hover:bg-muted transition-colors' : ''}`}
              onClick={handleEditUnitClick}
            >
              {officer.unitNumber || (canEdit ? "Add" : "-")}
            </Badge>
          )}
        </div>

        {/* Notes/Assignments */}
        <div className="text-center min-w-24 flex-1">
          <Label htmlFor={`notes-${officer.scheduleId}`} className="text-xs text-muted-foreground mb-1 block">
            Notes
          </Label>
          {canEdit && editingNotes === `${officer.scheduleId}-${officer.type}` ? (
            <div className="flex items-center gap-1">
              <Input
                id={`notes-${officer.scheduleId}`}
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
              {officer.notes || (canEdit ? "Add notes" : "-")}
            </div>
          )}
        </div>
      </div>

      {/* Position & Actions - Right Side */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Position Display/Edit */}
        {canEdit && editingSchedule === `${officer.scheduleId}-${officer.type}` ? (
          <div className="flex items-center gap-2">
            <div className="space-y-2">
              <Select value={editPosition} onValueChange={setEditPosition}>
                <SelectTrigger className="w-32">
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
                  className="w-32"
                />
              )}
            </div>
            <Button
              size="sm"
              onClick={handleSavePosition}
              disabled={isUpdating}
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditingSchedule(null);
                setEditPosition("");
                setCustomPosition("");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="text-right min-w-24">
            <Badge variant="secondary" className="mb-1 w-full justify-center">
              {officer.position || (sectionType === "special" ? "Special Assignment" : "No Position")}
            </Badge>
            {canEdit && (
              <div className="flex gap-1 justify-center">
                {/* Partnership Manager */}
                {onPartnershipChange && sectionType !== "pto" && (
                  <PartnershipManager 
                    officer={officer}
                    onPartnershipChange={onPartnershipChange}
                  />
                )}
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleEditClick}
                  title="Edit Position"
                  className="h-6 w-6"
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onAssignPTO(officer)}
                  title="Assign PTO"
                  className="h-6 w-6"
                >
                  <Clock className="h-3 w-3" />
                </Button>
                {/* DELETE BUTTON - Only show for exception officers (added shifts) */}
                {officer.type === "exception" && onRemove && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemove(officer)}
                    disabled={isUpdating}
                    title="Remove Added Shift"
                    className="h-6 w-6 text-red-600 hover:text-red-800 hover:bg-red-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
