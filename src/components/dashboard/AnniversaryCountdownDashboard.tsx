import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, parseISO, isBefore, addYears, isToday, isSameDay } from "date-fns";
import { Calendar, Target, Trophy, PartyPopper, Timer, Clock, CalendarDays } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

interface AnniversaryCountdownDashboardProps {
  userId: string;
}

export const AnniversaryCountdownDashboard = ({ userId }: AnniversaryCountdownDashboardProps) => {
  const [daysUntil, setDaysUntil] = useState<number | null>(null);
  const [yearsOfService, setYearsOfService] = useState<number>(0);
  const [nextAnniversary, setNextAnniversary] = useState<Date | null>(null);
  const [isAnniversaryToday, setIsAnniversaryToday] = useState(false);
  const queryClient = useQueryClient();

  // Fetch user profile including hire_date and preference
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile-anniversary', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('hire_date, show_anniversary_countdown, full_name')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Mutation to toggle countdown visibility
  const toggleCountdownMutation = useMutation({
    mutationFn: async (showCountdown: boolean) => {
      const { error } = await supabase
        .from('profiles')
        .update({ show_anniversary_countdown: showCountdown })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-anniversary', userId] });
      toast.success(`Anniversary countdown ${profile?.show_anniversary_countdown ? 'hidden' : 'shown'}`);
    },
  });

  // Calculate anniversary countdown
  useEffect(() => {
    if (profile?.hire_date) {
      const hireDate = parseISO(profile.hire_date);
      const today = new Date();
      
      // Calculate years of service
      const years = today.getFullYear() - hireDate.getFullYear();
      setYearsOfService(years);
      
      // Calculate next anniversary
      let nextAnniv = new Date(today.getFullYear(), hireDate.getMonth(), hireDate.getDate());
      
      // If anniversary already passed this year, move to next year
      if (isBefore(today, nextAnniv) || isSameDay(today, nextAnniv)) {
        // Anniversary is today or in the future this year
        if (isSameDay(today, nextAnniv)) {
          setIsAnniversaryToday(true);
          setDaysUntil(0);
        } else {
          setIsAnniversaryToday(false);
          const days = differenceInDays(nextAnniv, today);
          setDaysUntil(days);
        }
      } else {
        // Anniversary passed, calculate for next year
        nextAnniv = addYears(nextAnniv, 1);
        const days = differenceInDays(nextAnniv, today);
        setDaysUntil(days);
        setIsAnniversaryToday(false);
      }
      
      setNextAnniversary(nextAnniv);
    }
  }, [profile?.hire_date]);

  const handleToggleCountdown = () => {
    if (profile) {
      toggleCountdownMutation.mutate(!profile.show_anniversary_countdown);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">Loading anniversary data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't show if user has disabled it or has no hire date
  if (!profile?.show_anniversary_countdown || !profile?.hire_date) {
    return null;
  }

  // Calculate progress percentage for the year (0-100%)
  const calculateYearProgress = () => {
    if (!profile?.hire_date || !nextAnniversary) return 0;
    
    const hireDate = parseISO(profile.hire_date);
    const lastAnniversary = addYears(nextAnniversary, -1);
    const totalDaysInYear = 365;
    const daysSinceLastAnniversary = differenceInDays(new Date(), lastAnniversary);
    
    return Math.min(Math.max((daysSinceLastAnniversary / totalDaysInYear) * 100, 0), 100);
  };

  const yearProgress = calculateYearProgress();

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Service Anniversary</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleCountdown}
            className="h-8 w-8 p-0"
            title="Hide countdown"
          >
            <Clock className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isAnniversaryToday ? (
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 mb-2">
              <PartyPopper className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-primary">🎉 Happy Anniversary!</h3>
            <p className="text-muted-foreground">
              Congratulations on {yearsOfService} {yearsOfService === 1 ? 'year' : 'years'} of service!
            </p>
            <Badge variant="default" className="text-sm py-1">
              <Trophy className="h-3 w-3 mr-1" />
              {yearsOfService} Year{ yearsOfService !== 1 ? 's' : '' } Milestone
            </Badge>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Years of Service</p>
                <p className="text-2xl font-bold">{yearsOfService} <span className="text-sm font-normal text-muted-foreground">years</span></p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Next Anniversary</p>
                <p className="text-lg font-semibold">
                  {nextAnniversary ? format(nextAnniversary, 'MMM d, yyyy') : 'N/A'}
                </p>
              </div>
            </div>
            
            {/* Countdown Display */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center text-muted-foreground">
                  <Timer className="h-3 w-3 mr-1" />
                  {daysUntil === 1 ? '1 day until' : `${daysUntil} days until`}
                </span>
                <span className="font-medium">
                  Year {yearsOfService + 1}
                </span>
              </div>
              
              {/* Progress Bar */}
              <div className="space-y-1">
                <Progress value={yearProgress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Year {yearsOfService}</span>
                  <span>{Math.round(yearProgress)}%</span>
                  <span>Year {yearsOfService + 1}</span>
                </div>
              </div>
            </div>
            
            {/* Milestone Badges */}
            <div className="flex flex-wrap gap-2 pt-2">
              {yearsOfService >= 5 && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  5+ Years
                </Badge>
              )}
              {yearsOfService >= 10 && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  10+ Years
                </Badge>
              )}
              {yearsOfService >= 20 && (
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  20+ Years
                </Badge>
              )}
              {yearsOfService >= 25 && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  25+ Years
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
