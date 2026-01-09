// ForceListView.tsx - Updated to show profiles scheduled for the selected year
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, parseISO, addDays, startOfYear, endOfYear } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { CalendarIcon, Users, ChevronLeft, ChevronRight, Clock, X, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getLastName, getRankAbbreviation } from "./utils";
import { auditLogger } from "@/lib/auditLogger";

interface ForcedDate {
  id?: string;
  officer_id: string;
  forced_date: string;
  is_red?: boolean;
  notes?: string;
  created_at?: string;
}

interface ForceListViewProps {
  selectedShiftId: string;
  setSelectedShiftId: (shiftId: string) => void;
  shiftTypes: any[];
  isAdminOrSupervisor: boolean;
}

// Helper to check if officer should be excluded from force list
const shouldExcludeFromForceList = (rank: string): boolean => {
  if (!rank) return false;
  const rankLower = rank.toLowerCase();
  
  // Exclude Lieutenants, Chiefs, Deputy Chiefs, and PPOs/Probationary officers
  return rankLower.includes('lieutenant') || 
         rankLower.includes('lt') || 
         rankLower.includes('chief') || 
         rankLower.includes('deputy') ||
         rankLower.includes('probationary') ||
         rankLower.includes('ppo');
};

// Custom sort function for Force List
const sortForceListOfficers = (officers: any[], getForceCount: (officerId: string) => number) => {
  return [...officers].sort((a, b) => {
    // Primary: service credit (LEAST to most - ascending)
    const aCredit = a.service_credit || 0;
    const bCredit = b.service_credit || 0;
    
    if (aCredit !== bCredit) {
      return aCredit - bCredit;
    }
    
    // Secondary: badge number (DESCENDING - higher badge number = lower seniority = should be higher in force list)
    const getBadgeNumber = (officer: any): number => {
      const badgeNum = officer.badge_number || officer.badgeNumber;
      if (!badgeNum) return 9999;
      
      const parsed = parseInt(badgeNum);
      return isNaN(parsed) ? 9999 : parsed;
    };
    
    const aBadge = getBadgeNumber(a);
    const bBadge = getBadgeNumber(b);
    if (aBadge !== bBadge) {
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
    return aLastName.localeCompare(bLastName);
  });
};

export const ForceListView: React.FC<ForceListViewProps> = ({
  selectedShiftId,
  setSelectedShiftId,
  shiftTypes,
  isAdminOrSupervisor
}) => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<{
    startDate: Date;
    endDate: Date;
  }>({
    startDate: startOfYear(new Date()),
    endDate: endOfYear(new Date()),
  });
  const [calendarOpen, setCalendarOpen] = useState<"start" | "end" | null>(null);
  const [editingForcedDate, setEditingForcedDate] = useState<{
    officerId: string;
    officerName: string;
    date: Date | null;
    isRed: boolean;
    notes: string;
  } | null>(null);

  // Fetch forced dates
  const { data: forcedDates } = useQuery({
    queryKey: ['forced-dates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forced_dates")
        .select("*")
        .order("forced_date", { ascending: false });

      if (error) {
        console.error("Error fetching forced dates:", error);
        return [];
      }
      return data as ForcedDate[];
    },
  });

  // Mutation to add/update forced date
  const addForcedDateMutation = useMutation({
    mutationFn: async ({ officerId, forcedDate, isRed, notes }: {
      officerId: string;
      forcedDate: string;
      isRed: boolean;
      notes: string;
    }) => {
      const { data, error } = await supabase
        .from("forced_dates")
        .upsert({
          officer_id: officerId,
          forced_date: forcedDate,
          is_red: isRed,
          notes: notes || null
        }, {
          onConflict: 'officer_id,forced_date'
        });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      // Log to audit
      auditLogger.logDatabaseOperation(
        'UPSERT',
        'forced_dates',
        data?.[0]?.id,
        undefined,
        variables,
        `Forced date added for officer ${variables.officerId}`
      );
      
      toast.success("Forced date saved");
      queryClient.invalidateQueries({ queryKey: ['forced-dates'] });
      setEditingForcedDate(null);
    },
    onError: (error) => {
      toast.error("Error saving forced date");
      console.error("Error saving forced date:", error);
    }
  });

  // Mutation to delete forced date
  const deleteForcedDateMutation = useMutation({
    mutationFn: async (forcedDateId: string) => {
      const { error } = await supabase
        .from("forced_dates")
        .delete()
        .eq("id", forcedDateId);

      if (error) throw error;
    },
    onSuccess: (_, forcedDateId) => {
      // Log to audit
      auditLogger.logDatabaseOperation(
        'DELETE',
        'forced_dates',
        forcedDateId,
        undefined,
        undefined,
        `Forced date removed`
      );
      
      toast.success("Forced date removed");
      queryClient.invalidateQueries({ queryKey: ['forced-dates'] });
    },
    onError: (error) => {
      toast.error("Error removing forced date");
      console.error("Error removing forced date:", error);
    }
  });

  // Fetch force list data - SHOW PROFILES WITH RECURRING SCHEDULES FOR THE SELECTED SHIFT AND YEAR
  const { data: forceListData, isLoading } = useQuery({
    queryKey: ['force-list', selectedShiftId, filters.startDate],
    queryFn: async () => {
      if (!selectedShiftId) return null;

      const selectedYear = filters.startDate.getFullYear();
      const yearStartDate = `${selectedYear}-01-01`;
      const yearEndDate = `${selectedYear}-12-31`;

      // Get officers who have recurring schedules for this shift that overlap with the selected year
      const { data: recurringSchedules, error: recurringError } = await supabase
        .from("recurring_schedules")
        .select(`
          officer_id,
          start_date,
          end_date,
          profiles!recurring_schedules_officer_id_fkey (
            id,
            full_name,
            badge_number,
            rank,
            service_credit_override,
            hire_date,
            promotion_date_sergeant,
            promotion_date_lieutenant
          )
        `)
        .eq("shift_type_id", selectedShiftId)
        .or(`end_date.is.null,end_date.gte.${yearStartDate}`)  // Schedule hasn't ended OR ends after year starts
        .lte("start_date", yearEndDate);  // Schedule starts before year ends

      if (recurringError) {
        console.error("Error fetching recurring schedules for force list:", recurringError);
        throw recurringError;
      }

      // Process officers - get unique officers and EXCLUDE Lieutenants/Chiefs/PPOs
      const uniqueOfficersMap = new Map();
      const excludedOfficers: any[] = [];
      
      recurringSchedules?.forEach(schedule => {
        if (schedule.profiles) {
          // Check if officer should be included (exclude Lieutenants/Chiefs/PPOs)
          if (shouldExcludeFromForceList(schedule.profiles.rank)) {
            excludedOfficers.push({
              name: schedule.profiles.full_name,
              rank: schedule.profiles.rank
            });
          } else {
            if (!uniqueOfficersMap.has(schedule.profiles.id)) {
              uniqueOfficersMap.set(schedule.profiles.id, schedule.profiles);
            }
          }
        }
      });
      
      const officers = Array.from(uniqueOfficersMap.values());

      // Log excluded officers for debugging
      if (excludedOfficers.length > 0) {
        console.log('🚫 Officers excluded from force list (Lieutenants/Chiefs/PPOs):', 
          excludedOfficers
        );
      }

      console.log(`📊 Included officers for force list: ${officers.length}`);

      // Fetch service credits for each officer via RPC
      console.log('🔄 Fetching service credits for officers...');
      const officersWithCredits = await Promise.all(
        officers.map(async (officer) => {
          try {
            const { data: creditData, error: creditError } = await supabase
              .rpc('get_service_credit', { profile_id: officer.id });
            
            if (creditError) {
              console.error(`Error fetching service credit for ${officer.full_name}:`, creditError);
              return {
                ...officer,
                service_credit: 0
              };
            }
            
            const serviceCredit = parseFloat(creditData) || 0;
            console.log(`Officer ${officer.full_name} - Service Credit: ${serviceCredit}`);
            
            return {
              ...officer,
              service_credit: serviceCredit
            };
          } catch (error) {
            console.error(`Error fetching service credit for ${officer.full_name}:`, error);
            return {
              ...officer,
              service_credit: 0
            };
          }
        })
      );

      return {
        officers: officersWithCredits || [],
        totalCount: officersWithCredits.length
      };
    },
    enabled: !!selectedShiftId,
  });

  // Get forced dates for each officer
  const getOfficerForcedDates = (officerId: string) => {
    return forcedDates?.filter(fd => fd.officer_id === officerId) || [];
  };

  // Get force count for each officer
  const getForceCount = (officerId: string) => {
    return getOfficerForcedDates(officerId).length;
  };

  // Get most recent forced date
  const getMostRecentForcedDate = (officerId: string) => {
    const dates = getOfficerForcedDates(officerId);
    if (dates.length === 0) return null;
    
    return dates.reduce((mostRecent, current) => {
      const mostRecentDate = parseISO(mostRecent.forced_date);
      const currentDate = parseISO(current.forced_date);
      return currentDate.getTime() > mostRecentDate.getTime() ? current : mostRecent;
    });
  };

  // Format service credit to one decimal place
  const formatServiceCredit = (credit: any) => {
    if (credit === undefined || credit === null) return '0.0';
    const num = parseFloat(credit);
    return isNaN(num) ? '0.0' : num.toFixed(1);
  };

  // After getting forceListData...
  const allOfficers = forceListData?.officers || [];

  // Sort officers for force list
  const sortedOfficers = sortForceListOfficers(allOfficers, getForceCount);

  // Now categorize the sorted officers
  const sortedSupervisors = sortedOfficers.filter(officer => {
    const rank = officer?.rank?.toLowerCase() || '';
    return (rank.includes('sergeant') || rank.includes('sgt')) && 
           !rank.includes('lieutenant') && 
           !rank.includes('lt') && 
           !rank.includes('chief') && 
           !rank.includes('deputy');
  });

  const sortedRegularOfficers = sortedOfficers.filter(officer => {
    const rank = officer?.rank?.toLowerCase() || '';
    // Check if it's a sergeant
    const isSergeant = rank.includes('sergeant') || rank.includes('sgt');
    
    // Include only if NOT a sergeant (all others are regular officers)
    return !isSergeant;
  });

  const handlePreviousWeek = () => {
    setFilters(prev => ({
      ...prev,
      startDate: startOfYear(addDays(prev.startDate, -365)),
      endDate: endOfYear(addDays(prev.endDate, -365))
    }));
  };

  const handleNextWeek = () => {
    setFilters(prev => ({
      ...prev,
      startDate: startOfYear(addDays(prev.startDate, 365)),
      endDate: endOfYear(addDays(prev.endDate, 365))
    }));
  };

  const handleToday = () => {
    setFilters({
      startDate: startOfYear(new Date()),
      endDate: endOfYear(new Date())
    });
  };

  const handleAddForcedDate = (officerId: string, officerName: string) => {
    setEditingForcedDate({
      officerId,
      officerName,
      date: new Date(),
      isRed: false,
      notes: ''
    });
  };

  const handleSaveForcedDate = () => {
    if (!editingForcedDate || !editingForcedDate.date) return;

    addForcedDateMutation.mutate({
      officerId: editingForcedDate.officerId,
      forcedDate: format(editingForcedDate.date, "yyyy-MM-dd"),
      isRed: editingForcedDate.isRed,
      notes: editingForcedDate.notes
    });
  };

  const handleDeleteForcedDate = (forcedDateId: string) => {
    if (confirm("Are you sure you want to remove this forced date?")) {
      deleteForcedDateMutation.mutate(forcedDateId);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Force List
              {forceListData?.totalCount !== undefined && (
                <Badge variant="outline" className="ml-2">
                  {forceListData.totalCount} officers
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium text-muted-foreground">
                Shift: {shiftTypes?.find(s => s.id === selectedShiftId)?.name || "Not selected"}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Date Range Selector */}
            <div className="space-y-2">
              <Label htmlFor="date-range">Calendar Year</Label>
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
              <div className="text-center pt-1">
                <Badge variant="secondary">
                  {format(filters.startDate, "yyyy")}
                </Badge>
              </div>
            </div>

            {/* Navigation Controls */}
            <div className="space-y-2">
              <Label>Navigation</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePreviousWeek}>
                  <ChevronLeft className="h-4 w-4" />
                  Prev Year
                </Button>
                <Button variant="outline" size="sm" onClick={handleToday}>
                  Current Year
                </Button>
                <Button variant="outline" size="sm" onClick={handleNextWeek}>
                  Next Year
                  <ChevronRight className="h-4 w-4" />
                </Button>
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
            <div className="text-center py-8">Loading force list...</div>
          ) : forceListData?.officers?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No officers scheduled for {shiftTypes?.find(s => s.id === selectedShiftId)?.name} shift in {format(filters.startDate, "yyyy")}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header with Service Credit Column */}
              <div className="grid grid-cols-10 bg-muted/50 p-3 font-semibold border rounded-t-lg">
                <div className="col-span-2">Officer</div>
                <div className="col-span-1">Badge #</div>
                <div className="col-span-1">Rank</div>
                <div className="col-span-1 text-center">Service Credit</div>
                <div className="col-span-1 text-center">Force Count</div>
                <div className="col-span-2">Forced Dates</div>
                <div className="col-span-1">Actions</div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 gap-4">
                {/* Supervisors Section */}
                {sortedSupervisors.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-lg font-semibold border-b pb-2">
                      Sergeants ({sortedSupervisors.length})
                    </div>
                    {sortedSupervisors.map((officer) => {
                      const forcedDates = getOfficerForcedDates(officer.id);
                      const forceCount = getForceCount(officer.id);
                      const mostRecent = getMostRecentForcedDate(officer.id);
                      
                      return (
                        <div key={officer.id} className="grid grid-cols-10 p-3 border rounded-lg hover:bg-muted/30 items-center">
                          <div className="col-span-2">
                            <div className="font-medium">
                              {getLastName(officer.full_name)}
                              <Badge variant="outline" className="ml-2 text-xs">
                                {getRankAbbreviation(officer.rank)}
                              </Badge>
                            </div>
                          </div>
                          <div className="col-span-1">
                            {officer.badge_number}
                          </div>
                          <div className="col-span-1">
                            <Badge variant="secondary" className="text-xs">
                              {getRankAbbreviation(officer.rank)}
                            </Badge>
                          </div>
                          <div className="col-span-1 text-center">
                            <Badge variant="outline" className="text-xs font-mono">
                              {formatServiceCredit(officer.service_credit)}
                            </Badge>
                          </div>
                          <div className="col-span-1 text-center">
                            <Badge 
                              variant={forceCount === 0 ? "outline" : "default"}
                              className={forceCount === 0 ? "" : "bg-blue-600"}
                            >
                              {forceCount}
                            </Badge>
                          </div>
                          <div className="col-span-2">
                            <div className="flex flex-wrap gap-1">
                              {forcedDates.map((forcedDate) => (
                                <Badge 
                                  key={forcedDate.id}
                                  variant="outline"
                                  className={`text-xs ${forcedDate.is_red ? 'bg-red-100 text-red-800 border-red-300' : 'bg-gray-100 text-gray-800 border-gray-300'}`}
                                >
                                  {format(parseISO(forcedDate.forced_date), "MMM d")}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-3 w-3 ml-1 hover:bg-red-100 hover:text-red-600"
                                    onClick={() => forcedDate.id && handleDeleteForcedDate(forcedDate.id)}
                                    title="Remove forced date"
                                  >
                                    <X className="h-2 w-2" />
                                  </Button>
                                </Badge>
                              ))}
                              {forcedDates.length === 0 && (
                                <span className="text-sm text-muted-foreground italic">Never forced</span>
                              )}
                            </div>
                            {mostRecent && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Last: {format(parseISO(mostRecent.forced_date), "MMM d, yyyy")}
                              </div>
                            )}
                          </div>
                          <div className="col-span-1">
                            {isAdminOrSupervisor ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddForcedDate(officer.id, officer.full_name)}
                                title="Add forced date"
                              >
                                <Clock className="h-3 w-3 mr-1" />
                                Force
                              </Button>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                View Only
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Regular Officers Section */}
                {sortedRegularOfficers.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-lg font-semibold border-b pb-2 mt-4">
                      Officers ({sortedRegularOfficers.length})
                    </div>
                    {sortedRegularOfficers.map((officer) => {
                      const forcedDates = getOfficerForcedDates(officer.id);
                      const forceCount = getForceCount(officer.id);
                      const mostRecent = getMostRecentForcedDate(officer.id);
                      
                      return (
                        <div key={officer.id} className="grid grid-cols-10 p-3 border rounded-lg hover:bg-muted/30 items-center">
                          <div className="col-span-2">
                            <div className="font-medium">{getLastName(officer.full_name)}</div>
                          </div>
                          <div className="col-span-1">
                            {officer.badge_number}
                          </div>
                          <div className="col-span-1">
                            <Badge variant="secondary" className="text-xs">
                              {getRankAbbreviation(officer.rank)}
                            </Badge>
                          </div>
                          <div className="col-span-1 text-center">
                            <Badge variant="outline" className="text-xs font-mono">
                              {formatServiceCredit(officer.service_credit)}
                            </Badge>
                          </div>
                          <div className="col-span-1 text-center">
                            <Badge 
                              variant={forceCount === 0 ? "outline" : "default"}
                              className={forceCount === 0 ? "" : "bg-blue-600"}
                            >
                              {forceCount}
                            </Badge>
                          </div>
                          <div className="col-span-2">
                            <div className="flex flex-wrap gap-1">
                              {forcedDates.map((forcedDate) => (
                                <Badge 
                                  key={forcedDate.id}
                                  variant="outline"
                                  className={`text-xs ${forcedDate.is_red ? 'bg-red-100 text-red-800 border-red-300' : 'bg-gray-100 text-gray-800 border-gray-300'}`}
                                >
                                  {format(parseISO(forcedDate.forced_date), "MMM d")}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-3 w-3 ml-1 hover:bg-red-100 hover:text-red-600"
                                    onClick={() => forcedDate.id && handleDeleteForcedDate(forcedDate.id)}
                                    title="Remove forced date"
                                  >
                                    <X className="h-2 w-2" />
                                  </Button>
                                </Badge>
                              ))}
                              {forcedDates.length === 0 && (
                                <span className="text-sm text-muted-foreground italic">Never forced</span>
                              )}
                            </div>
                            {mostRecent && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Last: {format(parseISO(mostRecent.forced_date), "MMM d, yyyy")}
                              </div>
                            )}
                          </div>
                          <div className="col-span-1">
                            {isAdminOrSupervisor ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddForcedDate(officer.id, officer.full_name)}
                                title="Add forced date"
                              >
                                <Clock className="h-3 w-3 mr-1" />
                                Force
                              </Button>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                View Only
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* REMOVED PPOs Section */}
              </div>

              {/* Forced Date Entry Modal */}
              {editingForcedDate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
                    <h3 className="text-lg font-semibold mb-4">
                      Add Forced Date for {getLastName(editingForcedDate.officerName)}
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="forced-date">Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {editingForcedDate.date ? format(editingForcedDate.date, "PPP") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={editingForcedDate.date || undefined}
                              onSelect={(date) => {
                                if (date) {
                                  setEditingForcedDate(prev => prev ? {...prev, date} : null);
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <Label htmlFor="force-color">Color</Label>
                        <div className="flex gap-2 mt-2">
                          <Button
                            type="button"
                            variant={editingForcedDate.isRed ? "default" : "outline"}
                            className={editingForcedDate.isRed ? "bg-red-600 hover:bg-red-700" : ""}
                            onClick={() => setEditingForcedDate(prev => prev ? {...prev, isRed: true} : null)}
                          >
                            Red
                          </Button>
                          <Button
                            type="button"
                            variant={!editingForcedDate.isRed ? "default" : "outline"}
                            className={!editingForcedDate.isRed ? "bg-gray-800 hover:bg-gray-900" : ""}
                            onClick={() => setEditingForcedDate(prev => prev ? {...prev, isRed: false} : null)}
                          >
                            Black
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Red: Special/emergency forced shift<br/>
                          Black: Regular forced shift
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Input
                          id="notes"
                          value={editingForcedDate.notes}
                          onChange={(e) => setEditingForcedDate(prev => prev ? {...prev, notes: e.target.value} : null)}
                          placeholder="Any notes about this forced shift"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setEditingForcedDate(null)}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleSaveForcedDate}
                          disabled={!editingForcedDate.date || addForcedDateMutation.isPending}
                        >
                          {addForcedDateMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary Statistics - REMOVED PPOs COUNT */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{sortedSupervisors.length}</div>
                  <div className="text-sm text-muted-foreground">Sergeants</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{sortedRegularOfficers.length}</div>
                  <div className="text-sm text-muted-foreground">Officers</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">
                    {sortedSupervisors.length + sortedRegularOfficers.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Force</div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">
                    Black Date
                  </Badge>
                  <span className="text-sm">Regular forced shift</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                    Red Date
                  </Badge>
                  <span className="text-sm">Special/emergency forced shift</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-blue-600">
                    3
                  </Badge>
                  <span className="text-sm">Force count (shows total forced shifts)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="h-5">
                    Sgt
                  </Badge>
                  <span className="text-sm">Sergeants only (Lieutenants/Chiefs/PPOs excluded)</span>
                </div>
              </div>

              {/* Force List Info */}
              <div className="p-4 border rounded-lg bg-blue-50">
                <h4 className="font-semibold mb-2">Force List Information</h4>
                <div className="text-sm space-y-1">
                  <p><strong>Included:</strong> Sergeants and Regular Officers only</p>
                  <p><strong>Excluded:</strong> Lieutenants, Chiefs, Deputy Chiefs, and PPOs/Probationary officers</p>
                  <p><strong>Sorting Priority:</strong></p>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>Service Credit (least to most)</li>
                    <li>Badge Number (higher to lower when service credits equal)</li>
                    <li>Last Name (A-Z)</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
