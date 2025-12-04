// hooks/useBeatPreferencesPDFExport.ts
import { useCallback } from "react";
import jsPDF from "jspdf";
import { format } from "date-fns";

interface BeatPreferencesExportOptions {
  selectedDate: Date;
  shiftName: string;
  shiftId: string;
  beatData: {
    officers: Array<{
      id: string;
      full_name: string;
      badge_number: string;
      rank: string;
      service_credit_override?: number;
    }>;
    preferences: Array<{
      officer_id: string;
      first_choice?: string;
      second_choice?: string;
      third_choice?: string;
      unavailable_beats?: string[];
      notes?: string;
    }>;
  } | null;
}

// Modern color scheme
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

// Placeholder logo
const getLogoBase64 = (): string => {
  const departmentLogo = "data:image/png;base64,placeholder";
  return departmentLogo;
};

// Function to draw logo
const drawActualLogo = (pdf: jsPDF, x: number, y: number) => {
  const logoBase64 = getLogoBase64();
  
  if (!logoBase64 || logoBase64 === "data:image/png;base64,placeholder") {
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

// Helper function to get last name from full name
const getLastName = (fullName: string): string => {
  if (!fullName) return "";
  const parts = fullName.split(" ");
  return parts.length > 0 ? parts[parts.length - 1] : fullName;
};

// Helper function to get rank abbreviation
const getRankAbbreviation = (rank: string): string => {
  if (!rank) return "";
  
  const rankMap: Record<string, string> = {
    'probationary': 'P/O',
    'officer': 'OFC',
    'senior officer': 'S/O',
    'corporal': 'CPL',
    'sergeant': 'SGT',
    'lieutenant': 'LT',
    'captain': 'CAPT',
    'deputy chief': 'D/CH',
    'chief': 'CHF'
  };
  
  return rankMap[rank.toLowerCase()] || rank.toUpperCase().substring(0, 4);
};

// Table drawing function for beat preferences
const drawBeatPreferencesTable = (pdf: jsPDF, headers: string[], data: any[][], startY: number, margins: { left: number, right: number }, sectionColor?: number[]) => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const tableWidth = pageWidth - margins.left - margins.right;
  
  const getColumnWidths = (headers: string[]) => {
    const totalColumns = headers.length;
    const baseWidths = {
      "OFFICER": 0.20,
      "BADGE #": 0.10,
      "RANK": 0.10,
      "1ST CHOICE": 0.15,
      "2ND CHOICE": 0.15,
      "3RD CHOICE": 0.15,
      "UNAVAILABLE": 0.25
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
  const rowHeight = 8;
  const cellPadding = 3;

  // Draw headers - center all headers
  let x = margins.left;
  headers.forEach((header, index) => {
    pdf.setFillColor(sectionColor?.[0] || COLORS.primary[0], sectionColor?.[1] || COLORS.primary[1], sectionColor?.[2] || COLORS.primary[2]);
    pdf.rect(x, y, colWidths[index], rowHeight, 'F');
    
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(255, 255, 255);
    
    const textWidth = pdf.getTextWidth(header);
    const textX = x + (colWidths[index] - textWidth) / 2;
    pdf.text(header, Math.max(textX, x + 2), y + rowHeight - cellPadding);
    
    x += colWidths[index];
  });

  y += rowHeight;

  // Draw data rows
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  
  data.forEach((row, rowIndex) => {
    x = margins.left;
    
    if (rowIndex % 2 === 0) {
      pdf.setFillColor(255, 255, 255);
    } else {
      pdf.setFillColor(COLORS.light[0], COLORS.light[1], COLORS.light[2]);
    }
    
    pdf.rect(x, y, tableWidth, rowHeight, 'F');
    
    pdf.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    pdf.setLineWidth(0.1);
    
    row.forEach((cell, cellIndex) => {
      pdf.rect(x, y, colWidths[cellIndex], rowHeight, 'S');
      
      const currentHeader = headers[cellIndex].toUpperCase();
      
      // Set different colors for different columns
      if (currentHeader === "1ST CHOICE" && cell !== "-") {
        pdf.setTextColor(0, 100, 0); // Green for 1st choice
      } else if (currentHeader === "2ND CHOICE" && cell !== "-") {
        pdf.setTextColor(0, 0, 150); // Blue for 2nd choice
      } else if (currentHeader === "3RD CHOICE" && cell !== "-") {
        pdf.setTextColor(128, 0, 128); // Purple for 3rd choice
      } else if (currentHeader === "UNAVAILABLE" && cell !== "-") {
        pdf.setTextColor(150, 0, 0); // Red for unavailable
      } else {
        pdf.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
      }
      
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
      
      // Center specific columns
      const centerColumns = ["BADGE #", "RANK"];
      
      if (centerColumns.includes(currentHeader)) {
        const textWidth = pdf.getTextWidth(displayText);
        const textX = x + (colWidths[cellIndex] - textWidth) / 2;
        pdf.text(displayText, Math.max(textX, x + 2), y + rowHeight - cellPadding);
      } else {
        pdf.text(displayText, x + cellPadding, y + rowHeight - cellPadding);
      }
      
      x += colWidths[cellIndex];
    });
    
    y += rowHeight;
    
    // Check if we need a new page
    if (y > pdf.internal.pageSize.getHeight() - 30) {
      pdf.addPage();
      y = 30;
      
      // Redraw headers on new page
      x = margins.left;
      headers.forEach((header, index) => {
        pdf.setFillColor(sectionColor?.[0] || COLORS.primary[0], sectionColor?.[1] || COLORS.primary[1], sectionColor?.[2] || COLORS.primary[2]);
        pdf.rect(x, y, colWidths[index], rowHeight, 'F');
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.setTextColor(255, 255, 255);
        
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

export const useBeatPreferencesPDFExport = () => {
  const exportToPDF = useCallback(async ({ 
    selectedDate, 
    shiftName, 
    shiftId, 
    beatData 
  }: BeatPreferencesExportOptions) => {
    try {
      console.log("Beat Preferences PDF Export - Received data:", { selectedDate, shiftName, shiftId, beatData });

      if (!beatData || !selectedDate) {
        throw new Error("No beat data or date provided for PDF export");
      }

      const pdf = new jsPDF("p", "mm", "letter");
      const pageWidth = pdf.internal.pageSize.getWidth();
      let yPosition = 20;

      // Draw logo
      drawActualLogo(pdf, 15, 15);

      // Title
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
      const title = `Beat Preferences - ${shiftName}`;
      const titleWidth = pdf.getTextWidth(title);
      pdf.text(title, (pageWidth - titleWidth) / 2, 28);

      // Date and shift info
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
      
      const dateText = format(selectedDate, "EEEE, MMMM d, yyyy");
      const dateWidth = pdf.getTextWidth(dateText);
      pdf.text(dateText, (pageWidth - dateWidth) / 2, 36);

      yPosition = 45;

      // Check if we have data
      if (!beatData.officers || beatData.officers.length === 0) {
        pdf.setFontSize(12);
        pdf.setTextColor(150, 150, 150);
        pdf.text("No officer beat preferences available", pageWidth / 2, yPosition, { align: "center" });
      } else {
        // Sort officers by last name for the PDF
        const sortedOfficers = [...beatData.officers].sort((a, b) => 
          getLastName(a.full_name).localeCompare(getLastName(b.full_name))
        );

        // Prepare table data
        const tableData: any[][] = [];
        
        sortedOfficers.forEach((officer) => {
          const preferences = beatData.preferences.find(p => p.officer_id === officer.id);
          
          // Format unavailable beats
          let unavailableText = "-";
          if (preferences?.unavailable_beats && preferences.unavailable_beats.length > 0) {
            unavailableText = preferences.unavailable_beats.join(', ');
            if (unavailableText.length > 30) {
              unavailableText = unavailableText.substring(0, 27) + "...";
            }
          }
          
          tableData.push([
            getLastName(officer.full_name),
            officer.badge_number || "-",
            getRankAbbreviation(officer.rank),
            preferences?.first_choice || "-",
            preferences?.second_choice || "-",
            preferences?.third_choice || "-",
            unavailableText
          ]);
        });

        // Draw table
        const headers = ["OFFICER", "BADGE #", "RANK", "1ST CHOICE", "2ND CHOICE", "3RD CHOICE", "UNAVAILABLE"];
        yPosition = drawBeatPreferencesTable(pdf, headers, tableData, yPosition, { left: 15, right: 15 }, COLORS.primary);
        
        // Summary section
        yPosition += 5;
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
        
        const officersWithFullPreferences = beatData.preferences.filter(p => 
          p.first_choice && p.second_choice && p.third_choice
        ).length;
        
        const summaryText = `Total Officers: ${sortedOfficers.length} | Officers with Full Preferences: ${officersWithFullPreferences}`;
        pdf.text(summaryText, 15, yPosition);
      }

      // Footer with generation time
      yPosition = pdf.internal.pageSize.getHeight() - 15;
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
      
      const generatedAt = `Generated: ${format(new Date(), "MMM d, h:mm a")}`;
      pdf.text(generatedAt, pageWidth - 15, yPosition, { align: 'right' });

      // Save PDF
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const filename = `Beat_Preferences_${shiftName.replace(/\s+/g, "_")}_${dateStr}.pdf`;
      pdf.save(filename);

      return { success: true };
    } catch (error) {
      console.error("Beat Preferences PDF export error:", error);
      return { success: false, error };
    }
  }, []);

  return { exportToPDF };
};
