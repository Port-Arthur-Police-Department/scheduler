// src/hooks/useWeeklyPDFExport.ts
import { format, startOfWeek, addDays, addWeeks, parseISO, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { getLastName } from "@/utils/scheduleUtils";
import { RANK_ORDER } from "@/constants/positions";

interface ExportOptions {
  startDate: Date;
  endDate: Date;
  shiftName: string;
  scheduleData: any[];
  viewType: "weekly" | "monthly";
}

interface OfficerWeeklyData {
  officerId: string;
  officerName: string;
  badgeNumber?: string;
  rank?: string;
  service_credit?: number;
  weeklySchedule: Record<string, any>;
  recurringDays: Set<number>;
}

export const useWeeklyPDFExport = () => {
  const exportWeeklyPDF = async ({
    startDate,
    endDate,
    shiftName,
    scheduleData,
    viewType = "weekly"
  }: ExportOptions) => {
    try {
      // ✅ Lazy-load jsPDF so it doesn't slow page load
      const { default: jsPDF } = await import("jspdf");
      
      const pdf = new jsPDF("landscape", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = 20;

      // ===== Header =====
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(41, 128, 185);
      
      const title = viewType === "weekly" 
        ? `WEEKLY SCHEDULE - ${shiftName.toUpperCase()}`
        : `MONTHLY SCHEDULE - ${shiftName.toUpperCase()}`;
      
      pdf.text(title, pageWidth / 2, yPosition, { align: "center" });

      yPosition += 8;
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(
        `Period: ${format(startDate, "MMM d, yyyy")} - ${format(endDate, "MMM d, yyyy")}`,
        pageWidth / 2,
        yPosition,
        { align: "center" }
      );
      yPosition += 15;

      if (viewType === "weekly") {
        renderWeeklyView(pdf, startDate, endDate, shiftName, scheduleData);
      } else {
        renderMonthlyView(pdf, startDate, endDate, shiftName, scheduleData);
      }

      // ===== Footer =====
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(
        `Generated on ${format(new Date(), "MMM d, yyyy 'at' h:mm a")}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );

      const filename = viewType === "weekly" 
        ? `Weekly_Schedule_${shiftName.replace(/\s+/g, "_")}_${format(startDate, "yyyy-MM-dd")}_to_${format(endDate, "yyyy-MM-dd")}.pdf`
        : `Monthly_Schedule_${shiftName.replace(/\s+/g, "_")}_${format(startDate, "yyyy-MM-dd")}_to_${format(endDate, "yyyy-MM-dd")}.pdf`;
      
      pdf.save(filename);

      return { success: true };
    } catch (error) {
      console.error("PDF export error:", error);
      return { success: false, error };
    }
  };

  // Helper function to render weekly view similar to your Excel-style table
  const renderWeeklyView = (pdf: any, startDate: Date, endDate: Date, shiftName: string, scheduleData: any[]) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    let yPosition = 40;

    // ===== Build weeks =====
    const weeks = [];
    let currentWeekStart = startOfWeek(startDate, { weekStartsOn: 0 });
    while (currentWeekStart <= endDate) {
      weeks.push({ start: currentWeekStart, end: addDays(currentWeekStart, 6) });
      currentWeekStart = addWeeks(currentWeekStart, 1);
    }

    for (const week of weeks) {
      if (yPosition > pdf.internal.pageSize.getHeight() - 100) {
        pdf.addPage();
        yPosition = 20;
      }

      // Week header
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(0, 0, 0);
      pdf.text(
        `Week of ${format(week.start, "MMM d")} - ${format(week.end, "MMM d, yyyy")}`,
        15,
        yPosition
      );
      yPosition += 8;

      const weekDays = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(week.start, i);
        return {
          date,
          dateStr: format(date, "yyyy-MM-dd"),
          dayName: format(date, "EEE").toUpperCase(),
          formattedDate: format(date, "MMM d"),
          dayOfWeek: date.getDay()
        };
      });

      // Prepare officer data for the week
      const allOfficers = new Map<string, OfficerWeeklyData>();

      // Process schedule data for the week
      scheduleData?.forEach((daySchedule: any) => {
        const scheduleDate = parseISO(daySchedule.date);
        if (scheduleDate >= week.start && scheduleDate <= week.end) {
          daySchedule.officers.forEach((officer: any) => {
            if (!allOfficers.has(officer.officerId)) {
              allOfficers.set(officer.officerId, {
                officerId: officer.officerId,
                officerName: officer.officerName,
                badgeNumber: officer.badgeNumber,
                rank: officer.rank,
                service_credit: officer.service_credit,
                weeklySchedule: {},
                recurringDays: new Set()
              });
            }
            allOfficers.get(officer.officerId)!.weeklySchedule[daySchedule.date] = officer;
          });
        }
      });

      // Categorize officers similar to your WeeklySchedule component
      const getRankPriority = (rank: string) => {
        if (!rank) return 99;
        const rankKey = Object.keys(RANK_ORDER).find(
          key => key.toLowerCase() === rank.toLowerCase()
        );
        return rankKey ? RANK_ORDER[rankKey as keyof typeof RANK_ORDER] : 99;
      };

      const isSupervisorByRank = (officer: OfficerWeeklyData) => {
        const rankPriority = getRankPriority(officer.rank || '');
        return rankPriority < RANK_ORDER.Officer;
      };

      // Categorize officers
      const supervisors = Array.from(allOfficers.values())
        .filter(o => isSupervisorByRank(o))
        .sort((a, b) => {
          const aPriority = getRankPriority(a.rank || '');
          const bPriority = getRankPriority(b.rank || '');
          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }
          return getLastName(a.officerName).localeCompare(getLastName(b.officerName));
        });

      const allOfficersList = Array.from(allOfficers.values())
        .filter(o => !isSupervisorByRank(o));

      const ppos = allOfficersList
        .filter(o => o.rank?.toLowerCase() === 'probationary')
        .sort((a, b) => {
          const aCredit = a.service_credit || 0;
          const bCredit = b.service_credit || 0;
          if (bCredit !== aCredit) {
            return bCredit - aCredit;
          }
          return getLastName(a.officerName).localeCompare(getLastName(b.officerName));
        });

      const regularOfficers = allOfficersList
        .filter(o => o.rank?.toLowerCase() !== 'probationary')
        .sort((a, b) => {
          const aCredit = a.service_credit || 0;
          const bCredit = b.service_credit || 0;
          if (bCredit !== aCredit) {
            return bCredit - aCredit;
          }
          return getLastName(a.officerName).localeCompare(getLastName(b.officerName));
        });

      // Calculate column widths
      const colWidths = [20, 30]; // Badge and Name columns
      const dayColWidth = (pageWidth - 60 - colWidths[0] - colWidths[1]) / 7;

      // Draw table headers
      let xPosition = 15;
      
      // Header background
      pdf.setFillColor(41, 128, 185);
      pdf.rect(xPosition, yPosition, pageWidth - 30, 8, "F");
      
      // Header text
      pdf.setFontSize(8);
      pdf.setTextColor(255, 255, 255);

      // Static headers
      pdf.text("BADGE", xPosition + 2, yPosition + 5);
      xPosition += colWidths[0];
      pdf.text("NAME", xPosition + 2, yPosition + 5);
      xPosition += colWidths[1];

      // Day headers
      weekDays.forEach((day) => {
        pdf.text(day.dayName, xPosition + 2, yPosition + 3);
        pdf.text(day.formattedDate, xPosition + 2, yPosition + 6);
        xPosition += dayColWidth;
      });

      yPosition += 8;

      // Function to render officer rows
      const renderOfficerRows = (officers: OfficerWeeklyData[], isPPO: boolean = false) => {
        pdf.setFontSize(7);
        
        for (const officer of officers) {
          if (yPosition > pdf.internal.pageSize.getHeight() - 15) {
            pdf.addPage();
            yPosition = 20;
          }

          xPosition = 15;
          
          // Badge number
          pdf.setTextColor(0, 0, 0);
          pdf.text(officer.badgeNumber?.toString() || "", xPosition + 2, yPosition + 4);
          xPosition += colWidths[0];
          
          // Name with rank/PPO indicator
          let nameText = getLastName(officer.officerName);
          if (isPPO) {
            nameText += " (PPO)";
          } else if (officer.rank && isSupervisorByRank(officer)) {
            nameText += ` (${officer.rank})`;
          }
          pdf.text(nameText, xPosition + 2, yPosition + 4);
          xPosition += colWidths[1];

          // Daily assignments
          weekDays.forEach((day) => {
            const dayOfficer = officer.weeklySchedule[day.dateStr];
            let text = "";
            let color: [number, number, number] = [0, 0, 0];

            if (dayOfficer) {
              if (dayOfficer.shiftInfo?.isOff) {
                text = "OFF";
                color = [100, 100, 100];
              } else if (dayOfficer.shiftInfo?.hasPTO) {
                text = "PTO";
                color = [220, 38, 38];
              } else if (dayOfficer.shiftInfo?.position) {
                // Shorten position for PDF
                const position = dayOfficer.shiftInfo.position;
                if (position.length > 8) {
                  text = position.substring(0, 8);
                } else {
                  text = position;
                }
                color = [0, 100, 0];
              } else {
                text = "SCHED";
                color = [0, 0, 150];
              }
            }

            pdf.setTextColor(...color);
            pdf.text(text, xPosition + 2, yPosition + 4);
            xPosition += dayColWidth;
          });

          yPosition += 6;
        }
      };

      // Render supervisors section
      if (supervisors.length > 0) {
        // Supervisor header
        pdf.setFillColor(240, 240, 240);
        pdf.rect(15, yPosition, pageWidth - 30, 6, "F");
        pdf.setFontSize(8);
        pdf.setTextColor(0, 0, 0);
        pdf.text("SUPERVISORS", 17, yPosition + 4);
        yPosition += 6;
        
        renderOfficerRows(supervisors);
        yPosition += 2;
      }

      // Render regular officers section
      if (regularOfficers.length > 0) {
        // Officers header
        pdf.setFillColor(240, 240, 240);
        pdf.rect(15, yPosition, pageWidth - 30, 6, "F");
        pdf.setFontSize(8);
        pdf.setTextColor(0, 0, 0);
        pdf.text("OFFICERS", 17, yPosition + 4);
        yPosition += 6;
        
        renderOfficerRows(regularOfficers);
        yPosition += 2;
      }

      // Render PPOs section
      if (ppos.length > 0) {
        // PPOs header
        pdf.setFillColor(200, 220, 255);
        pdf.rect(15, yPosition, pageWidth - 30, 6, "F");
        pdf.setFontSize(8);
        pdf.setTextColor(0, 0, 0);
        pdf.text("PPOs", 17, yPosition + 4);
        yPosition += 6;
        
        renderOfficerRows(ppos, true);
      }

      yPosition += 15;
    }
  };

  // Helper function to render monthly view
  const renderMonthlyView = (pdf: any, startDate: Date, endDate: Date, shiftName: string, scheduleData: any[]) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    let yPosition = 40;

    // Group by month
    const currentMonth = startOfMonth(startDate);
    const monthDays = eachDayOfInterval({ start: startDate, end: endDate });
    
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    const startDay = monthStart.getDay();
    const endDay = monthEnd.getDay();
    
    const previousMonthDays = Array.from({ length: startDay }, (_, i) => 
      addDays(monthStart, -startDay + i)
    );
    
    const nextMonthDays = Array.from({ length: 6 - endDay }, (_, i) => 
      addDays(monthEnd, i + 1)
    );

    const allCalendarDays = [...previousMonthDays, ...monthDays, ...nextMonthDays];
    const weeks: Date[][] = [];
    
    for (let i = 0; i < allCalendarDays.length; i += 7) {
      weeks.push(allCalendarDays.slice(i, i + 7));
    }

    // Month header
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(0, 0, 0);
    pdf.text(
      `Monthly Schedule - ${format(currentMonth, "MMMM yyyy")}`,
      pageWidth / 2,
      yPosition,
      { align: "center" }
    );
    yPosition += 10;

    // Day headers
    const dayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayColWidth = (pageWidth - 40) / 7;
    let xPosition = 20;

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 255, 255);
    
    dayHeaders.forEach(day => {
      pdf.setFillColor(41, 128, 185);
      pdf.rect(xPosition, yPosition, dayColWidth, 6, "F");
      pdf.text(day, xPosition + (dayColWidth / 2), yPosition + 4, { align: "center" });
      xPosition += dayColWidth;
    });

    yPosition += 6;

    // Render calendar weeks
    pdf.setFontSize(7);
    
    for (const week of weeks) {
      if (yPosition > pdf.internal.pageSize.getHeight() - 50) {
        pdf.addPage();
        yPosition = 20;
      }

      const rowHeight = 25;
      xPosition = 20;

      // Draw day cells
      week.forEach(day => {
        const dateStr = format(day, "yyyy-MM-dd");
        const isCurrentMonth = isSameMonth(day, currentMonth);
        const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
        
        // Cell background
        if (isToday) {
          pdf.setFillColor(255, 235, 156); // Light yellow for today
        } else if (!isCurrentMonth) {
          pdf.setFillColor(240, 240, 240); // Light gray for other months
        } else {
          pdf.setFillColor(255, 255, 255);
        }
        
        pdf.rect(xPosition, yPosition, dayColWidth, rowHeight, "F");
        
        // Day number
        pdf.setTextColor(isCurrentMonth ? 0 : 150);
        pdf.setFont("helvetica", isToday ? "bold" : "normal");
        pdf.text(
          format(day, "d"), 
          xPosition + 2, 
          yPosition + 3
        );

        // Get schedule for this day
        const daySchedule = scheduleData.find((s: any) => s.date === dateStr);
        if (daySchedule && isCurrentMonth) {
          const ptoOfficers = daySchedule.officers?.filter((officer: any) => 
            officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift
          ) || [];

          let textY = yPosition + 8;
          
          // Show PTO count
          if (ptoOfficers.length > 0) {
            pdf.setTextColor(220, 38, 38);
            pdf.text(`${ptoOfficers.length} PTO`, xPosition + 2, textY);
            textY += 4;
          }

          // Show staffing info
          if (daySchedule.staffing) {
            pdf.setTextColor(0, 100, 0);
            pdf.text(`S:${daySchedule.staffing.supervisors}`, xPosition + 2, textY);
            textY += 4;
            pdf.text(`O:${daySchedule.staffing.officers}`, xPosition + 2, textY);
          }
        }

        xPosition += dayColWidth;
      });

      yPosition += rowHeight;
    }
  };

  return { exportWeeklyPDF };
};
