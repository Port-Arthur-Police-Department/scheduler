// src/hooks/useMonthlyPDFExport.ts
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  addDays, 
  isSameMonth, 
  parseISO,
  isSameDay 
} from "date-fns";
import { getLastName } from "@/utils/scheduleUtils";
import { RANK_ORDER } from "@/constants/positions";

interface MonthlyExportOptions {
  month: Date;
  shiftName: string;
  scheduleData: any[];
  minimumStaffing?: Map<number, Map<string, { minimumOfficers: number; minimumSupervisors: number }>>;
  selectedShiftId?: string;
}

export const useMonthlyPDFExport = () => {
  const exportMonthlyPDF = async ({
    month,
    shiftName,
    scheduleData,
    minimumStaffing,
    selectedShiftId
  }: MonthlyExportOptions) => {
    try {
      const { default: jsPDF } = await import("jspdf");
      
      const pdf = new jsPDF("landscape", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      // Get calendar days (including previous/next month padding)
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

      // Helper functions
      const getRankPriority = (rank: string) => {
        if (!rank) return 99;
        const rankKey = Object.keys(RANK_ORDER).find(
          key => key.toLowerCase() === rank.toLowerCase()
        );
        return rankKey ? RANK_ORDER[rankKey as keyof typeof RANK_ORDER] : 99;
      };

      const isSupervisorByRank = (rank: string) => {
        const rankPriority = getRankPriority(rank);
        return rankPriority < RANK_ORDER.Officer;
      };

      // Header
      let yPosition = 10;
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(41, 128, 185);
      pdf.text(
        `${shiftName.toUpperCase()} - ${format(month, "MMMM yyyy").toUpperCase()}`,
        pageWidth / 2,
        yPosition,
        { align: "center" }
      );

      yPosition += 10;

      // Calendar grid setup
      const cellWidth = (pageWidth - 20) / 7;
      const cellHeight = (pageHeight - 30) / 6; // 6 weeks max in a month view
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
        const dayOfWeek = day.getDay();
        const isCurrentMonthDay = isSameMonth(day, month);
        const isToday = isSameDay(day, new Date());
        
        const xPos = startX + (currentCol * cellWidth);
        const yPos = startY + (currentRow * cellHeight);

        // Cell background
        if (isToday) {
          pdf.setFillColor(255, 251, 230); // Light yellow for today
        } else if (isCurrentMonthDay) {
          pdf.setFillColor(255, 255, 255);
        } else {
          pdf.setFillColor(245, 245, 245); // Light gray for other months
        }
        pdf.rect(xPos, yPos, cellWidth, cellHeight, "F");

        // Cell border
        pdf.setDrawColor(200, 200, 200);
        pdf.rect(xPos, yPos, cellWidth, cellHeight, "S");

        // Date number
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(isCurrentMonthDay ? 0 : 150);
        pdf.text(format(day, "d"), xPos + 2, yPos + 5);

        if (isCurrentMonthDay) {
          const daySchedule = scheduleData?.find(s => s.date === dateStr);
          
          // Get minimum staffing
          const minStaffingForDay = minimumStaffing?.get(dayOfWeek)?.get(selectedShiftId || '');
          const minimumOfficers = minStaffingForDay?.minimumOfficers || 0;
          const minimumSupervisors = minStaffingForDay?.minimumSupervisors || 1;

          // Calculate staffing
          const supervisorCount = daySchedule?.officers?.filter((officer: any) => {
            const isSupervisor = isSupervisorByRank(officer.rank);
            const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
            const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO;
            return isSupervisor && isScheduled;
          }).length || 0;

          const officerCount = daySchedule?.officers?.filter((officer: any) => {
            const isOfficer = !isSupervisorByRank(officer.rank);
            const isNotPPO = officer.rank?.toLowerCase() !== 'probationary';
            const hasFullDayPTO = officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift;
            const isScheduled = officer.shiftInfo && !officer.shiftInfo.isOff && !hasFullDayPTO;
            return isOfficer && isNotPPO && isScheduled;
          }).length || 0;

          const ptoOfficers = daySchedule?.officers?.filter((officer: any) => 
            officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift
          ) || [];

          // Staffing badges
          let badgeY = yPos + 10;
          pdf.setFontSize(7);
          
          // Supervisor count
          const supUnderstaffed = supervisorCount < minimumSupervisors;
          pdf.setFillColor(supUnderstaffed ? 239 : 240, supUnderstaffed ? 68 : 240, supUnderstaffed ? 68 : 240);
          pdf.roundedRect(xPos + cellWidth - 18, badgeY, 16, 4, 1, 1, "F");
          pdf.setTextColor(supUnderstaffed ? 220 : 100, supUnderstaffed ? 38 : 100, supUnderstaffed ? 38 : 100);
          pdf.text(`${supervisorCount}/${minimumSupervisors} S`, xPos + cellWidth - 10, badgeY + 3, { align: "center" });
          
          badgeY += 5;

          // Officer count
          const offUnderstaffed = officerCount < minimumOfficers;
          pdf.setFillColor(offUnderstaffed ? 239 : 240, offUnderstaffed ? 68 : 240, offUnderstaffed ? 68 : 240);
          pdf.roundedRect(xPos + cellWidth - 18, badgeY, 16, 4, 1, 1, "F");
          pdf.setTextColor(offUnderstaffed ? 220 : 100, offUnderstaffed ? 38 : 100, offUnderstaffed ? 38 : 100);
          pdf.text(`${officerCount}/${minimumOfficers} O`, xPos + cellWidth - 10, badgeY + 3, { align: "center" });

          badgeY += 5;

          // PTO badge
          if (ptoOfficers.length > 0) {
            pdf.setFillColor(144, 238, 144);
            pdf.roundedRect(xPos + cellWidth - 18, badgeY, 16, 4, 1, 1, "F");
            pdf.setTextColor(0, 100, 0);
            pdf.text(`${ptoOfficers.length} PTO`, xPos + cellWidth - 10, badgeY + 3, { align: "center" });
          }

          // PTO officers list
          let listY = yPos + 25;
          pdf.setFontSize(6);
          pdf.setFont("helvetica", "normal");
          
          const maxOfficersToShow = Math.floor((cellHeight - 25) / 3.5);
          const officersToShow = ptoOfficers.slice(0, maxOfficersToShow);
          
          officersToShow.forEach((officer: any, index: number) => {
            // Background
            pdf.setFillColor(240, 255, 240);
            pdf.rect(xPos + 2, listY, cellWidth - 4, 3, "F");
            
            // Border
            pdf.setDrawColor(144, 238, 144);
            pdf.rect(xPos + 2, listY, cellWidth - 4, 3, "S");
            
            // Name
            pdf.setTextColor(0, 0, 0);
            const lastName = getLastName(officer.officerName);
            pdf.text(lastName, xPos + 3, listY + 2.2);
            
            // PTO type
            pdf.setTextColor(0, 100, 0);
            const ptoType = officer.shiftInfo?.ptoData?.ptoType || 'PTO';
            pdf.text(ptoType.substring(0, 6), xPos + cellWidth - 12, listY + 2.2);
            
            listY += 3.5;
          });

          // Show "..." if more officers than can fit
          if (ptoOfficers.length > maxOfficersToShow) {
            pdf.setTextColor(100, 100, 100);
            pdf.text(`+${ptoOfficers.length - maxOfficersToShow} more`, xPos + 3, listY + 2);
          }
        }

        // Move to next cell
        currentCol++;
        if (currentCol >= 7) {
          currentCol = 0;
          currentRow++;
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

      // Legend
      pdf.setFontSize(7);
      pdf.setTextColor(0, 0, 0);
      let legendY = pageHeight - 10;
      pdf.text("Legend:", 10, legendY);
      
      // PTO color
      pdf.setFillColor(144, 238, 144);
      pdf.rect(25, legendY - 2, 5, 3, "F");
      pdf.text("Full-day PTO", 32, legendY);
      
      // Understaffed color
      pdf.setFillColor(239, 68, 68);
      pdf.rect(60, legendY - 2, 5, 3, "F");
      pdf.text("Understaffed", 67, legendY);

      const filename = `Monthly_Schedule_${shiftName.replace(/\s+/g, "_")}_${format(month, "yyyy-MM")}.pdf`;
      pdf.save(filename);

      return { success: true };
    } catch (error) {
      console.error("Monthly PDF export error:", error);
      return { success: false, error };
    }
  };

  return { exportMonthlyPDF };
};
