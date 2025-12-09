import { useWeeklyPDFExport } from "@/hooks/useWeeklyPDFExport";
import { useMonthlyPDFExport } from "@/hooks/useMonthlyPDFExport";

// Add this helper function at the top of pdfExportUtils.ts:
const processScheduleDataForExport = (scheduleData: any[], dateRange: { from: Date; to: Date }) => {
  // Filter to only include days within the date range
  const filteredSchedules = scheduleData.filter((daySchedule: any) => {
    const scheduleDate = parseISO(daySchedule.date);
    return scheduleDate >= dateRange.from && scheduleDate <= dateRange.to;
  });

  // Create a map to organize officers by their ID
  const officerMap = new Map<string, OfficerWeeklyData>();

  filteredSchedules.forEach((daySchedule: any) => {
    const { date, officers } = daySchedule;
    
    officers.forEach((officer: any) => {
      const officerId = officer.officerId || officer.officer_id || officer.id;
      
      if (!officerId) {
        console.warn("Officer without ID found:", officer);
        return;
      }
      
      if (!officerMap.has(officerId)) {
        officerMap.set(officerId, {
          officerId,
          officerName: officer.officerName || officer.full_name || officer.profiles?.full_name || "Unknown",
          badgeNumber: officer.badgeNumber || officer.badge_number || officer.profiles?.badge_number,
          rank: officer.rank || officer.profiles?.rank,
          service_credit: officer.service_credit || 0,
          weeklySchedule: {},
          recurringDays: new Set()
        });
      }
      
      // Add this day's schedule to the officer
      const officerData = officerMap.get(officerId)!;
      officerData.weeklySchedule[date] = officer;
    });
  });

  return Array.from(officerMap.values());
};

// Update the exportWeeklyPDF function - replace the officer data preparation section:
export const exportWeeklyPDF = async (options: WeeklyExportOptions) => {
  const { startDate, endDate, shiftName, scheduleData, minimumStaffing, selectedShiftId, colorSettings } = options;
  
  try {
    const { default: jsPDF } = await import("jspdf");
    const pdfColors = processColorSettings(colorSettings);

    console.log("Exporting with data:", {
      startDate,
      endDate,
      shiftName,
      scheduleDataLength: scheduleData.length,
      firstDay: scheduleData[0]
    });

    // Process the schedule data to match expected structure
    const processedOfficers = processScheduleDataForExport(scheduleData, { from: startDate, to: endDate });
    
    console.log("Processed officers:", {
      count: processedOfficers.length,
      firstOfficer: processedOfficers[0],
      firstOfficerWeeklySchedule: processedOfficers[0]?.weeklySchedule
    });

    const pdf = new jsPDF("portrait", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // CORRECTED cell display logic - UPDATED TO MATCH YOUR DATA STRUCTURE
    const getCellDisplay = (officer: any) => {
      console.log("getCellDisplay officer:", officer);
      
      if (!officer) {
        return { 
          text: "", 
          color: pdfColors.offDay.text, 
          fillColor: pdfColors.offDay.bg 
        };
      }

      // Check if officer has shiftInfo
      const shiftInfo = officer.shiftInfo;
      if (!shiftInfo) {
        return { 
          text: " ", 
          color: [0, 0, 150], 
          fillColor: [255, 255, 255]
        };
      }

      if (shiftInfo.isOff) {
        return { 
          text: "OFF", 
          color: [100, 100, 100], 
          fillColor: pdfColors.offDay.bg 
        };
      } else if (shiftInfo.hasPTO) {
        if (shiftInfo.ptoData?.isFullShift) {
          const ptoType = shiftInfo.ptoData.ptoType || "PTO";
          const isSupervisor = isSupervisorByRank({ rank: officer.rank } as OfficerWeeklyData);
          const ptoColors = isSupervisor ? pdfColors.supervisorPTO : pdfColors.officerPTO;
          const isSickTime = ptoType.toLowerCase().includes('sick');
          const finalColors = isSickTime ? pdfColors.sickTime : ptoColors;
          
          return { 
            text: ptoType.toUpperCase(), 
            color: finalColors.text, 
            fillColor: finalColors.bg 
          };
        } else {
          const position = shiftInfo.position || "";
          const simplifiedPosition = simplifyPosition(position);
          const displayText = simplifiedPosition ? simplifiedPosition + "*" : "PTO*";
          const partialBg = [255, 255, 224];
          
          return { 
            text: displayText, 
            color: [0, 100, 0], 
            fillColor: partialBg 
          };
        }
      } else if (shiftInfo.position) {
        const position = shiftInfo.position;
        const simplifiedPosition = simplifyPosition(position);
        const isSpecial = isSpecialAssignment(position);
        let displayText = simplifiedPosition;
        
        // Shorten long positions
        if (simplifiedPosition.length > 8) {
          // Try to keep meaningful parts
          if (simplifiedPosition.includes('/')) {
            // For positions like "1/2", keep the numbers
            displayText = simplifiedPosition.replace(/[^0-9/]/g, '');
          } else {
            displayText = simplifiedPosition.substring(0, 8);
          }
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

    console.log("Weeks to export:", weeks);

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
      
      // Add shift name
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(
        shiftName,
        pageWidth / 2,
        yPosition + 5,
        { align: "center" }
      );
      
      yPosition += 12;

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

      console.log("Week days:", weekDays);

      // Categorize officers for this week
      const supervisors = processedOfficers
        .filter(o => isSupervisorByRank(o))
        .sort((a, b) => {
          const aPriority = getRankPriority(a.rank || '');
          const bPriority = getRankPriority(b.rank || '');
          if (aPriority !== bPriority) return aPriority - bPriority;
          return getLastName(a.officerName).localeCompare(getLastName(b.officerName));
        });

      const allOfficersList = processedOfficers
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

      console.log("Categorized officers:", {
        supervisors: supervisors.length,
        regularOfficers: regularOfficers.length,
        ppos: ppos.length
      });

      // Table setup
      const margin = 5;
      const availableWidth = pageWidth - (margin * 2);
      const badgeWidth = 18; // Slightly wider for badge numbers
      const nameWidth = 35;  // Wider for names
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
      pdf.text("ID#", xPosition + badgeWidth / 2, yPosition + 7, { align: "center" });
      xPosition += badgeWidth;
      pdf.text("OFFICER", xPosition + 5, yPosition + 7);
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
          if (yPosition > pageHeight - 20) {
            pdf.addPage();
            yPosition = 10;
            
            // Re-draw header for new page
            pdf.setFillColor(41, 128, 185);
            pdf.rect(startX, yPosition, tableWidth, 10, "F");
            pdf.setFontSize(10);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(255, 255, 255);
            
            let headerX = startX;
            pdf.text("ID#", headerX + badgeWidth / 2, yPosition + 7, { align: "center" });
            headerX += badgeWidth;
            pdf.text("OFFICER", headerX + 5, yPosition + 7);
            headerX += nameWidth;
            
            weekDays.forEach((day) => {
              pdf.setFontSize(9);
              pdf.text(day.dayName, headerX + dayColWidth / 2, yPosition + 4, { align: "center" });
              pdf.setFontSize(8);
              pdf.text(day.formattedDate, headerX + dayColWidth / 2, yPosition + 7, { align: "center" });
              headerX += dayColWidth;
            });
            
            yPosition += 10;
          }

          xPosition = startX;
          
          // Row background
          pdf.setFillColor(255, 255, 255);
          pdf.rect(xPosition, yPosition, tableWidth, 8, "F");
          
          // Badge number
          pdf.setTextColor(0, 0, 0);
          const badgeDisplay = officer.badgeNumber?.toString() || "N/A";
          pdf.text(badgeDisplay, xPosition + badgeWidth / 2, yPosition + 5, { align: "center" });
          xPosition += badgeWidth;
          
          // Name - last name only with PPO indicator if needed
          let lastName = getLastName(officer.officerName);
          if (isPPO) {
            lastName += " (PPO)";
          }
          pdf.text(lastName, xPosition + 5, yPosition + 5);
          xPosition += nameWidth;

          // Daily assignments
          weekDays.forEach((day) => {
            const dayOfficer = officer.weeklySchedule[day.dateStr];
            const cellDisplay = getCellDisplay(dayOfficer);

            // Set cell background
            pdf.setFillColor(...cellDisplay.fillColor);
            pdf.rect(xPosition, yPosition, dayColWidth, 8, "F");
            
            // Cell border
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(xPosition, yPosition, dayColWidth, 8, "S");
            
            // Cell text
            if (cellDisplay.text && cellDisplay.text.trim()) {
              pdf.setTextColor(...cellDisplay.color);
              
              // Adjust font size based on text length
              let fontSize = 7;
              if (cellDisplay.text.length > 6) {
                fontSize = 6;
              }
              pdf.setFontSize(fontSize);
              
              pdf.text(
                cellDisplay.text, 
                xPosition + dayColWidth / 2, 
                yPosition + 4.5, 
                { align: "center" }
              );
              
              pdf.setFontSize(8); // Reset to normal size
            }
            
            xPosition += dayColWidth;
          });

          yPosition += 8;
        }
      };

      // Render sections
      if (supervisors.length > 0) {
        // Supervisor header
        pdf.setFillColor(240, 240, 240);
        pdf.rect(startX, yPosition, tableWidth, 6, "F");
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text("SUPERVISORS", startX + 5, yPosition + 4);
        yPosition += 6;
        
        renderOfficerRows(supervisors);
        yPosition += 3;
      }

      if (regularOfficers.length > 0) {
        // Regular officers header
        pdf.setFillColor(240, 240, 240);
        pdf.rect(startX, yPosition, tableWidth, 6, "F");
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text("OFFICERS", startX + 5, yPosition + 4);
        yPosition += 6;
        
        renderOfficerRows(regularOfficers);
        yPosition += 3;
      }

      if (ppos.length > 0) {
        // PPO header
        pdf.setFillColor(230, 240, 255);
        pdf.rect(startX, yPosition, tableWidth, 6, "F");
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text("PROBATIONARY OFFICERS (PPO)", startX + 5, yPosition + 4);
        yPosition += 6;
        
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
    console.log("Saving PDF as:", filename);
    pdf.save(filename);

    return { success: true };
  } catch (error) {
    console.error("PDF export error:", error);
    return { success: false, error };
  }
};
