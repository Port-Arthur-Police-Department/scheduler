// src/components/staff/PartnershipManagement.tsx
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { Users, AlertTriangle, CheckCircle, Trash2, Search, CalendarDays, Filter, RefreshCw, UserCheck, UserX, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO, startOfWeek, endOfWeek, addDays, subDays, eachDayOfInterval, isWithinInterval } from "date-fns";
import { cn } from "@/lib/utils";

export const PartnershipManagement = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  }>({
    from: startOfWeek(new Date(), { weekStartsOn: 0 }),
    to: endOfWeek(new Date(), { weekStartsOn: 6 })
  });
  const [filterShift, setFilterShift] = useState<string>("all");
  const [selectedPartnership, setSelectedPartnership] = useState<any>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedRegularOfficer, setSelectedRegularOfficer] = useState<string>("");
  const [selectedPPO, setSelectedPPO] = useState<string>("");
  const [viewMode, setViewMode] = useState<"all" | "active" | "orphaned">("all");
  
  const queryClient = useQueryClient();

  // Helper function to check if officer is PPO
  const isPPO = (officer: any): boolean => {
    if (!officer || !officer.rank) return false;
    const rank = officer.rank.toLowerCase();
    return rank === 'probationary' || rank.includes('probationary') || rank.includes('ppo');
  };

  // Function to get all dates in range
  const getDatesInRange = (from: Date, to: Date): string[] => {
    const dates: string[] = [];
    let currentDate = new Date(from);
    const endDate = new Date(to);
    
    while (currentDate <= endDate) {
      dates.push(format(currentDate, "yyyy-MM-dd"));
      currentDate = addDays(currentDate, 1);
    }
    
    return dates;
  };

  // Fetch all partnerships with date range support
  const { data: partnerships, isLoading, refetch } = useQuery({
    queryKey: ["all-partnerships-range", dateRange, filterShift, viewMode],
    queryFn: async () => {
      const datesInRange = getDatesInRange(dateRange.from, dateRange.to);
      
      console.log("📅 Fetching partnerships for date range:", {
        from: format(dateRange.from, "yyyy-MM-dd"),
        to: format(dateRange.to, "yyyy-MM-dd"),
        days: datesInRange.length,
        shift: filterShift,
        mode: viewMode
      });

           // Get recurring partnerships - FIXED: Exclude null partner_officer_id
      const { data: recurringData, error: recurringError } = await supabase
        .from("recurring_schedules")
        .select(`
          id,
          officer_id,
          partner_officer_id,
          day_of_week,
          start_date,
          end_date,
          shift_type_id,
          is_partnership,
          profiles:profiles!recurring_schedules_officer_id_fkey (
            id,
            full_name,
            badge_number,
            rank
          ),
          partner_profile:profiles!recurring_schedules_partner_officer_id_fkey (
            id,
            full_name,
            badge_number,
            rank
          ),
          shift_types (
            id,
            name,
            start_time,
            end_time
          )
        `)
        .eq("is_partnership", true)
        .not("partner_officer_id", "is", null); // THIS IS THE FIX - exclude null values

      if (recurringError) {
        console.error("Error fetching recurring partnerships:", recurringError);
        throw recurringError;
      }

      // Get exception partnerships for each day in range
      const exceptionPromises = datesInRange.map(date => 
        supabase
                    .from("schedule_exceptions")
          .select(`
            id,
            officer_id,
            partner_officer_id,
            date,
            shift_type_id,
            is_partnership,
            partnership_suspended,
            partnership_suspension_reason,
            profiles:profiles!schedule_exceptions_officer_id_fkey (
              id,
              full_name,
              badge_number,
              rank
            ),
            partner_profile:profiles!schedule_exceptions_partner_officer_id_fkey (
              id,
              full_name,
              badge_number,
              rank
            ),
            shift_types (
              id,
              name,
              start_time,
              end_time
            )
          `)
          .eq("is_partnership", true)
          .not("partner_officer_id", "is", null) 
          .eq("date", date)
      );

      const exceptionResults = await Promise.all(exceptionPromises);
      const exceptionPartnerships = exceptionResults.flatMap(result => result.data || []);

      console.log("📊 Partnerships found:", {
        recurring: recurringData?.length || 0,
        exceptions: exceptionPartnerships.length
      });

      // Combine and filter partnerships
      const allPartnerships = [];

      // Process recurring partnerships
      if (recurringData) {
        for (const recurring of recurringData) {
          if (!recurring.profiles || !recurring.partner_profile) continue;
          
          // Check if this partnership is active during any day in the range
          const activeDates: string[] = [];
          
          for (const date of datesInRange) {
            const currentDate = parseISO(date);
            const startDate = parseISO(recurring.start_date);
            const endDate = recurring.end_date ? parseISO(recurring.end_date) : null;
            
            // Check date range
            if (currentDate < startDate) continue;
            if (endDate && currentDate > endDate) continue;
            
            // Check day of week
            if (recurring.day_of_week !== currentDate.getDay()) continue;
            
            // Check shift filter
            if (filterShift !== "all" && recurring.shift_type_id !== filterShift) continue;
            
            activeDates.push(date);
          }
          
          if (activeDates.length > 0) {
            allPartnerships.push({
              id: recurring.id,
              type: "recurring",
              officer1: recurring.profiles,
              officer2: recurring.partner_profile,
              shift: recurring.shift_types,
              dates: activeDates,
              dayOfWeek: recurring.day_of_week,
              startDate: recurring.start_date,
              endDate: recurring.end_date,
              isValid: true,
              source: 'recurring'
            });
          }
        }
      }

      // Process exception partnerships
      for (const exception of exceptionPartnerships) {
        if (!exception.profiles || !exception.partner_profile) continue;
        
        // Check shift filter
        if (filterShift !== "all" && exception.shift_type_id !== filterShift) continue;
        
        allPartnerships.push({
          id: exception.id,
          type: "exception",
          officer1: exception.profiles,
          officer2: exception.partner_profile,
          shift: exception.shift_types,
          dates: [exception.date],
          date: exception.date,
          partnershipSuspended: exception.partnership_suspended,
          partnershipSuspensionReason: exception.partnership_suspension_reason,
          isValid: true,
          source: 'exception'
        });
      }

      // Validate partnerships (check for reciprocal relationships)
      const validatedPartnerships = allPartnerships.map(partnership => {
        // For recurring, find reciprocal record
        if (partnership.type === "recurring") {
          const reciprocal = allPartnerships.find(p => 
            p.type === "recurring" &&
            p.officer1.id === partnership.officer2.id &&
            p.officer2.id === partnership.officer1.id &&
            p.shift_type_id === partnership.shift_type_id &&
            p.dayOfWeek === partnership.dayOfWeek
          );
          
          return {
            ...partnership,
            isValid: !!reciprocal
          };
        } else {
          // For exceptions, find reciprocal record
          const reciprocal = allPartnerships.find(p => 
            p.type === "exception" &&
            p.officer1.id === partnership.officer2.id &&
            p.officer2.id === partnership.officer1.id &&
            p.date === partnership.date
          );
          
          return {
            ...partnership,
            isValid: !!reciprocal
          };
        }
      });

      // Filter by view mode
      let filteredPartnerships = validatedPartnerships;
      if (viewMode === "active") {
        filteredPartnerships = validatedPartnerships.filter(p => p.isValid && !p.partnershipSuspended);
      } else if (viewMode === "orphaned") {
        filteredPartnerships = validatedPartnerships.filter(p => !p.isValid);
      }

      // Sort by date
      filteredPartnerships.sort((a, b) => {
        const dateA = a.dates[0] || "9999-12-31";
        const dateB = b.dates[0] || "9999-12-31";
        return dateA.localeCompare(dateB);
      });

      return filteredPartnerships;
    }
  });

  // Fetch available regular officers (non-PPO) for new partnerships
  const { data: regularOfficers } = useQuery({
    queryKey: ["regular-officers"],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, badge_number, rank")
        .order("full_name");
      
      return profiles?.filter(p => !isPPO(p)) || [];
    }
  });

  // Fetch available PPO officers for new partnerships
  const { data: ppoOfficers } = useQuery({
    queryKey: ["ppo-officers"],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, badge_number, rank")
        .order("full_name");
      
      return profiles?.filter(p => isPPO(p)) || [];
    }
  });

  // Fetch all shifts
  const { data: shifts } = useQuery({
    queryKey: ["all-shifts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("shift_types")
        .select("*")
        .order("start_time");
      return data || [];
    }
  });

  // Mutation to remove partnership
  const removePartnershipMutation = useMutation({
    mutationFn: async (partnership: any) => {
      if (partnership.type === "recurring") {
        // Remove from recurring
        await supabase
          .from("recurring_schedules")
          .update({ 
            partner_officer_id: null,
            is_partnership: false 
          })
          .eq("id", partnership.id);
        
        // Also remove from partner's record
        const { data: partnerRecords } = await supabase
          .from("recurring_schedules")
          .select("id")
          .eq("officer_id", partnership.officer2.id)
          .eq("partner_officer_id", partnership.officer1.id)
          .eq("shift_type_id", partnership.shift_type_id)
          .eq("day_of_week", partnership.dayOfWeek);

        if (partnerRecords && partnerRecords.length > 0) {
          await supabase
            .from("recurring_schedules")
            .update({ 
              partner_officer_id: null,
              is_partnership: false 
            })
            .eq("id", partnerRecords[0].id);
        }
      } else {
        // Remove from exceptions for all dates
        for (const date of partnership.dates) {
          await supabase
            .from("schedule_exceptions")
            .delete()
            .eq("officer_id", partnership.officer1.id)
            .eq("partner_officer_id", partnership.officer2.id)
            .eq("date", date)
            .eq("shift_type_id", partnership.shift_type_id);
          
          await supabase
            .from("schedule_exceptions")
            .delete()
            .eq("officer_id", partnership.officer2.id)
            .eq("partner_officer_id", partnership.officer1.id)
            .eq("date", date)
            .eq("shift_type_id", partnership.shift_type_id);
        }
      }
    },
    onSuccess: () => {
      toast.success("Partnership removed successfully");
      queryClient.invalidateQueries({ queryKey: ["all-partnerships-range"] });
      queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
    },
    onError: (error) => {
      toast.error("Failed to remove partnership");
      console.error(error);
    }
  });

  // Mutation to create partnership
  const createPartnershipMutation = useMutation({
    mutationFn: async ({ 
      regularOfficerId, 
      ppoOfficerId, 
      date, 
      shiftId 
    }: { 
      regularOfficerId: string; 
      ppoOfficerId: string; 
      date: string; 
      shiftId: string; 
    }) => {
      // Check if officers are already partnered for this date/shift
      const existingPartnerships = await supabase
        .from("schedule_exceptions")
        .select("*")
        .eq("date", date)
        .eq("shift_type_id", shiftId)
        .or(`officer_id.eq.${regularOfficerId},officer_id.eq.${ppoOfficerId}`)
        .eq("is_partnership", true);

      if (existingPartnerships.data && existingPartnerships.data.length > 0) {
        throw new Error("One or both officers are already in a partnership for this date and shift");
      }

      // Create partnership as a schedule exception
      const { error } = await supabase
        .from("schedule_exceptions")
        .insert([
          {
            officer_id: regularOfficerId,
            partner_officer_id: ppoOfficerId,
            date: date,
            shift_type_id: shiftId,
            is_partnership: true,
            is_off: false,
            schedule_type: "manual_partnership",
            position_name: "Riding Partner"
          },
          {
            officer_id: ppoOfficerId,
            partner_officer_id: regularOfficerId,
            date: date,
            shift_type_id: shiftId,
            is_partnership: true,
            is_off: false,
            schedule_type: "manual_partnership",
            position_name: "Riding Partner (PPO)"
          }
        ]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Partnership created successfully");
      setShowCreateDialog(false);
      setSelectedRegularOfficer("");
      setSelectedPPO("");
      queryClient.invalidateQueries({ queryKey: ["all-partnerships-range"] });
      queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create partnership");
    }
  });

  // Function to fix orphaned partnerships
  const fixOrphanedPartnerships = async () => {
    toast.info("Scanning for orphaned partnerships...");
    
    // Find partnerships where only one side exists
    const orphanedPartnerships = partnerships?.filter(p => !p.isValid) || [];
    
    if (orphanedPartnerships.length === 0) {
      toast.success("No orphaned partnerships found");
      return;
    }

    // Fix each orphaned partnership
    for (const partnership of orphanedPartnerships) {
      await removePartnershipMutation.mutateAsync(partnership);
    }
    
    toast.success(`Fixed ${orphanedPartnerships.length} orphaned partnership(s)`);
    refetch();
  };

  // Function to navigate date range
  const navigateDateRange = (direction: "prev" | "next") => {
    const rangeDays = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
    
    if (direction === "prev") {
      setDateRange({
        from: subDays(dateRange.from, rangeDays + 1),
        to: subDays(dateRange.to, rangeDays + 1)
      });
    } else {
      setDateRange({
        from: addDays(dateRange.from, rangeDays + 1),
        to: addDays(dateRange.to, rangeDays + 1)
      });
    }
  };

  const handleCreatePartnership = () => {
    // Use the first date in the range for creation
    const firstDate = format(dateRange.from, "yyyy-MM-dd");
    
    if (!selectedRegularOfficer || !selectedPPO || !firstDate || !filterShift || filterShift === "all") {
      toast.error("Please select both officers and a shift");
      return;
    }

    createPartnershipMutation.mutate({
      regularOfficerId: selectedRegularOfficer,
      ppoOfficerId: selectedPPO,
      date: firstDate,
      shiftId: filterShift
    });
  };

  // Format date range display
  const formatDateRangeDisplay = () => {
    const fromFormatted = format(dateRange.from, "MMM d, yyyy");
    const toFormatted = format(dateRange.to, "MMM d, yyyy");
    
    if (fromFormatted === toFormatted) {
      return fromFormatted;
    }
    return `${fromFormatted} - ${toFormatted}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Partnership Management
        </CardTitle>
        <CardDescription>
          View and manage officer partnerships within a date range
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Range Picker */}
          <div className="col-span-2">
            <Label>Date Range</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateDateRange("prev")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        formatDateRangeDisplay()
                      ) : (
                        format(dateRange.from, "MMM d, yyyy")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={dateRange}
                    onSelect={(range) => {
                      if (range?.from && range.to) {
                        setDateRange({ from: range.from, to: range.to });
                      }
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateDateRange("next")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div>
            <Label htmlFor="filter-shift">Shift</Label>
            <Select value={filterShift} onValueChange={setFilterShift}>
              <SelectTrigger>
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Shifts</SelectItem>
                {shifts?.map((shift) => (
                  <SelectItem key={shift.id} value={shift.id}>
                    {shift.name} ({shift.start_time} - {shift.end_time})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>View Mode</Label>
            <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
              <SelectTrigger>
                <SelectValue placeholder="View mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Partnerships</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="orphaned">Orphaned Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search and Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              placeholder="Search officers by name or badge number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          
          <div className="flex items-end gap-2">
            <Button 
              onClick={() => refetch()} 
              variant="outline"
              className="flex-1"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="flex-1">
                  <UserCheck className="h-4 w-4 mr-2" />
                  Create Partnership
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Partnership</DialogTitle>
                  <DialogDescription>
                    Pair a regular officer with a Probationary officer
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label>Regular Officer</Label>
                    <Select value={selectedRegularOfficer} onValueChange={setSelectedRegularOfficer}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select regular officer" />
                      </SelectTrigger>
                      <SelectContent>
                        {regularOfficers?.map((officer) => (
                          <SelectItem key={officer.id} value={officer.id}>
                            {officer.full_name} ({officer.badge_number}) - {officer.rank}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Probationary Officer (PPO)</Label>
                    <Select value={selectedPPO} onValueChange={setSelectedPPO}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select PPO" />
                      </SelectTrigger>
                      <SelectContent>
                        {ppoOfficers?.map((officer) => (
                          <SelectItem key={officer.id} value={officer.id}>
                            {officer.full_name} ({officer.badge_number}) - {officer.rank}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={format(dateRange.from, "yyyy-MM-dd")}
                      onChange={(e) => {
                        const newDate = new Date(e.target.value);
                        setDateRange({
                          from: newDate,
                          to: newDate
                        });
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Currently viewing {formatDateRangeDisplay()}
                    </p>
                  </div>
                  
                  <div>
                    <Label>Shift</Label>
                    <Select value={filterShift} onValueChange={setFilterShift}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select shift" />
                      </SelectTrigger>
                      <SelectContent>
                        {shifts?.map((shift) => (
                          <SelectItem key={shift.id} value={shift.id}>
                            {shift.name} ({shift.start_time} - {shift.end_time})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCreateDialog(false);
                        setSelectedRegularOfficer("");
                        setSelectedPPO("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreatePartnership}
                      disabled={createPartnershipMutation.isPending}
                    >
                      {createPartnershipMutation.isPending ? "Creating..." : "Create Partnership"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {partnerships?.length || 0}
              </div>
              <p className="text-sm text-muted-foreground">Total Partnerships</p>
              <p className="text-xs text-muted-foreground">
                {formatDateRangeDisplay()}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {partnerships?.filter(p => p.isValid && !p.partnershipSuspended).length || 0}
              </div>
              <p className="text-sm text-muted-foreground">Active & Valid</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-amber-600">
                {partnerships?.filter(p => p.partnershipSuspended).length || 0}
              </div>
              <p className="text-sm text-muted-foreground">Suspended</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">
                {partnerships?.filter(p => !p.isValid).length || 0}
              </div>
              <p className="text-sm text-muted-foreground">Orphaned</p>
              {partnerships?.filter(p => !p.isValid).length > 0 && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="mt-2"
                  onClick={fixOrphanedPartnerships}
                >
                  Fix Orphaned
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Partnerships Table */}
        <div className="border rounded-lg">
          <div className="p-4 border-b bg-muted/50">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                Partnerships ({partnerships?.length || 0})
              </h3>
              <div className="text-sm text-muted-foreground">
                Showing {formatDateRangeDisplay()}
              </div>
            </div>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Officers</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin" />
                      <p>Loading partnerships...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : partnerships?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-8 w-8 text-muted-foreground" />
                      <p>No partnerships found for selected criteria</p>
                      <p className="text-sm text-muted-foreground">
                        Date Range: {formatDateRangeDisplay()}
                        {filterShift !== "all" && ` • Shift: ${shifts?.find(s => s.id === filterShift)?.name}`}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                partnerships
                  ?.filter(partnership => {
                    if (!searchQuery) return true;
                    const query = searchQuery.toLowerCase();
                    return (
                      partnership.officer1.full_name.toLowerCase().includes(query) ||
                      partnership.officer2.full_name.toLowerCase().includes(query) ||
                      partnership.officer1.badge_number.toLowerCase().includes(query) ||
                      partnership.officer2.badge_number.toLowerCase().includes(query)
                    );
                  })
                  .map((partnership) => (
                    <TableRow key={`${partnership.type}-${partnership.id}-${partnership.dates[0]}`}>
                      <TableCell>
                        <div className="space-y-2">
                          <div>
                            <p className="font-medium">{partnership.officer1.full_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {partnership.officer1.badge_number} • {partnership.officer1.rank}
                            </p>
                            {isPPO(partnership.officer1) && (
                              <Badge variant="outline" className="mt-1 bg-yellow-100 text-yellow-800">
                                PPO
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <div className="h-px flex-1 bg-border" />
                            <Users className="h-3 w-3" />
                            <div className="h-px flex-1 bg-border" />
                          </div>
                          <div>
                            <p className="font-medium">{partnership.officer2.full_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {partnership.officer2.badge_number} • {partnership.officer2.rank}
                            </p>
                            {isPPO(partnership.officer2) && (
                              <Badge variant="outline" className="mt-1 bg-yellow-100 text-yellow-800">
                                PPO
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {partnership.shift ? (
                          <div>
                            <p>{partnership.shift.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {partnership.shift.start_time} - {partnership.shift.end_time}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {partnership.type === "exception" ? (
                          <div>
                            <p>{partnership.date}</p>
                            <Badge variant="outline" className="mt-1">
                              One-time
                            </Badge>
                          </div>
                        ) : (
                          <div>
                            <p>Recurring Schedule</p>
                            <p className="text-sm text-muted-foreground">
                              Active on {partnership.dates.length} day(s)
                            </p>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {partnership.startDate} {partnership.endDate ? `- ${partnership.endDate}` : "(Ongoing)"}
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={partnership.type === "recurring" ? "default" : "outline"}>
                          {partnership.type === "recurring" ? "Recurring" : "Exception"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {partnership.partnershipSuspended ? (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Suspended
                          </Badge>
                        ) : partnership.isValid ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Orphaned
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (confirm(`Remove partnership between ${partnership.officer1.full_name} and ${partnership.officer2.full_name}?`)) {
                              removePartnershipMutation.mutate(partnership);
                            }
                          }}
                          disabled={removePartnershipMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
