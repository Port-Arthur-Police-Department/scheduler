// File: scheduler/src/components/dashboard/UpcomingEventsDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Cake, Award, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO, addDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserRole } from "@/hooks/useUserRole";

interface DashboardEvent {
  id: string;
  officer_name: string;
  officer_id: string;
  event_type: 'birthday' | 'anniversary';
  event_date: string;
  years: number;
  rank?: string;
}

interface UpcomingEventsDashboardProps {
  userRole?: 'officer' | 'supervisor' | 'admin';
}

export const UpcomingEventsDashboard = ({ userRole }: UpcomingEventsDashboardProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { primaryRole } = useUserRole();

  // Use provided role or fallback to useUserRole
  const actualRole = userRole || (primaryRole as 'officer' | 'supervisor' | 'admin');

  // Fetch settings to check if module is enabled for this user role
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['website-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('website_settings')
        .select('*')
        .single();
      
      if (error) {
        console.error('Error fetching settings:', error);
        return null;
      }
      return data;
    },
  });

  // Check if user should see this module
  const shouldShowModule = () => {
    if (!settings) return false;
    
    // First check if module is enabled
    if (!settings.enable_events_dashboard) return false;
    
    // Then check if user's role can see it
    switch (actualRole) {
      case 'admin':
        return settings.events_dashboard_visible_to_admins !== false;
      case 'supervisor':
        return settings.events_dashboard_visible_to_supervisors !== false;
      case 'officer':
        return settings.events_dashboard_visible_to_officers !== false;
      default:
        return false;
    }
  };

  // Fetch officers for events
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['dashboard-events', currentMonth.getMonth(), currentMonth.getFullYear()],
    queryFn: async () => {
      try {
        // Fetch active officers with birthdays and hire dates
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, full_name, date_of_birth, hire_date, rank, status')
          .eq('status', 'active')
          .order('full_name', { ascending: true });

        if (error) throw error;

        const eventsList: DashboardEvent[] = [];
        const currentYear = currentMonth.getFullYear();
        const currentMonthNum = currentMonth.getMonth();

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

        profiles?.forEach(profile => {
          // Check birthdays
          if (profile.date_of_birth && settings?.events_dashboard_show_birthdays !== false) {
            const birthDate = parseISO(profile.date_of_birth);
            const birthdayThisYear = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
            
            // If we're in current month scope, check if birthday is in this month
            // If we're in upcoming scope, check if birthday is within next 30 days
            if (isWithinInterval(birthdayThisYear, { start: startDate, end: endDate })) {
              const age = currentYear - birthDate.getFullYear();
              eventsList.push({
                id: `${profile.id}-birthday-${birthDate.getDate()}`,
                officer_name: profile.full_name || 'Unknown Officer',
                officer_id: profile.id,
                event_type: 'birthday',
                event_date: birthdayThisYear.toISOString(),
                years: age,
                rank: profile.rank
              });
            }
          }

          // Check anniversaries
          if (profile.hire_date && settings?.events_dashboard_show_anniversaries !== false) {
            const hireDate = parseISO(profile.hire_date);
            const anniversaryThisYear = new Date(currentYear, hireDate.getMonth(), hireDate.getDate());
            
            if (isWithinInterval(anniversaryThisYear, { start: startDate, end: endDate })) {
              const yearsOfService = currentYear - hireDate.getFullYear();
              eventsList.push({
                id: `${profile.id}-anniversary-${hireDate.getDate()}`,
                officer_name: profile.full_name || 'Unknown Officer',
                officer_id: profile.id,
                event_type: 'anniversary',
                event_date: anniversaryThisYear.toISOString(),
                years: yearsOfService,
                rank: profile.rank
              });
            }
          }
        });

        // Sort by date
        return eventsList.sort((a, b) => 
          new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
        );
      } catch (error) {
        console.error('Error fetching events:', error);
        return [];
      }
    },
    enabled: shouldShowModule(),
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
                    </div>
                    <div className="flex items-center gap-2 text-sm ml-6">
                      <Badge variant="secondary" className="text-xs">
                        {event.event_type === 'anniversary' ? `Year ${event.years}` : `Turns ${event.years}`}
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
      </CardContent>
    </Card>
  );
};
