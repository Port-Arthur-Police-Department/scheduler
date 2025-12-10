// src/components/schedule/OfficerSection.tsx
import { Badge } from "@/components/ui/badge";
import { OfficerCard } from "./OfficerCard";
import { PTOCard } from "./PTOCard";
import { PartnershipManager } from "./PartnershipManager"; // We'll create this

// Update the OfficerSectionProps interface
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
  colorSettings?: any; // Add this line
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
  colorSettings // Add this line
}: OfficerSectionProps) => {
  const isPTOSection = sectionType === "pto";
  const hasData = isPTOSection ? ptoRecords.length > 0 : officers.length > 0;

  // Function to get section style based on type and settings
  const getSectionStyle = () => {
    // Default colors if no settings
    const defaultColors = {
      schedule_supervisor_bg: "240,248,255",
      schedule_supervisor_text: "25,25,112",
      schedule_officer_bg: "248,249,250",
      schedule_officer_text: "33,37,41",
      schedule_special_bg: "243,229,245",
      schedule_special_text: "102,51,153",
      schedule_pto_bg: "230,255,242",
      schedule_pto_text: "0,100,0",
    };

    const colors = colorSettings || defaultColors;
    
    switch (sectionType) {
      case "special":
        return {
          headerBg: `bg-[rgb(${colors.schedule_special_bg})]`,
          headerText: `text-[rgb(${colors.schedule_special_text})]`,
          borderColor: "border-purple-200 dark:border-purple-800"
        };
      case "pto":
        return {
          headerBg: `bg-[rgb(${colors.schedule_pto_bg})]`,
          headerText: `text-[rgb(${colors.schedule_pto_text})]`,
          borderColor: "border-green-200 dark:border-green-800"
        };
      case "regular":
      default:
        // Check if this is likely a supervisor section by title
        if (title.toLowerCase().includes('supervisor')) {
          return {
            headerBg: `bg-[rgb(${colors.schedule_supervisor_bg})]`,
            headerText: `text-[rgb(${colors.schedule_supervisor_text})]`,
            borderColor: "border-blue-200 dark:border-blue-800"
          };
        } else {
          return {
            headerBg: `bg-[rgb(${colors.schedule_officer_bg})]`,
            headerText: `text-[rgb(${colors.schedule_officer_text})]`,
            borderColor: "border-gray-200 dark:border-gray-800"
          };
        }
    }
  };

  const sectionStyle = getSectionStyle();

  return (
    <div className="space-y-2">
      <div className={`flex items-center justify-between border-b pb-2 ${sectionStyle.headerBg} ${sectionStyle.borderColor} px-3 py-2 rounded-t-lg`}>
        <h4 className={`font-semibold text-sm ${sectionStyle.headerText}`}>{title}</h4>
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
        <div className={`space-y-2 p-2 ${sectionStyle.headerBg} rounded-b-lg border ${sectionStyle.borderColor}`}>
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
        <div className={`space-y-2 p-2 ${sectionStyle.headerBg} rounded-b-lg border ${sectionStyle.borderColor}`}>
          {officers
            .map((officer) => (
              <OfficerCard
                key={`${officer.scheduleId}-${officer.type}`}
                officer={officer}
                canEdit={canEdit}
                onSavePosition={onSavePosition}
                onSaveUnitNumber={(off, unit) => onSaveUnitNumber(off, unit)}
                onSaveNotes={(off, notes) => onSaveNotes(off, notes)}
                onAssignPTO={onAssignPTO}
                onRemove={onRemoveOfficer}
                onPartnershipChange={onPartnershipChange}
                isUpdating={isUpdating}
                sectionType={sectionType}
              />
            ))
            .filter(Boolean)}
        </div>
      )}
    </div>
  );
};
