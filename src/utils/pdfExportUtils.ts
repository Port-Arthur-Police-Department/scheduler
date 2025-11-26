// src/utils/pdfExportUtils.ts
import { format, startOfWeek, addDays, addWeeks, parseISO, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, eachMonthOfInterval, isValid } from "date-fns";
import { getLastName } from "@/utils/scheduleUtils";
import { RANK_ORDER, PREDEFINED_POSITIONS } from "@/constants/positions";

// Default fallback colors
const FALLBACK_COLORS = {
  supervisorPTO: { bg: [255, 255, 200] as [number, number, number], border: [255, 220, 100], text: [139, 69, 19] },
  officerPTO: { bg: [240, 255, 240] as [number, number, number], border: [144, 238, 144], text: [0, 100, 0] },
  sickTime: { bg: [255, 200, 200] as [number, number, number], border: [255, 100, 100], text: [139, 0, 0] },
  offDay: { bg: [220, 220, 220] as [number, number, number], text: [100, 100, 100] },
  // Add new PTO type colors
  vacation: { bg: [173, 216, 230] as [number, number, number], border: [100, 149, 237], text: [0, 0, 139] },
  sick: { bg: [255, 200, 200] as [number, number, number], border: [255, 100, 100], text: [139, 0, 0] },
  holiday: { bg: [255, 218, 185] as [number, number, number], border: [255, 165, 0], text: [165, 42, 42] },
  comp: { bg: [221, 160, 221] as [number, number, number], border: [186, 85, 211], text: [128, 0, 128] }
};

interface WeeklyExportOptions {
  startDate: Date;
  endDate: Date;
  shiftName: string;
  scheduleData: any[];
  minimumStaffing?: Map<number, Map<string, { minimumOfficers: number; minimumSupervisors: number }>>;
  selectedShiftId?: string;
  colorSettings?: any;
}

interface MonthlyExportOptions {
  startDate: Date | string;
  endDate: Date | string;
  shiftName: string;
  scheduleData: any[];
  colorSettings?: any;
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

// Helper function to convert RGB string to array
const getColorArray = (rgbString: string): [number, number, number] => {
  try {
    const parts = rgbString.split(',').map(part => parseInt(part.trim()));
    if (parts.length === 3 && parts.every(part => !isNaN(part))) {
      return [parts[0], parts[1], parts[2]] as [number, number, number];
    }
    return [255, 255, 255];
  } catch (error) {
    return [255, 255, 255];
  }
};

// Process color settings from the database format
const processColorSettings = (colorSettings: any) => {
  if (!colorSettings) return FALLBACK_COLORS;

  return {
    supervisorPTO: {
      bg: getColorArray(colorSettings.pdf_supervisor_pto_bg || "255,255,200"),
      border: getColorArray(colorSettings.pdf_supervisor_pto_border || "255,220,100"),
      text: getColorArray(colorSettings.pdf_supervisor_pto_text || "139,69,19")
    },
    officerPTO: {
      bg: getColorArray(colorSettings.pdf_officer_pto_bg || "240,255,240"),
      border: getColorArray(colorSettings.pdf_officer_pto_border || "144,238,144"),
      text: getColorArray(colorSettings.pdf_officer_pto_text || "0,100,0")
    },
    sickTime: {
      bg: getColorArray(colorSettings.pdf_sick_time_bg || "255,200,200"),
      border: getColorArray(colorSettings.pdf_sick_time_border || "255,100,100"),
      text: getColorArray(colorSettings.pdf_sick_time_text || "139,0,0")
    },
    offDay: {
      bg: getColorArray(colorSettings.pdf_off_day_bg || "220,220,220"),
      text: getColorArray(colorSettings.pdf_off_day_text || "100,100,100")
    },
    // Add processing for new PTO type colors
    vacation: {
      bg: getColorArray(colorSettings.pdf_vacation_bg || "173,216,230"),
      border: getColorArray(colorSettings.pdf_vacation_border || "100,149,237"),
      text: getColorArray(colorSettings.pdf_vacation_text || "0,0,139")
    },
    sick: {
      bg: getColorArray(colorSettings.pdf_sick_bg || "255,200,200"),
      border: getColorArray(colorSettings.pdf_sick_border || "255,100,100"),
      text: getColorArray(colorSettings.pdf_sick_text || "139,0,0")
    },
    holiday: {
      bg: getColorArray(colorSettings.pdf_holiday_bg || "255,218,185"),
      border: getColorArray(colorSettings.pdf_holiday_border || "255,165,0"),
      text: getColorArray(colorSettings.pdf_holiday_text || "165,42,42")
    },
    comp: {
      bg: getColorArray(colorSettings.pdf_comp_bg || "221,160,221"),
      border: getColorArray(colorSettings.pdf_comp_border || "186,85,211"),
      text: getColorArray(colorSettings.pdf_comp_text || "128,0,128")
    }
  };
};

// Helper function to check if position is a special assignment
const isSpecialAssignment = (position: string) => {
  if (!position) return false;
  return position.toLowerCase().includes('other') ||
         (position && !PREDEFINED_POSITIONS.includes(position));
};

// Helper function to simplify position text
const simplifyPosition = (position: string): string => {
  if (!position) return "";
  if (position.toLowerCase().startsWith('district')) {
    return position.replace(/district\s*/i, '');
  }
  return position;
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

// Helper function to determine PTO color using customizable colors
const getPTOColor = (ptoType: string, isSupervisor: boolean, pdfColors: any) => {
  const ptoTypeLower = ptoType?.toLowerCase() || '';
  
  // Use specific PTO type colors
  if (ptoTypeLower.includes('vacation') || ptoTypeLower === 'vacation') {
    return {
      backgroundColor: pdfColors.vacation.bg,
      borderColor: pdfColors.vacation.border,
      textColor: pdfColors.vacation.text
    };
  } else if (ptoTypeLower.includes('sick') || ptoTypeLower === 'sick') {
    return {
      backgroundColor: pdfColors.sick.bg,
      borderColor: pdfColors.sick.border,
      textColor: pdfColors.sick.text
    };
  } else if (ptoTypeLower.includes('holiday') || ptoTypeLower === 'holiday') {
    return {
      backgroundColor: pdfColors.holiday.bg,
      borderColor: pdfColors.holiday.border,
      textColor: pdfColors.holiday.text
    };
  } else if (ptoTypeLower.includes('comp') || ptoTypeLower === 'comp') {
    return {
      backgroundColor: pdfColors.comp.bg,
      borderColor: pdfColors.comp.border,
      textColor: pdfColors.comp.text
    };
  }
  
  // Fallback to supervisor vs officer colors for general PTO
  if (isSupervisor) {
    return {
      backgroundColor: pdfColors.supervisorPTO.bg,
      borderColor: pdfColors.supervisorPTO.border,
      textColor: pdfColors.supervisorPTO.text
    };
  } else {
    return {
      backgroundColor: pdfColors.officerPTO.bg,
      borderColor: pdfColors.officerPTO.border,
      textColor: pdfColors.officerPTO.text
    };
  }
};

// Helper function to get rank abbreviation
const getRankAbbreviation = (rank: string): string => {
  if (!rank) return 'Ofc';
  
  const rankLower = rank.toLowerCase();
  if (rankLower.includes('sergeant') || rankLower.includes('sgt')) return 'Sgt';
  if (rankLower.includes('lieutenant') || rankLower.includes('lt')) return 'LT';
  if (rankLower.includes('deputy') || rankLower.includes('deputy chief')) return 'DC';
  if (rankLower.includes('chief') && !rankLower.includes('deputy')) return 'CHIEF';
  return 'Ofc';
};

export const exportWeeklyPDF = async (options: WeeklyExportOptions) => {
  const { startDate, endDate, shiftName, scheduleData, minimumStaffing, selectedShiftId, colorSettings } = options;
  
  try {
    const { default: jsPDF } = await import("jspdf");
    const pdfColors = processColorSettings(colorSettings);

    const pdf = new jsPDF("portrait", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // CORRECTED cell display logic
    const getCellDisplay = (officer: any) => {
      if (!officer) {
        return { 
          text: "", 
          color: pdfColors.offDay.text, 
          fillColor: pdfColors.offDay.bg 
        };
      }

      if (officer.shiftInfo?.isOff) {
        return { 
          text: "OFF", 
          color: [100, 100, 100], 
          fillColor: pdfColors.offDay.bg 
        };
      } else if (officer.shiftInfo?.hasPTO) {
        if (officer.shiftInfo?.ptoData?.isFullShift) {
          const ptoType = officer.shiftInfo.ptoData.ptoType || "PTO";
          const isSupervisor = isSupervisorByRank({ rank: officer.rank } as OfficerWeeklyData);
          const ptoColors = isSupervisor ? pdfColors.supervisorPTO : pdfColors.officerPTO;
          const isSickTime = ptoType.toLowerCase().includes('sick');
          const finalColors = isSickTime ? pdfColors.sickTime : ptoColors;
          
          return { 
            text: ptoType, 
            color: finalColors.text, 
            fillColor: finalColors.bg 
          };
        } else {
          const position = officer.shiftInfo.position || "";
          const simplifiedPosition = simplifyPosition(position);
          const displayText = simplifiedPosition ? simplifiedPosition + "*" : "PTO*";
          const partialBg = [255, 255, 224];
          
          return { 
            text: displayText, 
            color: [0, 100, 0], 
            fillColor: partialBg 
          };
        }
      } else if (officer.shiftInfo?.position) {
        const position = officer.shiftInfo.position;
        const simplifiedPosition = simplifyPosition(position);
        const isSpecial = isSpecialAssignment(position);
        let displayText = simplifiedPosition;
        if (simplifiedPosition.length > 8) {
          displayText = simplifiedPosition.substring(0, 8);
        }
        return { 
          text: displayText, 
          color: isSpecial ? [139, 69, 19] : [0, 100, 0], 
          fillColor: isSpecial ? [255, 248, 220] : [255, 255, 255]
        };
      } else {
        return { 
          text: " ", 
          color: [0, 0, 150], 
          fillColor: [255, 255, 255]
        };
      }
    };

    // Build weeks array for the entire date range
    const weeks = [];
    let currentWeekStart = startOfWeek(startDate, { weekStartsOn: 0 });
    
    while (currentWeekStart <= endDate) {
      const weekEnd = addDays(currentWeekStart, 6);
      weeks.push({ 
        start: currentWeekStart, 
        end: weekEnd > endDate ? endDate : weekEnd
      });
      currentWeekStart = addWeeks(currentWeekStart, 1);
    }

    // Render each week
    for (const [weekIndex, week] of weeks.entries()) {
      if (weekIndex > 0) {
        pdf.addPage();
      }

      let yPosition = 10;

      // Header
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
      }).filter(day => day !== null);

      // Prepare officer data FOR THIS WEEK ONLY
      const allOfficers = new Map<string, OfficerWeeklyData>();

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
            const existingOfficer = allOfficers.get(officer.officerId);
            if (existingOfficer) {
              existingOfficer.weeklySchedule[daySchedule.date] = officer;
            }
          });
        }
      });

      // Categorize officers
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

      // Table setup
      const margin = 5;
      const availableWidth = pageWidth - (margin * 2);
      const badgeWidth = 15;
      const nameWidth = 30;
      const dayColWidth = (availableWidth - badgeWidth - nameWidth) / 7;
      const tableWidth = availableWidth;
      const startX = margin;

      // Main table header
      pdf.setFillColor(41, 128, 185);
      pdf.rect(startX, yPosition, tableWidth, 10, "F");
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);

      let xPosition = startX;
      
      // Headers
      pdf.text("Empl#", xPosition + 5, yPosition + 7);
      xPosition += badgeWidth;
      pdf.text("NAME", xPosition + 5, yPosition + 7);
      xPosition += nameWidth;

      // Day headers
      weekDays.forEach((day) => {
        pdf.setFontSize(9);
        pdf.text(day.dayName, xPosition + dayColWidth / 2, yPosition + 4, { align: "center" });
        pdf.setFontSize(8);
        pdf.text(day.formattedDate, xPosition + dayColWidth / 2, yPosition + 7, { align: "center" });
        xPosition += dayColWidth;
      });

      yPosition += 10;

      // Function to render officer rows
      const renderOfficerRows = (officers: OfficerWeeklyData[], isPPO: boolean = false) => {
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        
        for (const officer of officers) {
          if (yPosition > pageHeight - 15) {
            pdf.addPage();
            yPosition = 10;
          }

          xPosition = startX;
          
          pdf.setFillColor(255, 255, 255);
          pdf.rect(xPosition, yPosition, tableWidth, 7, "F");
          
          pdf.setTextColor(0, 0, 0);
          pdf.text(officer.badgeNumber?.toString() || "", xPosition + 5, yPosition + 4.5);
          xPosition += badgeWidth;
          
          let lastName = getLastName(officer.officerName);
          if (isPPO) {
            lastName += " (PPO)";
          }
          pdf.text(lastName, xPosition + 5, yPosition + 4.5);
          xPosition += nameWidth;

          // Daily assignments
          weekDays.forEach((day) => {
            const dayOfficer = officer.weeklySchedule[day.dateStr];
            const cellDisplay = getCellDisplay(dayOfficer);

            pdf.setFillColor(...cellDisplay.fillColor);
            pdf.rect(xPosition, yPosition, dayColWidth, 7, "F");
            
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(xPosition, yPosition, dayColWidth, 7, "S");
            
            if (cellDisplay.text) {
              pdf.setTextColor(...cellDisplay.color);
              pdf.text(cellDisplay.text, xPosition + dayColWidth / 2, yPosition + 4, { align: "center" });
            }
            
            xPosition += dayColWidth;
          });

          yPosition += 7;
        }
      };

      // Render sections
      if (supervisors.length > 0) {
        renderOfficerRows(supervisors);
        yPosition += 3;
      }

      if (regularOfficers.length > 0) {
        renderOfficerRows(regularOfficers);
        yPosition += 3;
      }

      if (ppos.length > 0) {
        renderOfficerRows(ppos, true);
      }
    }

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

export const exportMonthlyPDF = async (options: MonthlyExportOptions) => {
  const { startDate, endDate, shiftName, scheduleData, colorSettings } = options;
  
  try {
    const { default: jsPDF } = await import("jspdf");
    const pdfColors = processColorSettings(colorSettings);

    const pdf = new jsPDF("landscape", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Convert to Date objects if they're strings
    const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;

    if (!isValid(start) || !isValid(end)) {
      throw new Error(`Invalid date range provided: ${startDate} to ${endDate}`);
    }

    const actualStartDate = start < end ? start : end;
    const actualEndDate = end > start ? end : start;

    // Get all months in the selected date range
    const months = eachMonthOfInterval({ 
      start: actualStartDate, 
      end: actualEndDate 
    });

    // Helper function to get rank priority
    const getRankPriority = (rank: string) => {
      if (!rank) return 99;
      const rankKey = Object.keys(RANK_ORDER).find(
        key => key.toLowerCase() === rank.toLowerCase()
      );
      return rankKey ? RANK_ORDER[rankKey as keyof typeof RANK_ORDER] : 99;
    };

    // Helper function to check if officer is supervisor by rank
    const isSupervisorByRank = (officer: any) => {
      const rankPriority = getRankPriority(officer.rank || '');
      return rankPriority < RANK_ORDER.Officer;
    };

    // Process each month
    for (const [monthIndex, month] of months.entries()) {
      if (monthIndex > 0) {
        pdf.addPage();
      }

      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      // Get calendar days with proper padding
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

      // Header - UPDATED TEXT
      let yPosition = 10;
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(41, 128, 185);
      pdf.text(
        `${shiftName.toUpperCase()} - ${format(month, "MMMM yyyy").toUpperCase()} - HOLIDAY/VACATION SCHEDULE`,
        pageWidth / 2,
        yPosition,
        { align: "center" }
      );

      // Show date range for context if multiple months
      if (months.length > 1) {
        yPosition += 6;
        pdf.setFontSize(10);
        pdf.setTextColor(100, 100, 100);
        pdf.text(
          `Selected Range: ${format(actualStartDate, "MMM d, yyyy")} - ${format(actualEndDate, "MMM d, yyyy")}`,
          pageWidth / 2,
          yPosition,
          { align: "center" }
        );
      }

      yPosition += 15;

      // Calendar grid setup
      const cellWidth = (pageWidth - 20) / 7;
      const cellHeight = (pageHeight - 40) / 6;
      const startX = 10;
      let startY = yPosition;

      // Day headers
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      let xPos = startX;
      
      pdf.setFillColor(41, 128, 185);
      pdf.rect(startX, startY, pageWidth - 20, 8, "F");
      
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      
      dayNames.forEach((dayName) => {
        pdf.text(dayName, xPos + cellWidth / 2, startY + 5.5, { align: "center" });
        xPos += cellWidth;
      });

      startY += 8;

      // Render calendar cells
      let currentRow = 0;
      let currentCol = 0;

      for (const day of allCalendarDays) {
        const dateStr = format(day, "yyyy-MM-dd");
        const isCurrentMonthDay = isSameMonth(day, month);
        const isToday = isSameDay(day, new Date());
        const isInSelectedRange = day >= actualStartDate && day <= actualEndDate;
        
        const xPos = startX + (currentCol * cellWidth);
        const yPos = startY + (currentRow * cellHeight);

        // Cell background
        if (isToday) {
          pdf.setFillColor(255, 251, 230);
        } else if (isCurrentMonthDay && isInSelectedRange) {
          pdf.setFillColor(255, 255, 255);
        } else if (isCurrentMonthDay) {
          pdf.setFillColor(245, 245, 245);
        } else {
          pdf.setFillColor(240, 240, 240);
        }
        pdf.rect(xPos, yPos, cellWidth, cellHeight, "F");

        // Cell border
        pdf.setDrawColor(200, 200, 200);
        pdf.rect(xPos, yPos, cellWidth, cellHeight, "S");

        // Date number
        pdf.setFontSize(10);
        if (isCurrentMonthDay && isInSelectedRange) {
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(0, 0, 0);
        } else if (isCurrentMonthDay) {
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(150, 150, 150);
        } else {
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(200, 200, 200);
        }
        pdf.text(format(day, "d"), xPos + 2, yPos + 5);

        // Show PTO information for days in the selected range and current month
        if (isCurrentMonthDay && isInSelectedRange) {
          const daySchedule = scheduleData?.find(s => s.date === dateStr);
          
          // Get ONLY Holiday and Vacation PTO officers for this day - UPDATED FILTER
          const ptoOfficers = daySchedule?.officers?.filter((officer: any) => 
            officer.shiftInfo?.hasPTO && 
            officer.shiftInfo?.ptoData?.isFullShift &&
            (officer.shiftInfo?.ptoData?.ptoType?.toLowerCase().includes('holiday') ||
             officer.shiftInfo?.ptoData?.ptoType?.toLowerCase().includes('vacation'))
          ) || [];

          // Show PTO badge if there are any Holiday/Vacation PTO officers - UPDATED TEXT
          if (ptoOfficers.length > 0) {
            let badgeY = yPos + 10;
            pdf.setFontSize(7);
            pdf.setFont("helvetica", "bold");
            
            // PTO badge - UPDATED TEXT
            pdf.setFillColor(144, 238, 144);
            pdf.roundedRect(xPos + cellWidth - 20, badgeY, 18, 4, 1, 1, "F");
            pdf.setTextColor(0, 100, 0);
            pdf.text(`H/V: ${ptoOfficers.length}`, xPos + cellWidth - 11, badgeY + 3, { align: "center" });
          }

          // PTO officers list by NAME with customizable color coding and rank badges
          let listY = yPos + 15;
          pdf.setFontSize(6);
          pdf.setFont("helvetica", "normal");
          
          // Calculate how many officers we can fit in the cell
          const maxOfficersToShow = Math.floor((cellHeight - 15) / 3);
          const officersToShow = ptoOfficers.slice(0, maxOfficersToShow);
          
          officersToShow.forEach((officer: any, index: number) => {
  const isSupervisor = isSupervisorByRank(officer);
  const ptoType = officer.shiftInfo?.ptoData?.ptoType || 'PTO';
  const rankAbbreviation = getRankAbbreviation(officer.rank);
  const badgeNumber = officer.badgeNumber || '';
  
  // GET COLOR BASED ON PTO TYPE AND RANK using customizable colors
  const colors = getPTOColor(ptoType, isSupervisor, pdfColors);
  
  // Background for each PTO entry
  pdf.setFillColor(...colors.backgroundColor);
  pdf.rect(xPos + 2, listY, cellWidth - 4, 2.5, "F");
  
  // Border
  pdf.setDrawColor(...colors.borderColor);
  pdf.rect(xPos + 2, listY, cellWidth - 4, 2.5, "S");
  
  // Officer NAME with BADGE NUMBER and rank badge for supervisors
  pdf.setTextColor(...colors.textColor);
  const lastName = getLastName(officer.officerName);
  
  // Build display text with badge number
  let displayText = `${lastName} #${badgeNumber}`;
  
  // Show rank badge for supervisors in monthly view
  if (isSupervisor) {
    displayText += ` (${rankAbbreviation})`;
  }
  
  pdf.text(displayText, xPos + 3, listY + 1.8);
  
  // PTO type (abbreviated) - UPDATED WITH VAC/HOL ABBREVIATIONS
  const getAbbreviatedPTOType = (ptoType: string): string => {
    const ptoTypeLower = ptoType.toLowerCase();
    
    if (ptoTypeLower.includes('vacation') || ptoTypeLower === 'vacation') {
      return 'vac';
    } else if (ptoTypeLower.includes('holiday') || ptoTypeLower === 'holiday') {
      return 'hol';
    } else if (ptoTypeLower.includes('sick') || ptoTypeLower === 'sick') {
      return 'sick';
    } else if (ptoTypeLower.includes('comp') || ptoTypeLower === 'comp') {
      return 'comp';
    } else {
      // Default abbreviation for other types
      return ptoType.length > 6 ? ptoType.substring(0, 6) : ptoType;
    }
  };
  
  const shortPtoType = getAbbreviatedPTOType(ptoType);
  pdf.text(shortPtoType, xPos + cellWidth - 10, listY + 1.8);
  
  listY += 3;
});

          // Show "..." if more officers than can fit
          if (ptoOfficers.length > maxOfficersToShow) {
            pdf.setTextColor(100, 100, 100);
            pdf.text(`+${ptoOfficers.length - maxOfficersToShow} more`, xPos + 3, listY + 1.5);
          }
        } else if (isCurrentMonthDay) {
          // For current month days outside selected range
          pdf.setFontSize(6);
          pdf.setTextColor(180, 180, 180);
          pdf.setFont("helvetica", "italic");
          pdf.text("Not Selected", xPos + cellWidth / 2, yPos + cellHeight / 2, { align: "center" });
        } else {
          // For padding days (previous/next month), show empty
          pdf.setFontSize(6);
          pdf.setTextColor(200, 200, 200);
          pdf.setFont("helvetica", "italic");
          pdf.text("No Data", xPos + cellWidth / 2, yPos + cellHeight / 2, { align: "center" });
        }

        // Move to next cell
        currentCol++;
        if (currentCol >= 7) {
          currentCol = 0;
          currentRow++;
        }
      }
    }

    // Footer on last page
    pdf.setFontSize(6);
    pdf.setTextColor(100, 100, 100);
    pdf.text(
      `Generated on ${format(new Date(), "MMM d, yyyy 'at' h:mm a")}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: "center" }
    );

    // UPDATED Legend on last page with only Holiday/Vacation PTO types
    pdf.setFontSize(7);
    pdf.setTextColor(0, 0, 0);
    let legendY = pageHeight - 15;
    let legendX = 10;
    
    // Vacation color in legend
    pdf.setFillColor(...pdfColors.vacation.bg);
    pdf.rect(legendX, legendY - 2, 5, 3, "F");
    pdf.text("Vacation", legendX + 7, legendY);
    legendX += 25;

    // Holiday color in legend
    pdf.setFillColor(...pdfColors.holiday.bg);
    pdf.rect(legendX, legendY - 2, 5, 3, "F");
    pdf.text("Holiday", legendX + 7, legendY);
    legendX += 25;

    // Removed other PTO types from legend

    const filename = `Monthly_PTO_Schedule_${shiftName.replace(/\s+/g, "_")}_${format(actualStartDate, "yyyy-MM")}_to_${format(actualEndDate, "yyyy-MM")}.pdf`;
    pdf.save(filename);

    return { success: true };
  } catch (error) {
    console.error("Monthly PDF export error:", error);
    return { success: false, error };
  }
};
