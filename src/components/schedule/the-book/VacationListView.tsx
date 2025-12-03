// VacationListView.tsx
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfYear, endOfYear, eachMonthOfInterval, isSameMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plane, CalendarIcon, Filter, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getLastName, getRankAbbreviation } from "./utils";

interface VacationListViewProps {
  selectedShiftId: string;
  setSelectedShiftId: (shiftId: string) => void;
  shiftTypes: any[];
}

export const VacationListView: React.FC<VacationListViewProps> = ({
  selectedShiftId,
  setSelectedShiftId,
  shiftTypes
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showAllVacations, setShowAllVacations] = useState<boolean>(false);

  // Remove the local shiftTypes query since we get it from parent

  // Fetch vacation data
  const { data: vacationData, isLoading } = useQuery({
    queryKey: ['vacation-list', selectedShiftId, selectedYear, showAllVacations],
    queryFn: async () => {
      if (!selectedShiftId) return null;

      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;

      // Fetch PTO exceptions
      const { data: ptoExceptions, error } = await supabase
        .from("schedule_exceptions")
        .select(`
          *,
          profiles!schedule_exceptions_officer_id_fkey (
            id,
            full_name,
            badge_number,
            rank,
            vacation_hours,
            holiday_hours,
            sick_hours,
            comp_hours
          )
        `)
        .eq("is_off", true)
        .gte("date", startDate)
        .lte("date", endDate)
        .eq("shift_type_id", selectedShiftId);

      if (error) throw error;

      // Group PTO by officer and month
      const ptoByOfficer = new Map();
      const ptoByMonth = new Map();

      ptoExceptions?.forEach(pto => {
        const officerId = pto.officer_id;
        const month = pto.date.substring(0, 7); // YYYY-MM
        
        // Initialize officer data
        if (!ptoByOfficer.has(officerId)) {
          ptoByOfficer.set(officerId, {
            officer: pto.profiles,
            ptoDays: new Map(),
            totalDays: 0
          });
        }

        // Initialize month data
        if (!ptoByMonth.has(month)) {
          ptoByMonth.set(month, {
            month,
            officers: new Set(),
            totalDays: 0
          });
        }

        const officerData = ptoByOfficer.get(officerId);
        const monthData = ptoByMonth.get(month);

        // Count days
        officerData.totalDays += 1;
        officerData.ptoDays.set(month, (officerData.ptoDays.get(month) || 0) + 1);
        
        monthData.officers.add(officerId);
        monthData.totalDays += 1;
      });

      return {
        ptoExceptions: ptoExceptions || [],
        ptoByOfficer: Array.from(ptoByOfficer.values()),
        ptoByMonth: Array.from(ptoByMonth.values()),
        summary: {
          totalOfficers: ptoByOfficer.size,
          totalDays: ptoExceptions?.length || 0,
          averageDays: ptoExceptions?.length ? (ptoExceptions.length / ptoByOfficer.size) : 0
        }
      };
    },
    enabled: !!selectedShiftId,
  });

  const months = eachMonthOfInterval({
    start: startOfYear(new Date(selectedYear, 0, 1)),
    end: endOfYear(new Date(selectedYear, 0, 1))
  });

  const handleExport = () => {
    toast.info("Export feature coming soon!");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5" />
              Vacation List
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium text-muted-foreground">
                Shift: {shiftTypes?.find(s => s.id === selectedShiftId)?.name || "Not selected"}
              </div>
              <Button onClick={handleExport} size="sm" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* Year Selector */}
            <div className="space-y-2">
              <Label htmlFor="year-select">Year</Label>
              <select 
                id="year-select"
                value={selectedYear.toString()}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {[2023, 2024, 2025, 2026].map((year) => (
                  <option key={year} value={year.toString()}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Show All Toggle */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Switch
                  checked={showAllVacations}
                  onCheckedChange={setShowAllVacations}
                />
                Show All Vacations (Including Past)
              </Label>
            </div>

            {/* Summary Stats */}
            <div className="space-y-2">
              <Label>Summary</Label>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{vacationData?.summary?.totalOfficers || 0}</div>
                  <div className="text-sm text-muted-foreground">Officers</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{vacationData?.summary?.totalDays || 0}</div>
                  <div className="text-sm text-muted-foreground">Days</div>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {!selectedShiftId ? (
            <div className="text-center py-8 text-muted-foreground">
              Please select a shift from the Weekly or Monthly tab first
            </div>
          ) : isLoading ? (
            <div className="text-center py-8">Loading vacation data...</div>
          ) : (
            <div className="space-y-6">
              {/* Monthly Overview */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Monthly Overview - {selectedYear}</h3>
                <div className="grid grid-cols-6 gap-2">
                  {months.map((month) => {
                    const monthKey = format(month, "yyyy-MM");
                    const monthData = vacationData?.ptoByMonth.find(m => m.month === monthKey);
                    const isCurrentMonth = isSameMonth(month, new Date());
                    
                    return (
                      <div 
                        key={monthKey} 
                        className={`text-center p-3 border rounded-lg ${isCurrentMonth ? 'bg-primary/10 border-primary' : ''}`}
                      >
                        <div className="font-medium">{format(month, "MMM")}</div>
                        <div className="text-2xl font-bold mt-1">{monthData?.totalDays || 0}</div>
                        <div className="text-xs text-muted-foreground">days</div>
                        <div className="text-xs mt-1">{monthData?.officers.size || 0} officers</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Officer Vacation Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Officer Vacation Details</h3>
                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 bg-muted/50 p-3 font-semibold border-b">
                    <div className="col-span-3">Officer</div>
                    <div className="col-span-2">Badge #</div>
                    <div className="col-span-2">Rank</div>
                    <div className="col-span-2">Total Days</div>
                    <div className="col-span-3">Months</div>
                  </div>
                  
                  <div className="max-h-[400px] overflow-y-auto">
                    {vacationData?.ptoByOfficer.map(({ officer, totalDays, ptoDays }) => (
                      <div key={officer.id} className="grid grid-cols-12 p-3 border-b hover:bg-muted/30">
                        <div className="col-span-3 font-medium">{getLastName(officer.full_name)}</div>
                        <div className="col-span-2">{officer.badge_number}</div>
                        <div className="col-span-2">
                          <Badge variant="outline">{getRankAbbreviation(officer.rank)}</Badge>
                        </div>
                        <div className="col-span-2 font-bold">{totalDays}</div>
                        <div className="col-span-3">
                          <div className="flex flex-wrap gap-1">
                            {Array.from(ptoDays.entries()).map(([month, days]) => (
                              <Badge key={month} variant="secondary" className="text-xs">
                                {format(new Date(month + "-01"), "MMM")}: {days}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {vacationData?.ptoByOfficer.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">
                        No vacation data found for {selectedYear}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* PTO Balance Summary */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">PTO Balance Summary</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg bg-blue-50">
                    <div className="text-sm text-blue-700 font-medium">Vacation Hours</div>
                    <div className="text-2xl font-bold mt-1">
                      {vacationData?.ptoByOfficer.reduce((sum, { officer }) => 
                        sum + (officer.vacation_hours || 0), 0
                      ).toFixed(1) || "0.0"}
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg bg-green-50">
                    <div className="text-sm text-green-700 font-medium">Holiday Hours</div>
                    <div className="text-2xl font-bold mt-1">
                      {vacationData?.ptoByOfficer.reduce((sum, { officer }) => 
                        sum + (officer.holiday_hours || 0), 0
                      ).toFixed(1) || "0.0"}
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg bg-red-50">
                    <div className="text-sm text-red-700 font-medium">Sick Hours</div>
                    <div className="text-2xl font-bold mt-1">
                      {vacationData?.ptoByOfficer.reduce((sum, { officer }) => 
                        sum + (officer.sick_hours || 0), 0
                      ).toFixed(1) || "0.0"}
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg bg-purple-50">
                    <div className="text-sm text-purple-700 font-medium">Comp Hours</div>
                    <div className="text-2xl font-bold mt-1">
                      {vacationData?.ptoByOfficer.reduce((sum, { officer }) => 
                        sum + (officer.comp_hours || 0), 0
                      ).toFixed(1) || "0.0"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
