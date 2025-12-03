// src/components/schedule/the-book/ForceListView.tsx
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Users, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ForceType, ForceListFilters } from "./types";
import { getLastName, getRankAbbreviation, getRankPriority, isSupervisorByRank } from "./utils";

export const ForceListView: React.FC = () => {
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [filters, setFilters] = useState<ForceListFilters>({
    startDate: startOfWeek(new Date(), { weekStartsOn: 0 }),
    endDate: endOfWeek(new Date(), { weekStartsOn: 0 }),
    forceType: "regular-force"
  });
  const [calendarOpen, setCalendarOpen] = useState<"start" | "end" | null>(null);

  // Get shift types
  const { data: shiftTypes } = useQuery({
    queryKey: ["shift-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_types")
        .select("*")
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  // Fetch force list data
  const { data: forceListData, isLoading } = useQuery({
    queryKey: ['force-list', selectedShiftId, filters],
    queryFn: async () => {
      if (!selectedShiftId) return null;

      const { data: officers, error } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          badge_number,
          rank,
          service_credit_override,
          hire_date
        `)
        .order("full_name");

      if (error) throw error;

      // Get schedule data for the date range
      const { data: scheduleData } = await supabase
        .from("recurring_schedules")
        .select(`
          *,
          shift_types (id, name, start_time, end_time)
        `)
        .eq("shift_type_id", selectedShiftId);

      return {
        officers: officers || [],
        scheduleData: scheduleData || []
      };
    },
    enabled: !!selectedShiftId,
  });

  const dates = eachDayOfInterval({ 
    start: filters.startDate, 
    end: filters.endDate 
  });

  // Categorize officers
  const supervisors = forceListData?.officers?.filter(officer => 
    isSupervisorByRank(officer)
  ) || [];

  const regularOfficers = forceListData?.officers?.filter(officer => 
    !isSupervisorByRank(officer) && officer.rank?.toLowerCase() !== 'probationary'
  ) || [];

  const ppos = forceListData?.officers?.filter(officer => 
    officer.rank?.toLowerCase() === 'probationary'
  ) || [];

  // Sort officers
  const sortedSupervisors = [...supervisors].sort((a, b) => {
    const aPriority = getRankPriority(a.rank);
    const bPriority = getRankPriority(b.rank);
    if (aPriority !== bPriority) return aPriority - bPriority;
    return getLastName(a.full_name).localeCompare(getLastName(b.full_name));
  });

  const sortedRegularOfficers = [...regularOfficers].sort((a, b) => {
    const aCredit = a.service_credit_override || 0;
    const bCredit = b.service_credit_override || 0;
    if (bCredit !== aCredit) return bCredit - aCredit;
    return getLastName(a.full_name).localeCompare(getLastName(b.full_name));
  });

  const sortedPPOs = [...ppos].sort((a, b) => {
    const aCredit = a.service_credit_override || 0;
    const bCredit = b.service_credit_override || 0;
    if (bCredit !== aCredit) return bCredit - aCredit;
    return getLastName(a.full_name).localeCompare(getLastName(b.full_name));
  });

  const handlePreviousWeek = () => {
    setFilters(prev => ({
      ...prev,
      startDate: addDays(prev.startDate, -7),
      endDate: addDays(prev.endDate, -7)
    }));
  };

  const handleNextWeek = () => {
    setFilters(prev => ({
      ...prev,
      startDate: addDays(prev.startDate, 7),
      endDate: addDays(prev.endDate, 7)
    }));
  };

  const handleToday = () => {
    setFilters({
      startDate: startOfWeek(new Date(), { weekStartsOn: 0 }),
      endDate: endOfWeek(new Date(), { weekStartsOn: 0 }),
      forceType: filters.forceType
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Force List
            </CardTitle>
            <div className="flex items-center gap-3">
              <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select Shift" />
                </SelectTrigger>
                <SelectContent>
                  {shiftTypes?.map((shift) => (
                    <SelectItem key={shift.id} value={shift.id}>
                      {shift.name} ({shift.start_time} - {shift.end_time})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* Date Range Selector */}
            <div className="space-y-2">
              <Label htmlFor="date-range">Date Range</Label>
              <div className="flex items-center gap-2">
                <Popover open={calendarOpen === "start"} onOpenChange={(open) => setCalendarOpen(open ? "start" : null)}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.startDate ? format(filters.startDate, "PPP") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.startDate}
                      onSelect={(date) => {
                        if (date) {
                          setFilters(prev => ({ ...prev, startDate: date }));
                          setCalendarOpen("end");
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                <span className="text-muted-foreground">to</span>
                
                <Popover open={calendarOpen === "end"} onOpenChange={(open) => setCalendarOpen(open ? "end" : null)}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.endDate ? format(filters.endDate, "PPP") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.endDate}
                      onSelect={(date) => {
                        if (date) {
                          setFilters(prev => ({ ...prev, endDate: date }));
                          setCalendarOpen(null);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Force Type Toggle */}
            <div className="space-y-2">
              <Label>Force Type</Label>
              <ToggleGroup 
                type="single" 
                value={filters.forceType}
                onValueChange={(value: ForceType) => {
                  if (value) setFilters(prev => ({ ...prev, forceType: value }));
                }}
                className="justify-start"
              >
                <ToggleGroupItem value="regular-force" className="px-4">
                  Regular Force
                </ToggleGroupItem>
                <ToggleGroupItem value="true-force" className="px-4">
                  True Force
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Navigation Controls */}
            <div className="space-y-2">
              <Label>Navigation</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePreviousWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleToday}>
                  Today
                </Button>
                <Button variant="outline" size="sm" onClick={handleNextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {!selectedShiftId ? (
            <div className="text-center py-8 text-muted-foreground">
              Please select a shift to view the force list
            </div>
          ) : isLoading ? (
            <div className="text-center py-8">Loading force list...</div>
          ) : (
            <div className="space-y-6">
              {/* Date Header */}
              <div className="grid grid-cols-2 gap-4">
                {dates.map((date, index) => {
                  const isToday = isSameDay(date, new Date());
                  const dateColor = filters.forceType === "true-force" 
                    ? "text-red-600 font-bold" 
                    : "text-foreground";
                  
                  return (
                    <div key={index} className={`text-center p-2 border rounded-lg ${isToday ? 'bg-primary/10' : ''}`}>
                      <div className={`text-sm font-medium ${dateColor}`}>
                        {format(date, "EEE, MMM d")}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-2 gap-8">
                {/* Left Column - Supervisors */}
                <div className="space-y-4">
                  <div className="text-lg font-semibold border-b pb-2">
                    Supervisors
                  </div>
                  <div className="space-y-2">
                    {sortedSupervisors.map((officer) => (
                      <div key={officer.id} className="p-3 border rounded-lg hover:bg-muted/50">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">
                              {getLastName(officer.full_name)}
                              <Badge variant="outline" className="ml-2 text-xs">
                                {getRankAbbreviation(officer.rank)}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {officer.badge_number} • Service Credit: {officer.service_credit_override || 0}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column - Regular Officers */}
                <div className="space-y-4">
                  <div className="text-lg font-semibold border-b pb-2">
                    Officers
                  </div>
                  <div className="space-y-2">
                    {sortedRegularOfficers.map((officer) => (
                      <div key={officer.id} className="p-3 border rounded-lg hover:bg-muted/50">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{getLastName(officer.full_name)}</div>
                            <div className="text-sm text-muted-foreground">
                              {officer.badge_number} • Service Credit: {officer.service_credit_override || 0}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* PPO Section - Full Width */}
              {sortedPPOs.length > 0 && (
                <div className="space-y-4">
                  <div className="text-lg font-semibold border-b pb-2">
                    PPO Officers
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {sortedPPOs.map((officer) => (
                      <div key={officer.id} className="p-3 border rounded-lg hover:bg-muted/50 bg-blue-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">
                              {getLastName(officer.full_name)}
                              <Badge variant="outline" className="ml-2 text-xs bg-blue-100">
                                PPO
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {officer.badge_number} • Service Credit: {officer.service_credit_override || 0}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary Statistics */}
              <div className="grid grid-cols-4 gap-4 pt-4 border-t">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{sortedSupervisors.length}</div>
                  <div className="text-sm text-muted-foreground">Supervisors</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{sortedRegularOfficers.length}</div>
                  <div className="text-sm text-muted-foreground">Officers</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{sortedPPOs.length}</div>
                  <div className="text-sm text-muted-foreground">PPOs</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">
                    {sortedSupervisors.length + sortedRegularOfficers.length + sortedPPOs.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Force</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
