import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Clock, Edit2, Calendar, Award, Plus, Search } from "lucide-react";
import { OfficerProfileDialog } from "./OfficerProfileDialog";
import { OfficerScheduleManager } from "./OfficerScheduleManager";
import { format } from "date-fns";
import { useWebsiteSettings } from "@/hooks/useWebsiteSettings";

export const StaffManagement = () => {
  const [editingOfficer, setEditingOfficer] = useState<any>(null);
  const [managingSchedule, setManagingSchedule] = useState<any>(null);
  const [creatingNewOfficer, setCreatingNewOfficer] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
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
              Staff Directory
            </CardTitle>
            <CardDescription>View all officers and their information</CardDescription>
          </div>
          <Button 
            onClick={() => setCreatingNewOfficer(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Profile
          </Button>
        </div>
        
        {/* Search Bar */}
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
      </CardHeader>
      <CardContent>
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
                          <div className="flex items-center gap-1">
                            <Award className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Service Credit:</span>
                            <div className="space-y-0.5">
                              <span className="font-medium">{officer.service_credit?.toFixed(1) || 0} yrs</span>
                              {officer.hire_date && (
                                <p className="text-xs text-muted-foreground">
                                  Since {format(new Date(officer.hire_date), "MMM yyyy")}
                                </p>
                              )}
                              {officer.service_credit_override !== null && (
                                <p className="text-xs text-amber-600 dark:text-amber-500">
                                  (Adjusted {officer.service_credit_override > 0 ? '+' : ''}{officer.service_credit_override.toFixed(1)} yrs)
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Show when PTO balances are disabled
                        <div className="mt-2 text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Award className="h-3 w-3" />
                            <span>Service Credit:</span>
                            <span className="font-medium">{officer.service_credit?.toFixed(1) || 0} yrs</span>
                            {officer.hire_date && (
                              <span className="text-xs">
                                (Since {format(new Date(officer.hire_date), "MMM yyyy")})
                              </span>
                            )}
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
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>

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
    </Card>
  );
};
