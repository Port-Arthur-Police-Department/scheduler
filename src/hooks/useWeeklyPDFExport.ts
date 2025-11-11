// src/hooks/useWeeklyPDFExport.ts
import { format, startOfWeek, addDays, addWeeks, parseISO, isSameDay } from "date-fns";
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

      let yPosition = 10; // Reduced from 20 to 10

      // ===== Compact Header =====
      pdf.setFontSize(12); // Reduced from 16
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(41, 128, 185);
      
      pdf.text(`WEEKLY - ${shiftName.toUpperCase()}`, pageWidth / 2, yPosition, { align: "center" });

      yPosition += 5; // Reduced from 8
      pdf.setFontSize(8); // Reduced from 10
      pdf.setTextColor(100, 100, 100);
      pdf.text(
        `${format(week.start, "MMM d")} - ${format(week.end, "MMM d, yyyy")}`,
        pageWidth / 2,
        yPosition,
        { align: "center" }
      );
      yPosition += 8; // Reduced from 15

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
      const colWidths = [20, 30]; // Slightly smaller badge and name columns
      const dayColWidth = (pageWidth - 50 - colWidths[0] - colWidths[1]) / 7; // Reduced margins
      const tableWidth = pageWidth - 20; // Reduced from 30

      // Draw the main grid header (matching your Weekly tab)
      let xPosition = 10; // Reduced from 15
      
      // Header background - blue like your app
      pdf.setFillColor(41, 128, 185);
      pdf.rect(xPosition, yPosition, tableWidth, 6, "F"); // Reduced height from 8 to 6
      
      // Header text
      pdf.setFontSize(7); // Reduced from 8
      pdf.setTextColor(255, 255, 255);

      // Static headers - matching your "Empl#" and "NAME" columns
      pdf.text("BADGE", xPosition + 2, yPosition + 4); // Adjusted vertical position
      xPosition += colWidths[0];
      pdf.text("NAME", xPosition + 2, yPosition + 4);
      xPosition += colWidths[1];

      // Day headers with dates - matching your app layout
      weekDays.forEach((day) => {
        pdf.text(day.dayName, xPosition + 2, yPosition + 2); // Adjusted vertical positions
        pdf.text(day.formattedDate, xPosition + 2, yPosition + 4.5);
        xPosition += dayColWidth;
      });

      yPosition += 6; // Reduced from 8

      // Draw staffing count rows (matching your Weekly tab)
      xPosition = 10; // Reduced from 15
      
      // SUPERVISORS count row
      pdf.setFillColor(240, 240, 240);
      pdf.rect(xPosition, yPosition, tableWidth, 5, "F"); // Reduced height from 6 to 5
      pdf.setFontSize(7); // Reduced from 8
      pdf.setTextColor(0, 0, 0);
      
      pdf.text("SUPERVISORS", xPosition + 2, yPosition + 3.5); // Adjusted vertical position
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

      yPosition += 5; // Reduced from 6

      // Render supervisors section
      supervisors.forEach((officer) => {
        if (yPosition > pageHeight - 15) {
          // If we're running out of space, start a new page (though with compact header this should be rare)
          pdf.addPage();
          yPosition = 10;
        }

        xPosition = 10; // Reduced from 15
        
        // Officer row background
        pdf.setFillColor(255, 255, 255);
        pdf.rect(xPosition, yPosition, tableWidth, 5, "F"); // Reduced height from 6 to 5
        
        // Badge number
        pdf.setFontSize(6); // Reduced from 7
        pdf.setTextColor(0, 0, 0);
        pdf.text(officer.badgeNumber?.toString() || "", xPosition + 2, yPosition + 3.5); // Adjusted vertical position
        xPosition += colWidths[0];
        
        // Name with rank
        let nameText = getLastName(officer.officerName);
        pdf.text(nameText, xPosition + 2, yPosition + 3.5);
        xPosition += colWidths[1];

        // Daily assignments for SUPERVISORS - INCLUDING DD
        weekDays.forEach((day) => {
          const dayOfficer = officer.weeklySchedule[day.dateStr];
          let text = "";
          let color: [number, number, number] = [0, 0, 0];
          let fillColor: [number, number, number] | null = null;

          if (dayOfficer) {
            if (dayOfficer.shiftInfo?.isOff) {
              text = "OFF";
              color = [100, 100, 100];
            } else if (dayOfficer.shiftInfo?.hasPTO) {
              text = "PTO";
              color = [220, 38, 38];
            } else if (dayOfficer.shiftInfo?.position) {
              // Shorten position for PDF but show more characters
              const position = dayOfficer.shiftInfo.position;
              if (position.length > 8) { // Reduced from 10
                text = position.substring(0, 8);
              } else {
                text = position;
              }
              color = [0, 100, 0];
            } else {
              // Black out the square for Designated Day Off - FOR SUPERVISORS
              fillColor = [0, 0, 0];
            }
          } else {
            // If no officer data for this day, it's a Designated Day Off
            fillColor = [0, 0, 0];
          }

          // Fill the cell with black if it's a Designated Day Off
          if (fillColor) {
            pdf.setFillColor(...fillColor);
            pdf.rect(xPosition, yPosition, dayColWidth, 5, "F"); // Reduced height
          } else {
            pdf.setTextColor(...color);
            pdf.text(text, xPosition + 2, yPosition + 3.5); // Adjusted vertical position
          }
          
          xPosition += dayColWidth;
        });

        yPosition += 5; // Reduced from 6
      });

      // OFFICERS count row (separator)
      yPosition += 2; // Reduced spacing
      xPosition = 10; // Reduced from 15
      
      pdf.setFillColor(240, 240, 240);
      pdf.rect(xPosition, yPosition, tableWidth, 5, "F"); // Reduced height
      pdf.setFontSize(7); // Reduced from 8
      pdf.setTextColor(0, 0, 0);
      
      pdf.text("OFFICERS", xPosition + 2, yPosition + 3.5); // Adjusted vertical position
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

      yPosition += 5; // Reduced from 6

      // Render regular officers
      regularOfficers.forEach((officer) => {
        if (yPosition > pageHeight - 15) {
          pdf.addPage();
          yPosition = 10;
        }

        xPosition = 10; // Reduced from 15
        
        // Officer row background
        pdf.setFillColor(255, 255, 255);
        pdf.rect(xPosition, yPosition, tableWidth, 5, "F"); // Reduced height
        
        // Badge number
        pdf.setFontSize(6); // Reduced from 7
        pdf.setTextColor(0, 0, 0);
        pdf.text(officer.badgeNumber?.toString() || "", xPosition + 2, yPosition + 3.5); // Adjusted vertical position
        xPosition += colWidths[0];
        
        // Name
        pdf.text(getLastName(officer.officerName), xPosition + 2, yPosition + 3.5);
        xPosition += colWidths[1];

        // Daily assignments for regular officers
        weekDays.forEach((day) => {
          const dayOfficer = officer.weeklySchedule[day.dateStr];
          let text = "";
          let color: [number, number, number] = [0, 0, 0];
          let fillColor: [number, number, number] | null = null;

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
              if (position.length > 8) { // Reduced from 10
                text = position.substring(0, 8);
              } else {
                text = position;
              }
              color = [0, 100, 0];
            } else {
              // Black out the square for Designated Day Off
              fillColor = [0, 0, 0];
            }
          } else {
            // If no officer data for this day, it's a Designated Day Off
            fillColor = [0, 0, 0];
          }

          // Fill the cell with black if it's a Designated Day Off
          if (fillColor) {
            pdf.setFillColor(...fillColor);
            pdf.rect(xPosition, yPosition, dayColWidth, 5, "F"); // Reduced height
          } else {
            pdf.setTextColor(...color);
            pdf.text(text, xPosition + 2, yPosition + 3.5); // Adjusted vertical position
          }
          
          xPosition += dayColWidth;
        });

        yPosition += 5; // Reduced from 6
      });

      // PPOs section if they exist
      if (ppos.length > 0) {
        // PPO count row
        yPosition += 2; // Reduced spacing
        xPosition = 10; // Reduced from 15
        
        pdf.setFillColor(200, 220, 255); // Light blue background for PPOs
        pdf.rect(xPosition, yPosition, tableWidth, 5, "F"); // Reduced height
        pdf.setFontSize(7); // Reduced from 8
        pdf.setTextColor(0, 0, 0);
        
        pdf.text("PPO", xPosition + 2, yPosition + 3.5); // Adjusted vertical position
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

        yPosition += 5; // Reduced from 6

        // Render PPOs
        ppos.forEach((officer) => {
          if (yPosition > pageHeight - 15) {
            pdf.addPage();
            yPosition = 10;
          }

          xPosition = 10; // Reduced from 15
          
          // PPO row background
          pdf.setFillColor(255, 255, 255);
          pdf.rect(xPosition, yPosition, tableWidth, 5, "F"); // Reduced height
          
          // Badge number
          pdf.setFontSize(6); // Reduced from 7
          pdf.setTextColor(0, 0, 0);
          pdf.text(officer.badgeNumber?.toString() || "", xPosition + 2, yPosition + 3.5); // Adjusted vertical position
          xPosition += colWidths[0];
          
          // Name with PPO indicator
          pdf.text(getLastName(officer.officerName) + " (PPO)", xPosition + 2, yPosition + 3.5);
          xPosition += colWidths[1];

          // Daily assignments for PPOs
          weekDays.forEach((day) => {
            const dayOfficer = officer.weeklySchedule[day.dateStr];
            let text = "";
            let color: [number, number, number] = [0, 0, 0];
            let fillColor: [number, number, number] | null = null;

            if (dayOfficer) {
              if (dayOfficer.shiftInfo?.isOff) {
                text = "OFF";
                color = [100, 100, 100];
              } else if (dayOfficer.shiftInfo?.hasPTO) {
                text = "PTO";
                color = [220, 38, 38];
              } else if (dayOfficer.shiftInfo?.position) {
                // For PPOs, show partner information if available
                const position = dayOfficer.shiftInfo.position;
                let displayText = position;
                
                // Extract partner information similar to your app
                const partnerMatch = position.match(/Partner with\s+(.+)/i);
                if (partnerMatch) {
                  displayText = `w/${getLastName(partnerMatch[1])}`;
                }
                
                if (displayText.length > 8) { // Reduced from 10
                  text = displayText.substring(0, 8);
                } else {
                  text = displayText;
                }
                color = [0, 100, 0];
              } else {
                // Black out the square for Designated Day Off
                fillColor = [0, 0, 0];
              }
            } else {
              // If no officer data for this day, it's a Designated Day Off
              fillColor = [0, 0, 0];
            }

            // Fill the cell with black if it's a Designated Day Off
            if (fillColor) {
              pdf.setFillColor(...fillColor);
              pdf.rect(xPosition, yPosition, dayColWidth, 5, "F"); // Reduced height
            } else {
              pdf.setTextColor(...color);
              pdf.text(text, xPosition + 2, yPosition + 3.5); // Adjusted vertical position
            }
            
            xPosition += dayColWidth;
          });

          yPosition += 5; // Reduced from 6
        });
      }
    }
  };

  // Helper function to render monthly view (simplified for now)
  const renderMonthlyView = (pdf: any, startDate: Date, endDate: Date, shiftName: string, scheduleData: any[]) => {
    // For monthly view, we'll use the same weekly layout but show multiple weeks
    // You can implement the calendar grid view here if needed
    renderWeeklyView(pdf, startDate, endDate, shiftName, scheduleData);
  };

  return { exportWeeklyPDF };
};
