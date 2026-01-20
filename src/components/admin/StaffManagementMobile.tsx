import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Clock, Edit2, Calendar, Award, Plus, Search, CalendarIcon, TrendingUp, Menu, X, Filter, ChevronRight } from "lucide-react";
import { OfficerProfileDialog } from "./OfficerProfileDialog";
import { OfficerScheduleManager } from "./OfficerScheduleManager";
import { BulkPTOAssignmentDialog } from "./BulkPTOAssignmentDialog";
import { format } from "date-fns";
import { useWebsiteSettings } from "@/hooks/useWebsiteSettings";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OfficersManagement } from "@/components/schedule/OfficersManagement";

interface StaffManagementMobileProps {
  userId?: string;
  isAdminOrSupervisor?: boolean;
}

export const StaffManagementMobile = ({ 
  userId, 
  isAdminOrSupervisor = false 
}: StaffManagementMobileProps) => {
  const [editingOfficer, setEditingOfficer] = useState<any>(null);
  const [managingSchedule, setManagingSchedule] = useState<any>(null);
  const [creatingNewOfficer, setCreatingNewOfficer] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [bulkPTOOfficer, setBulkPTOOfficer] = useState<any>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("directory");
  
  // Add website settings hook
  const { data: settings } = useWebsiteSettings();

  const { data: officers, isLoading } = useQuery({
    queryKey: ["all-officers"],
    queryFn: async () => {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*");

      if (profilesError) throw profilesError;

      // Get all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Combine the data and sort by last name
      const officersWithCredit = await Promise.all(
        profilesData.map(async (profile) => {
          const { data: creditData } = await supabase.rpc("get_service_credit", {
            profile_id: profile.id,
          });

          return {
            ...profile,
            service_credit: creditData || 0,
            roles: rolesData?.filter(r => r.user_id === profile.id).map(r => r.role) || []
          };
        })
      );

      // Sort by last name
      const officers = officersWithCredit.sort((a, b) => {
        // Extract last names (assumes last name is the last word)
        const lastNameA = a.full_name.split(' ').pop()?.toLowerCase() || '';
        const lastNameB = b.full_name.split(' ').pop()?.toLowerCase() || '';
        return lastNameA.localeCompare(lastNameB);
      });

      return officers;
    },
  });

  // Helper function to get seniority label based on rank and promotion dates
  const getSeniorityLabel = (officer: any) => {
    const rank = officer.rank?.toLowerCase() || '';
    
    if (rank.includes('lieutenant') || rank.includes('lt')) {
      return 'LT Seniority';
    } else if (rank.includes('sergeant') || rank.includes('sgt')) {
      return 'SGT Seniority';
    } else {
      return 'Service Credit';
    }
  };

  // Helper function to get seniority details
  const getSeniorityDetails = (officer: any) => {
    const rank = officer.rank?.toLowerCase() || '';
    const items = [];
    
    // Always show hire date
    if (officer.hire_date) {
      items.push(
        <div key="hire" className="flex items-center gap-1 text-muted-foreground">
          <CalendarIcon className="h-2 w-2" />
          <span>Hire: {format(new Date(officer.hire_date), "MMM yyyy")}</span>
        </div>
      );
    }
    
    // Show "Since" for current rank's promotion date
    if ((rank.includes('lieutenant') || rank.includes('lt')) && officer.promotion_date_lieutenant) {
      items.push(
        <div key="lt-since" className="flex items-center gap-1 text-purple-600 dark:text-purple-500">
          <TrendingUp className="h-2 w-2" />
          <span>LT: {format(new Date(officer.promotion_date_lieutenant), "MMM yyyy")}</span>
        </div>
      );
    } else if ((rank.includes('sergeant') || rank.includes('sgt')) && officer.promotion_date_sergeant) {
      items.push(
        <div key="sgt-since" className="flex items-center gap-1 text-blue-600 dark:text-blue-500">
          <TrendingUp className="h-2 w-2" />
          <span>SGT: {format(new Date(officer.promotion_date_sergeant), "MMM yyyy")}</span>
        </div>
      );
    }
    
    // Show promotion history (previous ranks)
    if (rank.includes('lieutenant') || rank.includes('lt')) {
      // If Lieutenant, show Sergeant promotion if exists
      if (officer.promotion_date_sergeant) {
        items.push(
          <div key="sgt-promo" className="flex items-center gap-1 text-blue-600 dark:text-blue-500">
            <TrendingUp className="h-2 w-2" />
            <span>SGT: {format(new Date(officer.promotion_date_sergeant), "MMM yyyy")}</span>
          </div>
        );
      }
    }
    // If Sergeant, Lieutenant promotion shouldn't exist (they'd be Lieutenant rank)
    // If Officer, show both if they exist (historical promotions)
    else if (!rank.includes('sergeant') && !rank.includes('sgt')) {
      if (officer.promotion_date_sergeant) {
        items.push(
          <div key="sgt-promo" className="flex items-center gap-1 text-blue-600 dark:text-blue-500">
            <TrendingUp className="h-2 w-2" />
            <span>SGT: {format(new Date(officer.promotion_date_sergeant), "MMM yyyy")}</span>
          </div>
        );
      }
      if (officer.promotion_date_lieutenant) {
        items.push(
          <div key="lt-promo" className="flex items-center gap-1 text-purple-600 dark:text-purple-500">
            <TrendingUp className="h-2 w-2" />
            <span>LT: {format(new Date(officer.promotion_date_lieutenant), "MMM yyyy")}</span>
          </div>
        );
      }
    }
    
    return items;
  };

  // Filter officers based on search query
  const filteredOfficers = useMemo(() => {
    if (!officers) return [];
    
    if (!searchQuery.trim()) return officers;

    const query = searchQuery.toLowerCase().trim();
    return officers.filter(officer => 
      officer.full_name?.toLowerCase().includes(query) ||
      officer.email?.toLowerCase().includes(query) ||
      officer.badge_number?.toLowerCase().includes(query) ||
      officer.rank?.toLowerCase().includes(query) ||
      officer.phone?.toLowerCase().includes(query)
    );
  }, [officers, searchQuery]);

  return (
    <div className="pb-4">
      {/* Header with Search and Actions */}
      <div className="sticky top-0 z-10 bg-background border-b pb-4 px-4 pt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staff Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage personnel and schedules
            </p>
          </div>
          {activeTab === "directory" && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => setCreatingNewOfficer(true)}
                className="h-8 w-8 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                    <Filter className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[80vh]">
                  <SheetHeader>
                    <SheetTitle>Search & Filter</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search officers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                        autoFocus
                      />
                    </div>
                    {searchQuery && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {filteredOfficers.length} {filteredOfficers.length === 1 ? 'officer' : 'officers'} found
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          )}
        </div>
        
        {/* Tabs for switching between directory and schedules */}
        <Tabs defaultValue="directory" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="directory">
              <Users className="h-4 w-4 mr-2" />
              Directory
            </TabsTrigger>
            <TabsTrigger value="schedules">
              <Calendar className="h-4 w-4 mr-2" />
              Schedules
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="directory" className="mt-4">
            {/* Search Bar - Only show in directory tab */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search officers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {searchQuery && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Badge variant="secondary" className="text-xs">
                    {filteredOfficers.length}
                  </Badge>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="schedules" className="mt-0">
            {/* Officer Schedule Management Component */}
            <div className="text-sm text-muted-foreground mb-4">
              Manage weekly and monthly officer schedules
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Content Area */}
      <div className="px-4 mt-4">
        {activeTab === "directory" ? (
          // Directory View
          isLoading ? (
            <div className="flex justify-center items-center h-32">
              <p className="text-sm text-muted-foreground">Loading officers...</p>
            </div>
          ) : !officers || officers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">No officers found.</p>
              <Button 
                onClick={() => setCreatingNewOfficer(true)}
                className="flex items-center gap-2 mx-auto"
              >
                <Plus className="h-4 w-4" />
                Create First Officer
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOfficers.length === 0 && searchQuery ? (
                <div className="text-center py-8">
                  <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-2">
                    No officers found for "{searchQuery}"
                  </p>
                  <Button 
                    variant="outline"
                    onClick={() => setSearchQuery("")}
                    size="sm"
                  >
                    Clear search
                  </Button>
                </div>
              ) : (
                filteredOfficers.map((officer) => (
                  <div key={officer.id} className="p-3 border rounded-lg bg-card">
                    <div className="space-y-2">
                      {/* Officer Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-base truncate">{officer.full_name}</p>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {officer.rank && (
                              <Badge variant="secondary" className="text-xs capitalize">
                                {officer.rank}
                              </Badge>
                            )}
                            {officer.roles && officer.roles.length > 0 && (
                              officer.roles.map((role: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-xs capitalize">
                                  {role}
                                </Badge>
                              ))
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Menu className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingOfficer(officer)}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setManagingSchedule(officer)}>
                              <Calendar className="h-4 w-4 mr-2" />
                              Manage Schedule
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setBulkPTOOfficer(officer)}>
                              <Calendar className="h-4 w-4 mr-2" />
                              Bulk PTO
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Officer Details */}
                      <div className="space-y-1 text-sm">
                        {officer.badge_number && (
                          <div className="flex items-center">
                            <span className="text-muted-foreground w-24">Badge:</span>
                            <span>{officer.badge_number}</span>
                          </div>
                        )}
                        {officer.email && (
                          <div className="flex items-center">
                            <span className="text-muted-foreground w-24">Email:</span>
                            <span className="truncate">{officer.email}</span>
                          </div>
                        )}
                        {officer.phone && (
                          <div className="flex items-center">
                            <span className="text-muted-foreground w-24">Phone:</span>
                            <span>{officer.phone}</span>
                          </div>
                        )}
                      </div>

                      {/* PTO Balances Section */}
                      {settings?.show_pto_balances && settings?.pto_balances_visible ? (
                        <>
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Vacation:</span>
                              </div>
                              <span className="font-medium text-sm">{officer.vacation_hours || 0}h</span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Sick:</span>
                              </div>
                              <span className="font-medium text-sm">{officer.sick_hours || 0}h</span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Comp:</span>
                              </div>
                              <span className="font-medium text-sm">{officer.comp_hours || 0}h</span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Holiday:</span>
                              </div>
                              <span className="font-medium text-sm">{officer.holiday_hours || 0}h</span>
                            </div>
                          </div>
                          
                          {/* Seniority Section */}
                          <div className="pt-2 border-t space-y-2">
                            <div className="flex items-center gap-1">
                              <Award className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {getSeniorityLabel(officer)}:
                              </span>
                              <span className="font-medium text-sm ml-1">{officer.service_credit?.toFixed(1) || 0} yrs</span>
                              {officer.service_credit_override !== null && (
                                <span className="text-xs text-amber-600 dark:text-amber-500 ml-1">
                                  (Adj)
                                </span>
                              )}
                            </div>
                            
                            {/* Seniority Details */}
                            <div className="space-y-1 text-xs pl-4">
                              {getSeniorityDetails(officer)}
                            </div>
                          </div>
                        </>
                      ) : (
                        /* Simplified View when PTO is disabled */
                        <div className="pt-2 border-t space-y-2">
                          <div className="flex items-center gap-1">
                            <Award className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {getSeniorityLabel(officer)}:
                            </span>
                            <span className="font-medium text-sm ml-1">{officer.service_credit?.toFixed(1) || 0} yrs</span>
                          </div>
                          
                          {/* Seniority Details */}
                          <div className="space-y-1 text-xs pl-4">
                            {getSeniorityDetails(officer)}
                          </div>
                          
                          <div className="text-xs text-muted-foreground italic">
                            PTO managed as indefinite
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )
        ) : (
          // Schedules View - Officer Schedule Management
          <OfficersManagement 
            userId={userId}
            isAdminOrSupervisor={isAdminOrSupervisor}
            isMobile={true}
          />
        )}
      </div>

      {/* Dialogs */}
      {editingOfficer && (
        <OfficerProfileDialog
          officer={editingOfficer}
          open={!!editingOfficer}
          onOpenChange={(open) => !open && setEditingOfficer(null)}
        />
      )}

      {managingSchedule && (
        <OfficerScheduleManager
          officer={managingSchedule}
          open={!!managingSchedule}
          onOpenChange={(open) => !open && setManagingSchedule(null)}
        />
      )}

      {creatingNewOfficer && (
        <OfficerProfileDialog
          officer={null}
          open={!!creatingNewOfficer}
          onOpenChange={(open) => !open && setCreatingNewOfficer(false)}
        />
      )}

      {bulkPTOOfficer && (
        <BulkPTOAssignmentDialog
          officer={bulkPTOOfficer}
          open={!!bulkPTOOfficer}
          onOpenChange={(open) => !open && setBulkPTOOfficer(null)}
        />
      )}
    </div>
  );
};
