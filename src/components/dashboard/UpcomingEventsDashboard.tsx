// File: scheduler/src/components/dashboard/UpcomingEventsDashboard.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Cake, Award, ChevronLeft, ChevronRight, Users, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO, addDays, differenceInDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DashboardEvent {
  id: string;
  officer_name: string;
  officer_id: string;
  event_type: 'birthday' | 'anniversary';
  event_date: string;
  years: number;
  rank?: string;
  badge_number?: string;
}

interface UpcomingEventsDashboardProps {
  userRole?: 'officer' | 'supervisor' | 'admin';
}

export const UpcomingEventsDashboard = ({ userRole }: UpcomingEventsDashboardProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Fetch settings to check if module is enabled for this user role
  const { data: settings, isLoading: settingsLoading, error: settingsError } = useQuery({
    queryKey: ['website-settings-events'],
    queryFn: async () => {
      console.log('🔍 Fetching website settings for events dashboard...');
      const { data, error } = await supabase
        .from('website_settings')
        .select('*')
        .single();
      
      if (error) {
        console.error('❌ Error fetching settings:', error);
        return null;
      }
      
      console.log('✅ Settings loaded:', {
        enable_events_dashboard: data.enable_events_dashboard,
        visible_to_officers: data.events_dashboard_visible_to_officers,
        visible_to_supervisors: data.events_dashboard_visible_to_supervisors,
        visible_to_admins: data.events_dashboard_visible_to_admins,
        show_birthdays: data.events_dashboard_show_birthdays,
        show_anniversaries: data.events_dashboard_show_anniversaries,
        month_scope: data.events_dashboard_month_scope
      });
      
      return data;
    },
  });

  // Check if user should see this module
  const shouldShowModule = () => {
    if (!settings) {
      return false;
    }
    
    // First check if module is enabled
    if (!settings.enable_events_dashboard) {
      return false;
    }
    
    // Then check if user's role can see it
    let roleCanSee = false;
    switch (userRole) {
      case 'admin':
        roleCanSee = settings.events_dashboard_visible_to_admins !== false;
        break;
      case 'supervisor':
        roleCanSee = settings.events_dashboard_visible_to_supervisors !== false;
        break;
      case 'officer':
        roleCanSee = settings.events_dashboard_visible_to_officers !== false;
        break;
      default:
        roleCanSee = false;
        break;
    }
    
    return roleCanSee;
  };

  // Fetch officers for events - UPDATED WITH CORRECT COLUMN NAMES
  const { data: events, isLoading: eventsLoading, error: eventsError } = useQuery({
    queryKey: ['dashboard-events', currentMonth.getMonth(), currentMonth.getFullYear()],
    queryFn: async () => {
      try {
        console.log('🎯 Fetching events for month:', currentMonth.getMonth() + 1, currentMonth.getFullYear());
        
        // Fetch active officers with birthdays and hire dates - USING CORRECT COLUMN NAMES
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, full_name, birthday, hire_date, rank, badge_number, active')
          .eq('active', true)
          .order('full_name', { ascending: true });

        if (error) {
          console.error('❌ Error fetching profiles:', error);
          throw error;
        }

        console.log('📊 Profiles found:', profiles?.length || 0);
        
        const eventsList: DashboardEvent[] = [];
        const currentYear = currentMonth.getFullYear();

        // Determine scope based on settings
        const scope = settings?.events_dashboard_month_scope || 'current';
        const now = new Date();
        
        let startDate: Date;
        let endDate: Date;

        if (scope === 'current') {
          // Current month scope
          startDate = startOfMonth(currentMonth);
          endDate = endOfMonth(currentMonth);
        } else {
          // Upcoming 30 days scope - always from today
          startDate = now;
          endDate = addDays(now, 30);
        }

        console.log('📅 Date range for events:', {
          scope,
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd')
        });

        // Log all birthdays and hire dates for debugging
        profiles?.forEach((profile, index) => {
          console.log(`👤 Profile ${index + 1}:`, {
            name: profile.full_name,
            birthday: profile.birthday,
            hire_date: profile.hire_date
          });
        });

        profiles?.forEach(profile => {
          // Check birthdays - USING CORRECT COLUMN NAME: birthday
          if (profile.birthday && settings?.events_dashboard_show_birthdays !== false) {
            try {
              const birthDate = parseISO(profile.birthday);
              const birthdayThisYear = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
              
              // If we're in current month scope, check if birthday is in this month
              // If we're in upcoming scope, check if birthday is within next 30 days
              if (isWithinInterval(birthdayThisYear, { start: startDate, end: endDate })) {
                const age = currentYear - birthDate.getFullYear();
                console.log(`🎂 Birthday found for ${profile.full_name}:`, {
                  date: format(birthdayThisYear, 'yyyy-MM-dd'),
                  age
                });
                
                eventsList.push({
                  id: `${profile.id}-birthday-${birthDate.getDate()}`,
                  officer_name: profile.full_name || 'Unknown Officer',
                  officer_id: profile.id,
                  event_type: 'birthday',
                  event_date: birthdayThisYear.toISOString(),
                  years: age,
                  rank: profile.rank,
                  badge_number: profile.badge_number
                });
              }
            } catch (error) {
              console.error(`Error processing birthday for ${profile.full_name}:`, error);
            }
          }

          // Check anniversaries - USING CORRECT COLUMN NAME: hire_date
          if (profile.hire_date && settings?.events_dashboard_show_anniversaries !== false) {
            try {
              const hireDate = parseISO(profile.hire_date);
              const anniversaryThisYear = new Date(currentYear, hireDate.getMonth(), hireDate.getDate());
              
              if (isWithinInterval(anniversaryThisYear, { start: startDate, end: endDate })) {
                const yearsOfService = currentYear - hireDate.getFullYear();
                console.log(`🎖️ Anniversary found for ${profile.full_name}:`, {
                  date: format(anniversaryThisYear, 'yyyy-MM-dd'),
                  yearsOfService
                });
                
                eventsList.push({
                  id: `${profile.id}-anniversary-${hireDate.getDate()}`,
                  officer_name: profile.full_name || 'Unknown Officer',
                  officer_id: profile.id,
                  event_type: 'anniversary',
                  event_date: anniversaryThisYear.toISOString(),
                  years: yearsOfService,
                  rank: profile.rank,
                  badge_number: profile.badge_number
                });
              }
            } catch (error) {
              console.error(`Error processing anniversary for ${profile.full_name}:`, error);
            }
          }
        });

        console.log('📋 Total events found:', eventsList.length);
        
        // Sort by date
        const sortedEvents = eventsList.sort((a, b) => 
          new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
        );
        
        console.log('✅ Events sorted and ready:', sortedEvents);
        return sortedEvents;
      } catch (error) {
        console.error('❌ Error fetching events:', error);
        return [];
      }
    },
    enabled: shouldShowModule() && !settingsLoading,
  });

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(current => 
      direction === 'prev' ? subMonths(current, 1) : addMonths(current, 1)
    );
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'anniversary':
        return <Award className="h-4 w-4 text-blue-500" />;
      case 'birthday':
        return <Cake className="h-4 w-4 text-pink-500" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'anniversary':
        return "bg-blue-50 text-blue-700 border-blue-200";
      case 'birthday':
        return "bg-pink-50 text-pink-700 border-pink-200";
      default:
        return "bg-gray-50";
    }
  };

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'MMM d');
  };

  const getTodayBadge = (dateString: string) => {
    const eventDate = new Date(dateString);
    const today = new Date();
    
    // Check if same day (ignoring time)
    return eventDate.getDate() === today.getDate() && 
           eventDate.getMonth() === today.getMonth() && 
           eventDate.getFullYear() === today.getFullYear();
  };

  // Don't render anything if module shouldn't be shown
  if (!shouldShowModule()) {
    console.log('🚫 Module not shown - settings check failed');
    return null;
  }

  const isLoading = settingsLoading || eventsLoading;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Events - {format(currentMonth, 'MMMM yyyy')}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateMonth('prev')}
              disabled={isLoading}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateMonth('next')}
              disabled={isLoading}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription>
          {settings?.events_dashboard_month_scope === 'current' 
            ? `Birthdays and hire date anniversaries for ${format(currentMonth, 'MMMM yyyy')}`
            : 'Birthdays and hire date anniversaries in the next 30 days'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Debug info */}
        {eventsError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error Loading Events</AlertTitle>
            <AlertDescription>
              {eventsError.message}
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !events || events.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              {settings?.events_dashboard_month_scope === 'current' 
                ? `No upcoming events for ${format(currentMonth, 'MMMM')}`
                : 'No upcoming events in the next 30 days'}
            </p>
            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Make sure officers have their <strong>birthday</strong> and <strong>hire_date</strong> 
                fields filled in their profiles.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {events.map((event) => (
              <div
                key={event.id}
                className={`p-3 rounded-lg border ${getEventColor(event.event_type)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getEventIcon(event.event_type)}
                      <span className="font-medium">{event.officer_name}</span>
                      {getTodayBadge(event.event_date) && (
                        <Badge variant="default" className="text-xs">
                          Today
                        </Badge>
                      )}
                      {event.rank && (
                        <Badge variant="outline" className="text-xs">
                          {event.rank}
                        </Badge>
                      )}
                      {event.badge_number && (
                        <Badge variant="secondary" className="text-xs">
                          {event.badge_number}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm ml-6">
                      <Badge variant="secondary" className="text-xs">
                        {event.event_type === 'anniversary' ? `Year ${event.years}` : `Age ${event.years}`}
                      </Badge>
                      <span className="text-muted-foreground">
                        {formatEventDate(event.event_date)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium capitalize">
                      {event.event_type}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {event.event_type === 'anniversary' ? 'Hire Date' : 'Birthday'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Stats Summary */}
        {events && events.length > 0 && (
          <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <div className="text-lg font-semibold text-pink-600">
                {events.filter(e => e.event_type === 'birthday').length}
              </div>
              <div className="text-xs text-muted-foreground">Birthdays</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">
                {events.filter(e => e.event_type === 'anniversary').length}
              </div>
              <div className="text-xs text-muted-foreground">Anniversaries</div>
            </div>
          </div>
        )}
        
        {/* Debug info for admin */}
        {userRole === 'admin' && (
          <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
            <p>Debug info: Found {events?.length || 0} events for {format(currentMonth, 'MMMM yyyy')}</p>
            <p>Settings: Module {settings?.enable_events_dashboard ? 'enabled' : 'disabled'}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
