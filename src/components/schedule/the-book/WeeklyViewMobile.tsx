// src/components/schedule/the-book/WeeklyViewMobile.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Edit, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface OfficerSchedule {
  id: string;
  name: string;
  emplId: string;
  shift: string;
  rank: string;
  schedule: string[];
  position?: string;
}

interface WeeklyViewMobileProps {
  shiftId: string;
}

const WeeklyViewMobile = ({ shiftId }: WeeklyViewMobileProps) => {
  // Mock data - replace with your actual data
  const officers: OfficerSchedule[] = [
    {
      id: "1",
      name: "John Smith",
      emplId: "12345",
      shift: "Day",
      rank: "Officer",
      schedule: ["A", "B", "Off", "A", "B", "Off", "Off"],
      position: "Patrol"
    },
    // Add more officers...
  ];

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="space-y-3">
      {officers.map((officer) => (
        <Card key={officer.id} className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{officer.name}</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {officer.rank}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  #{officer.emplId} • {officer.shift} • {officer.position}
                </div>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-sm">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Assignment
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-sm text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => (
                <div key={day} className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">{day}</div>
                  <div className={`text-sm font-medium p-1 rounded ${
                    officer.schedule[index] === "Off" 
                      ? "bg-gray-100 text-gray-600"
                      : "bg-blue-50 text-blue-700"
                  }`}>
                    {officer.schedule[index] || "-"}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Additional info row */}
            <div className="mt-3 pt-3 border-t flex justify-between text-sm">
              <div>
                <span className="text-muted-foreground">PTO Balance:</span>
                <span className="ml-2 font-medium">48 hrs</span>
              </div>
              <Badge variant="secondary">Regular</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {/* Add Officer Button */}
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <Button variant="outline" className="w-full">
            + Add Officer to Schedule
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default WeeklyViewMobile;
