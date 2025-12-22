import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreVertical, Edit, Trash2, Plane, CalendarX } from "lucide-react";
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
  if (!officer || !officer.shiftInfo) {
    return (
      <div className="h-8 flex items-center justify-center">
        <span className="text-xs text-muted-foreground">-</span>
      </div>
    );
  }

  const { shiftInfo } = officer;
  const isOff = shiftInfo.isOff;
  const hasPTO = shiftInfo.hasPTO;
  const position = shiftInfo.position;
  const isException = shiftInfo.scheduleType === 'exception';

  // Base cell class - add styling for non-recurring days (exceptions/ad-hoc assignments)
  const cellClass = cn(
    "relative group h-8 flex items-center justify-center",
    // Style non-recurring days (exceptions) - these should be marked
    !isRegularRecurringDay && position && !isOff && !hasPTO && "bg-gray-900 border border-gray-700"
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
      const textColor = !isRegularRecurringDay && position && !isOff && !hasPTO ? "text-gray-100" : "text-gray-900";
      
      return (
        <div className="flex flex-col items-center">
          <div className={cn("text-xs truncate max-w-[80px]", textColor)} title={position}>
            {position}
          </div>
          {!isRegularRecurringDay && position && !isOff && !hasPTO && (
            <div className="flex items-center gap-1 mt-0.5">
              <CalendarX className="h-2 w-2 text-gray-300" />
              <span className="text-[9px] text-gray-300 font-medium">AD-HOC</span>
            </div>
          )}
        </div>
      );
    }

    return (
      <span className="text-xs text-muted-foreground">-</span>
    );
  };

  return (
    <div className={cellClass}>
      <div className="h-full flex items-center justify-center w-full">
        {getCellContent()}
      </div>
      
      {isAdminOrSupervisor && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn(
                "absolute top-0 right-0 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity",
                !isRegularRecurringDay && position && !isOff && !hasPTO ? "text-gray-100" : ""
              )}
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
