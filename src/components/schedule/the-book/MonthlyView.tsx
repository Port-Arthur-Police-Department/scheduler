// src/components/schedule/the-book/MonthlyView.tsx
import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addDays, isSameMonth, isSameDay, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import type { ViewProps } from "./types";
import { calculateStaffingCounts } from "./utils";

export const MonthlyView: React.FC<ViewProps> = ({
  currentDate,
  selectedShiftId,
  schedules,
  isAdminOrSupervisor,
  weeklyColors,
  onEventHandlers,
  mutations,
  navigateToDailySchedule,
  getLastName,
  getRankAbbreviation,
}) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  const startDay = monthStart.getDay();
  const endDay = monthEnd.getDay();
  
  const previousMonthDays = Array.from({ length: startDay }, (_, i) => 
    addDays(monthStart, -startDay + i)
  );
  
  const nextMonthDays = Array.from({ length: 6 - endDay }, (_, i) => 
    addDays(monthEnd, i + 1)
  );

  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const allCalendarDays = [...previousMonthDays, ...monthDays, ...nextMonthDays];

  if (!schedules) {
    return <div className="text-center py-8 text-muted-foreground">No schedule data available</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="text-center font-medium text-sm py-2 bg-muted/50 rounded">
            {day}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {allCalendarDays.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayOfWeek = day.getDay();
          const daySchedule = schedules.dailySchedules?.find(s => s.date === dateStr);
          const isCurrentMonthDay = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());
          
          // Get minimum staffing from database
          const minStaffingForDay = schedules.minimumStaffing?.get(dayOfWeek)?.get(selectedShiftId);
          const minimumOfficers = minStaffingForDay?.minimumOfficers || 0;
          const minimumSupervisors = minStaffingForDay?.minimumSupervisors || 1;
          
          // Filter PTO officers
          const ptoOfficers = daySchedule?.officers?.filter((officer: any) => {
            if (!officer.shiftInfo?.hasPTO || !officer.shiftInfo?.ptoData) {
              return false;
            }
            
            const ptoType = officer.shiftInfo?.ptoData?.ptoType?.toLowerCase() || '';
            return ptoType.includes('vacation') || ptoType.includes('holiday') || 
                   ptoType.includes('sick') || ptoType.includes('comp');
          }) || [];

          // Calculate staffing counts
          const { supervisorCount, officerCount } = isCurrentMonthDay && daySchedule
            ? calculateStaffingCounts(daySchedule.categorizedOfficers || { supervisors: [], officers: [], ppos: [] })
            : { supervisorCount: 0, officerCount: 0 };

          const isOfficersUnderstaffed = isCurrentMonthDay && (officerCount < minimumOfficers);
          const isSupervisorsUnderstaffed = isCurrentMonthDay && (supervisorCount < minimumSupervisors);
          const isUnderstaffed = isCurrentMonthDay && (isOfficersUnderstaffed || isSupervisorsUnderstaffed);

          return (
            <div
              key={day.toISOString()}
              className={`
                min-h-32 p-2 border rounded-lg text-sm flex flex-col
                ${isCurrentMonthDay ? 'bg-card' : 'bg-muted/20 text-muted-foreground'}
                ${isToday ? 'border-primary ring-2 ring-primary' : 'border-border'}
                hover:bg-accent/50 transition-colors
                ${isUnderstaffed ? 'bg-red-50 border-red-200' : ''}
              `}
            >
              <div className="flex justify-between items-start mb-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`
                    h-6 w-6 p-0 text-xs font-medium hover:bg-primary hover:text-primary-foreground
                    ${isToday ? 'bg-primary text-primary-foreground' : ''}
                    ${!isCurrentMonthDay ? 'text-muted-foreground' : ''}
                  `}
                  onClick={() => navigateToDailySchedule(dateStr)}
                  title={`View daily schedule for ${format(day, "MMM d, yyyy")}`}
                >
                  {format(day, "d")}
                </Button>
                
                <div className="flex flex-col gap-1">
                  {isUnderstaffed && (
                    <Badge variant="destructive" className="text-xs h-4">
                      Understaffed
                    </Badge>
                  )}
                  {ptoOfficers.length > 0 && (
                    <Badge 
                      variant="outline" 
                      className="text-xs h-4 border-green-200"
                      style={{
                        backgroundColor: weeklyColors.pto?.bg,
                        color: weeklyColors.pto?.text
                      }}
                    >
                      PTO: {ptoOfficers.length}
                    </Badge>
                  )}
                  {isCurrentMonthDay && !isUnderstaffed && (
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="text-xs h-4">
                        {supervisorCount}/{minimumSupervisors} Sup
                      </Badge>
                      <Badge variant="outline" className="text-xs h-4">
                        {officerCount}/{minimumOfficers} Ofc
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-1 flex-1 overflow-y-auto">
                {ptoOfficers.length > 0 ? (
                  <div className="space-y-1">
                    {ptoOfficers.map((officer: any) => {
                      const isSupervisor = officer.rank?.toLowerCase().includes('lieutenant') || 
                                         officer.rank?.toLowerCase().includes('sergeant') ||
                                         officer.rank?.toLowerCase().includes('sgt') ||
                                         officer.rank?.toLowerCase().includes('lt') ||
                                         officer.rank?.toLowerCase().includes('chief');
                      const isPPO = officer.rank?.toLowerCase() === 'probationary';
                      const rankAbbreviation = getRankAbbreviation(officer.rank);
                      const ptoType = officer.shiftInfo?.ptoData?.ptoType || 'PTO';
                      
                      // Get the correct color based on PTO type
                      const getPTOColor = (ptoType: string) => {
                        const ptoTypeLower = ptoType?.toLowerCase() || '';
                        
                        if (ptoTypeLower.includes('vacation') || ptoTypeLower === 'vacation') {
                          return {
                            bg: weeklyColors.vacation?.bg || 'rgb(173, 216, 230)',
                            text: weeklyColors.vacation?.text || 'rgb(0, 0, 139)',
                            border: weeklyColors.vacation?.border || 'rgb(100, 149, 237)'
                          };
                        } else if (ptoTypeLower.includes('holiday') || ptoTypeLower === 'holiday') {
                          return {
                            bg: weeklyColors.holiday?.bg || 'rgb(255, 218, 185)',
                            text: weeklyColors.holiday?.text || 'rgb(165, 42, 42)',
                            border: weeklyColors.holiday?.border || 'rgb(255, 165, 0)'
                          };
                        } else if (ptoTypeLower.includes('sick') || ptoTypeLower === 'sick') {
                          return {
                            bg: weeklyColors.sick?.bg || 'rgb(255, 200, 200)',
                            text: weeklyColors.sick?.text || 'rgb(139, 0, 0)',
                            border: weeklyColors.sick?.border || 'rgb(255, 100, 100)'
                          };
                        } else if (ptoTypeLower.includes('comp') || ptoTypeLower === 'comp') {
                          return {
                            bg: weeklyColors.comp?.bg || 'rgb(221, 160, 221)',
                            text: weeklyColors.comp?.text || 'rgb(128, 0, 128)',
                            border: weeklyColors.comp?.border || 'rgb(186, 85, 211)'
                          };
                        } else {
                          // Default PTO color for other types
                          return {
                            bg: weeklyColors.pto?.bg || 'rgb(144, 238, 144)',
                            text: weeklyColors.pto?.text || 'rgb(0, 100, 0)',
                            border: weeklyColors.pto?.border || 'rgb(0, 100, 0)'
                          };
                        }
                      };

                      // Get badge color based on rank
                      const getRankBadgeColor = (rankAbbr: string) => {
                        if (rankAbbr === 'Sgt') {
                          return "bg-gray-100 text-gray-800 border-gray-300";
                        } else {
                          return "bg-yellow-100 text-yellow-800 border-yellow-300";
                        }
                      };

                      const ptoColors = getPTOColor(ptoType);
                      const rankBadgeClass = getRankBadgeColor(rankAbbreviation);
                      
                      return (
                        <div 
                          key={officer.officerId} 
                          className="text-xs p-1 rounded border flex items-center justify-between group hover:opacity-90"
                          style={{
                            backgroundColor: ptoColors.bg,
                            borderColor: ptoColors.border,
                            color: ptoColors.text
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <div className={`font-medium truncate ${!isCurrentMonthDay ? 'opacity-70' : ''}`}>
                              {getLastName(officer.officerName)}
                            </div>
                            {isSupervisor && (
                              <Badge variant="outline" className={`h-3 text-[8px] px-1 ${rankBadgeClass}`}>
                                {rankAbbreviation}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <div className={`text-[10px] font-medium ${!isCurrentMonthDay ? 'opacity-70' : ''}`}>
                              {ptoType}
                            </div>
                            {isAdminOrSupervisor && isCurrentMonthDay && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEventHandlers.onRemovePTO(officer.shiftInfo, dateStr, officer.officerId);
                                }}
                                disabled={mutations.removePTOMutation.isPending}
                                title="Remove PTO"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={`text-xs text-center py-2 ${!isCurrentMonthDay ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                    No PTO
                  </div>
                )}
              </div>
              
              {isUnderstaffed && (
                <div className="mt-1 text-[10px] space-y-0.5 text-red-600">
                  {isSupervisorsUnderstaffed && (
                    <div>Sup: {supervisorCount}/{minimumSupervisors}</div>
                  )}
                  {isOfficersUnderstaffed && (
                    <div>Ofc: {officerCount}/{minimumOfficers}</div>
                  )}
                </div>
              )}
              
              {!isCurrentMonthDay && (
                <div className="text-[8px] text-muted-foreground text-center mt-1">
                  {format(day, "MMM")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
