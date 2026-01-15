// src/components/staff/StaffManagement.tsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Clock, Edit2, Calendar, Award, Plus, Search, CalendarIcon, TrendingUp } from "lucide-react";
import { OfficerProfileDialog } from "./OfficerProfileDialog";
import { OfficerScheduleManager } from "./OfficerScheduleManager";
import { BulkPTOAssignmentDialog } from "./BulkPTOAssignmentDialog";
import { PartnershipManagement } from "./PartnershipManagement";
import { format } from "date-fns";
import { useWebsiteSettings } from "@/hooks/useWebsiteSettings";
import { auditLogger } from "@/lib/auditLogger";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // NEW: Import Tabs

export const StaffManagement = () => {
  const [editingOfficer, setEditingOfficer] = useState<any>(null);
  const [managingSchedule, setManagingSchedule] = useState<any>(null);
  const [creatingNewOfficer, setCreatingNewOfficer] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [bulkPTOOfficer, setBulkPTOOfficer] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("officers"); // NEW: Track active tab
  
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
      return 'Seniority at Lieutenant';
    } else if (rank.includes('sergeant') || rank.includes('sgt')) {
      return 'Seniority at Sergeant';
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
          <span>Since: {format(new Date(officer.promotion_date_lieutenant), "MMM yyyy")}</span>
        </div>
      );
    } else if ((rank.includes('sergeant') || rank.includes('sgt')) && officer.promotion_date_sergeant) {
      items.push(
        <div key="sgt-since" className="flex items-center gap-1 text-blue-600 dark:text-blue-500">
          <TrendingUp className="h-2 w-2" />
          <span>Since: {format(new Date(officer.promotion_date_sergeant), "MMM yyyy")}</span>
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
            <span>Sgt: {format(new Date(officer.promotion_date_sergeant), "MMM yyyy")}</span>
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
            <span>Sgt: {format(new Date(officer.promotion_date_sergeant), "MMM yyyy")}</span>
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staff Management
            </CardTitle>
            <CardDescription>Manage officers, schedules, and partnerships</CardDescription>
          </div>
          {activeTab === "officers" && (
            <Button 
              onClick={() => setCreatingNewOfficer(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Profile
            </Button>
          )}
        </div>
        
        {/* Search Bar - Only show on officers tab */}
        {activeTab === "officers" && (
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search officers by name, badge, rank, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Badge variant="secondary" className="text-xs">
                  {filteredOfficers.length} {filteredOfficers.length === 1 ? 'officer' : 'officers'}
                </Badge>
              </div>
            )}
          </div>
        )}
      </CardHeader>
      
      {/* TABS SECTION - ADDED HERE */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="officers">Officers</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="partnerships">Partnerships</TabsTrigger>
        </TabsList>
      </Tabs>
      
      <CardContent>
        {/* Officers Tab Content */}
        <TabsContent value="officers" className="mt-0 space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading officers...</p>
          ) : !officers || officers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-4">No officers found.</p>
              <Button 
                onClick={() => setCreatingNewOfficer(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create First Officer Profile
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOfficers.length === 0 && searchQuery ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-2">
                    No officers found matching "{searchQuery}"
                  </p>
                  <Button 
                    variant="outline"
                    onClick={() => setSearchQuery("")}
                  >
                    Clear search
                  </Button>
                </div>
              ) : (
                filteredOfficers.map((officer) => (
                  <div key={officer.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="font-medium">{officer.full_name}</p>
                        <p className="text-sm text-muted-foreground">{officer.email}</p>
                        {officer.badge_number && (
                          <p className="text-sm text-muted-foreground">Badge: {officer.badge_number}</p>
                        )}
                        {officer.phone && (
                          <p className="text-sm text-muted-foreground">Phone: {officer.phone}</p>
                        )}
                        {officer.rank && (
                          <p className="text-sm font-medium text-primary">Rank: {officer.rank}</p>
                        )}
                        
                        {/* PTO Balances Section - Conditionally Rendered */}
                        {settings?.show_pto_balances && settings?.pto_balances_visible ? (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Vacation:</span>
                              <span className="font-medium">{officer.vacation_hours || 0}h</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Sick:</span>
                              <span className="font-medium">{officer.sick_hours || 0}h</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Comp:</span>
                              <span className="font-medium">{officer.comp_hours || 0}h</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Holiday:</span>
                              <span className="font-medium">{officer.holiday_hours || 0}h</span>
                            </div>
                            
                            {/* Seniority Section */}
                            <div className="col-span-2 space-y-1 text-sm">
                              <div className="flex items-center gap-1">
                                <Award className="h-3 w-3 text-muted-foreground" />
                                {/* Show "Seniority at Rank" if officer has promotion date, otherwise "Service Credit" */}
                                <span className="text-muted-foreground">
                                  {getSeniorityLabel(officer)}:
                                </span>
                                <span className="font-medium ml-1">{officer.service_credit?.toFixed(1) || 0} yrs</span>
                                {officer.service_credit_override !== null && (
                                  <span className="text-xs text-amber-600 dark:text-amber-500 ml-1">
                                    (Adjusted {officer.service_credit_override > 0 ? '+' : ''}{officer.service_credit_override.toFixed(1)} yrs)
                                  </span>
                                )}
                              </div>
                              
                              {/* Seniority Details */}
                              <div className="space-y-1 text-xs ml-4">
                                {getSeniorityDetails(officer)}
                              </div>
                            </div>
                          </div>
                        ) : (
                          // Show when PTO balances are disabled
                          <div className="mt-2 text-sm">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Award className="h-3 w-3" />
                              {/* Show "Seniority at Rank" if officer has promotion date, otherwise "Service Credit" */}
                              <span>{getSeniorityLabel(officer)}:</span>
                              <span className="font-medium ml-1">{officer.service_credit?.toFixed(1) || 0} yrs</span>
                            </div>
                            
                            {/* Seniority Details */}
                            <div className="space-y-1 text-xs ml-4 mt-1">
                              {getSeniorityDetails(officer)}
                            </div>
                            
                            <div className="mt-1 text-xs text-muted-foreground italic">
                              PTO balances are currently managed as indefinite
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                          {officer.roles && officer.roles.length > 0 ? (
                            officer.roles.map((role: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="capitalize">
                                {role}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline">Officer</Badge>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingOfficer(officer)}
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setManagingSchedule(officer)}
                          >
                            <Calendar className="h-3 w-3 mr-1" />
                            Schedule
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setBulkPTOOfficer(officer)}
                            title="Assign Bulk PTO"
                          >
                            <Calendar className="h-3 w-3 mr-1" />
                            Bulk PTO
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </TabsContent>
        
        {/* Schedules Tab Content - Placeholder for now */}
        <TabsContent value="schedules" className="mt-0">
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Schedule Management</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Manage officer schedules from the main schedule view or by clicking on individual officers above.
            </p>
            <div className="flex flex-col gap-2 max-w-md mx-auto">
              <p className="text-sm text-muted-foreground">
                • Use the "Schedule" button on each officer card to manage their recurring schedules
              </p>
              <p className="text-sm text-muted-foreground">
                • Visit the Daily Schedule view for day-to-day schedule management
              </p>
              <p className="text-sm text-muted-foreground">
                • Use the Force List for special assignment management
              </p>
            </div>
          </div>
        </TabsContent>
        
        {/* Partnerships Tab Content - NEW */}
        <TabsContent value="partnerships" className="mt-0">
          <PartnershipManagement />
        </TabsContent>
      </CardContent>

      {/* Dialogs (outside tabs content) */}
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
    </Card>
  );
};
