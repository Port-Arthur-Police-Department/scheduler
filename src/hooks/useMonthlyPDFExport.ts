// src/hooks/useMonthlyPDFExport.ts - UPDATED WITH CUSTOMIZABLE COLORS
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  addDays, 
  isSameMonth, 
  parseISO,
  isSameDay,
  eachMonthOfInterval,
  isValid
} from "date-fns";
import { getLastName } from "@/utils/scheduleUtils";
import { RANK_ORDER } from "@/constants/positions";
import { useColorSettings } from "@/hooks/useColorSettings";

interface MonthlyExportOptions {
  startDate: Date | string;
  endDate: Date | string;
  shiftName: string;
  scheduleData: any[];
}

export const useMonthlyPDFExport = () => {
  const { pdf: pdfColors } = useColorSettings();

  const exportMonthlyPDF = async ({
    startDate,
    endDate,
    shiftName,
    scheduleData
  }: MonthlyExportOptions) => {
    try {
      const { default: jsPDF } = await import("jspdf");
      
      const pdf = new jsPDF("landscape", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Convert to Date objects if they're strings
      const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
      const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;

      // Validate dates
      if (!isValid(start) || !isValid(end)) {
        console.error('Invalid dates provided:', { startDate, endDate, start, end });
        throw new Error(`Invalid date range provided: ${startDate} to ${endDate}`);
      }

      // Ensure endDate is not before startDate
      const actualStartDate = start < end ? start : end;
      const actualEndDate = end > start ? end : start;

      console.log('Processing monthly export with dates:', {
        originalStart: startDate,
        originalEnd: endDate,
        processedStart: actualStartDate,
        processedEnd: actualEndDate
      });

      // Get all months in the selected date range
      const months = eachMonthOfInterval({ 
        start: actualStartDate, 
        end: actualEndDate 
      });

      console.log('Months to process:', months);

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

      // Helper function to determine PTO color using customizable colors
      const getPTOColor = (ptoType: string, isSupervisor: boolean) => {
        const ptoTypeLower = ptoType?.toLowerCase() || '';
        
        // SICK TIME - RED for both supervisors and officers
        if (ptoTypeLower.includes('sick') || ptoTypeLower === 'sick') {
          return {
            backgroundColor: pdfColors.sickTime.bg,
            borderColor: pdfColors.sickTime.border,
            textColor: pdfColors.sickTime.text
          };
        }
        
        // Regular PTO - different colors for supervisors vs officers
        if (isSupervisor) {
          // YELLOW for supervisor PTO
          return {
            backgroundColor: pdfColors.supervisorPTO.bg,
            borderColor: pdfColors.supervisorPTO.border,
            textColor: pdfColors.supervisorPTO.text
          };
        } else {
          // GREEN for officer PTO
          return {
            backgroundColor: pdfColors.officerPTO.bg,
            borderColor: pdfColors.officerPTO.border,
            textColor: pdfColors.officerPTO.text
          };
        }
      };

      // Process each month
      for (const [monthIndex, month] of months.entries()) {
        if (monthIndex > 0) {
          pdf.addPage();
        }

        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        
        // Get calendar days with proper padding
        const startDay = monthStart.getDay(); // 0 = Sunday
        const endDay = monthEnd.getDay();
        
        // Calculate padding days - show complete weeks
        const previousMonthDays = Array.from({ length: startDay }, (_, i) => 
          addDays(monthStart, -startDay + i)
        );
        
        const nextMonthDays = Array.from({ length: 6 - endDay }, (_, i) => 
          addDays(monthEnd, i + 1)
        );

        const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const allCalendarDays = [...previousMonthDays, ...monthDays, ...nextMonthDays];

        // Header
        let yPosition = 10;
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(41, 128, 185);
        pdf.text(
          `${shiftName.toUpperCase()} - ${format(month, "MMMM yyyy").toUpperCase()} - PTO SCHEDULE`,
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
        const cellHeight = (pageHeight - 40) / 6; // 6 weeks max in a month view
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

          // Cell background - different colors for current month vs padding
          if (isCurrentMonthDay && isInSelectedRange) {
            pdf.setFillColor(255, 255, 255);
          } else if (isCurrentMonthDay) {
            pdf.setFillColor(245, 245, 245); // Light gray for current month but outside selected range
          } else {
            pdf.setFillColor(240, 240, 240); // Even lighter gray for padding days
          }
          pdf.rect(xPos, yPos, cellWidth, cellHeight, "F");

          // Cell border
          pdf.setDrawColor(200, 200, 200);
          pdf.rect(xPos, yPos, cellWidth, cellHeight, "S");

          // Date number - different styling
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

          // Only show PTO information for days in the selected range and current month
          if (isCurrentMonthDay && isInSelectedRange) {
            const daySchedule = scheduleData?.find(s => s.date === dateStr);
            
            // Get PTO officers for this day
            const ptoOfficers = daySchedule?.officers?.filter((officer: any) => 
              officer.shiftInfo?.hasPTO && officer.shiftInfo?.ptoData?.isFullShift
            ) || [];

            // Show PTO badge if there are any PTO officers
            if (ptoOfficers.length > 0) {
              let badgeY = yPos + 10;
              pdf.setFontSize(7);
              pdf.setFont("helvetica", "bold");
              
              // PTO badge
              pdf.setFillColor(144, 238, 144);
              pdf.roundedRect(xPos + cellWidth - 20, badgeY, 18, 4, 1, 1, "F");
              pdf.setTextColor(0, 100, 0);
              pdf.text(`PTO: ${ptoOfficers.length}`, xPos + cellWidth - 11, badgeY + 3, { align: "center" });
            }

            // PTO officers list by NAME with customizable color coding
            let listY = yPos + 15;
            pdf.setFontSize(6);
            pdf.setFont("helvetica", "normal");
            
            // Calculate how many officers we can fit in the cell
            const maxOfficersToShow = Math.floor((cellHeight - 15) / 3);
            const officersToShow = ptoOfficers.slice(0, maxOfficersToShow);
            
            officersToShow.forEach((officer: any, index: number) => {
              const isSupervisor = isSupervisorByRank(officer);
              const ptoType = officer.shiftInfo?.ptoData?.ptoType || 'PTO';
              
              // GET COLOR BASED ON PTO TYPE AND RANK using customizable colors
              const colors = getPTOColor(ptoType, isSupervisor);
              
              // Background for each PTO entry
              pdf.setFillColor(...colors.backgroundColor);
              pdf.rect(xPos + 2, listY, cellWidth - 4, 2.5, "F");
              
              // Border
              pdf.setDrawColor(...colors.borderColor);
              pdf.rect(xPos + 2, listY, cellWidth - 4, 2.5, "S");
              
              // Officer NAME (last name only)
              pdf.setTextColor(...colors.textColor);
              const lastName = getLastName(officer.officerName);
              pdf.text(lastName, xPos + 3, listY + 1.8);
              
              // PTO type (abbreviated)
              const shortPtoType = ptoType.length > 6 ? ptoType.substring(0, 6) : ptoType;
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

      // Updated legend on last page using customizable colors
      pdf.setFontSize(7);
      pdf.setTextColor(0, 0, 0);
      let legendY = pageHeight - 10;
      
      // Sick time color in legend
      pdf.setFillColor(...pdfColors.sickTime.bg);
      pdf.rect(10, legendY - 2, 5, 3, "F");
      pdf.text("Sick Time", 17, legendY);
      
      // Supervisor PTO color in legend
      pdf.setFillColor(...pdfColors.supervisorPTO.bg);
      pdf.rect(35, legendY - 2, 5, 3, "F");
      pdf.text("Supervisor PTO", 42, legendY);
      
      // Officer PTO color in legend
      pdf.setFillColor(...pdfColors.officerPTO.bg);
      pdf.rect(65, legendY - 2, 5, 3, "F");
      pdf.text("Officer PTO", 72, legendY);

      const filename = `Monthly_PTO_Schedule_${shiftName.replace(/\s+/g, "_")}_${format(actualStartDate, "yyyy-MM")}_to_${format(actualEndDate, "yyyy-MM")}.pdf`;
      pdf.save(filename);

      return { success: true };
    } catch (error) {
      console.error("Monthly PDF export error:", error);
      return { success: false, error };
    }
  };

  return { exportMonthlyPDF };
};
