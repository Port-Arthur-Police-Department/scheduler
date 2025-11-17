// src/hooks/useWeeklyPDFExport.ts - UPDATED VERSION
import { format, startOfWeek, addDays, addWeeks, parseISO, isSameDay } from "date-fns";
import { getLastName } from "@/utils/scheduleUtils";
import { RANK_ORDER, PREDEFINED_POSITIONS } from "@/constants/positions";

interface ExportOptions {
  startDate: Date;
  endDate: Date;
  shiftName: string;
  scheduleData: any[];
  viewType: "weekly" | "monthly";
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
    viewType = "weekly",
    minimumStaffing,
    selectedShiftId
  }: ExportOptions) => {
    try {
      const { default: jsPDF } = await import("jspdf");
      
      const pdf = new jsPDF("landscape", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      if (viewType === "weekly") {
        renderWeeklyView(pdf, startDate, endDate, shiftName, scheduleData, minimumStaffing, selectedShiftId);
      } else {
        renderMonthlyView(pdf, startDate, endDate, shiftName, scheduleData);
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

  // Helper function to check if position is a special assignment
  const isSpecialAssignment = (position: string) => {
    if (!position) return false;
    return position.toLowerCase().includes('other') ||
           (position && !PREDEFINED_POSITIONS.includes(position));
  };

  // Helper function to determine cell content and styling
  const getCellContent = (officer: any) => {
    if (!officer) {
      return { text: "", color: [0, 0, 0], fillColor: null, textStyle: "normal" };
    }

    // Full-day PTO - green background
    if (officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift) {
      const ptoType = officer.shiftInfo.ptoData.ptoType || "PTO";
      return { 
        text: ptoType, 
        color: [0, 100, 0], 
        fillColor: [144, 238, 144], // Light green
        textStyle: "bold"
      };
    }

    // Partial PTO - position with asterisk
    if (officer.shiftInfo?.hasPTO && !officer.shiftInfo?.ptoData?.isFullShift) {
      const position = officer.shiftInfo.position || "";
      const displayText = position + "*";
      return { 
        text: displayText, 
        color: [0, 100, 0], 
        fillColor: [255, 255, 224], // Light yellow
        textStyle: "bold"
      };
    }

    // Day off
    if (officer.shiftInfo?.isOff) {
      return { text: "OFF", color: [100, 100, 100], fillColor: [220, 220, 220], textStyle: "normal" };
    }

    // Has position
    if (officer.shiftInfo?.position) {
      const position = officer.shiftInfo.position;
      const isSpecial = isSpecialAssignment(position);
      
      return { 
        text: position, 
        color: isSpecial ? [139, 69, 19] : [0, 0, 0], // Brown for special, black for regular
        fillColor: isSpecial ? [255, 248, 220] : null, // Light wheat for special
        textStyle: "normal"
      };
    }

    // Designated day off (no assignment)
    return { text: "", color: [0, 0, 0], fillColor: null, textStyle: "normal" };
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

  // Helper function to render weekly view matching the exact table structure
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

    // Build weeks
    const weeks = [];
    let currentWeekStart = startOfWeek(startDate, { weekStartsOn: 0 });
    while (currentWeekStart <= endDate) {
      weeks.push({ start: currentWeekStart, end: addDays(currentWeekStart, 6) });
      currentWeekStart = addWeeks(currentWeekStart, 1);
    }

    for (const [weekIndex, week] of weeks.entries()) {
      if (weekIndex > 0) {
        pdf.addPage();
      }

      let yPosition = 10;

      // Header
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(41, 128, 185);
      pdf.text(`${shiftName.toUpperCase()} - WEEKLY SCHEDULE`, pageWidth / 2, yPosition, { align: "center" });

      yPosition += 8;
      pdf.setFontSize(12);
      pdf.setTextColor(60, 60, 60);
      pdf.text(
        `${format(week.start, "MMM d, yyyy")} - ${format(week.end, "MMM d, yyyy")}`,
        pageWidth / 2,
        yPosition,
        { align: "center" }
      );
      yPosition += 12;

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

      // Prepare officer data
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
            allOfficers.get(officer.officerId)!.weeklySchedule[daySchedule.date] = officer;
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

      // Column widths - matching the table structure
      const badgeWidth = 15;
      const nameWidth = 25;
      const dayColWidth = 25;
      const tableWidth = badgeWidth + nameWidth + (dayColWidth * 7);

      // Calculate starting x position to center the table
      const startX = (pageWidth - tableWidth) / 2;

      // Main table header
      pdf.setFillColor(41, 128, 185);
      pdf.rect(startX, yPosition, tableWidth, 10, "F");
      
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);

      let xPosition = startX;
      
      // Headers
      pdf.text("Empl#", xPosition + 3, yPosition + 6);
      xPosition += badgeWidth;
      pdf.text("NAME", xPosition + 3, yPosition + 6);
      xPosition += nameWidth;

      // Day headers with staffing counts
      weekDays.forEach((day) => {
        const daySchedule = scheduleData?.find(s => s.date === day.dateStr);
        
        // Get minimum staffing
        const minStaffingForDay = minimumStaffing?.get(day.dayOfWeek)?.get(selectedShiftId || '');
        const minimumOfficers = minStaffingForDay?.minimumOfficers || 0;
        const minimumSupervisors = minStaffingForDay?.minimumSupervisors || 1;
        
        // Calculate actual counts
        const supervisorCount = daySchedule?.officers?.filter((officer: any) => {
          const isSupervisor = isSupervisorByRank({ rank: officer.rank } as OfficerWeeklyData);
          const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
          const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
          const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
          return isSupervisor && isScheduled;
        }).length || 0;

        const officerCount = daySchedule?.officers?.filter((officer: any) => {
          const isOfficer = !isSupervisorByRank({ rank: officer.rank } as OfficerWeeklyData);
          const isNotPPO = officer.rank?.toLowerCase() !== 'probationary';
          const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
          const isSpecial = isSpecialAssignment(officer.shiftInfo?.position);
          const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO && !isSpecial;
          return isOfficer && isNotPPO && isScheduled;
        }).length || 0;

        // Day name and date
        pdf.text(day.dayName, xPosition + dayColWidth / 2, yPosition + 3, { align: "center" });
        pdf.setFontSize(7);
        pdf.text(day.formattedDate, xPosition + dayColWidth / 2, yPosition + 5, { align: "center" });
        
        // Staffing counts - matching your image format
        pdf.text(`${supervisorCount}/${minimumSupervisors}up`, xPosition + dayColWidth / 2, yPosition + 7, { align: "center" });
        pdf.text(`${officerCount}/${minimumOfficers}Ofc`, xPosition + dayColWidth / 2, yPosition + 8.5, { align: "center" });
        
        pdf.setFontSize(9);
        xPosition += dayColWidth;
      });

      yPosition += 10;

      // Function to render count row
      const renderCountRow = (label: string, bgColor: number[], countType: 'supervisor' | 'officer' | 'ppo') => {
        xPosition = startX;
        
        pdf.setFillColor(...bgColor);
        pdf.rect(xPosition, yPosition, tableWidth, 6, "F");
        
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        
        // Skip badge column
        xPosition += badgeWidth;
        
        // Label
        pdf.text(label, xPosition + 3, yPosition + 4);
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
              const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO;
              return isOfficer && isNotPPO && isScheduled;
            }).length || 0;
          } else if (countType === 'ppo') {
            count = daySchedule?.officers?.filter((officer: any) => {
              const isOfficer = !isSupervisorByRank({ rank: officer.rank } as OfficerWeeklyData);
              const isPPO = officer.rank?.toLowerCase() === 'probationary';
              const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
              const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO;
              return isOfficer && isPPO && isScheduled;
            }).length || 0;
          }

          const displayText = countType === 'ppo' ? count.toString() : `${count}/${minimum}`;
          pdf.text(displayText, xPosition + dayColWidth / 2, yPosition + 4, { align: "center" });
          xPosition += dayColWidth;
        });

        yPosition += 6;
      };

      // Function to render officer rows
      const renderOfficerRows = (officers: OfficerWeeklyData[], isPPO: boolean = false) => {
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        
        for (const officer of officers) {
          if (yPosition > pageHeight - 20) {
            pdf.addPage();
            yPosition = 10;
          }

          xPosition = startX;
          
          // Row background
          pdf.setFillColor(255, 255, 255);
          pdf.rect(xPosition, yPosition, tableWidth, 6, "FD");
          
          // Badge number
          pdf.setTextColor(0, 0, 0);
          pdf.text(officer.badgeNumber?.toString() || "", xPosition + 3, yPosition + 4);
          xPosition += badgeWidth;
          
          // Name - last name only
          const lastName = getLastName(officer.officerName);
          pdf.text(lastName, xPosition + 3, yPosition + 4);
          xPosition += nameWidth;

          // Daily assignments
          weekDays.forEach((day) => {
            const dayOfficer = officer.weeklySchedule[day.dateStr];
            const cellContent = getCellContent(dayOfficer);

            // Cell background
            if (cellContent.fillColor) {
              pdf.setFillColor(...cellContent.fillColor);
              pdf.rect(xPosition, yPosition, dayColWidth, 6, "F");
            }
            
            // Cell border
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(xPosition, yPosition, dayColWidth, 6, "S");
            
            // Cell text
            if (cellContent.text) {
              pdf.setTextColor(...cellContent.color);
              if (cellContent.textStyle === "bold") {
                pdf.setFont("helvetica", "bold");
              }
              
              // Truncate long text
              const displayText = cellContent.text.length > 10 
                ? cellContent.text.substring(0, 10) 
                : cellContent.text;
              
              pdf.text(displayText, xPosition + dayColWidth / 2, yPosition + 3.5, { align: "center" });
              
              if (cellContent.textStyle === "bold") {
                pdf.setFont("helvetica", "normal");
              }
            }
            
            xPosition += dayColWidth;
          });

          yPosition += 6;
        }
      };

      // Render Supervisors section
      if (supervisors.length > 0) {
        renderCountRow("SUPERVISORS", [240, 240, 240], 'supervisor');
        renderOfficerRows(supervisors);
        yPosition += 2;
      }

      // Render Officers section with count row
      if (regularOfficers.length > 0) {
        renderCountRow("OFFICERS", [240, 240, 240], 'officer');
        renderOfficerRows(regularOfficers);
        yPosition += 2;
      }

      // Render PPOs section with count row
      if (ppos.length > 0) {
        renderCountRow("PPO", [230, 240, 255], 'ppo');
        renderOfficerRows(ppos, true);
      }
    }
  };

  // Basic monthly view (you can enhance this later)
  const renderMonthlyView = (
    pdf: any,
    startDate: Date,
    endDate: Date,
    shiftName: string,
    scheduleData: any[]
  ) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(41, 128, 185);
    pdf.text(`${shiftName.toUpperCase()} - MONTHLY SCHEDULE`, pageWidth / 2, 20, { align: "center" });

    pdf.setFontSize(12);
    pdf.setTextColor(60, 60, 60);
    pdf.text(
      `${format(startDate, "MMM d, yyyy")} - ${format(endDate, "MMM d, yyyy")}`,
      pageWidth / 2,
      30,
      { align: "center" }
    );

    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text(
      "Monthly view export - For detailed view, use Weekly export",
      pageWidth / 2,
      45,
      { align: "center" }
    );
  };

  return { exportWeeklyPDF };
};
