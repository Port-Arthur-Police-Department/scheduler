// src/components/schedule/the-book/ForceListViewMobile.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, UserX } from "lucide-react";

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
  // Mock data - replace with your actual data
  const forceData = [
    { shift: "Day Shift", total: 24, onDuty: 18, offDuty: 6 },
    { shift: "Evening Shift", total: 22, onDuty: 16, offDuty: 6 },
    { shift: "Night Shift", total: 20, onDuty: 15, offDuty: 5 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Force List</h2>
        </div>
        <Button size="sm">Refresh</Button>
      </div>

      {/* Shift selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {shiftTypes.map(shift => (
          <Button
            key={shift.id}
            size="sm"
            variant={selectedShiftId === shift.id ? "default" : "outline"}
            onClick={() => setSelectedShiftId(shift.id)}
            className="whitespace-nowrap"
          >
            {shift.name}
          </Button>
        ))}
      </div>

      {/* Force statistics */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-blue-50 p-3 rounded-lg text-center">
          <div className="text-xl font-bold">66</div>
          <div className="text-xs text-muted-foreground">Total Officers</div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg text-center">
          <div className="text-xl font-bold">49</div>
          <div className="text-xs text-muted-foreground">On Duty</div>
        </div>
        <div className="bg-red-50 p-3 rounded-lg text-center">
          <div className="text-xl font-bold">17</div>
          <div className="text-xs text-muted-foreground">Off Duty</div>
        </div>
      </div>

      {/* Shift breakdown */}
      <div className="space-y-3">
        {forceData.map((shift, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold">{shift.shift}</h3>
                <Badge>{shift.total} officers</Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-green-500" />
                    <span className="text-sm">On Duty</span>
                  </div>
                  <span className="font-medium">{shift.onDuty}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserX className="h-4 w-4 text-red-500" />
                    <span className="text-sm">Off Duty</span>
                  </div>
                  <span className="font-medium">{shift.offDuty}</span>
                </div>
              </div>
              
              {isAdminOrSupervisor && (
                <Button size="sm" variant="outline" className="w-full mt-3">
                  View Roster
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ForceListViewMobile;
