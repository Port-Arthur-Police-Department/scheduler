import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { format, startOfYear, endOfYear, addYears, subYears } from "date-fns";

interface ForceListViewMobileProps {
  selectedShiftId: string;
  setSelectedShiftId: (id: string) => void;
  shiftTypes: any[];
  isAdminOrSupervisor: boolean;
}

const ForceListViewMobile = ({
  selectedShiftId,
  setSelectedShiftId,
  shiftTypes,
  isAdminOrSupervisor
}: ForceListViewMobileProps) => {
  // Simplified force list view for mobile
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Force List</h2>
        </div>
        <Badge variant="outline">
          {format(new Date(), "yyyy")}
        </Badge>
      </div>

      {/* Year navigation */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="sm">
              <ChevronLeft className="h-4 w-4" />
              Prev Year
            </Button>
            <Button variant="outline" size="sm">
              Current Year
            </Button>
            <Button variant="outline" size="sm">
              Next Year
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="text-center text-sm text-muted-foreground">
            Force list data will appear here. Use the desktop view for detailed information.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForceListViewMobile;
