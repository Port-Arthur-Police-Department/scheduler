import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreVertical, Edit, Trash2, Plane, CalendarCheck, CalendarX } from "lucide-react";
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
}

export const ScheduleCellMobile: React.FC<ScheduleCellMobileProps> = ({
  officer,
  dateStr,
  officerId,
  officerName,
  isAdminOrSupervisor,
  isSupervisor = false,
  isPPO = false,
  isRegularRecurringDay = false
}) => {
  const hasOfficerData = officer && officer.shiftInfo;
  const shiftInfo = officer?.shiftInfo;
  const isOff = shiftInfo?.isOff || false;
  const hasPTO = shiftInfo?.hasPTO || false;
  const position = shiftInfo?.position;
  const isScheduledDay = hasOfficerData && !isOff && !hasPTO;

  // Determine cell styling based on schedule type
  const cellClass = cn(
    "relative group h-8 flex items-center justify-center",
    // Green for ALL recurring days (scheduled days)
    isRegularRecurringDay && "bg-green-50 border-l-2 border-green-400",
    // Gray for non-scheduled days (not recurring, no assignment)
    !isRegularRecurringDay && !hasOfficerData && "bg-gray-100 border-l-2 border-gray-300"
  );

  // Handle PTO assignment
  const handleAssignPTO = () => {
    toast.info("PTO assignment coming soon");
  };

  // Handle remove PTO
  const handleRemovePTO = () => {
    toast.info("Remove PTO coming soon");
  };

  // Handle edit assignment
  const handleEditAssignment = () => {
    toast.info("Edit assignment coming soon");
  };

  // Handle remove officer
  const handleRemoveOfficer = () => {
    toast.info("Remove officer coming soon");
  };

  // Get cell content based on status
  const getCellContent = () => {
    if (!hasOfficerData) {
      // This is a non-scheduled day (not recurring, no assignment)
      return (
        <span className="text-xs text-muted-foreground">-</span>
      );
    }

    if (isOff) {
      return (
        <Badge variant="destructive" className="text-xs w-full justify-center">
          Off
        </Badge>
      );
    }

    if (hasPTO) {
      const ptoType = shiftInfo.ptoData?.ptoType || 'PTO';
      return (
        <Badge 
          variant="outline" 
          className="text-xs w-full justify-center bg-yellow-50 border-yellow-200"
        >
          {ptoType}
        </Badge>
      );
    }

    if (position) {
      return (
        <div className="flex flex-col items-center">
          <div className="text-xs truncate max-w-[80px]" title={position}>
            {position}
          </div>
          {isRegularRecurringDay && (
            <div className="flex items-center gap-1 mt-0.5">
              <CalendarCheck className="h-2 w-2 text-green-600" />
              <span className="text-[9px] text-green-600 font-medium">SCHEDULED</span>
            </div>
          )}
        </div>
      );
    }

    // This is a recurring day but with no specific assignment (just "-")
    return (
      <div className="flex flex-col items-center">
        <span className="text-xs text-muted-foreground">-</span>
        {isRegularRecurringDay && (
          <div className="flex items-center gap-1 mt-0.5">
            <CalendarCheck className="h-2 w-2 text-green-600" />
            <span className="text-[9px] text-green-600 font-medium">SCHEDULED</span>
          </div>
        )}
      </div>
    );
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
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {!hasPTO && !isOff && (
              <DropdownMenuItem onClick={handleAssignPTO}>
                <Plane className="h-3 w-3 mr-2" />
                Assign PTO
              </DropdownMenuItem>
            )}
            
            {hasPTO && (
              <DropdownMenuItem onClick={handleRemovePTO}>
                <Trash2 className="h-3 w-3 mr-2" />
                Remove PTO
              </DropdownMenuItem>
            )}
            
            {!isOff && (
              <DropdownMenuItem onClick={handleEditAssignment}>
                <Edit className="h-3 w-3 mr-2" />
                Edit Assignment
              </DropdownMenuItem>
            )}
            
            <DropdownMenuItem 
              onClick={handleRemoveOfficer}
              className="text-destructive"
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
