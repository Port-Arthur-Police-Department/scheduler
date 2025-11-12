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
        renderWeeklyView(pdf, startDate, endDate, shiftName, scheduleData, minimumStaffing, selectedShiftId);
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
      return { text: "", color: [0, 0, 0], fillColor: [80, 80, 80], textStyle: "normal" };
    }

    // Full-day PTO - green background
    if (officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift) {
      const ptoType = officer.shiftInfo.ptoData.ptoType || "PTO";
      return { 
        text: ptoType.substring(0, 8), 
        color: [0, 100, 0], 
        fillColor: [144, 238, 144],
        textStyle: "bold"
      };
    }

    // Partial PTO - position with asterisk
    if (officer.shiftInfo?.hasPTO && !officer.shiftInfo?.ptoData?.isFullShift) {
      const position = officer.shiftInfo.position || "";
      const displayText = position.length > 7 ? position.substring(0, 7) + "*" : position + "*";
      return { 
        text: displayText, 
        color: [0, 100, 0], 
        fillColor: [255, 255, 224],
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
      const displayText = position.length > 8 ? position.substring(0, 8) : position;
      
      return { 
        text: displayText, 
        color: isSpecial ? [139, 69, 19] : [0, 0, 0],
        fillColor: isSpecial ? [255, 248, 220] : null,
        textStyle: "normal"
      };
    }

    // Designated day off (no assignment)
    return { text: "", color: [0, 0, 0], fillColor: [80, 80, 80], textStyle: "normal" };
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
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(41, 128, 185);
      pdf.text(`${shiftName.toUpperCase()} - WEEKLY SCHEDULE`, pageWidth / 2, yPosition, { align: "center" });

      yPosition += 6;
      pdf.setFontSize(10);
      pdf.setTextColor(60, 60, 60);
      pdf.text(
        `${format(week.start, "MMM d")} - ${format(week.end, "MMM d, yyyy")}`,
        pageWidth / 2,
        yPosition,
        { align: "center" }
      );
      yPosition += 10;

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

      // Helper functions
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

      // Column widths
      const badgeWidth = 18;
      const nameWidth = 35;
      const remainingWidth = pageWidth - 20 - badgeWidth - nameWidth;
      const dayColWidth = remainingWidth / 7;
      const tableWidth = pageWidth - 20;

      // Draw table header
      let xPosition = 10;
      
      pdf.setFillColor(41, 128, 185);
      pdf.rect(xPosition, yPosition, tableWidth, 8, "F");
      
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);

      // Headers
      pdf.text("Empl#", xPosition + 2, yPosition + 5.5);
      xPosition += badgeWidth;
      pdf.text("NAME", xPosition + 2, yPosition + 5.5);
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

        // Day name
        pdf.text(day.dayName, xPosition + dayColWidth / 2, yPosition + 3, { align: "center" });
        // Date
        pdf.setFontSize(6);
        pdf.text(day.formattedDate, xPosition + dayColWidth / 2, yPosition + 5.5, { align: "center" });
        // Staffing counts
        pdf.text(`${supervisorCount}/${minimumSupervisors} S`, xPosition + dayColWidth / 2, yPosition + 7, { align: "center" });
        pdf.text(`${officerCount}/${minimumOfficers} O`, xPosition + dayColWidth / 2, yPosition + 8.5, { align: "center" });
        
        pdf.setFontSize(8);
        xPosition += dayColWidth;
      });

      yPosition += 8;

      // Function to render count row
      const renderCountRow = (label: string, bgColor: number[], countType: 'supervisor' | 'officer' | 'ppo') => {
        xPosition = 10;
        
        pdf.setFillColor(...bgColor);
        pdf.rect(xPosition, yPosition, tableWidth, 5, "F");
        
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        
        xPosition += badgeWidth;
        pdf.text(label, xPosition + 2, yPosition + 3.5);
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

          const displayText = countType === 'ppo' ? count.toString() : `${count} / ${minimum}`;
          pdf.text(displayText, xPosition + dayColWidth / 2, yPosition + 3.5, { align: "center" });
          xPosition += dayColWidth;
        });

        yPosition += 5;
      };

      // Function to render officer rows
      const renderOfficerRows = (officers: OfficerWeeklyData[], isPPO: boolean = false) => {
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "normal");
        
        for (const officer of officers) {
          if (yPosition > pageHeight - 20) {
            pdf.addPage();
            yPosition = 10;
          }

          xPosition = 10;
          
          // Row background
          pdf.setFillColor(255, 255, 255);
          pdf.rect(xPosition, yPosition, tableWidth, 5, "FD");
          
          // Badge
          pdf.setTextColor(0, 0, 0);
          pdf.text(officer.badgeNumber?.toString() || "", xPosition + 2, yPosition + 3.5);
          xPosition += badgeWidth;
          
          // Name
          let nameText = getLastName(officer.officerName);
          if (officer.rank && isSupervisorByRank(officer)) {
            pdf.setFontSize(6);
            pdf.text(nameText, xPosition + 2, yPosition + 2.5);
            pdf.setTextColor(100, 100, 100);
            pdf.text(officer.rank, xPosition + 2, yPosition + 4.5);
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(7);
          } else {
            pdf.text(nameText, xPosition + 2, yPosition + 3.5);
          }
          xPosition += nameWidth;

          // Daily assignments
          weekDays.forEach((day) => {
            const dayOfficer = officer.weeklySchedule[day.dateStr];
            const cellContent = getCellContent(dayOfficer);

            // Cell background
            if (cellContent.fillColor) {
              pdf.setFillColor(...cellContent.fillColor);
              pdf.rect(xPosition, yPosition, dayColWidth, 5, "F");
            }
            
            // Cell border
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(xPosition, yPosition, dayColWidth, 5, "S");
            
            // Cell text
            if (cellContent.text) {
              pdf.setTextColor(...cellContent.color);
              if (cellContent.textStyle === "bold") {
                pdf.setFont("helvetica", "bold");
              }
              pdf.text(cellContent.text, xPosition + dayColWidth / 2, yPosition + 3.5, { align: "center" });
              if (cellContent.textStyle === "bold") {
                pdf.setFont("helvetica", "normal");
              }
            }
            
            xPosition += dayColWidth;
          });

          yPosition += 5;
        }
      };

      // Render Supervisors section
      if (supervisors.length > 0) {
        renderCountRow("SUPERVISORS", [220, 220, 220], 'supervisor');
        renderOfficerRows(supervisors);
        yPosition += 2;
      }

      // Render Officers section
      if (regularOfficers.length > 0) {
        renderCountRow("OFFICERS", [220, 220, 220], 'officer');
        renderOfficerRows(regularOfficers);
        yPosition += 2;
      }

      // Render PPOs section
      if (ppos.length > 0) {
        renderCountRow("PPO", [200, 220, 255], 'ppo');
        renderOfficerRows(ppos);
      }
    }
  };

  return { exportWeeklyPDF };
};
