// src/hooks/useWeeklyPDFExport.ts - FIXED MULTI-WEEK EXPORT
import { format, startOfWeek, addDays, addWeeks, parseISO, isSameDay } from "date-fns";
import { getLastName } from "@/utils/scheduleUtils";
import { RANK_ORDER, PREDEFINED_POSITIONS } from "@/constants/positions";

interface ExportOptions {
  startDate: Date;
  endDate: Date;
  shiftName: string;
  scheduleData: any[];
  minimumStaffing?: Map<number, Map<string, { minimumOfficers: number; minimumSupervisors: number }>>;
  selectedShiftId?: string;
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
    minimumStaffing,
    selectedShiftId
  }: ExportOptions) => {
    try {
      const { default: jsPDF } = await import("jspdf");
      
      // PORTRAIT MODE
      const pdf = new jsPDF("portrait", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      renderWeeklyView(pdf, startDate, endDate, shiftName, scheduleData, minimumStaffing, selectedShiftId);

      // Footer
      pdf.setFontSize(6);
      pdf.setTextColor(100, 100, 100);
      pdf.text(
        `Generated on ${format(new Date(), "MMM d, yyyy 'at' h:mm a")}`,
        pageWidth / 2,
        pageHeight - 5,
        { align: "center" }
      );

      const filename = `Weekly_Schedule_${shiftName.replace(/\s+/g, "_")}_${format(startDate, "yyyy-MM-dd")}_to_${format(endDate, "yyyy-MM-dd")}.pdf`;
      
      pdf.save(filename);

      return { success: true };
    } catch (error) {
      console.error("PDF export error:", error);
      return { success: false, error };
    }
  };

  // Helper function to check if position is a special assignment
  const isSpecialAssignment = (position: string) => {
    if (!position) return false;
    return position.toLowerCase().includes('other') ||
           (position && !PREDEFINED_POSITIONS.includes(position));
  };

  // Helper function to simplify position text - ONLY REMOVE "DISTRICT"
  const simplifyPosition = (position: string): string => {
    if (!position) return "";
    
    // Only remove the word "District" but keep all numbers/slashes
    if (position.toLowerCase().startsWith('district')) {
      return position.replace(/district\s*/i, '');
    }
    
    return position;
  };

  // CORRECTED cell display logic - FIXED OFF DAY BACKGROUND
  const getCellDisplay = (officer: any) => {
    if (!officer) {
      return { text: "", color: [0, 0, 0], fillColor: [220, 220, 220] }; // Gray for empty non-scheduled days
    }

    if (officer.shiftInfo?.isOff) {
      return { text: "OFF", color: [100, 100, 100], fillColor: [220, 220, 220] }; // Gray for OFF days
    } else if (officer.shiftInfo?.hasPTO) {
      // Differentiate between full and partial PTO
      if (officer.shiftInfo?.ptoData?.isFullShift) {
        const ptoType = officer.shiftInfo.ptoData.ptoType || "PTO";
        return { text: ptoType, color: [0, 100, 0], fillColor: [144, 238, 144] }; // Light green
      } else {
        // Partial PTO - show position with indicator
        const position = officer.shiftInfo.position || "";
        const simplifiedPosition = simplifyPosition(position);
        const displayText = simplifiedPosition ? simplifiedPosition + "*" : "PTO*";
        return { text: displayText, color: [0, 100, 0], fillColor: [255, 255, 224] }; // Light yellow
      }
    } else if (officer.shiftInfo?.position) {
      const position = officer.shiftInfo.position;
      const simplifiedPosition = simplifyPosition(position);
      const isSpecial = isSpecialAssignment(position);
      // Use simplified position text
      let displayText = simplifiedPosition;
      if (simplifiedPosition.length > 8) {
        displayText = simplifiedPosition.substring(0, 8);
      }
      return { 
        text: displayText, 
        color: isSpecial ? [139, 69, 19] : [0, 100, 0], 
        fillColor: isSpecial ? [255, 248, 220] : [255, 255, 255] // White for regular positions
      };
    } else {
      return { text: " ", color: [0, 0, 150], fillColor: [255, 255, 255] }; // White for scheduled but no assignment
    }
  };

  // Helper function to get rank priority
  const getRankPriority = (rank: string) => {
    if (!rank) return 99;
    const rankKey = Object.keys(RANK_ORDER).find(
      key => key.toLowerCase() === rank.toLowerCase()
    );
    return rankKey ? RANK_ORDER[rankKey as keyof typeof RANK_ORDER] : 99;
  };

  // Helper function to check if officer is supervisor by rank
  const isSupervisorByRank = (officer: OfficerWeeklyData) => {
    const rankPriority = getRankPriority(officer.rank || '');
    return rankPriority < RANK_ORDER.Officer;
  };

  // FIXED: Weekly view that handles multiple weeks in date range
  const renderWeeklyView = (
    pdf: any, 
    startDate: Date, 
    endDate: Date, 
    shiftName: string, 
    scheduleData: any[],
    minimumStaffing?: Map<number, Map<string, { minimumOfficers: number; minimumSupervisors: number }>>,
    selectedShiftId?: string
  ) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Build weeks array for the entire date range
    const weeks = [];
    let currentWeekStart = startOfWeek(startDate, { weekStartsOn: 0 });
    
    while (currentWeekStart <= endDate) {
      const weekEnd = addDays(currentWeekStart, 6);
      weeks.push({ 
        start: currentWeekStart, 
        end: weekEnd > endDate ? endDate : weekEnd // Don't exceed the selected end date
      });
      currentWeekStart = addWeeks(currentWeekStart, 1);
    }

    // Render each week
    for (const [weekIndex, week] of weeks.entries()) {
      if (weekIndex > 0) {
        pdf.addPage();
      }

      let yPosition = 10;

      // ONLY DATE RANGE HEADER for this specific week
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(41, 128, 185);
      pdf.text(
        `${format(week.start, "MMM d, yyyy")} - ${format(week.end, "MMM d, yyyy")}`,
        pageWidth / 2,
        yPosition,
        { align: "center" }
      );
      yPosition += 8;

      const weekDays = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(week.start, i);
        // Don't show days beyond the selected end date
        if (date > endDate) {
          return null;
        }
        return {
          date,
          dateStr: format(date, "yyyy-MM-dd"),
          dayName: format(date, "EEE").toUpperCase(),
          formattedDate: format(date, "MMM d"),
          dayOfWeek: date.getDay(),
          isToday: isSameDay(date, new Date())
        };
      }).filter(day => day !== null); // Remove null days

      // Prepare officer data FOR THIS WEEK ONLY
      const allOfficers = new Map<string, OfficerWeeklyData>();

      scheduleData?.forEach((daySchedule: any) => {
        const scheduleDate = parseISO(daySchedule.date);
        // Only include days within this week and the selected date range
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

      // Categorize officers - INCLUDING PPO
      const supervisors = Array.from(allOfficers.values())
        .filter(o => isSupervisorByRank(o))
        .sort((a, b) => {
          const aPriority = getRankPriority(a.rank || '');
          const bPriority = getRankPriority(b.rank || '');
          if (aPriority !== bPriority) return aPriority - bPriority;
          return getLastName(a.officerName).localeCompare(getLastName(b.officerName));
        });

      const allOfficersList = Array.from(allOfficers.values())
        .filter(o => !isSupervisorByRank(o));

      // ADD PPO SECTION BACK
      const ppos = allOfficersList
        .filter(o => o.rank?.toLowerCase() === 'probationary')
        .sort((a, b) => {
          const aCredit = a.service_credit || 0;
          const bCredit = b.service_credit || 0;
          if (bCredit !== aCredit) return bCredit - aCredit;
          return getLastName(a.officerName).localeCompare(getLastName(b.officerName));
        });

      const regularOfficers = allOfficersList
        .filter(o => o.rank?.toLowerCase() !== 'probationary')
        .sort((a, b) => {
          const aCredit = a.service_credit || 0;
          const bCredit = b.service_credit || 0;
          if (bCredit !== aCredit) return bCredit - aCredit;
          return getLastName(a.officerName).localeCompare(getLastName(b.officerName));
        });

      // LARGER COLUMN WIDTHS - MAXIMIZE TABLE SIZE
      const margin = 5; // Minimal margin
      const availableWidth = pageWidth - (margin * 2);
      const badgeWidth = 15; // Reasonable badge column
      const nameWidth = 30;  // Large name column
      const dayColWidth = (availableWidth - badgeWidth - nameWidth) / 7; // Balance day columns
      const tableWidth = availableWidth;

      // Start at left margin (table takes full width)
      const startX = margin;

      // Main table header - LARGER
      pdf.setFillColor(41, 128, 185);
      pdf.rect(startX, yPosition, tableWidth, 10, "F"); // Larger header
      
      pdf.setFontSize(10); // Good readable size
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);

      let xPosition = startX;
      
      // Headers
      pdf.text("Empl#", xPosition + 5, yPosition + 7);
      xPosition += badgeWidth;
      pdf.text("NAME", xPosition + 5, yPosition + 7);
      xPosition += nameWidth;

      // Day headers - GOOD READABLE SIZES
      weekDays.forEach((day) => {
        // Day name and date only
        pdf.setFontSize(9);
        pdf.text(day.dayName, xPosition + dayColWidth / 2, yPosition + 4, { align: "center" });
        pdf.setFontSize(8);
        pdf.text(day.formattedDate, xPosition + dayColWidth / 2, yPosition + 7, { align: "center" });
        
        xPosition += dayColWidth;
      });

      yPosition += 10;

      // Function to render count row - LARGER
      const renderCountRow = (label: string, bgColor: number[], countType: 'supervisor' | 'officer' | 'ppo') => {
        xPosition = startX;
        
        pdf.setFillColor(...bgColor);
        pdf.rect(xPosition, yPosition, tableWidth, 8, "F"); // Larger height
        
        pdf.setFontSize(9); // Good readable size
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        
        // Skip badge column
        xPosition += badgeWidth;
        
        // Label
        pdf.text(label, xPosition + 5, yPosition + 5);
        xPosition += nameWidth;

        // Count for each day
        weekDays.forEach((day) => {
          const daySchedule = scheduleData?.find(s => s.date === day.dateStr);
          const minStaffingForDay = minimumStaffing?.get(day.dayOfWeek)?.get(selectedShiftId || '');
          
          let count = 0;
          let minimum = 0;

          if (countType === 'supervisor') {
            minimum = minStaffingForDay?.minimumSupervisors || 1;
            count = daySchedule?.officers?.filter((officer: any) => {
              const isSupervisor = isSupervisorByRank({ rank: officer.rank } as OfficerWeeklyData);
              const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
              const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
              const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
              return isSupervisor && isScheduled;
            }).length || 0;
          } else if (countType === 'officer') {
            minimum = minStaffingForDay?.minimumOfficers || 0;
            count = daySchedule?.officers?.filter((officer: any) => {
              const isOfficer = !isSupervisorByRank({ rank: officer.rank } as OfficerWeeklyData);
              const isNotPPO = officer.rank?.toLowerCase() !== 'probationary';
              const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
              const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
              const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
              return isOfficer && isNotPPO && isScheduled;
            }).length || 0;
          } else if (countType === 'ppo') {
            count = daySchedule?.officers?.filter((officer: any) => {
              const isOfficer = !isSupervisorByRank({ rank: officer.rank } as OfficerWeeklyData);
              const isPPO = officer.rank?.toLowerCase() === 'probationary';
              const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
              const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
              const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
              return isOfficer && isPPO && isScheduled;
            }).length || 0;
          }

          const displayText = countType === 'ppo' ? count.toString() : `${count}/${minimum}`;
          pdf.text(displayText, xPosition + dayColWidth / 2, yPosition + 5, { align: "center" });
          xPosition += dayColWidth;
        });

        yPosition += 8;
      };

      // Function to render officer rows - LARGER
      const renderOfficerRows = (officers: OfficerWeeklyData[], isPPO: boolean = false) => {
        pdf.setFontSize(8); // Good readable size
        pdf.setFont("helvetica", "normal");
        
        for (const officer of officers) {
          // Check if we need to add a page
          if (yPosition > pageHeight - 15) {
            pdf.addPage();
            yPosition = 10; // Reset for new page
          }

          xPosition = startX;
          
          // Row background - white for the entire row
          pdf.setFillColor(255, 255, 255);
          pdf.rect(xPosition, yPosition, tableWidth, 7, "F"); // Larger height
          
          // Badge number
          pdf.setTextColor(0, 0, 0);
          pdf.text(officer.badgeNumber?.toString() || "", xPosition + 5, yPosition + 4.5);
          xPosition += badgeWidth;
          
          // Name - last name only with PPO indicator if needed
          let lastName = getLastName(officer.officerName);
          if (isPPO) {
            lastName += " (PPO)";
          }
          pdf.text(lastName, xPosition + 5, yPosition + 4.5);
          xPosition += nameWidth;

          // Daily assignments - LARGER CELLS
          weekDays.forEach((day) => {
            const dayOfficer = officer.weeklySchedule[day.dateStr];
            const cellDisplay = getCellDisplay(dayOfficer);

            // ALWAYS set the cell background color from cellDisplay.fillColor
            pdf.setFillColor(...cellDisplay.fillColor);
            pdf.rect(xPosition, yPosition, dayColWidth, 7, "F"); // Larger height
            
            // Cell border - always draw border
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(xPosition, yPosition, dayColWidth, 7, "S"); // Larger height
            
            // Cell text
            if (cellDisplay.text) {
              pdf.setTextColor(...cellDisplay.color);
              
              // Center the text in the cell
              pdf.text(cellDisplay.text, xPosition + dayColWidth / 2, yPosition + 4, { align: "center" });
            }
            
            xPosition += dayColWidth;
          });

          yPosition += 7;
        }
      };

      // Render Supervisors section
      if (supervisors.length > 0) {
        renderCountRow("SUPERVISORS", [240, 240, 240], 'supervisor');
        renderOfficerRows(supervisors);
        yPosition += 3;
      }

      // Render Officers section with count row
      if (regularOfficers.length > 0) {
        renderCountRow("OFFICERS", [240, 240, 240], 'officer');
        renderOfficerRows(regularOfficers);
        yPosition += 3;
      }

      // RENDER PPO SECTION WITH COUNT ROW
      if (ppos.length > 0) {
        renderCountRow("PPO", [230, 240, 255], 'ppo');
        renderOfficerRows(ppos, true);
      }
    }
  };

  return { exportWeeklyPDF };
};
