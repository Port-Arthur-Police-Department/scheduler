// src/hooks/useWeeklyPDFExport.ts
import { format, startOfWeek, addDays, addWeeks, parseISO, isSameDay } from "date-fns";
import { getLastName } from "@/utils/scheduleUtils";
import { RANK_ORDER, PREDEFINED_POSITIONS } from "@/constants/positions";

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

      if (viewType === "weekly") {
        renderWeeklyView(pdf, startDate, endDate, shiftName, scheduleData);
      } else {
        renderMonthlyView(pdf, startDate, endDate, shiftName, scheduleData);
      }

      // ===== Footer =====
      pdf.setFontSize(6);
      pdf.setTextColor(100, 100, 100);
      pdf.text(
        `Generated on ${format(new Date(), "MMM d, yyyy 'at' h:mm a")}`,
        pageWidth / 2,
        pageHeight - 5,
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

  // Helper function to determine cell content - MIRRORING your ScheduleCell component logic
  const getCellContent = (officer: any) => {
    if (!officer) {
      return { text: "", color: [0, 0, 0], fillColor: null };
    }

    if (officer.shiftInfo?.isOff) {
      return { text: "OFF", color: [100, 100, 100], fillColor: null };
    }

    if (officer.shiftInfo?.hasPTO) {
      return { text: "PTO", color: [220, 38, 38], fillColor: null };
    }

    if (officer.shiftInfo?.position) {
      // Check if it's a special assignment (like your app does)
      const isSpecialAssignment = officer.shiftInfo.position && (
        officer.shiftInfo.position.toLowerCase().includes('other') ||
        (officer.shiftInfo.position && !PREDEFINED_POSITIONS.includes(officer.shiftInfo.position))
      );

      if (isSpecialAssignment) {
        return { text: "OTHER", color: [150, 75, 0], fillColor: null }; // Brown color for special assignments
      }

      // Regular position assignment
      const position = officer.shiftInfo.position;
      if (position.length > 8) {
        return { text: position.substring(0, 8), color: [0, 100, 0], fillColor: null };
      } else {
        return { text: position, color: [0, 100, 0], fillColor: null };
      }
    }

    // If officer exists but has no position and is not off/PTO, it's a Designated Day Off
    // This mirrors the logic where empty cells in your app represent DD
    return { text: "", color: [0, 0, 0], fillColor: [0, 0, 0] }; // Black out for DD
  };

  // Helper function to render weekly view matching your Weekly tab layout
  const renderWeeklyView = (pdf: any, startDate: Date, endDate: Date, shiftName: string, scheduleData: any[]) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // ===== Build weeks =====
    const weeks = [];
    let currentWeekStart = startOfWeek(startDate, { weekStartsOn: 0 });
    while (currentWeekStart <= endDate) {
      weeks.push({ start: currentWeekStart, end: addDays(currentWeekStart, 6) });
      currentWeekStart = addWeeks(currentWeekStart, 1);
    }

    for (const [weekIndex, week] of weeks.entries()) {
      // Start new page for each week
      if (weekIndex > 0) {
        pdf.addPage();
      }

      let yPosition = 10;

      // ===== Compact Header =====
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(41, 128, 185);
      
      pdf.text(`WEEKLY - ${shiftName.toUpperCase()}`, pageWidth / 2, yPosition, { align: "center" });

      yPosition += 5;
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(
        `${format(week.start, "MMM d")} - ${format(week.end, "MMM d, yyyy")}`,
        pageWidth / 2,
        yPosition,
        { align: "center" }
      );
      yPosition += 8;

      const weekDays = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(week.start, i);
        return {
          date,
          dateStr: format(date, "yyyy-MM-dd"),
          dayName: format(date, "EEE").toUpperCase(),
          formattedDate: format(date, "MMM d"),
          dayOfWeek: date.getDay(),
          isToday: isSameDay(date, new Date())
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

      // Categorize officers exactly like your Weekly tab
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

      // Calculate column widths to match your Weekly tab layout
      const colWidths = [20, 30];
      const dayColWidth = (pageWidth - 50 - colWidths[0] - colWidths[1]) / 7;
      const tableWidth = pageWidth - 20;

      // Draw the main grid header
      let xPosition = 10;
      
      // Header background - blue like your app
      pdf.setFillColor(41, 128, 185);
      pdf.rect(xPosition, yPosition, tableWidth, 6, "F");
      
      // Header text
      pdf.setFontSize(7);
      pdf.setTextColor(255, 255, 255);

      // Static headers
      pdf.text("BADGE", xPosition + 2, yPosition + 4);
      xPosition += colWidths[0];
      pdf.text("NAME", xPosition + 2, yPosition + 4);
      xPosition += colWidths[1];

      // Day headers with dates
      weekDays.forEach((day) => {
        pdf.text(day.dayName, xPosition + 2, yPosition + 2);
        pdf.text(day.formattedDate, xPosition + 2, yPosition + 4.5);
        xPosition += dayColWidth;
      });

      yPosition += 6;

      // Draw staffing count rows
      xPosition = 10;
      
      // SUPERVISORS count row
      pdf.setFillColor(240, 240, 240);
      pdf.rect(xPosition, yPosition, tableWidth, 5, "F");
      pdf.setFontSize(7);
      pdf.setTextColor(0, 0, 0);
      
      pdf.text("SUPERVISORS", xPosition + 2, yPosition + 3.5);
      xPosition += colWidths[0] + colWidths[1];
      
      // Supervisor counts per day
      weekDays.forEach((day) => {
        const daySchedule = scheduleData.find((s: any) => s.date === day.dateStr);
        const supervisorCount = daySchedule?.officers?.filter((officer: any) => {
          const isSupervisor = isSupervisorByRank({ rank: officer.rank } as OfficerWeeklyData);
          const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
          const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO;
          return isSupervisor && isScheduled;
        }).length || 0;
        
        pdf.text(`${supervisorCount}`, xPosition + (dayColWidth / 2), yPosition + 3.5, { align: "center" });
        xPosition += dayColWidth;
      });

      yPosition += 5;

      // Render supervisors section
      supervisors.forEach((officer) => {
        if (yPosition > pageHeight - 15) {
          pdf.addPage();
          yPosition = 10;
        }

        xPosition = 10;
        
        // Officer row background
        pdf.setFillColor(255, 255, 255);
        pdf.rect(xPosition, yPosition, tableWidth, 5, "F");
        
        // Badge number
        pdf.setFontSize(6);
        pdf.setTextColor(0, 0, 0);
        pdf.text(officer.badgeNumber?.toString() || "", xPosition + 2, yPosition + 3.5);
        xPosition += colWidths[0];
        
        // Name with rank
        let nameText = getLastName(officer.officerName);
        pdf.text(nameText, xPosition + 2, yPosition + 3.5);
        xPosition += colWidths[1];

        // Daily assignments for SUPERVISORS - USING THE SAME LOGIC AS YOUR APP
        weekDays.forEach((day) => {
          const dayOfficer = officer.weeklySchedule[day.dateStr];
          const cellContent = getCellContent(dayOfficer);

          // Fill the cell with black if it's a Designated Day Off
          if (cellContent.fillColor) {
            pdf.setFillColor(...cellContent.fillColor);
            pdf.rect(xPosition, yPosition, dayColWidth, 5, "F");
          } else {
            pdf.setTextColor(...cellContent.color);
            pdf.text(cellContent.text, xPosition + 2, yPosition + 3.5);
          }
          
          xPosition += dayColWidth;
        });

        yPosition += 5;
      });

      // OFFICERS count row (separator)
      yPosition += 2;
      xPosition = 10;
      
      pdf.setFillColor(240, 240, 240);
      pdf.rect(xPosition, yPosition, tableWidth, 5, "F");
      pdf.setFontSize(7);
      pdf.setTextColor(0, 0, 0);
      
      pdf.text("OFFICERS", xPosition + 2, yPosition + 3.5);
      xPosition += colWidths[0] + colWidths[1];
      
      // Officer counts per day
      weekDays.forEach((day) => {
        const daySchedule = scheduleData.find((s: any) => s.date === day.dateStr);
        const officerCount = daySchedule?.officers?.filter((officer: any) => {
          const isOfficer = !isSupervisorByRank({ rank: officer.rank } as OfficerWeeklyData);
          const isNotPPO = officer.rank?.toLowerCase() !== 'probationary';
          const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
          const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO;
          return isOfficer && isNotPPO && isScheduled;
        }).length || 0;
        
        pdf.text(`${officerCount}`, xPosition + (dayColWidth / 2), yPosition + 3.5, { align: "center" });
        xPosition += dayColWidth;
      });

      yPosition += 5;

      // Render regular officers
      regularOfficers.forEach((officer) => {
        if (yPosition > pageHeight - 15) {
          pdf.addPage();
          yPosition = 10;
        }

        xPosition = 10;
        
        // Officer row background
        pdf.setFillColor(255, 255, 255);
        pdf.rect(xPosition, yPosition, tableWidth, 5, "F");
        
        // Badge number
        pdf.setFontSize(6);
        pdf.setTextColor(0, 0, 0);
        pdf.text(officer.badgeNumber?.toString() || "", xPosition + 2, yPosition + 3.5);
        xPosition += colWidths[0];
        
        // Name
        pdf.text(getLastName(officer.officerName), xPosition + 2, yPosition + 3.5);
        xPosition += colWidths[1];

        // Daily assignments for regular officers - USING THE SAME LOGIC AS YOUR APP
        weekDays.forEach((day) => {
          const dayOfficer = officer.weeklySchedule[day.dateStr];
          const cellContent = getCellContent(dayOfficer);

          // Fill the cell with black if it's a Designated Day Off
          if (cellContent.fillColor) {
            pdf.setFillColor(...cellContent.fillColor);
            pdf.rect(xPosition, yPosition, dayColWidth, 5, "F");
          } else {
            pdf.setTextColor(...cellContent.color);
            pdf.text(cellContent.text, xPosition + 2, yPosition + 3.5);
          }
          
          xPosition += dayColWidth;
        });

        yPosition += 5;
      });

      // PPOs section if they exist
      if (ppos.length > 0) {
        // PPO count row
        yPosition += 2;
        xPosition = 10;
        
        pdf.setFillColor(200, 220, 255);
        pdf.rect(xPosition, yPosition, tableWidth, 5, "F");
        pdf.setFontSize(7);
        pdf.setTextColor(0, 0, 0);
        
        pdf.text("PPO", xPosition + 2, yPosition + 3.5);
        xPosition += colWidths[0] + colWidths[1];
        
        // PPO counts per day
        weekDays.forEach((day) => {
          const daySchedule = scheduleData.find((s: any) => s.date === day.dateStr);
          const ppoCount = daySchedule?.officers?.filter((officer: any) => {
            const isPPO = officer.rank?.toLowerCase() === 'probationary';
            const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
            const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO;
            return isPPO && isScheduled;
          }).length || 0;
          
          pdf.text(`${ppoCount}`, xPosition + (dayColWidth / 2), yPosition + 3.5, { align: "center" });
          xPosition += dayColWidth;
        });

        yPosition += 5;

        // Render PPOs
        ppos.forEach((officer) => {
          if (yPosition > pageHeight - 15) {
            pdf.addPage();
            yPosition = 10;
          }

          xPosition = 10;
          
          // PPO row background
          pdf.setFillColor(255, 255, 255);
          pdf.rect(xPosition, yPosition, tableWidth, 5, "F");
          
          // Badge number
          pdf.setFontSize(6);
          pdf.setTextColor(0, 0, 0);
          pdf.text(officer.badgeNumber?.toString() || "", xPosition + 2, yPosition + 3.5);
          xPosition += colWidths[0];
          
          // Name with PPO indicator
          pdf.text(getLastName(officer.officerName) + " (PPO)", xPosition + 2, yPosition + 3.5);
          xPosition += colWidths[1];

          // Daily assignments for PPOs - USING THE SAME LOGIC AS YOUR APP
          weekDays.forEach((day) => {
            const dayOfficer = officer.weeklySchedule[day.dateStr];
            const cellContent = getCellContent(dayOfficer);

            // Fill the cell with black if it's a Designated Day Off
            if (cellContent.fillColor) {
              pdf.setFillColor(...cellContent.fillColor);
              pdf.rect(xPosition, yPosition, dayColWidth, 5, "F");
            } else {
              pdf.setTextColor(...cellContent.color);
              pdf.text(cellContent.text, xPosition + 2, yPosition + 3.5);
            }
            
            xPosition += dayColWidth;
          });

          yPosition += 5;
        });
      }
    }
  };

  // Helper function to render monthly view
  const renderMonthlyView = (pdf: any, startDate: Date, endDate: Date, shiftName: string, scheduleData: any[]) => {
    renderWeeklyView(pdf, startDate, endDate, shiftName, scheduleData);
  };

  return { exportWeeklyPDF };
};
