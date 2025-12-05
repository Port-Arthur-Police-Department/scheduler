import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plane, ChevronLeft, ChevronRight, Calendar, Filter, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, startOfYear, endOfYear, eachMonthOfInterval, isSameMonth } from "date-fns";
import { getLastName, getRankAbbreviation } from "./utils";

interface VacationListViewMobileProps {
  selectedShiftId: string;
  setSelectedShiftId: (id: string) => void;
  shiftTypes: any[];
}

export const VacationListViewMobile: React.FC<VacationListViewMobileProps> = ({
  selectedShiftId,
  setSelectedShiftId,
  shiftTypes
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Fetch vacation data
  const { data: vacationData, isLoading } = useQuery({
    queryKey: ['mobile-vacation-list', selectedShiftId, selectedYear],
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
            rank
          )
        `)
        .eq("is_off", true)
        .gte("date", startDate)
        .lte("date", endDate)
        .eq("shift_type_id", selectedShiftId);

      if (error) throw error;

      // Group by month
      const months = eachMonthOfInterval({
        start: new Date(selectedYear, 0, 1),
        end: new Date(selectedYear, 11, 31)
      });

      const monthData = months.map(month => {
        const monthKey = format(month, "yyyy-MM");
        const monthPTO = ptoExceptions?.filter(pto => 
          format(parseISO(pto.date), "yyyy-MM") === monthKey
        ) || [];
        
        const uniqueOfficers = new Set(monthPTO.map(pto => pto.officer_id));
        
        return {
          month,
          monthKey,
          totalDays: monthPTO.length,
          officerCount: uniqueOfficers.size,
          officers: Array.from(uniqueOfficers).map(id => 
            monthPTO.find(pto => pto.officer_id === id)?.profiles
          ).filter(Boolean)
        };
      });

      // Get officer summary
      const officerMap = new Map();
      ptoExceptions?.forEach(pto => {
        const officerId = pto.officer_id;
        if (!officerMap.has(officerId)) {
          officerMap.set(officerId, {
            officer: pto.profiles,
            totalDays: 0,
            months: new Set()
          });
        }
        const officerData = officerMap.get(officerId);
        officerData.totalDays += 1;
        officerData.months.add(format(parseISO(pto.date), "yyyy-MM"));
      });

      const officerSummary = Array.from(officerMap.values()).map(data => ({
        ...data,
        monthCount: data.months.size
      }));

      return {
        ptoExceptions: ptoExceptions || [],
        monthData,
        officerSummary,
        summary: {
          totalOfficers: officerMap.size,
          totalDays: ptoExceptions?.length || 0,
          averageDays: officerMap.size > 0 ? (ptoExceptions?.length || 0) / officerMap.size : 0
        }
      };
    },
    enabled: !!selectedShiftId,
  });

  const handleExport = () => {
    // Implement export logic
    console.log("Export vacation list");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plane className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Vacation List</h2>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
      </div>

      {/* Year Selection */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <Label>Select Year</Label>
            <Select 
              value={selectedYear.toString()} 
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2023, 2024, 2025, 2026].map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {vacationData && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <div className="text-xl font-bold">{vacationData.summary.totalOfficers}</div>
            <div className="text-xs text-muted-foreground">Officers</div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg text-center">
            <div className="text-xl font-bold">{vacationData.summary.totalDays}</div>
            <div className="text-xs text-muted-foreground">Days</div>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg text-center">
            <div className="text-xl font-bold">{vacationData.summary.averageDays.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Avg per Officer</div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">Loading vacation data...</div>
      ) : !selectedShiftId ? (
        <div className="text-center py-8 text-muted-foreground">
          Please select a shift
        </div>
      ) : !vacationData ? (
        <div className="text-center py-8 text-muted-foreground">
          No vacation data found
        </div>
      ) : (
        <>
          {/* Monthly Overview */}
          <div>
            <h3 className="font-semibold mb-2">Monthly Overview</h3>
            <div className="grid grid-cols-4 gap-1">
              {vacationData.monthData.map((month) => {
                const isCurrentMonth = isSameMonth(month.month, new Date());
                return (
                  <div 
                    key={month.monthKey} 
                    className={`text-center p-2 border rounded ${
                      isCurrentMonth ? 'bg-primary/10 border-primary' : ''
                    }`}
                  >
                    <div className="text-xs font-medium">{format(month.month, "MMM")}</div>
                    <div className="text-lg font-bold mt-1">{month.totalDays}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {month.officerCount} officers
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Officers */}
          <div>
            <h3 className="font-semibold mb-2">Officers with Most PTO</h3>
            <div className="space-y-2">
              {vacationData.officerSummary
                .sort((a, b) => b.totalDays - a.totalDays)
                .slice(0, 5)
                .map((data, index) => (
                  <Card key={data.officer.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 flex items-center justify-center bg-primary/10 rounded">
                            <span className="text-xs font-semibold">{index + 1}</span>
                          </div>
                          <div>
                            <div className="font-medium">
                              {getLastName(data.officer.full_name)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              #{data.officer.badge_number}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{data.totalDays} days</div>
                          <div className="text-xs text-muted-foreground">
                            {data.monthCount} months
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>

          {/* Recent PTO */}
          {vacationData.ptoExceptions.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Recent PTO</h3>
              <div className="space-y-2">
                {vacationData.ptoExceptions
                  .slice(0, 5)
                  .map((pto) => (
                    <Card key={pto.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">
                              {getLastName(pto.profiles?.full_name)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(parseISO(pto.date), "MMM d, yyyy")}
                            </div>
                          </div>
                          <Badge variant="outline">
                            {pto.pto_type || 'PTO'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-3">Vacation List Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-5">
                Vacation
              </Badge>
              <span>Paid time off</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-5">
                Sick
              </Badge>
              <span>Sick leave</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-5">
                15 days
              </Badge>
              <span>Total PTO days for officer</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
