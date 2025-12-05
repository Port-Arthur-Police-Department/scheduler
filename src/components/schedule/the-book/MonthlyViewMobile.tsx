// src/components/schedule/the-book/MonthlyViewMobile.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from "date-fns";

interface MonthlyViewMobileProps {
  currentDate: Date;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}

const MonthlyViewMobile = ({
  currentDate,
  onPrevious,
  onNext,
  onToday
}: MonthlyViewMobileProps) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-4">
      {/* Month header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          <h2 className="text-lg font-semibold">{format(currentDate, "MMMM yyyy")}</h2>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={onPrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={onToday}>
            Today
          </Button>
          <Button size="sm" variant="outline" onClick={onNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <Card>
        <CardContent className="p-4">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground p-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: monthStart.getDay() }).map((_, index) => (
              <div key={`empty-${index}`} className="h-10" />
            ))}
            
            {days.map(day => {
              const isCurrentDay = isToday(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              
              return (
                <div
                  key={day.toISOString()}
                  className={`h-10 flex items-center justify-center rounded-lg text-sm
                    ${isCurrentDay 
                      ? 'bg-primary text-primary-foreground font-semibold' 
                      : isCurrentMonth
                        ? 'bg-background hover:bg-muted'
                        : 'bg-muted/30 text-muted-foreground'
                    }
                  `}
                >
                  {format(day, "d")}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="text-sm space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-muted" />
          <span>Other Month</span>
        </div>
      </div>
    </div>
  );
};

export default MonthlyViewMobile;
