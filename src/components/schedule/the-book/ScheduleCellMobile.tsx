import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreVertical, Edit, Trash2, Plane, Umbrella, Star, Briefcase, CalendarOff } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ScheduleCellMobileProps {
  officer: any;
  dateStr: string;
  officerId: string;
  officerName: string;
  isAdminOrSupervisor: boolean;
  isSupervisor?: boolean;
  isPPO?: boolean;
  isRegularRecurringDay?: boolean;
  isSpecialAssignment?: (position: string) => boolean;
  // Add these new props for actions
  onAssignPTO?: (schedule: any, dateStr: string, officerId: string, officerName: string) => void;
  onRemovePTO?: (schedule: any, dateStr: string, officerId: string) => void;
  onEditAssignment?: (officer: any, dateStr: string) => void;
  onRemoveOfficer?: (scheduleId: string, type: 'recurring' | 'exception', officerData?: any) => void;
  isUpdating?: boolean;
}

// Helper function to get PTO abbreviation and icon
const getPTOInfo = (ptoType: string | undefined): { abbreviation: string; icon: React.ReactNode; colorClass: string } => {
  if (!ptoType) return { 
    abbreviation: 'PTO', 
    icon: <Umbrella className="h-3 w-3" />,
    colorClass: 'text-green-700' 
  };
  
  const ptoTypeLower = ptoType.toLowerCase();
  
  if (ptoTypeLower.includes('vacation')) {
    return { 
      abbreviation: 'Vac', 
      icon: <Plane className="h-3 w-3" />,
      colorClass: 'text-blue-700' 
    };
  }
  if (ptoTypeLower.includes('holiday')) {
    return { 
      abbreviation: 'Hol', 
      icon: <CalendarOff className="h-3 w-3" />,
      colorClass: 'text-orange-700' 
    };
  }
  if (ptoTypeLower.includes('sick')) {
    return { 
      abbreviation: 'Sick', 
      icon: <Briefcase className="h-3 w-3" />,
      colorClass: 'text-red-700' 
    };
  }
  if (ptoTypeLower.includes('comp')) {
    return { 
      abbreviation: 'Comp', 
      icon: <Star className="h-3 w-3" />,
      colorClass: 'text-purple-700' 
    };
  }
  
  return { 
    abbreviation: ptoType.substring(0, 3), 
    icon: <Umbrella className="h-3 w-3" />,
    colorClass: 'text-green-700' 
  };
};

export const ScheduleCellMobile: React.FC<ScheduleCellMobileProps> = ({
  officer,
  dateStr,
  officerId,
  officerName,
  isAdminOrSupervisor,
  isSupervisor = false,
  isPPO = false,
  isRegularRecurringDay = false,
  isSpecialAssignment,
  // New action props
  onAssignPTO,
  onRemovePTO,
  onEditAssignment,
  onRemoveOfficer,
  isUpdating = false,
}) => {
  const hasOfficerData = officer && officer.shiftInfo;
  const shiftInfo = officer?.shiftInfo;
  
  // PTO Detection - Look for ptoData with ptoType
  const hasPTO = shiftInfo?.hasPTO === true || 
                 (shiftInfo?.ptoData && shiftInfo.ptoData.ptoType);
  
  const ptoType = shiftInfo?.ptoData?.ptoType;
  const position = shiftInfo?.position;
  const isOff = shiftInfo?.isOff === true;
  
  // IMPORTANT: If it's marked as "Off" but has a PTO type, treat it as PTO, not "Off"
  const shouldShowAsPTO = hasPTO && ptoType;
  
  // Use the passed function or default detection
  const defaultIsSpecial = (position: string) => {
    if (!position) return false;
    const specialKeywords = ['other', 'special', 'training', 'detail', 'court', 'extra'];
    return specialKeywords.some(keyword => position.toLowerCase().includes(keyword));
  };
  
  const isSpecial = position && (isSpecialAssignment ? isSpecialAssignment(position) : defaultIsSpecial(position));

  // Determine cell styling based on schedule type
  const cellClass = cn(
    "relative group h-8 flex items-center justify-center",
    // PTO styling - apply based on PTO type
    shouldShowAsPTO && "border-l-2",
    // Vacation: Light blue
    shouldShowAsPTO && ptoType?.toLowerCase().includes('vacation') && "bg-blue-50 border-blue-400",
    // Holiday: Light orange
    shouldShowAsPTO && ptoType?.toLowerCase().includes('holiday') && "bg-orange-50 border-orange-400",
    // Sick: Light red
    shouldShowAsPTO && ptoType?.toLowerCase().includes('sick') && "bg-red-50 border-red-400",
    // Comp: Light purple
    shouldShowAsPTO && ptoType?.toLowerCase().includes('comp') && "bg-purple-50 border-purple-400",
    // Other PTO: Light green (fallback)
    shouldShowAsPTO && !ptoType?.toLowerCase().includes('vacation') && 
               !ptoType?.toLowerCase().includes('holiday') && 
               !ptoType?.toLowerCase().includes('sick') && 
               !ptoType?.toLowerCase().includes('comp') && "bg-green-50 border-green-400",
    // Purple for special assignments (but not if it's PTO)
    isSpecial && !shouldShowAsPTO && "bg-purple-50 border-l-2 border-purple-400",
    // Green for ALL recurring days (scheduled days) - but not if it's PTO or Special
    isRegularRecurringDay && !shouldShowAsPTO && !isSpecial && "bg-green-50 border-l-2 border-green-400",
    // Gray for non-scheduled days (not recurring, no assignment, no PTO)
    !isRegularRecurringDay && !hasOfficerData && !shouldShowAsPTO && "bg-gray-100 border-l-2 border-gray-300",
    // If marked as "Off" but no PTO type - should be rare, show as gray
    isOff && !shouldShowAsPTO && "bg-gray-200 border-l-2 border-gray-400"
  );

  // Get cell content based on status
  const getCellContent = () => {
    // If no officer data at all and it's not a recurring day
    if (!hasOfficerData && !isRegularRecurringDay) {
      return (
        <span className="text-xs text-muted-foreground">-</span>
      );
    }

    // If this is a recurring day but no specific data (just scheduled)
    if (isRegularRecurringDay && !hasOfficerData) {
      return (
        <div className="flex flex-col items-center">
          <div className="text-xs text-green-700 font-medium">Recur</div>
        </div>
      );
    }

    // PTO Handling - Show PTO abbreviation
    if (shouldShowAsPTO) {
      const ptoInfo = getPTOInfo(ptoType);
      return (
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1">
            <span className={`${ptoInfo.colorClass.replace('text-', 'text-')}`}>
              {ptoInfo.icon}
            </span>
            <span className={`text-xs font-medium ${ptoInfo.colorClass}`}>
              {ptoInfo.abbreviation}
            </span>
          </div>
          {/* Show position for partial PTO */}
          {shiftInfo?.ptoData?.isFullShift === false && position && (
            <div className="text-[10px] mt-0.5 truncate max-w-[70px] opacity-80" title={position}>
              {position}
            </div>
          )}
        </div>
      );
    }

    // Special Assignment
    if (isSpecial && position) {
      return (
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 text-purple-600" />
            <div className="text-xs truncate max-w-[70px] text-purple-700" title={position}>
              {position}
            </div>
          </div>
        </div>
      );
    }

    // Regular assignment (not special, not PTO)
    if (position) {
      return (
        <div className="flex flex-col items-center">
          <div className="text-xs truncate max-w-[80px]" title={position}>
            {position}
          </div>
        </div>
      );
    }

    // Recurring day with no specific position
    if (isRegularRecurringDay) {
      return (
        <div className="flex flex-col items-center">
          <div className="text-xs text-green-700 font-medium">Recur</div>
        </div>
      );
    }

    // If marked as "Off" but no PTO type (should be rare)
    if (isOff && !shouldShowAsPTO) {
      return (
        <Badge variant="outline" className="text-xs text-gray-600 border-gray-400 bg-gray-200">
          Off
        </Badge>
      );
    }

    // Fallback: Should not happen in a properly configured system
    return (
      <span className="text-xs text-muted-foreground">-</span>
    );
  };

  // Handle actions - use actual handlers if provided
  const handleAssignPTO = () => {
    if (onAssignPTO && officer?.shiftInfo) {
      onAssignPTO(officer.shiftInfo, dateStr, officerId, officerName);
    } else {
      toast.info("PTO assignment coming soon");
    }
  };

  const handleRemovePTO = () => {
    if (onRemovePTO && officer?.shiftInfo) {
      onRemovePTO(officer.shiftInfo, dateStr, officerId);
    } else {
      toast.info("Remove PTO coming soon");
    }
  };

  const handleEditAssignment = () => {
    if (onEditAssignment && officer) {
      onEditAssignment(officer, dateStr);
    } else {
      toast.info("Edit assignment coming soon");
    }
  };

  const handleRemoveOfficer = () => {
    if (onRemoveOfficer && officer?.shiftInfo) {
      onRemoveOfficer(
        officer.shiftInfo.scheduleId,
        officer.shiftInfo.scheduleType,
        officer
      );
    } else {
      toast.info("Remove officer coming soon");
    }
  };

  return (
    <div className={cellClass}>
      <div className="h-full flex items-center justify-center w-full">
        {getCellContent()}
      </div>
      
      {hasOfficerData && isAdminOrSupervisor && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-0 right-0 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
              disabled={isUpdating}
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {!shiftInfo?.hasPTO && !shiftInfo?.isOff && (
              <DropdownMenuItem onClick={handleAssignPTO} disabled={isUpdating}>
                <Plane className="h-3 w-3 mr-2" />
                Assign PTO
              </DropdownMenuItem>
            )}
            {shiftInfo?.hasPTO && (
              <DropdownMenuItem onClick={handleRemovePTO} disabled={isUpdating}>
                <Trash2 className="h-3 w-3 mr-2" />
                Remove PTO
              </DropdownMenuItem>
            )}
            {!shiftInfo?.hasPTO && !shiftInfo?.isOff && (
              <DropdownMenuItem onClick={handleEditAssignment} disabled={isUpdating}>
                <Edit className="h-3 w-3 mr-2" />
                Edit Assignment
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              onClick={handleRemoveOfficer} 
              className="text-destructive"
              disabled={isUpdating}
            >
              <Trash2 className="h-3 w-3 mr-2" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
