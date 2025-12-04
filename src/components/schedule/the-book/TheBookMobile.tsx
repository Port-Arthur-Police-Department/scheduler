// src/components/schedule/the-book/TheBookMobile.tsx
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, ChevronLeft, ChevronRight, CalendarDays, Users, Plane, MapPin } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

// Mobile-specific view components
import { WeeklyViewMobile } from "./WeeklyViewMobile";
import { MonthlyViewMobile } from "./MonthlyViewMobile";
import { ForceListViewMobile } from "./ForceListViewMobile";
import { VacationListViewMobile } from "./VacationListViewMobile";
import { BeatPreferencesViewMobile } from "./BeatPreferencesViewMobile";

interface TheBookMobileProps {
  userRole?: string;
  isAdminOrSupervisor?: boolean;
}

const TheBookMobile = ({ userRole = 'officer', isAdminOrSupervisor = false }: TheBookMobileProps) => {
  const [activeView, setActiveView] = useState<"weekly" | "monthly" | "force-list" | "vacation-list" | "beat-preferences">("weekly");
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");

  // Mock data - replace with your actual data fetching
  const shiftTypes = [
    { id: "1", name: "Day Shift", start_time: "07:00", end_time: "15:00" },
    { id: "2", name: "Evening Shift", start_time: "15:00", end_time: "23:00" },
    { id: "3", name: "Night Shift", start_time: "23:00", end_time: "07:00" },
  ];

  const renderView = () => {
    switch (activeView) {
      case "weekly":
        return <WeeklyViewMobile shiftId={selectedShiftId} />;
      case "monthly":
        return <MonthlyViewMobile shiftId={selectedShiftId} />;
      case "force-list":
        return <ForceListViewMobile />;
      case "vacation-list":
        return <VacationListViewMobile />;
      case "beat-preferences":
        return <BeatPreferencesViewMobile />;
      default:
        return <WeeklyViewMobile shiftId={selectedShiftId} />;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Schedule
            </CardTitle>
            
            {/* Shift Selector for Mobile */}
            <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select Shift" />
              </SelectTrigger>
              <SelectContent>
                {shiftTypes.map((shift) => (
                  <SelectItem key={shift.id} value={shift.id}>
                    {shift.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mobile-optimized Tabs */}
          <div className="mt-3">
            <Tabs value={activeView} onValueChange={(v: any) => setActiveView(v)}>
              <TabsList className="w-full grid grid-cols-3 h-auto">
                <TabsTrigger value="weekly" className="flex-col h-auto py-2">
                  <CalendarIcon className="h-4 w-4 mb-1" />
                  <span className="text-xs">Weekly</span>
                </TabsTrigger>
                <TabsTrigger value="monthly" className="flex-col h-auto py-2">
                  <CalendarDays className="h-4 w-4 mb-1" />
                  <span className="text-xs">Monthly</span>
                </TabsTrigger>
                
                {/* More options dropdown */}
                <Sheet>
                  <SheetTrigger asChild>
                    <TabsTrigger value="more" className="flex-col h-auto py-2">
                      <Users className="h-4 w-4 mb-1" />
                      <span className="text-xs">More</span>
                    </TabsTrigger>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[70vh]">
                    <div className="pt-6 space-y-4">
                      <h3 className="font-semibold text-lg">Schedule Views</h3>
                      <div className="space-y-2">
                        <Button
                          variant={activeView === "force-list" ? "default" : "ghost"}
                          className="w-full justify-start"
                          onClick={() => setActiveView("force-list")}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Force List
                        </Button>
                        <Button
                          variant={activeView === "vacation-list" ? "default" : "ghost"}
                          className="w-full justify-start"
                          onClick={() => setActiveView("vacation-list")}
                        >
                          <Plane className="h-4 w-4 mr-2" />
                          Vacation List
                        </Button>
                        <Button
                          variant={activeView === "beat-preferences" ? "default" : "ghost"}
                          className="w-full justify-start"
                          onClick={() => setActiveView("beat-preferences")}
                        >
                          <MapPin className="h-4 w-4 mr-2" />
                          Beat Preferences
                        </Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        
        <CardContent>
          {selectedShiftId ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button variant="outline" size="icon">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                  <div className="font-semibold">Week 45</div>
                  <div className="text-xs text-muted-foreground">Nov 4 - Nov 10, 2024</div>
                </div>
                <Button variant="outline" size="icon">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {renderView()}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Please select a shift to view schedule
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TheBookMobile;
