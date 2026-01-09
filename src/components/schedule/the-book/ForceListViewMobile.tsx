import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, ChevronLeft, ChevronRight, CalendarIcon, Filter, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, startOfYear, endOfYear } from "date-fns";
import { getLastName, getRankAbbreviation } from "./utils";
import { 
  getBadgeNumberForSorting,
  getServiceCreditForSorting,
  type OfficerForSorting 
} from "@/utils/sortingUtils";

interface ForceListViewMobileProps {
  selectedShiftId: string;
  setSelectedShiftId: (id: string) => void;
  shiftTypes: any[];
  isAdminOrSupervisor: boolean;
}

// Custom sort function for Force List
const sortForceListOfficers = (officers: OfficerForSorting[]) => {
  return [...officers].sort((a, b) => {
    // Primary: service credit (LEAST to most - ascending)
    const aCredit = getServiceCreditForSorting(a);
    const bCredit = getServiceCreditForSorting(b);
    
    if (aCredit !== bCredit) {
      console.log(`Service credit sort: ${a.full_name} (${aCredit}) vs ${b.full_name} (${bCredit}) -> ${aCredit - bCredit}`);
      return aCredit - bCredit;
    }
    
    // Secondary: badge number (DESCENDING - higher badge number = lower seniority = should be higher in force list)
    const aBadge = getBadgeNumberForSorting(a);
    const bBadge = getBadgeNumberForSorting(b);
    if (aBadge !== bBadge) {
      console.log(`Badge sort (equal credits): ${a.full_name} (${aBadge}) vs ${b.full_name} (${bBadge}) -> ${bBadge - aBadge} (DESCENDING)`);
      return bBadge - aBadge; // DESCENDING - higher badge number first
    }
    
    // Tertiary: last name (A-Z)
    const getLastNameFromFullName = (name: string = ""): string => {
      if (!name) return "";
      const parts = name.trim().split(/\s+/);
      return parts[parts.length - 1] || "";
    };
    
    const aLastName = getLastNameFromFullName(a.full_name);
    const bLastName = getLastNameFromFullName(b.full_name);
    const lastNameCompare = aLastName.localeCompare(bLastName);
    console.log(`Last name sort (equal credits & badges): ${a.full_name} (${aLastName}) vs ${b.full_name} (${bLastName}) -> ${lastNameCompare}`);
    return lastNameCompare;
  });
};

export const ForceListViewMobile: React.FC<ForceListViewMobileProps> = ({
  selectedShiftId,
  setSelectedShiftId,
  shiftTypes,
  isAdminOrSupervisor
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Fetch force list data
  const { data: forceData, isLoading } = useQuery({
    queryKey: ['mobile-force-list', selectedShiftId, selectedYear],
    queryFn: async () => {
      if (!selectedShiftId) return null;

      const yearStartDate = `${selectedYear}-01-01`;
      const yearEndDate = `${selectedYear}-12-31`;

      // Get officers who have recurring schedules for this shift
      const { data: recurringSchedules, error: recurringError } = await supabase
        .from("recurring_schedules")
        .select(`
          officer_id,
          profiles!recurring_schedules_officer_id_fkey (
            id,
            full_name,
            badge_number,
            rank,
            hire_date,
            promotion_date_sergeant,
            promotion_date_lieutenant,
            service_credit_override
          )
        `)
        .eq("shift_type_id", selectedShiftId)
        .or(`end_date.is.null,end_date.gte.${yearStartDate}`)
        .lte("start_date", yearEndDate);

      if (recurringError) {
        console.error("Error fetching recurring schedules:", recurringError);
        throw recurringError;
      }

      // Get forced dates
      const { data: forcedDates, error: forcedError } = await supabase
        .from("forced_dates")
        .select("*")
        .gte("forced_date", yearStartDate)
        .lte("forced_date", yearEndDate)
        .order("forced_date", { ascending: false });

      if (forcedError) {
        console.error("Error fetching forced dates:", forcedError);
        // Continue without forced dates
      }

      // Process officers - get unique officers
      const uniqueOfficersMap = new Map();
      recurringSchedules?.forEach(schedule => {
        if (schedule.profiles && !uniqueOfficersMap.has(schedule.profiles.id)) {
          uniqueOfficersMap.set(schedule.profiles.id, schedule.profiles);
        }
      });
      
      const officers = Array.from(uniqueOfficersMap.values());

      // Convert to OfficerForSorting format
      const officersForSorting: OfficerForSorting[] = officers.map(officer => ({
        id: officer.id,
        full_name: officer.full_name,
        officerName: officer.full_name,
        badge_number: officer.badge_number,
        badgeNumber: officer.badge_number,
        rank: officer.rank,
        service_credit: 0, // Will be calculated
        hire_date: officer.hire_date,
        service_credit_override: officer.service_credit_override || 0,
        promotion_date_sergeant: officer.promotion_date_sergeant,
        promotion_date_lieutenant: officer.promotion_date_lieutenant
      }));

      // Sort for Force List using custom sort function
      console.log('🔄 Sorting for Force List...');
      const sortedOfficers = sortForceListOfficers(officersForSorting);

      // Add force counts to sorted officers
      const officersWithData = sortedOfficers.map(officer => {
        const forceCount = forcedDates?.filter(fd => fd.officer_id === officer.id).length || 0;
        
        // Calculate actual service credit for display
        const serviceCredit = getServiceCreditForSorting(officer);
        
        return {
          ...officer,
          service_credit: serviceCredit,
          forceCount
        };
      });

      return {
        officers: officersWithData,
        forcedDates: forcedDates || [],
        summary: {
          totalOfficers: officersWithData.length,
          totalForced: forcedDates?.length || 0
        }
      };
    },
    enabled: !!selectedShiftId,
  });

  // Filter officers based on search
  const filteredOfficers = forceData?.officers?.filter(officer => {
    if (!searchQuery) return true;
    
    const searchLower = searchQuery.toLowerCase();
    return (
      officer.full_name.toLowerCase().includes(searchLower) ||
      officer.badge_number?.toLowerCase().includes(searchLower) ||
      officer.rank?.toLowerCase().includes(searchLower)
    );
  }) || [];

  // Categorize officers (Force list only includes Sergeants as supervisors)
  const supervisors = filteredOfficers.filter(officer => 
    officer.rank?.toLowerCase().includes('sergeant') || 
    officer.rank?.toLowerCase().includes('sgt')
  );

  const regularOfficers = filteredOfficers.filter(officer => 
    !officer.rank?.toLowerCase().includes('sergeant') &&
    !officer.rank?.toLowerCase().includes('sgt') &&
    !officer.rank?.toLowerCase().includes('probationary')
  );

  const ppos = filteredOfficers.filter(officer => 
    officer.rank?.toLowerCase() === 'probationary'
  );

  // Log sorting for debugging
  React.useEffect(() => {
    if (forceData?.officers && forceData.officers.length > 0) {
      console.log('📋 Force List Officers (first 10):');
      forceData.officers.slice(0, 10).forEach((officer, index) => {
        console.log(`${index + 1}. ${officer.full_name} - SC: ${officer.service_credit?.toFixed(1)} - Badge: ${officer.badge_number} - Force Count: ${officer.forceCount}`);
      });
    }
  }, [forceData]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Force List</h2>
        </div>
        <Badge variant="outline">
          {selectedYear}
        </Badge>
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

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search officers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-blue-50 p-3 rounded-lg text-center">
          <div className="text-xl font-bold">{supervisors.length}</div>
          <div className="text-xs text-muted-foreground">Sergeants</div>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg text-center">
          <div className="text-xl font-bold">{regularOfficers.length}</div>
          <div className="text-xs text-muted-foreground">Officers</div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg text-center">
          <div className="text-xl font-bold">{ppos.length}</div>
          <div className="text-xs text-muted-foreground">PPOs</div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading force list...</div>
      ) : !selectedShiftId ? (
        <div className="text-center py-8 text-muted-foreground">
          Please select a shift
        </div>
      ) : filteredOfficers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No officers found
        </div>
      ) : (
        <div className="space-y-4">
          {/* Supervisors */}
          {supervisors.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Sergeants ({supervisors.length})</h3>
              <div className="space-y-2">
                {supervisors.map((officer) => (
                  <Card key={officer.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-medium">
                            {getLastName(officer.full_name)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            #{officer.badge_number} • {getRankAbbreviation(officer.rank)}
                          </div>
                        </div>
                        <Badge variant={officer.forceCount > 0 ? "default" : "outline"}>
                          {officer.forceCount} forced
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Service Credit:</span>
                        <Badge variant="outline">
                          {officer.service_credit?.toFixed(1) || '0.0'} yrs
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Regular Officers */}
          {regularOfficers.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Officers ({regularOfficers.length})</h3>
              <div className="space-y-2">
                {regularOfficers.slice(0, 10).map((officer) => (
                  <Card key={officer.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-medium">
                            {getLastName(officer.full_name)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            #{officer.badge_number}
                          </div>
                        </div>
                        <Badge variant={officer.forceCount > 0 ? "default" : "outline"}>
                          {officer.forceCount} forced
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Service:</span>
                        <Badge variant="outline">
                          {officer.service_credit?.toFixed(1) || '0.0'} yrs
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {regularOfficers.length > 10 && (
                  <div className="text-center text-sm text-muted-foreground">
                    +{regularOfficers.length - 10} more officers
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PPOs */}
          {ppos.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">PPO Officers ({ppos.length})</h3>
              <div className="space-y-2">
                {ppos.map((officer) => (
                  <Card key={officer.id} className="bg-blue-50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-medium">
                            {getLastName(officer.full_name)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            #{officer.badge_number}
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-blue-100">
                          PPO
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Service:</span>
                        <Badge variant="outline">
                          {officer.service_credit?.toFixed(1) || '0.0'} yrs
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-3">Force List Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="h-5">
                2
              </Badge>
              <span>Number of times officer has been forced</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-5">
                0.5 yrs
              </Badge>
              <span>Service credit (sorted LEAST to MOST)</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-5 bg-blue-100">
                PPO
              </Badge>
              <span>Probationary Police Officer</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="text-xs text-muted-foreground">
                <strong>Sorting Priority:</strong><br />
                1. Service Credit (least to most)<br />
                2. Badge Number (higher to lower when service credits equal)<br />
                3. Last Name (A-Z)
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
