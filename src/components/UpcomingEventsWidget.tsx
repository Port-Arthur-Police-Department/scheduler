import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Cake, Award, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export const UpcomingEventsWidget = () => {
  const { data: upcomingEvents, isLoading } = useQuery({
    queryKey: ['upcoming-events'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_upcoming_anniversaries', {
        days_ahead: 30
      });
      
      if (error) {
        console.error('Error fetching upcoming events:', error);
        return [];
      }
      
      return data || [];
    },
    refetchInterval: 60 * 60 * 1000, // Refetch every hour
  });

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Upcoming Events
        </CardTitle>
        <CardDescription>
          Anniversaries and birthdays in the next 30 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Loading events...</p>
          </div>
        ) : !upcomingEvents || upcomingEvents.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No upcoming events</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.slice(0, 5).map((event: any) => (
              <div 
                key={`${event.event_type}-${event.officer_id}`}
                className={`p-3 rounded-lg border ${getEventColor(event.event_type)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getEventIcon(event.event_type)}
                      <span className="font-medium">{event.officer_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm ml-6">
                      <Badge variant="outline" className="text-xs">
                        {event.event_type === 'anniversary' ? `Year ${event.years}` : `Turns ${event.years}`}
                      </Badge>
                      <span className="text-muted-foreground">
                        {format(new Date(event.event_date), 'MMM d')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {event.days_until === 0 ? 'Today' : 
                       event.days_until === 1 ? 'Tomorrow' : 
                       `In ${event.days_until} days`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {event.event_type === 'anniversary' ? 'Hire Date' : 'Birthday'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {upcomingEvents.length > 5 && (
              <div className="text-center pt-2">
                <p className="text-sm text-muted-foreground">
                  +{upcomingEvents.length - 5} more events
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
