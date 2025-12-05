// src/components/schedule/the-book/VacationListViewMobile.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plane, Check, X, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface VacationListViewMobileProps {
  selectedShiftId: string;
  setSelectedShiftId: (id: string) => void;
  shiftTypes: any[];
}

const VacationListViewMobile = ({
  selectedShiftId,
  setSelectedShiftId,
  shiftTypes
}: VacationListViewMobileProps) => {
  // Mock data - replace with your actual data
  const vacationRequests = [
    { id: 1, officer: "John Smith", type: "Vacation", dates: "Nov 15-20, 2024", status: "pending" },
    { id: 2, officer: "Jane Doe", type: "Sick Leave", dates: "Nov 18, 2024", status: "approved" },
    { id: 3, officer: "Bob Johnson", type: "Personal Day", dates: "Nov 22, 2024", status: "denied" },
    { id: 4, officer: "Sarah Wilson", type: "Vacation", dates: "Dec 1-7, 2024", status: "pending" },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved": return <Check className="h-4 w-4 text-green-500" />;
      case "denied": return <X className="h-4 w-4 text-red-500" />;
      case "pending": return <Clock className="h-4 w-4 text-yellow-500" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-green-100 text-green-800 border-green-200";
      case "denied": return "bg-red-100 text-red-800 border-red-200";
      case "pending": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plane className="h-5 w-5" />
          <h2 className="text-lg font-semibold">PTO Requests</h2>
        </div>
        <Button size="sm">Request PTO</Button>
      </div>

      {/* Filter by shift */}
      {shiftTypes.length > 0 && (
        <Card>
          <CardContent className="p-4">
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
          </CardContent>
        </Card>
      )}

      {/* Vacation requests list */}
      <div className="space-y-3">
        {vacationRequests.map(request => (
          <Card key={request.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold">{request.officer}</h3>
                  <p className="text-sm text-muted-foreground">{request.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(request.status)}
                  <Badge variant="outline" className={getStatusColor(request.status)}>
                    {request.status}
                  </Badge>
                </div>
              </div>
              
              <div className="text-sm mb-3">
                <div className="text-muted-foreground">Dates:</div>
                <div className="font-medium">{request.dates}</div>
              </div>
              
              {request.status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" variant="outline">
                    <Check className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button size="sm" className="flex-1" variant="outline">
                    <X className="h-4 w-4 mr-1" />
                    Deny
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-3">Summary</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold">4</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="p-2 bg-green-50 rounded-lg">
              <div className="text-lg font-bold">1</div>
              <div className="text-xs text-muted-foreground">Approved</div>
            </div>
            <div className="p-2 bg-yellow-50 rounded-lg">
              <div className="text-lg font-bold">2</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VacationListViewMobile;
