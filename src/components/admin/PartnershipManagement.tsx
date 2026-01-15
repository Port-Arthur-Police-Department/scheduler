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
import { toast } from "sonner";
import { Users, AlertTriangle, CheckCircle, Trash2, Search, Calendar, Filter, RefreshCw, UserCheck, UserX } from "lucide-react";
import { format } from "date-fns";

export const PartnershipManagement = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [filterShift, setFilterShift] = useState<string>("all");
  const [selectedPartnership, setSelectedPartnership] = useState<any>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedRegularOfficer, setSelectedRegularOfficer] = useState<string>("");
  const [selectedPPO, setSelectedPPO] = useState<string>("");
  
  const queryClient = useQueryClient();

  // Helper function to check if officer is PPO
  const isPPO = (officer: any): boolean => {
    if (!officer || !officer.rank) return false;
    const rank = officer.rank.toLowerCase();
    return rank === 'probationary' || rank.includes('probationary') || rank.includes('ppo');
  };

  // Fetch all partnerships with detailed information
  const { data: partnerships, isLoading, refetch } = useQuery({
    queryKey: ["all-partnerships", filterDate, filterShift],
    queryFn: async () => {
      // Get partnerships from both recurring and exceptions
      const [recurringData, exceptionsData] = await Promise.all([
        supabase
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
          .eq("is_partnership", true),
        
        supabase
          .from("schedule_exceptions")
          .select(`
            id,
            officer_id,
            partner_officer_id,
            date,
            shift_type_id,
            is_partnership,
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
      ]);

      const allPartnerships = [];

      // Process recurring partnerships
      if (recurringData.data) {
        for (const record of recurringData.data) {
          if (!record.profiles || !record.partner_profile) continue;
          
          // Check if this partnership is active on the filter date
          const scheduleStart = new Date(record.start_date);
          const scheduleEnd = record.end_date ? new Date(record.end_date) : null;
          const filterDateObj = new Date(filterDate);
          
          if (filterDateObj < scheduleStart) continue;
          if (scheduleEnd && filterDateObj > scheduleEnd) continue;
          
          // Check day of week
          const filterDayOfWeek = filterDateObj.getDay();
          if (record.day_of_week !== filterDayOfWeek) continue;
          
          // Check shift filter
          if (filterShift !== "all" && record.shift_type_id !== filterShift) continue;
          
          allPartnerships.push({
            id: record.id,
            type: "recurring",
            officer1: record.profiles,
            officer2: record.partner_profile,
            shift: record.shift_types,
            date: null, // Recurring doesn't have specific date
            dayOfWeek: record.day_of_week,
            startDate: record.start_date,
            endDate: record.end_date,
            isValid: true // Assume valid until proven otherwise
          });
        }
      }

      // Process exception partnerships
      if (exceptionsData.data) {
        for (const record of exceptionsData.data) {
          if (!record.profiles || !record.partner_profile) continue;
          
          // Check date filter
          if (record.date !== filterDate) continue;
          
          // Check shift filter
          if (filterShift !== "all" && record.shift_type_id !== filterShift) continue;
          
          allPartnerships.push({
            id: record.id,
            type: "exception",
            officer1: record.profiles,
            officer2: record.partner_profile,
            shift: record.shift_types,
            date: record.date,
            isValid: true
          });
        }
      }

      // Validate partnerships (check for orphaned ones)
      for (const partnership of allPartnerships) {
        // Check if both officers have each other as partners
        if (partnership.type === "recurring") {
          // For recurring, check reciprocal relationship
          const partnerRecord = allPartnerships.find(p => 
            p.type === "recurring" && 
            p.officer1.id === partnership.officer2.id && 
            p.officer2.id === partnership.officer1.id
          );
          partnership.isValid = !!partnerRecord;
        } else {
          // For exceptions, reciprocal check
          const partnerRecord = allPartnerships.find(p => 
            p.type === "exception" && 
            p.officer1.id === partnership.officer2.id && 
            p.officer2.id === partnership.officer1.id
          );
          partnership.isValid = !!partnerRecord;
        }
      }

      return allPartnerships;
    }
  });

  // Fetch available regular officers (non-PPO) for new partnerships
  const { data: regularOfficers } = useQuery({
    queryKey: ["regular-officers", filterDate, filterShift],
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
    queryKey: ["ppo-officers", filterDate, filterShift],
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
        const partnerRecord = partnerships?.find(p => 
          p.type === "recurring" && 
          p.officer1.id === partnership.officer2.id && 
          p.officer2.id === partnership.officer1.id
        );
        
        if (partnerRecord) {
          await supabase
            .from("recurring_schedules")
            .update({ 
              partner_officer_id: null,
              is_partnership: false 
            })
            .eq("id", partnerRecord.id);
        }
      } else {
        // Remove from exceptions
        await supabase
          .from("schedule_exceptions")
          .update({ 
            partner_officer_id: null,
            is_partnership: false 
          })
          .eq("id", partnership.id);
        
        // Also remove from partner's record
        const partnerRecord = partnerships?.find(p => 
          p.type === "exception" && 
          p.officer1.id === partnership.officer2.id && 
          p.officer2.id === partnership.officer1.id
        );
        
        if (partnerRecord) {
          await supabase
            .from("schedule_exceptions")
            .update({ 
              partner_officer_id: null,
              is_partnership: false 
            })
            .eq("id", partnerRecord.id);
        }
      }
    },
    onSuccess: () => {
      toast.success("Partnership removed successfully");
      queryClient.invalidateQueries({ queryKey: ["all-partnerships"] });
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
      const dayOfWeek = new Date(date).getDay();
      
      // First, check if officers are already partnered
      const existingPartnerships = await supabase
        .from("schedule_exceptions")
        .select("*")
        .eq("date", date)
        .eq("shift_type_id", shiftId)
        .or(`officer_id.eq.${regularOfficerId},officer_id.eq.${ppoOfficerId}`)
        .eq("is_partnership", true);

      if (existingPartnerships.data && existingPartnerships.data.length > 0) {
        throw new Error("One or both officers are already in a partnership");
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
            schedule_type: "partnership"
          },
          {
            officer_id: ppoOfficerId,
            partner_officer_id: regularOfficerId,
            date: date,
            shift_type_id: shiftId,
            is_partnership: true,
            is_off: false,
            schedule_type: "partnership"
          }
        ]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Partnership created successfully");
      setShowCreateDialog(false);
      queryClient.invalidateQueries({ queryKey: ["all-partnerships"] });
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
    const orphanedCount = partnerships?.filter(p => !p.isValid).length || 0;
    
    if (orphanedCount === 0) {
      toast.success("No orphaned partnerships found");
      return;
    }

    // Fix each orphaned partnership
    for (const partnership of partnerships?.filter(p => !p.isValid) || []) {
      await removePartnershipMutation.mutateAsync(partnership);
    }
    
    toast.success(`Fixed ${orphanedCount} orphaned partnership(s)`);
    refetch();
  };

  const handleCreatePartnership = () => {
    if (!selectedRegularOfficer || !selectedPPO || !filterDate || !filterShift || filterShift === "all") {
      toast.error("Please select both officers, date, and shift");
      return;
    }

    createPartnershipMutation.mutate({
      regularOfficerId: selectedRegularOfficer,
      ppoOfficerId: selectedPPO,
      date: filterDate,
      shiftId: filterShift
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Partnership Management
        </CardTitle>
        <CardDescription>
          View, create, and manage officer partnerships
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="filter-date">Date</Label>
            <Input
              id="filter-date"
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
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
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              placeholder="Search officers..."
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
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                    />
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
                      onClick={() => setShowCreateDialog(false)}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {partnerships?.length || 0}
              </div>
              <p className="text-sm text-muted-foreground">Total Partnerships</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {partnerships?.filter(p => p.isValid).length || 0}
              </div>
              <p className="text-sm text-muted-foreground">Valid Partnerships</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-amber-600">
                {partnerships?.filter(p => !p.isValid).length || 0}
              </div>
              <p className="text-sm text-muted-foreground">Orphaned Partnerships</p>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Officer 1</TableHead>
                <TableHead>Officer 2</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Date/Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading partnerships...
                  </TableCell>
                </TableRow>
              ) : partnerships?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    No partnerships found for selected filters
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
                    <TableRow key={`${partnership.type}-${partnership.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{partnership.officer1.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {partnership.officer1.badge_number} • {partnership.officer1.rank}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
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
                            <p>Recurring</p>
                            <p className="text-sm text-muted-foreground">
                              {partnership.startDate} {partnership.endDate ? `- ${partnership.endDate}` : "(Ongoing)"}
                            </p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {partnership.isValid ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Valid
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
