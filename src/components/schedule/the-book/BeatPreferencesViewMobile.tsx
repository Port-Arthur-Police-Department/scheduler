// src/components/schedule/the-book/BeatPreferencesViewMobile.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Star, Clock, Users } from "lucide-react";

interface BeatPreferencesViewMobileProps {
  isAdminOrSupervisor: boolean;
  selectedShiftId: string;
  setSelectedShiftId: (id: string) => void;
  shiftTypes: any[];
}

const BeatPreferencesViewMobile = ({
  isAdminOrSupervisor,
  selectedShiftId,
  setSelectedShiftId,
  shiftTypes
}: BeatPreferencesViewMobileProps) => {
  // Mock data - replace with your actual data
  const beats = [
    { id: 1, name: "Downtown Patrol", officers: 3, priority: "High" },
    { id: 2, name: "North District", officers: 2, priority: "Medium" },
    { id: 3, name: "South District", officers: 4, priority: "Low" },
    { id: 4, name: "Airport Zone", officers: 2, priority: "High" },
    { id: 5, name: "Harbor Patrol", officers: 1, priority: "Medium" },
  ];

  const officerPreferences = [
    { officer: "John Smith", beat: "Downtown Patrol", preference: "High", experience: "5 years" },
    { officer: "Jane Doe", beat: "Airport Zone", preference: "High", experience: "3 years" },
    { officer: "Bob Johnson", beat: "North District", preference: "Medium", experience: "2 years" },
    { officer: "Sarah Wilson", beat: "South District", preference: "Low", experience: "1 year" },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high": return "bg-red-100 text-red-800 border-red-200";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low": return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Beat Preferences</h2>
        </div>
        <Button size="sm">Submit Preference</Button>
      </div>

      {/* Shift filter */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="text-sm font-medium">Filter by Shift</div>
            <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Shift" />
              </SelectTrigger>
              <SelectContent>
                {shiftTypes.map(shift => (
                  <SelectItem key={shift.id} value={shift.id}>
                    {shift.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Beats overview */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Available Beats
          </h3>
          <div className="space-y-3">
            {beats.map(beat => (
              <div key={beat.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{beat.name}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                    <Users className="h-3 w-3" />
                    {beat.officers} officers assigned
                  </div>
                </div>
                <Badge variant="outline" className={getPriorityColor(beat.priority)}>
                  {beat.priority}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Officer preferences */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Star className="h-4 w-4" />
            Officer Preferences
          </h3>
          <div className="space-y-3">
            {officerPreferences.map((pref, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium">{pref.officer}</div>
                    <div className="text-sm text-muted-foreground">Preferred: {pref.beat}</div>
                  </div>
                  <Badge variant="outline" className={getPriorityColor(pref.preference)}>
                    {pref.preference}
                  </Badge>
                </div>
                <div className="text-sm flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span className="text-muted-foreground">Experience:</span>
                  <span className="font-medium">{pref.experience}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Admin actions */}
      {isAdminOrSupervisor && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Admin Actions</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                Assign Officers to Beats
              </Button>
              <Button variant="outline" className="w-full justify-start">
                View Conflict Report
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Export Beat Assignments
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BeatPreferencesViewMobile;
