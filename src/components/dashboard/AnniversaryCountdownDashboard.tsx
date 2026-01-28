import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, parseISO } from "date-fns";
import { Trophy, PartyPopper, Timer, CalendarDays, Star, Award } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface AnniversaryCountdownDashboardProps {
  userId: string;
  userRole: 'officer' | 'supervisor' | 'admin';
  websiteSettings: any;
}

export const AnniversaryCountdownDashboard = ({ 
  userId, 
  userRole,
  websiteSettings 
}: AnniversaryCountdownDashboardProps) => {
  const [daysUntil, setDaysUntil] = useState<number | null>(null);
  const [yearsOfService, setYearsOfService] = useState<number>(0);
  const [nextAnniversary, setNextAnniversary] = useState<Date | null>(null);
  const [isAnniversaryToday, setIsAnniversaryToday] = useState(false);

  // Check if countdown is enabled for this user's role
  const isEnabledForRole = () => {
    if (!websiteSettings?.enable_anniversary_countdown) return false;
    
    switch (userRole) {
      case 'admin':
        return websiteSettings?.anniversary_countdown_admins !== false;
      case 'supervisor':
        return websiteSettings?.anniversary_countdown_supervisors !== false;
      case 'officer':
        return websiteSettings?.anniversary_countdown_officers !== false;
      default:
        return false;
    }
  };

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
    enabled: !!userId && isEnabledForRole(),
  });

useEffect(() => {
  if (profile?.hire_date) {
    const today = new Date();
    
    // Parse hire date from YYYY-MM-DD format
    const hireDateStr = profile.hire_date;
    console.log('Processing anniversary for:', profile.full_name);
    console.log('Hire date string:', hireDateStr);
    
    // Parse date manually to avoid timezone issues
    const [year, month, day] = hireDateStr.split('-').map(Number);
    const hireDate = new Date(year, month - 1, day); // month is 0-indexed
    
    console.log('Parsed hire date:', hireDate.toDateString());
    console.log('Today:', today.toDateString());
    
    // Create date objects for comparison (strip time components)
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const hireDateOnly = new Date(hireDate.getFullYear(), hireDate.getMonth(), hireDate.getDate());
    
    // Calculate years of service COMPLETED
    let yearsCompleted = today.getFullYear() - hireDate.getFullYear();
    
    // Create this year's anniversary date
    const thisYearAnniversary = new Date(
      today.getFullYear(),
      hireDate.getMonth(),
      hireDate.getDate()
    );
    
    console.log('This year anniversary:', thisYearAnniversary.toDateString());
    
    // Check if we've passed this year's anniversary
    // Use simple date comparison (milliseconds)
    const todayMillis = todayDateOnly.getTime();
    const anniversaryMillis = thisYearAnniversary.getTime();
    
    console.log('Today millis:', todayMillis);
    console.log('Anniversary millis:', anniversaryMillis);
    console.log('Comparison:', todayMillis >= anniversaryMillis ? 'Has passed' : 'Not yet');
    
    if (todayMillis < anniversaryMillis) {
      yearsCompleted--; // Haven't reached anniversary this year
    }
    
    setYearsOfService(yearsCompleted);
    console.log('Years of service (completed):', yearsCompleted);
    
    // Calculate NEXT anniversary
    let nextAnnivYear = today.getFullYear();
    
    if (todayMillis >= anniversaryMillis) {
      nextAnnivYear = today.getFullYear() + 1;
    }
    
    const nextAnniversary = new Date(nextAnnivYear, hireDate.getMonth(), hireDate.getDate());
    setNextAnniversary(nextAnniversary);
    
    console.log('Next anniversary:', nextAnniversary.toDateString());
    
    // Check if today IS the anniversary
    const isTodayAnniversary = 
      today.getMonth() === hireDate.getMonth() &&
      today.getDate() === hireDate.getDate();
    
    setIsAnniversaryToday(isTodayAnniversary);
    
    // Calculate days until next anniversary
    if (isTodayAnniversary) {
      setDaysUntil(0);
      console.log('🎉 TODAY IS THE ANNIVERSARY!');
    } else {
      const diffTime = nextAnniversary.getTime() - todayDateOnly.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setDaysUntil(diffDays);
      console.log('Days until next anniversary:', diffDays);
    }
    
    console.log('--- Calculation Complete ---\n');
  }
}, [profile?.hire_date]);

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

  // Don't show if:
  // 1. Feature is disabled globally
  // 2. Feature is disabled for user's role
  // 3. User has disabled it personally
  // 4. User has no hire date
  if (!isEnabledForRole() || !profile?.show_anniversary_countdown || !profile?.hire_date) {
    return null;
  }

  // Calculate progress percentage for the year (0-100%)
  const calculateYearProgress = () => {
    if (!profile?.hire_date || !nextAnniversary) return 0;
    
    const hireDate = parseISO(profile.hire_date);
    const lastAnniversary = new Date(
      nextAnniversary.getFullYear() - 1,
      nextAnniversary.getMonth(),
      nextAnniversary.getDate()
    );
    
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
          {/* REMOVED: The clock button that was causing issues */}
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
              
              {/* Progress Bar - only show if enabled */}
              {websiteSettings?.anniversary_show_progress_bar !== false && (
                <div className="space-y-1">
                  <Progress value={yearProgress} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Year {yearsOfService}</span>
                    <span>{Math.round(yearProgress)}%</span>
                    <span>Year {yearsOfService + 1}</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Milestone Badges - only show if enabled */}
            {websiteSettings?.anniversary_show_milestone_badges !== false && (
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
                {yearsOfService >= 15 && (
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                    15+ Years
                  </Badge>
                )}
                {yearsOfService >= 20 && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    <Star className="h-3 w-3 mr-1" />
                    20+ Years (Retirement Eligible)
                  </Badge>
                )}
                {yearsOfService >= 25 && (
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    <Award className="h-3 w-3 mr-1" />
                    25+ Years
                  </Badge>
                )}
                {yearsOfService >= 30 && (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    <Award className="h-3 w-3 mr-1" />
                    30+ Years
                  </Badge>
                )}
                {yearsOfService >= 35 && (
                  <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                    <Award className="h-3 w-3 mr-1" />
                    35+ Years
                  </Badge>
                )}
                {yearsOfService >= 40 && (
                  <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
                    <Award className="h-3 w-3 mr-1" />
                    40+ Years
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
