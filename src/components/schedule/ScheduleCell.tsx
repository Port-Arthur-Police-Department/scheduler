// src/components/schedule/ScheduleCell.tsx - UPDATED WITH BETTER ERROR HANDLING
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Clock } from "lucide-react";
import { PREDEFINED_POSITIONS } from "@/constants/positions";
import { useColorSettings } from "@/hooks/useColorSettings";

interface ScheduleCellProps {
  officer: any;
  dateStr: string;
  officerId: string;
  officerName: string;
  isAdminOrSupervisor: boolean;
  onAssignPTO: (schedule: any, dateStr: string, officerId: string, officerName: string) => void;
  onRemovePTO: (schedule: any, dateStr: string, officerId: string) => void;
  onEditAssignment: (officer: any, dateStr: string) => void;
  onRemoveOfficer: (officer: any) => void;
  isUpdating?: boolean;
  isPPO?: boolean;
  partnerInfo?: string;
}

// Default fallback colors
const FALLBACK_COLORS = {
  supervisor: { bg: 'rgb(240, 249, 255)', text: 'rgb(0, 75, 150)' },
  officer: { bg: 'rgb(240, 255, 240)', text: 'rgb(0, 100, 0)' },
  ppo: { bg: 'rgb(255, 250, 240)', text: 'rgb(150, 75, 0)' },
  pto: { bg: 'rgb(144, 238, 144)', text: 'rgb(0, 100, 0)' },
  off: { bg: 'rgb(240, 240, 240)', text: 'rgb(100, 100, 100)' },
};

export const ScheduleCell = ({
  officer,
  dateStr,
  officerId,
  officerName,
  isAdminOrSupervisor,
  onAssignPTO,
  onRemovePTO,
  onEditAssignment,
  onRemoveOfficer,
  isUpdating = false,
  isPPO = false,
  partnerInfo = null
}: ScheduleCellProps) => {
  const { weekly: weeklyColors } = useColorSettings();
  // Use color settings with error boundary
//  let weeklyColors = FALLBACK_COLORS;
  try {
    const colorSettings = useColorSettings();
    weeklyColors = colorSettings.weekly;
  } catch (error) {
    console.warn('Color settings not available, using fallback colors');
  }

  // Check if this officer has any schedule data for this date
  const hasSchedule = !!officer;
  const isOff = officer?.shiftInfo?.isOff;
  const hasPTO = officer?.shiftInfo?.hasPTO;
  const position = officer?.shiftInfo?.position;
  const ptoData = officer?.shiftInfo?.ptoData;
  
  // Extra shift = schedule exception AND not their regular recurring day
  const isException = officer?.shiftInfo?.scheduleType === "exception";
  const isRegularDay = officer?.isRegularRecurringDay;
  const isExtraShift = isException && !isOff && !hasPTO && !isRegularDay;

  // Special Assignment detection
  const isSpecialAssignment = position && (
    position.toLowerCase().includes('other') ||
    (position && !PREDEFINED_POSITIONS.includes(position))
  );

  // PTO Logic
  const isFullDayPTO = hasPTO && ptoData?.isFullShift;
  const isPartialPTO = hasPTO && !ptoData?.isFullShift;

  // For PPOs, use partner display if available
  const displayPosition = isPPO && partnerInfo 
    ? `Partner with ${partnerInfo}`
    : position;

  // Get background color based on officer status using color settings
  const getBackgroundColor = () => {
    if (isOff) {
      return weeklyColors.off.bg;
    } else if (isFullDayPTO) {
      return weeklyColors.pto.bg;
    } else if (isPartialPTO) {
      return weeklyColors.pto.bg;
    } else if (isPPO) {
      return weeklyColors.ppo.bg;
    }
    return 'bg-white';
  };

  // Get text color based on officer status using color settings
  const getTextColor = () => {
    if (isOff) {
      return weeklyColors.off.text;
    } else if (hasPTO) {
      return weeklyColors.pto.text;
    } else if (isPPO) {
      return weeklyColors.ppo.text;
    }
    return 'text-foreground';
  };

  // If no officer data at all, this is an unscheduled day
  if (!hasSchedule) {
    return (
      <div 
        className="p-2 border-r min-h-10 relative"
        style={{ backgroundColor: weeklyColors.off.bg }}
      />
    );
  }

  return (
    <div 
      className={`
        p-2 border-r min-h-10 relative group
        ${isExtraShift ? 'border-orange-300' : ''}
      `}
      style={{ 
        backgroundColor: getBackgroundColor(),
        color: getTextColor()
      }}
    >
      {isOff ? (
        <div className="text-center font-medium">DD</div>
      ) : hasPTO ? (
        <div className="text-center">
          {/* PTO Badge */}
          <Badge 
            className="text-xs border-green-200"
            style={{
              backgroundColor: weeklyColors.pto.bg,
              color: weeklyColors.pto.text,
              borderColor: weeklyColors.pto.text
            }}
          >
            {ptoData?.ptoType || 'PTO'}
          </Badge>
          
          {/* Show position for partial PTO */}
          {isPartialPTO && displayPosition && (
            <div className="text-xs mt-1 truncate opacity-90">
              {displayPosition}
            </div>
          )}
          
          {/* Show "Partial Day" indicator for partial PTO */}
          {isPartialPTO && (
            <div className="text-xs font-medium mt-1 opacity-90">
              Partial Day
            </div>
          )}
        </div>
      ) : (
        <div className="text-center">
          {/* Show "Extra Shift" for true extra days */}
          {isExtraShift && (
            <Badge 
              variant="outline" 
              className="text-xs mb-1 border-orange-300"
              style={{
                backgroundColor: 'rgb(255, 247, 237)',
                color: 'rgb(194, 65, 12)'
              }}
            >
              Extra Shift
            </Badge>
          )}
          {/* Show "Special Assignment" badge only for actual special assignments */}
          {isSpecialAssignment && !isExtraShift && (
            <Badge 
              variant="outline" 
              className="text-xs mb-1 border-purple-300"
              style={{
                backgroundColor: 'rgb(250, 245, 255)',
                color: 'rgb(126, 34, 206)'
              }}
            >
              Special
            </Badge>
          )}
          {displayPosition && (
            <div className="text-sm font-medium truncate">
              {displayPosition}
            </div>
          )}
        </div>
      )}

      {/* Action buttons for admin/supervisor - Only show on hover */}
      {isAdminOrSupervisor && officer.shiftInfo && (
        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {/* PENCIL ICON - Edit Assignment */}
          {!isOff && (
            <Button
              size="icon"
              variant="secondary"
              className="h-6 w-6 bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-200 shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
                onEditAssignment(officer, dateStr);
              }}
              title="Edit Assignment"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          )}
          
          {/* DELETE BUTTON - Only show for extra shifts */}
          {isExtraShift && (
            <Button
              size="icon"
              variant="secondary"
              className="h-6 w-6 bg-red-100 hover:bg-red-200 text-red-700 border border-red-200 shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveOfficer(officer);
              }}
              disabled={isUpdating}
              title="Remove Extra Shift"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
          
          {/* CLOCK ICON - PTO Management */}
          {!isOff && (
            <Button
              size="icon"
              variant="secondary"
              className="h-6 w-6 bg-green-100 hover:bg-green-200 text-green-700 border border-green-200 shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
                onAssignPTO(officer.shiftInfo, dateStr, officerId, officerName);
              }}
              title={hasPTO ? "Edit PTO" : "Assign PTO"}
            >
              <Clock className="h-3 w-3" />
            </Button>
          )}
          
          {/* TRASH ICON - Remove PTO */}
          {hasPTO && (
            <Button
              size="icon"
              variant="secondary"
              className="h-6 w-6 bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-200 shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
                onRemovePTO(officer.shiftInfo, dateStr, officerId);
              }}
              disabled={isUpdating}
              title="Remove PTO"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
