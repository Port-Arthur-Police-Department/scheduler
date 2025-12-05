// src/components/schedule/the-book/ForceListViewMobile.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

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
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Force List</h2>
      </div>
      
      {shiftTypes.map((shift) => (
        <Card key={shift.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold">{shift.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {shift.start_time} - {shift.end_time}
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setSelectedShiftId(shift.id)}
              >
                {selectedShiftId === shift.id ? "Selected" : "Select"}
              </Button>
            </div>
            
            {selectedShiftId === shift.id && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm">Shift selected. View officers on Weekly tab.</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ForceListViewMobile;
