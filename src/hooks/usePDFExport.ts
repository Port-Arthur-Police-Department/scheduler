// hooks/usePDFExport.ts
import { useCallback } from "react";
import jsPDF from "jspdf";
import { format } from "date-fns";

// Layout Settings Interface
interface LayoutSettings {
  fontSizes: {
    header: number;
    sectionTitle: number;
    tableHeader: number;
    tableContent: number;
    footer: number;
  };
  sections: {
    showSupervisors: boolean;
    showOfficers: boolean;
    showSpecialAssignments: boolean;
    showPTO: boolean;
    showStaffingSummary: boolean;
  };
  tableSettings: {
    rowHeight: number;
    cellPadding: number;
    showRowStriping: boolean;
    compactMode: boolean;
  };
  colorSettings: {
    // Header Colors
    headerBgColor: string;
    headerTextColor: string;
    
    // Section Title Colors (SUPERVISORS, OFFICERS text)
    sectionTitleColor: string;
    
    // Table Content Colors
    officerTextColor: string;
    supervisorTextColor: string;
    specialAssignmentTextColor: string;
    ptoTextColor: string;
    
    // Row Colors
    evenRowColor: string;
    oddRowColor: string;
    
    // Accent Colors (for borders, etc)
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
}

interface ExportOptions {
  selectedDate: Date;
  shiftName: string;
  shiftData: any;
  layoutSettings?: LayoutSettings;
}

// Default layout settings - UPDATED with more specific colors
const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  fontSizes: {
    header: 10,
    sectionTitle: 9,
    tableHeader: 7,
    tableContent: 7,
    footer: 7
  },
  sections: {
    showSupervisors: true,
    showOfficers: true,
    showSpecialAssignments: true,
    showPTO: true,
    showStaffingSummary: true
  },
  tableSettings: {
    rowHeight: 8,
    cellPadding: 3,
    showRowStriping: true,
    compactMode: false
  },
  colorSettings: {
    // Header Colors
    headerBgColor: "41,128,185", // Blue background for table headers
    headerTextColor: "255,255,255", // White text for table headers
    
    // Section Title Colors
    sectionTitleColor: "41,128,185", // Blue for "SUPERVISORS", "OFFICERS" titles
    
    // Table Content Colors
    officerTextColor: "44,62,80", // Dark gray for officer names
    supervisorTextColor: "44,62,80", // Dark gray for supervisor names
    specialAssignmentTextColor: "102,51,153", // Purple for special assignments
    ptoTextColor: "139,0,0", // Red for PTO
    
    // Row Colors
    evenRowColor: "255,255,255",
    oddRowColor: "248,249,250",
    
    // Accent Colors
    primaryColor: "41,128,185",
    secondaryColor: "52,152,219",
    accentColor: "155,89,182"
  }
};

// Modern color scheme (kept for backward compatibility)
const COLORS = {
  primary: [41, 128, 185],
  secondary: [52, 152, 219],
  accent: [155, 89, 182],
  success: [39, 174, 96],
  warning: [243, 156, 18],
  danger: [231, 76, 60],
  light: [248, 249, 250],
  dark: [44, 62, 80],
  gray: [108, 117, 125],
  border: [222, 226, 230]
};

// Helper function to convert hex/rgb string to array
const parseColor = (colorString: string): number[] => {
  if (colorString.includes(',')) {
    // RGB string like "41,128,185"
    return colorString.split(',').map(num => parseInt(num.trim(), 10));
  } else if (colorString.startsWith('#')) {
    // Hex color like "#2980b9"
    const hex = colorString.replace('#', '');
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return [r, g, b];
    } else if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return [r, g, b];
    }
  }
  // Default to dark gray if invalid
  return COLORS.dark;
};

// Your actual base64 logo - paste your complete string here
const getLogoBase64 = (): string => {
    const departmentLogo = "placeholder";
  
  return departmentLogo;
};

// Draw actual logo function
const drawActualLogo = (pdf: jsPDF, x: number, y: number) => {
  const logoBase64 = getLogoBase64();
  
  if (!logoBase64 || logoBase64 === "placeholder") {
    const logoSize = 20;
    pdf.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    pdf.rect(x, y, logoSize, logoSize, 'F');
    pdf.setFontSize(6);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.text("LOGO", x + logoSize/2, y + logoSize/2, { align: 'center', baseline: 'middle' });
    return logoSize;
  }

  try {
    const logoWidth = 20;
    const logoHeight = 20;
    pdf.addImage(logoBase64, 'PNG', x, y, logoWidth, logoHeight);
    return logoWidth;
  } catch (error) {
    console.error('Error drawing logo:', error);
    const logoSize = 20;
    pdf.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    pdf.rect(x, y, logoSize, logoSize, 'F');
    pdf.setFontSize(6);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.text("LOGO", x + logoSize/2, y + logoSize/2, { align: 'center', baseline: 'middle' });
    return logoSize;
  }
};

// UPDATED: Function to format supervisor display with rank
const formatSupervisorDisplay = (supervisor: any) => {
  if (!supervisor?.name) return "UNKNOWN";
  
  const name = supervisor.name.toUpperCase();
  const rank = supervisor.rank ? ` (${supervisor.rank})` : '';
  
  // If supervisor has a partnership, include partner
  if (supervisor.isCombinedPartnership && supervisor.partnerData) {
    const partnerName = supervisor.partnerData.partnerName.toUpperCase();
    const partnerRank = supervisor.partnerData.partnerRank ? ` (${supervisor.partnerData.partnerRank})` : '';
    return `${name}${rank} + ${partnerName}${partnerRank}`;
  }
  
  return `${name}${rank}`;
};

// UPDATED: Function to format officer display with partnership
const formatOfficerDisplay = (officer: any) => {
  if (!officer?.name) return "UNKNOWN";
  
  const name = officer.name.toUpperCase();
  
  // If officer has a partnership, include partner
  if (officer.isCombinedPartnership && officer.partnerData) {
    const partnerName = officer.partnerData.partnerName.toUpperCase();
    return `${name} + ${partnerName}`;
  }
  
  return name;
};

// UPDATED: Function to format partnership details for notes
const formatPartnershipDetails = (person: any) => {
  if (!person.isCombinedPartnership || !person.partnerData) {
    return person?.notes || "";
  }

  const primaryBadge = person.badge || "";
  const partnerBadge = person.partnerData.partnerBadge || "";
  const primaryRank = person.rank || "";
  const partnerRank = person.partnerData.partnerRank || "";
  
  let partnershipInfo = `PARTNERSHIP: ${primaryBadge} (${primaryRank}) + ${partnerBadge} (${partnerRank})`;
  
  if (person.notes) {
    partnershipInfo += ` | ${person.notes}`;
  }
  
  return partnershipInfo;
};

// UPDATED: Table drawing function with better color separation
const drawCompactTable = (
  pdf: jsPDF, 
  headers: string[], 
  data: any[][], 
  startY: number, 
  margins: { left: number, right: number }, 
  sectionType: 'supervisors' | 'officers' | 'special' | 'pto' = 'officers',
  layoutSettings: LayoutSettings = DEFAULT_LAYOUT_SETTINGS
) => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const tableWidth = pageWidth - margins.left - margins.right;
  
  const getColumnWidths = (headers: string[]) => {
    const totalColumns = headers.length;
    const baseWidths = {
      "REGULAR OFFICERS": 0.35,
      "SPECIAL ASSIGNMENT OFFICERS": 0.35,
      "PTO OFFICERS": 0.35,
      "OFFICERS": 0.35,
      "SUPERVISORS": 0.35,
      "BEAT": 0.10,
      "ASSIGNMENT": 0.20,
      "BADGE #": 0.10,
      "UNIT": 0.10,
      "NOTES": 0.35,
      "TYPE": 0.15,
      "TIME": 0.35
    };

    return headers.map(header => {
      const widthPercentage = baseWidths[header as keyof typeof baseWidths] || (1 / totalColumns);
      return tableWidth * widthPercentage;
    });
  };

  const colWidths = getColumnWidths(headers);
  
  const totalWidth = colWidths.reduce((sum, width) => sum + width, 0);
  if (Math.abs(totalWidth - tableWidth) > 1) {
    const adjustmentFactor = tableWidth / totalWidth;
    colWidths.forEach((width, index) => {
      colWidths[index] = width * adjustmentFactor;
    });
  }

  let y = startY;
  const rowHeight = layoutSettings.tableSettings.rowHeight;
  const cellPadding = layoutSettings.tableSettings.cellPadding;

  // Draw headers - center all headers
  let x = margins.left;
  headers.forEach((header, index) => {
    // Use header background color from layout settings
    const headerBg = parseColor(layoutSettings.colorSettings.headerBgColor);
    pdf.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
    pdf.rect(x, y, colWidths[index], rowHeight, 'F');
    
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(layoutSettings.fontSizes.tableHeader);
    
    // Use header text color from layout settings
    const headerTextColor = parseColor(layoutSettings.colorSettings.headerTextColor);
    pdf.setTextColor(headerTextColor[0], headerTextColor[1], headerTextColor[2]);
    
    const textWidth = pdf.getTextWidth(header);
    const textX = x + (colWidths[index] - textWidth) / 2;
    pdf.text(header, Math.max(textX, x + 2), y + rowHeight - cellPadding);
    
    x += colWidths[index];
  });

  y += rowHeight;

  // Draw data rows
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(layoutSettings.fontSizes.tableContent);
  
  data.forEach((row, rowIndex) => {
    x = margins.left;
    
    // Apply row striping if enabled
    if (layoutSettings.tableSettings.showRowStriping) {
      if (rowIndex % 2 === 0) {
        const evenRowColor = parseColor(layoutSettings.colorSettings.evenRowColor);
        pdf.setFillColor(evenRowColor[0], evenRowColor[1], evenRowColor[2]);
      } else {
        const oddRowColor = parseColor(layoutSettings.colorSettings.oddRowColor);
        pdf.setFillColor(oddRowColor[0], oddRowColor[1], oddRowColor[2]);
      }
    } else {
      const evenRowColor = parseColor(layoutSettings.colorSettings.evenRowColor);
      pdf.setFillColor(evenRowColor[0], evenRowColor[1], evenRowColor[2]);
    }
    
    pdf.rect(x, y, tableWidth, rowHeight, 'F');
    
    pdf.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    pdf.setLineWidth(0.1);
    
    row.forEach((cell, cellIndex) => {
      pdf.rect(x, y, colWidths[cellIndex], rowHeight, 'S');
      
      // Set text color based on section type
      let textColor;
      switch(sectionType) {
        case 'supervisors':
          textColor = parseColor(layoutSettings.colorSettings.supervisorTextColor);
          break;
        case 'special':
          textColor = parseColor(layoutSettings.colorSettings.specialAssignmentTextColor);
          break;
        case 'pto':
          textColor = parseColor(layoutSettings.colorSettings.ptoTextColor);
          break;
        case 'officers':
        default:
          textColor = parseColor(layoutSettings.colorSettings.officerTextColor);
          break;
      }
      
      pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
      
      const cellText = cell?.toString() || "";
      const maxTextWidth = colWidths[cellIndex] - (cellPadding * 2);
      
      let displayText = cellText;
      if (pdf.getTextWidth(cellText) > maxTextWidth) {
        let truncated = cellText;
        while (pdf.getTextWidth(truncated + "...") > maxTextWidth && truncated.length > 1) {
          truncated = truncated.substring(0, truncated.length - 1);
        }
        displayText = truncated + (truncated.length < cellText.length ? "..." : "");
      }
      
      // Center specific columns: BADGE #, BEAT, UNIT, TYPE
      const currentHeader = headers[cellIndex].toUpperCase();
      const centerColumns = ["BADGE #", "BEAT", "UNIT", "TYPE"];
      
      if (centerColumns.includes(currentHeader)) {
        // Center align for badge#, beat, unit, type
        const textWidth = pdf.getTextWidth(displayText);
        const textX = x + (colWidths[cellIndex] - textWidth) / 2;
        pdf.text(displayText, Math.max(textX, x + 2), y + rowHeight - cellPadding);
      } else {
        // Left align for other columns
        pdf.text(displayText, x + cellPadding, y + rowHeight - cellPadding);
      }
      
      x += colWidths[cellIndex];
    });
    
    y += rowHeight;
    
    if (y > pdf.internal.pageSize.getHeight() - 30) {
      pdf.addPage();
      y = 30;
      
      x = margins.left;
      headers.forEach((header, index) => {
        const headerBg = parseColor(layoutSettings.colorSettings.headerBgColor);
        pdf.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
        pdf.rect(x, y, colWidths[index], rowHeight, 'F');
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(layoutSettings.fontSizes.tableHeader);
        const headerTextColor = parseColor(layoutSettings.colorSettings.headerTextColor);
        pdf.setTextColor(headerTextColor[0], headerTextColor[1], headerTextColor[2]);
        
        const textWidth = pdf.getTextWidth(header);
        const textX = x + (colWidths[index] - textWidth) / 2;
        pdf.text(header, Math.max(textX, x + 2), y + rowHeight - cellPadding);
        
        x += colWidths[index];
      });
      y += rowHeight;
    }
  });

  return y + 8;
};

export const usePDFExport = () => {
  const exportToPDF = useCallback(async ({ 
    selectedDate, 
    shiftName, 
    shiftData, 
    layoutSettings = DEFAULT_LAYOUT_SETTINGS 
  }: ExportOptions) => {
    try {
      console.log("PDF Export - Received data:", { selectedDate, shiftName, shiftData, layoutSettings });

      if (!shiftData || !selectedDate) {
        throw new Error("No shift data or date provided for PDF export");
      }

      const pdf = new jsPDF("p", "mm", "letter");
      const pageWidth = pdf.internal.pageSize.getWidth();
      let yPosition = 20;

      // Draw logo
      drawActualLogo(pdf, 15, 15);

      // Shift info on the left, same line as logo
      pdf.setFontSize(layoutSettings.fontSizes.header);
      pdf.setFont("helvetica", "bold");
      const primaryColor = parseColor(layoutSettings.colorSettings.primaryColor);
      pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      
      const shiftInfo = `${shiftName.toUpperCase()} • ${shiftData.shift?.start_time || "N/A"}-${shiftData.shift?.end_time || "N/A"}`;
      pdf.text(shiftInfo, 45, 28);

      // Date with a few spaces after shiftInfo
      const dateText = format(selectedDate, "EEE, MMM d, yyyy");
      const shiftInfoWidth = pdf.getTextWidth(shiftInfo);
      const dateX = 45 + shiftInfoWidth + 15; // 15mm space after shiftInfo
      pdf.text(dateText, dateX, 28);

      // Start content lower to maintain spacing
      yPosition = 40;

      // Supervisors section - Only show if enabled in layout settings
      if (layoutSettings.sections.showSupervisors && shiftData.supervisors && shiftData.supervisors.length > 0) {
        // Add section title
        pdf.setFontSize(layoutSettings.fontSizes.sectionTitle);
        pdf.setFont("helvetica", "bold");
        const sectionTitleColor = parseColor(layoutSettings.colorSettings.sectionTitleColor);
        pdf.setTextColor(sectionTitleColor[0], sectionTitleColor[1], sectionTitleColor[2]);
        pdf.text("SUPERVISORS", 15, yPosition);
        yPosition += 6;
        
        const supervisorsData: any[] = [];

        shiftData.supervisors.forEach((supervisor: any) => {
          // Skip supervisors with full-day PTO
          const hasFullDayPTO = supervisor.hasPTO && 
            (supervisor.ptoData?.isFullShift === true || 
             (!supervisor.ptoData?.startTime && !supervisor.ptoData?.endTime) ||
             (supervisor.ptoData?.startTime === supervisor.shift?.start_time && 
              supervisor.ptoData?.endTime === supervisor.shift?.end_time));
          
          if (hasFullDayPTO) {
            console.log(`PDF Export - Filtering out supervisor ${supervisor.name} - full day PTO`);
            return; // Skip this supervisor
          }
          
          // UPDATED: Use supervisor formatting with rank
          const displayName = formatSupervisorDisplay(supervisor);
          const notes = formatPartnershipDetails(supervisor);
          
          supervisorsData.push([
            displayName,
            supervisor?.position || "",
            supervisor?.badge || "",
            supervisor?.unitNumber ? `Unit ${supervisor.unitNumber}` : "",
            notes
          ]);
        });

        // Only draw the table if there are supervisors after filtering
        if (supervisorsData.length > 0) {
          const officersHeaders = ["SUPERVISORS", "BEAT", "BADGE #", "UNIT", "NOTES"];
          yPosition = drawCompactTable(
            pdf, 
            officersHeaders, 
            supervisorsData, 
            yPosition, 
            { left: 15, right: 15 }, 
            'supervisors', // Pass section type
            layoutSettings
          );
          yPosition += 4;
        }
      }

      // SECTION 1: REGULAR OFFICERS TABLE - Only show if enabled
      if (layoutSettings.sections.showOfficers && shiftData.officers && shiftData.officers.length > 0) {
        // Add section title
        pdf.setFontSize(layoutSettings.fontSizes.sectionTitle);
        pdf.setFont("helvetica", "bold");
        const sectionTitleColor = parseColor(layoutSettings.colorSettings.sectionTitleColor);
        pdf.setTextColor(sectionTitleColor[0], sectionTitleColor[1], sectionTitleColor[2]);
        pdf.text("OFFICERS", 15, yPosition);
        yPosition += 6;
        
        const regularOfficersData: any[] = [];
        
        shiftData.officers.forEach((officer: any) => {
          // Skip officers with full-day PTO
          const hasFullDayPTO = officer.hasPTO && 
            (officer.ptoData?.isFullShift === true || 
             (!officer.ptoData?.startTime && !officer.ptoData?.endTime) ||
             (officer.ptoData?.startTime === officer.shift?.start_time && 
              officer.ptoData?.endTime === officer.shift?.end_time));
          
          if (hasFullDayPTO) {
            console.log(`PDF Export - Filtering out officer ${officer.name} - full day PTO`);
            return; // Skip this officer
          }
          
          // UPDATED: Use officer formatting with partnership
          const displayName = formatOfficerDisplay(officer);
          const notes = formatPartnershipDetails(officer);
          
          regularOfficersData.push([
            displayName,
            officer?.position || "",
            officer?.badge || "",
            officer?.unitNumber || "",
            notes
          ]);
        });

        // Only draw the table if there are officers after filtering
        if (regularOfficersData.length > 0) {
          const officersHeaders = ["OFFICERS", "BEAT", "BADGE #", "UNIT", "NOTES"];
          yPosition = drawCompactTable(
            pdf, 
            officersHeaders, 
            regularOfficersData, 
            yPosition, 
            { left: 15, right: 15 }, 
            'officers', // Pass section type
            layoutSettings
          );
        }
      }

      // SECTION 2: SPECIAL ASSIGNMENT OFFICERS TABLE - Only show if enabled
      if (layoutSettings.sections.showSpecialAssignments && shiftData.specialAssignmentOfficers && shiftData.specialAssignmentOfficers.length > 0) {
        // Add section title
        pdf.setFontSize(layoutSettings.fontSizes.sectionTitle);
        pdf.setFont("helvetica", "bold");
        const sectionTitleColor = parseColor(layoutSettings.colorSettings.sectionTitleColor);
        pdf.setTextColor(sectionTitleColor[0], sectionTitleColor[1], sectionTitleColor[2]);
        pdf.text("SPECIAL ASSIGNMENTS", 15, yPosition);
        yPosition += 6;
        
        const specialAssignmentData: any[] = [];
        
        shiftData.specialAssignmentOfficers.forEach((officer: any) => {
          // Skip officers with full-day PTO
          const hasFullDayPTO = officer.hasPTO && 
            (officer.ptoData?.isFullShift === true || 
             (!officer.ptoData?.startTime && !officer.ptoData?.endTime) ||
             (officer.ptoData?.startTime === officer.shift?.start_time && 
              officer.ptoData?.endTime === officer.shift?.end_time));
          
          if (hasFullDayPTO) {
            console.log(`PDF Export - Filtering out special assignment ${officer.name} - full day PTO`);
            return; // Skip this officer
          }
          
          // UPDATED: Use officer formatting with partnership
          const displayName = formatOfficerDisplay(officer);
          const notes = formatPartnershipDetails(officer);
          
          specialAssignmentData.push([
            displayName,
            officer?.position || "Special",
            officer?.badge || "",
            officer?.unitNumber || "",
            notes
          ]);
        });

        // Only draw the table if there are officers after filtering
        if (specialAssignmentData.length > 0) {
          const specialHeaders = ["SPECIAL ASSIGNMENT OFFICERS", "ASSIGNMENT", "BADGE #", "UNIT", "NOTES"];
          yPosition = drawCompactTable(
            pdf, 
            specialHeaders, 
            specialAssignmentData, 
            yPosition, 
            { left: 15, right: 15 }, 
            'special', // Pass section type
            layoutSettings
          );
        }
      }

      // SECTION 3: PTO/OFF DUTY TABLE - Only show if enabled
      if (layoutSettings.sections.showPTO && shiftData.ptoRecords && shiftData.ptoRecords.length > 0) {
        // Add section title
        pdf.setFontSize(layoutSettings.fontSizes.sectionTitle);
        pdf.setFont("helvetica", "bold");
        const sectionTitleColor = parseColor(layoutSettings.colorSettings.sectionTitleColor);
        pdf.setTextColor(sectionTitleColor[0], sectionTitleColor[1], sectionTitleColor[2]);
        pdf.text("TIME OFF", 15, yPosition);
        yPosition += 6;
        
        const ptoData: any[] = [];
        
        shiftData.ptoRecords.forEach((record: any) => {
          const name = record?.name ? record.name.toUpperCase() : "UNKNOWN";
          const badge = record?.badge || "";
          const ptoType = record?.ptoType ? record.ptoType.toUpperCase() : "UNKNOWN";
          
          const timeInfo = record?.isFullShift 
            ? "FULL SHIFT" 
            : `${record?.startTime || "N/A"}-${record?.endTime || "N/A"}`;
          
          ptoData.push([name, badge, ptoType, timeInfo]);
        });

        const ptoHeaders = ["PTO OFFICERS", "BADGE #", "TYPE", "TIME"];
        yPosition = drawCompactTable(
          pdf, 
          ptoHeaders, 
          ptoData, 
          yPosition, 
          { left: 15, right: 15 }, 
          'pto', // Pass section type
          layoutSettings
        );
      }

      // Compact staffing summary at bottom - Only show if enabled
      if (layoutSettings.sections.showStaffingSummary) {
        yPosition += 5;
        
        // Recalculate counts after filtering out full-day PTO officers
        const filteredSupervisors = shiftData.supervisors?.filter((supervisor: any) => {
          const hasFullDayPTO = supervisor.hasPTO && 
            (supervisor.ptoData?.isFullShift === true || 
             (!supervisor.ptoData?.startTime && !supervisor.ptoData?.endTime) ||
             (supervisor.ptoData?.startTime === supervisor.shift?.start_time && 
              supervisor.ptoData?.endTime === supervisor.shift?.end_time));
          return !hasFullDayPTO;
        }) || [];
        
        const filteredOfficers = shiftData.officers?.filter((officer: any) => {
          const hasFullDayPTO = officer.hasPTO && 
            (officer.ptoData?.isFullShift === true || 
             (!officer.ptoData?.startTime && !officer.ptoData?.endTime) ||
             (officer.ptoData?.startTime === officer.shift?.start_time && 
              officer.ptoData?.endTime === officer.shift?.end_time));
          return !hasFullDayPTO;
        }) || [];

        const currentSupervisors = filteredSupervisors.length;
        const minSupervisors = shiftData.minSupervisors || 0;
        const currentOfficers = filteredOfficers.length;
        const minOfficers = shiftData.minOfficers || 0;
        
        pdf.setFontSize(layoutSettings.fontSizes.footer);
        pdf.setFont("helvetica", "bold");
        const darkColor = parseColor(layoutSettings.colorSettings.primaryColor);
        pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        
        const staffingText = `STAFFING: Supervisors ${currentSupervisors}/${minSupervisors} • Officers ${currentOfficers}/${minOfficers}`;
        pdf.text(staffingText, 15, yPosition);

        const generatedAt = `Generated: ${format(new Date(), "MMM d, h:mm a")}`;
        pdf.text(generatedAt, pageWidth - 15, yPosition, { align: 'right' });
      }

      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const dayOfWeek = format(selectedDate, "EEEE").toUpperCase();
      const filename = `PAPD_Schedule_${shiftName.replace(/\s+/g, "_")}_${dayOfWeek}_${dateStr}.pdf`;

      pdf.save(filename);

      return { success: true };
    } catch (error) {
      console.error("PDF export error:", error);
      return { success: false, error };
    }
  }, []);

  return { exportToPDF, DEFAULT_LAYOUT_SETTINGS };
};
