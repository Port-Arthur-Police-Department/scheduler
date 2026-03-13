// src/components/schedule/OfficerSection.tsx
import { Badge } from "@/components/ui/badge";
import { OfficerCard } from "./OfficerCard";
import { PTOCard } from "./PTOCard";
import { PartnershipManager } from "./PartnershipManager";
import { SpecialAssignmentWarningDialog } from "./SpecialAssignmentWarningDialog";
import { useState } from "react";
import { PREDEFINED_POSITIONS } from "@/constants/positions";

interface OfficerSectionProps {
  title: string;
  officers?: any[];
  ptoRecords?: any[];
  minCount?: number;
  currentCount?: number;
  isUnderstaffed?: boolean;
  canEdit: boolean;
  onSavePosition: (officer: any, position: string) => void;
  onSaveUnitNumber: (officer: any, unitNumber: string) => void;
  onSaveNotes: (officer: any, notes: string) => void;
  onAssignPTO: (officer: any) => void;
  onRemoveOfficer?: (officer: any) => void;
  onEditPTO?: (ptoRecord: any) => void;
  onRemovePTO?: (ptoRecord: any) => void;
  onPartnershipChange?: (officer: any, partnerOfficerId?: string) => void;
  isUpdating?: boolean;
  sectionType?: "regular" | "special" | "pto";
  colorSettings?: any;
  showSpecialOccasions?: boolean;
}

export const OfficerSection = ({
  title,
  officers = [],
  ptoRecords = [],
  minCount,
  currentCount,
  isUnderstaffed,
  canEdit,
  onSavePosition,
  onSaveUnitNumber,
  onSaveNotes,
  onAssignPTO,
  onRemoveOfficer,
  onEditPTO,
  onRemovePTO,
  onPartnershipChange,
  isUpdating = false,
  sectionType = "regular",
  colorSettings,
  showSpecialOccasions = true
}: OfficerSectionProps) => {
  // State for the special assignment warning dialog
  const [specialAssignmentWarning, setSpecialAssignmentWarning] = useState<{
    open: boolean;
    officer: any;
    newPosition: string;
  } | null>(null);

  const isPTOSection = sectionType === "pto";
  const hasData = isPTOSection ? ptoRecords.length > 0 : officers.length > 0;

  // Default colors if no settings
  const defaultColors = {
    schedule_supervisor_bg: "240,248,255",
    schedule_supervisor_text: "25,25,112",
    schedule_officer_bg: "248,249,250",
    schedule_officer_text: "33,37,41",
    schedule_special_bg: "243,229,245",
    schedule_special_text: "102,51,153",
    schedule_pto_bg: "230,255,242",
    schedule_pto_text: "0,100,0"
  };

  // Function to get section style based on type and settings
  const getSectionStyle = () => {
    const colors = colorSettings || defaultColors;
    
    switch (sectionType) {
      case "special":
        return {
          headerStyle: {
            backgroundColor: `rgb(${colors.schedule_special_bg})`,
            color: `rgb(${colors.schedule_special_text})`,
            borderColor: `rgb(${colors.schedule_special_bg})`
          },
          contentStyle: {
            backgroundColor: `rgb(${colors.schedule_special_bg})`
          }
        };
      case "pto":
        return {
          headerStyle: {
            backgroundColor: `rgb(${colors.schedule_pto_bg})`,
            color: `rgb(${colors.schedule_pto_text})`,
            borderColor: `rgb(${colors.schedule_pto_bg})`
          },
          contentStyle: {
            backgroundColor: `rgb(${colors.schedule_pto_bg})`
          }
        };
      case "regular":
      default:
        // Check if this is likely a supervisor section by title
        if (title.toLowerCase().includes('supervisor')) {
          return {
            headerStyle: {
              backgroundColor: `rgb(${colors.schedule_supervisor_bg})`,
              color: `rgb(${colors.schedule_supervisor_text})`,
              borderColor: `rgb(${colors.schedule_supervisor_bg})`
            },
            contentStyle: {
              backgroundColor: `rgb(${colors.schedule_supervisor_bg})`
            }
          };
        } else {
          return {
            headerStyle: {
              backgroundColor: `rgb(${colors.schedule_officer_bg})`,
              color: `rgb(${colors.schedule_officer_text})`,
              borderColor: `rgb(${colors.schedule_officer_bg})`
            },
            contentStyle: {
              backgroundColor: `rgb(${colors.schedule_officer_bg})`
            }
          };
        }
    }
  };

  const sectionStyle = getSectionStyle();

  // Get the background color safely
  const getBackgroundColor = () => {
    if (!sectionStyle.contentStyle || !sectionStyle.contentStyle.backgroundColor) {
      // Return default based on section type
      const colors = colorSettings || defaultColors;
      if (sectionType === "special") return `rgb(${colors.schedule_special_bg})`;
      if (sectionType === "pto") return `rgb(${colors.schedule_pto_bg})`;
      if (title.toLowerCase().includes('supervisor')) return `rgb(${colors.schedule_supervisor_bg})`;
      return `rgb(${colors.schedule_officer_bg})`;
    }
    return sectionStyle.contentStyle.backgroundColor;
  };

  const backgroundColor = getBackgroundColor();

  // Handler for position changes with partnership warning
  const handlePositionChangeWithWarning = (officer: any, newPosition: string) => {
    // Check if this is a special assignment that will break a partnership
    const isSpecialAssignment = 
      newPosition === "Other (Custom)" || 
      (newPosition && !PREDEFINED_POSITIONS.includes(newPosition as any));
    
    const hasActivePartnership = officer.isPartnership && !officer.partnershipSuspended && officer.partnerData;
    
    if (isSpecialAssignment && hasActivePartnership) {
      // Show warning dialog
      setSpecialAssignmentWarning({
        open: true,
        officer,
        newPosition
      });
    } else {
      // No warning needed, proceed directly
      onSavePosition(officer, newPosition);
    }
  };

  // UPDATED: Handler for confirming special assignment after warning
  const handleConfirmSpecialAssignment = async () => {
    if (specialAssignmentWarning) {
      const { officer, newPosition } = specialAssignmentWarning;
      
      console.log("🔴 Confirming special assignment for:", officer.name);
      console.log("🔴 Partner data:", officer.partnerData);
      
      // First, save the new position
      await onSavePosition(officer, newPosition);
      
      // Then, if there's a partnership, trigger suspension
      if (officer.partnerData && onPartnershipChange) {
        console.log("🔴 Triggering partnership suspension for:", officer.name);
        
        // Create a properly formatted officer object with all necessary data
        const officerWithPartner = {
          ...officer,
          // Ensure partner data is properly passed
          partnerOfficerId: officer.partnerData.partnerOfficerId,
          partnerData: officer.partnerData
        };
        
        // Call onPartnershipChange with undefined to remove/suspend the partnership
        // This will trigger the handleRemovePartnership function in DailyScheduleView
        onPartnershipChange(officerWithPartner, undefined);
        
        console.log("🔴 Partnership suspension triggered");
      } else {
        console.log("🔴 No partner data or onPartnershipChange not available");
      }
      
      // Close the dialog
      setSpecialAssignmentWarning(null);
      
      // Force a small delay to allow the mutations to complete
      setTimeout(() => {
        console.log("🔴 Special assignment process completed");
      }, 500);
    }
  };

  return (
    <div className="space-y-2">
      <div 
        className="flex items-center justify-between border-b pb-2 px-3 py-2 rounded-t-lg"
        style={sectionStyle.headerStyle}
      >
        <h4 className="font-semibold text-sm" style={{ color: sectionStyle.headerStyle?.color || 'inherit' }}>
          {title}
        </h4>
        {minCount !== undefined && currentCount !== undefined ? (
          <Badge variant={isUnderstaffed ? "destructive" : "outline"}>
            {currentCount} / {minCount}
          </Badge>
        ) : (
          <Badge variant="outline">
            {isPTOSection ? ptoRecords.length : officers.length}
          </Badge>
        )}
      </div>
      
      {!hasData ? (
        <p className="text-sm text-muted-foreground italic">
          No {title.toLowerCase()} scheduled
        </p>
      ) : isPTOSection ? (
        <div 
          className="space-y-2 p-2 rounded-b-lg border"
          style={{ backgroundColor, borderColor: sectionStyle.headerStyle?.borderColor }}
        >
          {ptoRecords.map((ptoRecord) => (
            <PTOCard
              key={ptoRecord.id}
              ptoRecord={ptoRecord}
              canEdit={canEdit}
              onSaveUnitNumber={(record, unit) => onSaveUnitNumber(record, unit)}
              onSaveNotes={(record, notes) => onSaveNotes(record, notes)}
              onEdit={onEditPTO!}
              onRemove={onRemovePTO!}
              isUpdating={isUpdating}
            />
          ))}
        </div>
      ) : (
        <div 
          className="space-y-2 p-2 rounded-b-lg border"
          style={{ backgroundColor, borderColor: sectionStyle.headerStyle?.borderColor }}
        >
          {officers
            .map((officer) => (
              <OfficerCard
                key={`${officer.scheduleId}-${officer.type}`}
                officer={officer}
                canEdit={canEdit}
                onSavePosition={handlePositionChangeWithWarning}
                onSaveUnitNumber={(off, unit) => onSaveUnitNumber(off, unit)}
                onSaveNotes={(off, notes) => onSaveNotes(off, notes)}
                onAssignPTO={onAssignPTO}
                onRemove={onRemoveOfficer}
                onPartnershipChange={onPartnershipChange}
                isUpdating={isUpdating}
                sectionType={sectionType}
                backgroundColor={backgroundColor}
                showSpecialOccasions={showSpecialOccasions}
              />
            ))
            .filter(Boolean)}
        </div>
      )}

      {/* Special Assignment Warning Dialog */}
      {specialAssignmentWarning && (
        <SpecialAssignmentWarningDialog
          open={specialAssignmentWarning.open}
          onOpenChange={(open) => !open && setSpecialAssignmentWarning(null)}
          officer={specialAssignmentWarning.officer}
          partnerData={specialAssignmentWarning.officer.partnerData}
          onConfirm={handleConfirmSpecialAssignment}
          onCancel={() => setSpecialAssignmentWarning(null)}
        />
      )}
    </div>
  );
};
