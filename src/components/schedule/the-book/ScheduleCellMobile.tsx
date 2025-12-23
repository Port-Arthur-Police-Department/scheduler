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
  isSpecialAssignment
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
// Update the cellClass logic in ScheduleCellMobile.tsx:
const cellClass = cn(
  "relative group h-8 flex items-center justify-center",
  // PTO styling
  shiftInfo?.hasPTO && shiftInfo?.ptoData?.ptoType && "border-l-2",
  // Vacation
  shiftInfo?.ptoData?.ptoType?.toLowerCase().includes('vacation') && "bg-blue-50 border-blue-400",
  // Holiday
  shiftInfo?.ptoData?.ptoType?.toLowerCase().includes('holiday') && "bg-orange-50 border-orange-400",
  // Sick
  shiftInfo?.ptoData?.ptoType?.toLowerCase().includes('sick') && "bg-red-50 border-red-400",
  // Comp
  shiftInfo?.ptoData?.ptoType?.toLowerCase().includes('comp') && "bg-purple-50 border-purple-400",
  // Other PTO
  shiftInfo?.hasPTO && shiftInfo?.ptoData?.ptoType && 
  !shiftInfo?.ptoData?.ptoType?.toLowerCase().includes('vacation') && 
  !shiftInfo?.ptoData?.ptoType?.toLowerCase().includes('holiday') && 
  !shiftInfo?.ptoData?.ptoType?.toLowerCase().includes('sick') && 
  !shiftInfo?.ptoData?.ptoType?.toLowerCase().includes('comp') && "bg-green-50 border-green-400",
  // Special assignment
  isSpecial && !shiftInfo?.hasPTO && "bg-purple-50 border-l-2 border-purple-400",
  // Regular recurring day
  isRegularRecurringDay && !shiftInfo?.hasPTO && !isSpecial && "bg-green-50 border-l-2 border-green-400",
  // Empty cell
  !hasOfficerData && !isRegularRecurringDay && "bg-gray-100 border-l-2 border-gray-300"
);

  // Get cell content based on status
const getCellContent = () => {
  console.log('📱 ScheduleCellMobile for', officerName, 'on', dateStr, ':', {
    hasOfficerData,
    shiftInfo,
    isRegularRecurringDay,
    hasPTO: shiftInfo?.hasPTO,
    ptoType: shiftInfo?.ptoData?.ptoType
  });

  // If no officer data at all
  if (!hasOfficerData) {
    // Check if this is a recurring day (should have data, but just in case)
    if (isRegularRecurringDay) {
      return (
        <div className="flex flex-col items-center">
          <div className="text-xs text-green-700 font-medium">Recur</div>
        </div>
      );
    }
    return (
      <span className="text-xs text-muted-foreground">-</span>
    );
  }

  // PTO Handling - This should be the primary check
  if (shiftInfo?.hasPTO && shiftInfo?.ptoData?.ptoType) {
    console.log('🟢 Found PTO:', shiftInfo.ptoData.ptoType);
    const ptoInfo = getPTOInfo(shiftInfo.ptoData.ptoType);
    return (
      <div className="flex flex-col items-center p-1">
        <div className="flex items-center gap-1">
          <span className={`${ptoInfo.colorClass}`}>
            {ptoInfo.icon}
          </span>
          <span className={`text-xs font-medium ${ptoInfo.colorClass}`}>
            {ptoInfo.abbreviation}
          </span>
        </div>
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

  // Fallback
  return (
    <span className="text-xs text-muted-foreground">-</span>
  );
};

  // Handle actions
  const handleAssignPTO = () => toast.info("PTO assignment coming soon");
  const handleRemovePTO = () => toast.info("Remove PTO coming soon");
  const handleEditAssignment = () => toast.info("Edit assignment coming soon");
  const handleRemoveOfficer = () => toast.info("Remove officer coming soon");

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
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {!shouldShowAsPTO && (
              <DropdownMenuItem onClick={handleAssignPTO}>
                <Plane className="h-3 w-3 mr-2" />
                Assign PTO
              </DropdownMenuItem>
            )}
            {shouldShowAsPTO && (
              <DropdownMenuItem onClick={handleRemovePTO}>
                <Trash2 className="h-3 w-3 mr-2" />
                Remove PTO
              </DropdownMenuItem>
            )}
            {!shouldShowAsPTO && (
              <DropdownMenuItem onClick={handleEditAssignment}>
                <Edit className="h-3 w-3 mr-2" />
                Edit Assignment
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleRemoveOfficer} className="text-destructive">
              <Trash2 className="h-3 w-3 mr-2" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
