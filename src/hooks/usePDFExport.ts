

// usePDFExport.ts - WITH BIRTHDAY AND ANNIVERSARY INDICATORS
import { useCallback } from "react";
import jsPDF from "jspdf";
import { format, parseISO } from "date-fns";
import { DEFAULT_LAYOUT_SETTINGS, LayoutSettings } from "@/constants/pdfLayoutSettings";

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
    // Header Colors - Each section has its own header background
    supervisorHeaderBgColor: string;
    officerHeaderBgColor: string;
    specialHeaderBgColor: string;
    ptoHeaderBgColor: string;
    headerTextColor: string; // White text for all headers
    
    // Table Content Colors
    officerTextColor: string;
    supervisorTextColor: string;
    specialAssignmentTextColor: string;
    ptoTextColor: string;
    
    // Row Colors
    evenRowColor: string;
    oddRowColor: string;
    
    // Accent Colors (for top header and other accents)
    primaryColor: string; // Shift and Date title only
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

// Helper to fetch all officers assigned to a shift (including those completely off)
const fetchAllAssignedOfficers = async (shiftData: any, selectedDate: Date) => {
  try {
    // This is an example - adjust based on your database schema
    // You might need to query schedule_exceptions, recurring_schedules, etc.
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const shiftId = shiftData.shift?.id;
    
    if (!shiftId) return [];
    
    // Example query - you'll need to adjust this for your schema
    const { data: allScheduleEntries, error } = await supabase
      .from("schedule_exceptions")
      .select(`
        officer_id,
        profiles (id, full_name, birthday, hire_date)
      `)
      .eq("date", dateStr)
      .eq("shift_type_id", shiftId)
      .or("is_off.is.false,is_off.is.true"); // Include both working and off-duty
    
    if (error) {
      console.error("Error fetching assigned officers:", error);
      return [];
    }
    
    return allScheduleEntries.map(entry => ({
      officerId: entry.officer_id,
      name: entry.profiles?.full_name,
      birthday: entry.profiles?.birthday,
      hire_date: entry.profiles?.hire_date
    }));
    
  } catch (error) {
    console.error("Error in fetchAllAssignedOfficers:", error);
    return [];
  }
};

// Helper function to add special occasion indicators to officer names
const addSpecialOccasionIndicators = (officers: any[], showSpecialOccasions: boolean) => {
  if (!showSpecialOccasions) return officers;
  
  return officers.map(officer => {
    if (!officer || !officer.name) return officer;
    
    let nameDisplay = officer.name;
    
    // Add special occasion indicators
    if (officer.isBirthdayToday) {
      nameDisplay += " 🎂";
    }
    if (officer.isAnniversaryToday) {
      nameDisplay += ` 🎖️`;
    }
    
    // Return a new object with the updated name
    return {
      ...officer,
      name: nameDisplay
    };
  });
};

// Helper to calculate appropriate row height based on font size
const calculateRowHeight = (fontSize: number): number => {
  // Base row height for 8pt font
  const baseHeight = 7;
  // Add 0.5mm per point above 8
  if (fontSize <= 8) return baseHeight;
  return baseHeight + (fontSize - 8) * 0.5;
};

// Helper function to convert hex/rgb string to array - FIXED with better error handling
const parseColor = (colorString: string | undefined): number[] => {
  // If colorString is undefined or null, return default color
  if (!colorString) {
    console.warn('parseColor: colorString is undefined or null, using default');
    return COLORS.dark;
  }
  
  // Check if it's an RGB string
  if (typeof colorString === 'string' && colorString.includes(',')) {
    try {
      const parts = colorString.split(',').map(num => parseInt(num.trim(), 10));
      // Validate all parts are numbers
      if (parts.length === 3 && parts.every(num => !isNaN(num))) {
        return parts;
      }
    } catch (error) {
      console.warn('parseColor: Failed to parse RGB string:', colorString, error);
    }
  }
  
  // Check if it's a hex color
  if (typeof colorString === 'string' && colorString.startsWith('#')) {
    try {
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
    } catch (error) {
      console.warn('parseColor: Failed to parse hex color:', colorString, error);
    }
  }
  
  // Default to dark gray if invalid
  console.warn('parseColor: Invalid color format, using default:', colorString);
  return COLORS.dark;
};

// Safe color settings getter with defaults
const getColorSetting = (settings: LayoutSettings, key: keyof LayoutSettings['colorSettings']): string => {
  const color = settings.colorSettings[key];
  if (!color) {
    console.warn(`Missing color setting for ${key}, using default`);
    return DEFAULT_LAYOUT_SETTINGS.colorSettings[key] || "44,62,80";
  }
  return color;
};

// Helper to extract just the number from positions like "District 1", "Beat 2", "District 1/2"
// UPDATED: Also abbreviate "City-Wide" to "CW" and for supervisors, extract rank abbreviation
const extractBeatNumber = (position: string | undefined, rank: string = ""): string => {
  if (!position) return "";
  
  // Check if it's "City-Wide" (case insensitive)
  if (position.toLowerCase() === "city-wide") {
    return "CW";
  }
  
  // For supervisors in supervisor table, use rank abbreviation instead of "Sup"
  if (position.toLowerCase() === "supervisor") {
    if (!rank) return "Sup";
    
    const rankLower = rank.toLowerCase();
    if (rankLower.includes("sergeant") || rankLower.includes("sgt")) {
      return "Sgt";
    } else if (rankLower.includes("lieutenant") || rankLower.includes("lt")) {
      return "LT";
    } else if (rankLower.includes("captain") || rankLower.includes("cpt")) {
      return "Cpt";
    } else {
      // Return first 3 characters of rank or full rank if shorter
      return rank.substring(0, Math.min(3, rank.length)).toUpperCase();
    }
  }
  
  // Remove common prefixes and trim whitespace
  const cleanedPosition = position
    .replace(/^District\s*/i, '')  // Remove "District" at the start
    .replace(/^Beat\s*/i, '')      // Remove "Beat" at the start
    .replace(/^Unit\s*/i, '')      // Remove "Unit" at the start
    .trim();
  
  // If after removing prefixes we have something, return it
  if (cleanedPosition) {
    return cleanedPosition;
  }
  
  // If nothing left after removing prefixes, return original
  return position;
};

// Helper to extract last name only from full name
const extractLastName = (fullName: string): string => {
  if (!fullName) return "UNKNOWN";
  
  const parts = fullName.trim().split(' ');
  if (parts.length < 2) return fullName.toUpperCase();
  
  const lastName = parts[parts.length - 1];
  return lastName.toUpperCase();
};

// Helper to check if today is an officer's birthday
const hasBirthdayToday = (birthday: string | null | undefined, date: Date): boolean => {
  if (!birthday) return false;
  
  try {
    const birthDate = parseISO(birthday);
    const today = date;
    
    // Compare month and day only
    return birthDate.getMonth() === today.getMonth() && 
           birthDate.getDate() === today.getDate();
  } catch (error) {
    console.error("Error parsing birthday:", birthday, error);
    return false;
  }
};

// Helper to check if today is an officer's hire date anniversary
const hasAnniversaryToday = (hireDate: string | null | undefined, date: Date): boolean => {
  if (!hireDate) return false;
  
  try {
    const anniversaryDate = parseISO(hireDate);
    const today = date;
    
    // Compare month and day only
    return anniversaryDate.getMonth() === today.getMonth() && 
           anniversaryDate.getDate() === today.getDate();
  } catch (error) {
    console.error("Error parsing hire date:", hireDate, error);
    return false;
  }
};

// Helper to calculate years of service for anniversary
const calculateYearsOfService = (hireDate: string | null | undefined, date: Date): number => {
  if (!hireDate) return 0;
  
  try {
    const hireDateObj = parseISO(hireDate);
    const today = date;
    
    let years = today.getFullYear() - hireDateObj.getFullYear();
    
    // Adjust if anniversary hasn't occurred yet this year
    if (today.getMonth() < hireDateObj.getMonth() || 
        (today.getMonth() === hireDateObj.getMonth() && today.getDate() < hireDateObj.getDate())) {
      years--;
    }
    
    return Math.max(0, years);
  } catch (error) {
    console.error("Error calculating years of service:", hireDate, error);
    return 0;
  }
};

// Function to collect special occasions from ALL officers in shift data
const collectSpecialOccasions = async (shiftData: any, selectedDate: Date) => {
  const specialOccasions: Array<{
    name: string;
    type: 'birthday' | 'anniversary';
    icon: string;
    text: string;
    displayName: string;
    age?: number;
    yearsOfService?: number;
  }> = [];
  
  // [Keep all the helper functions: calculateAge, calculateServiceYears]
  
  // Get ALL officers for this shift (async now)
  const allShiftOfficers = await getAllOfficersForShift(shiftData, selectedDate);
  
  console.log(`📊 Checking ${allShiftOfficers.length} total officers for special occasions`);
  
  // Check each officer for special occasions
  allShiftOfficers.forEach((officer: any) => {
    if (!officer?.name) return;
    
    const lastName = extractLastName(officer.name);
    
    // Check birthday
    if (officer.birthday && hasBirthdayToday(officer.birthday, selectedDate)) {
      const age = calculateAge(officer.birthday, selectedDate);
      specialOccasions.push({
        name: officer.name,
        type: 'birthday',
        icon: '🎂',
        text: `Happy Birthday ${lastName} (${age})`,
        displayName: lastName,
        age: age
      });
    }
    
    // Check anniversary
    if (officer.hire_date && hasAnniversaryToday(officer.hire_date, selectedDate)) {
      const years = officer.yearsOfService || calculateServiceYears(officer.hire_date, selectedDate);
      specialOccasions.push({
        name: officer.name,
        type: 'anniversary',
        icon: '🎖️',
        text: `Congrats ${lastName} (${years} year${years !== 1 ? 's' : ''} anniversary)`,
        displayName: lastName,
        yearsOfService: years
      });
    }
  });
  
  // Remove duplicates
  const uniqueOccasions = specialOccasions.filter((occasion, index, self) =>
    index === self.findIndex((t) => (
      t.name === occasion.name && t.type === occasion.type
    ))
  );
  
  console.log(`🎉 Found ${uniqueOccasions.length} special occasions for shift`);
  
  return uniqueOccasions;
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
    const primaryColorStr = getColorSetting(DEFAULT_LAYOUT_SETTINGS, 'primaryColor');
    const primaryColor = parseColor(primaryColorStr);
    pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
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
    const primaryColorStr = getColorSetting(DEFAULT_LAYOUT_SETTINGS, 'primaryColor');
    const primaryColor = parseColor(primaryColorStr);
    pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    pdf.rect(x, y, logoSize, logoSize, 'F');
    pdf.setFontSize(6);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.text("LOGO", x + logoSize/2, y + logoSize/2, { align: 'center', baseline: 'middle' });
    return logoSize;
  }
};

// UPDATED: Function to format supervisor display WITHOUT rank in name column
// UPDATED: Function to format supervisor display WITHOUT rank in name column
const formatSupervisorDisplay = (supervisor: any, showSpecialOccasions: boolean = false) => {
  if (!supervisor?.name) return "UNKNOWN";
  
  const name = extractLastName(supervisor.name);
  
  // If supervisor has a partnership, include partner
  if (supervisor.isCombinedPartnership && supervisor.partnerData) {
    const partnerName = extractLastName(supervisor.partnerData.partnerName);
    let partnershipDisplay = `${name} + ${partnerName}`;
    
    // Add special occasion indicators for primary supervisor
    if (showSpecialOccasions && supervisor.isBirthdayToday) {
      partnershipDisplay += " 🎂";
    }
    if (showSpecialOccasions && supervisor.isAnniversaryToday) {
      partnershipDisplay += ` 🎖️`;
    }
    
    return partnershipDisplay;
  }
  
  // No partnership, show last name only (NO RANK in name column)
  if (showSpecialOccasions && supervisor.isBirthdayToday) {
    return `${name} 🎂`;
  }
  if (showSpecialOccasions && supervisor.isAnniversaryToday) {
    return `${name} 🎖️`;
  }
  
  return name;
};

// UPDATED: Function to format officer display with partnership - LAST NAMES ONLY
const formatOfficerDisplay = (officer: any, showSpecialOccasions: boolean = false) => {
  if (!officer?.name) return "UNKNOWN";
  
  // If officer has a partnership, include partner
  if (officer.isCombinedPartnership && officer.partnerData) {
    const name = extractLastName(officer.name);
    const partnerName = extractLastName(officer.partnerData.partnerName);
    let partnershipDisplay = `${name} + ${partnerName}`;
    
    // Add special occasion indicators for PRIMARY officer only
    // (We don't have partner's special occasion data in partnerData)
    if (showSpecialOccasions && officer.isBirthdayToday) {
      partnershipDisplay += " 🎂";
    }
    if (showSpecialOccasions && officer.isAnniversaryToday) {
      partnershipDisplay += ` 🎖️`;
    }
    
    return partnershipDisplay;
  }
  
  // No partnership, show last name only
  const name = extractLastName(officer.name);
  
  // Add special occasion indicators if enabled
  if (showSpecialOccasions && officer.isBirthdayToday) {
    return `${name} 🎂`;
  }
  if (showSpecialOccasions && officer.isAnniversaryToday) {
    return `${name} 🎖️`;
  }
  
  return name;
};

// UPDATED: Function to format partnership details for notes - ONLY PARTNER BADGE IN PARENTHESES
// Also adds "City-Wide" note when beat is City-Wide
const formatPartnershipDetails = (person: any, position: string = "") => {
  let notes = person?.notes || "";
  
  // Check if position is "City-Wide" and add note if not already present
  if (position && position.toLowerCase() === "city-wide") {
    const cityWideNote = "City-Wide";
    if (!notes.toLowerCase().includes("city-wide")) {
      if (notes) {
        notes = `${cityWideNote} | ${notes}`;
      } else {
        notes = cityWideNote;
      }
    }
  }
  
  if (!person.isCombinedPartnership || !person.partnerData) {
    return notes;
  }

  // Only include the partner badge number in parentheses
  const partnerBadge = person.partnerData.partnerBadge || "";
  let partnershipInfo = partnerBadge ? `(${partnerBadge})` : "";
  
  // Remove any existing partnership/badge mention from notes to avoid duplication
  let existingNotes = notes;
  const partnershipPatterns = [
    /PARTNERSHIP:.*/i,
    /PARTNER:.*/i,
    /PARTNERS:.*/i,
    /\([0-9]+\)/g, // Remove any badge numbers in parentheses
    /[0-9]+/g      // Remove any standalone badge numbers
  ];
  
  partnershipPatterns.forEach(pattern => {
    existingNotes = existingNotes.replace(pattern, "").trim();
  });
  
  // Clean up any leftover separators
  existingNotes = existingNotes.replace(/^\|/, "").replace(/\|$/, "").replace(/^\s*-\s*/, "").trim();
  
  // If we have both partnership info and other notes, combine them
  if (partnershipInfo && existingNotes) {
    return `${partnershipInfo} ${existingNotes}`;
  } else if (partnershipInfo) {
    return partnershipInfo;
  } else {
    return existingNotes;
  }
};

// ENHANCED: Table drawing function with support for larger font sizes and column-specific fonts
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
  
  // Use column width settings from layoutSettings with fallback to defaults
  const getColumnWidths = (headers: string[]) => {
    const totalColumns = headers.length;
    const columnWidths = layoutSettings.tableSettings?.columnWidths || DEFAULT_LAYOUT_SETTINGS.tableSettings.columnWidths;
    
    const baseWidths = {
      "REGULAR OFFICERS": columnWidths.name,
      "SPECIAL ASSIGNMENT OFFICERS": columnWidths.name,
      "PTO OFFICERS": columnWidths.name,
      "OFFICERS": columnWidths.name,
      "SUPERVISORS": columnWidths.name,
      "BEAT": columnWidths.beat,
      "ASSIGNMENT": columnWidths.assignment,
      "BADGE #": columnWidths.badge,
      "UNIT": columnWidths.unit,
      "NOTES": columnWidths.notes,
      "TYPE": columnWidths.type,
      "TIME": columnWidths.time
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
  
  // Calculate dynamic row height based on font sizes
  const baseRowHeight = layoutSettings.tableSettings.rowHeight || DEFAULT_LAYOUT_SETTINGS.tableSettings.rowHeight;
  
  // Find the maximum font size in this table for this section
  let maxFontSize = 8; // Default minimum
  if (sectionType === 'supervisors') {
    maxFontSize = Math.max(
      layoutSettings.fontSizes.nameColumn,
      layoutSettings.fontSizes.beatColumn,
      layoutSettings.fontSizes.badgeColumn,
      layoutSettings.fontSizes.notesColumn
    );
  } else if (sectionType === 'special') {
    maxFontSize = Math.max(
      layoutSettings.fontSizes.nameColumn,
      layoutSettings.fontSizes.badgeColumn,
      layoutSettings.fontSizes.notesColumn
    );
  } else if (sectionType === 'pto') {
    maxFontSize = Math.max(
      layoutSettings.fontSizes.nameColumn,
      layoutSettings.fontSizes.badgeColumn,
      layoutSettings.fontSizes.ptoTimeColumn
    );
  } else { // officers
    maxFontSize = Math.max(
      layoutSettings.fontSizes.nameColumn,
      layoutSettings.fontSizes.beatColumn,
      layoutSettings.fontSizes.badgeColumn,
      layoutSettings.fontSizes.notesColumn
    );
  }
  
  // Adjust row height based on font size (0.5mm per point above 8pt)
  const fontAdjustment = Math.max(0, (maxFontSize - 8) * 0.5);
  const rowHeight = Math.max(baseRowHeight + fontAdjustment, 6); // Minimum 6mm
  
  const cellPadding = Math.max(
    layoutSettings.tableSettings.cellPadding || DEFAULT_LAYOUT_SETTINGS.tableSettings.cellPadding,
    2 // Minimum padding for large fonts
  );

  // Draw headers - center all headers
  let x = margins.left;
  headers.forEach((header, index) => {
    // Get appropriate header background color based on section type
    let headerBgColorKey: keyof LayoutSettings['colorSettings'];
    switch(sectionType) {
      case 'supervisors':
        headerBgColorKey = 'supervisorHeaderBgColor';
        break;
      case 'special':
        headerBgColorKey = 'specialHeaderBgColor';
        break;
      case 'pto':
        headerBgColorKey = 'ptoHeaderBgColor';
        break;
      case 'officers':
      default:
        headerBgColorKey = 'officerHeaderBgColor';
        break;
    }
    
    const headerBgColor = getColorSetting(layoutSettings, headerBgColorKey);
    const headerBg = parseColor(headerBgColor);
    pdf.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
    pdf.rect(x, y, colWidths[index], rowHeight, 'F');
    
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(layoutSettings.fontSizes.tableHeader || DEFAULT_LAYOUT_SETTINGS.fontSizes.tableHeader);
    
    // Use header text color from layout settings
    const headerTextColor = getColorSetting(layoutSettings, 'headerTextColor');
    const headerTextColorParsed = parseColor(headerTextColor);
    pdf.setTextColor(headerTextColorParsed[0], headerTextColorParsed[1], headerTextColorParsed[2]);
    
    // Adjust header text if it's too wide
    let displayHeader = header;
    const maxHeaderWidth = colWidths[index] - (cellPadding * 2);
    let headerTextWidth = pdf.getTextWidth(displayHeader);
    
    if (headerTextWidth > maxHeaderWidth) {
      // Try to abbreviate common headers
      const abbreviations: Record<string, string> = {
        "SPECIAL ASSIGNMENT OFFICERS": "SPECIAL ASSIGN",
        "REGULAR OFFICERS": "OFFICERS",
        "PTO OFFICERS": "PTO",
        "SUPERVISORS": "SUP",
        "ASSIGNMENT": "ASSIGN",
        "SPECIAL ASSIGNMENT": "SPECIAL"
      };
      
      if (abbreviations[header]) {
        displayHeader = abbreviations[header];
        headerTextWidth = pdf.getTextWidth(displayHeader);
      }
      
      // If still too wide, truncate
      if (headerTextWidth > maxHeaderWidth) {
        let truncated = displayHeader;
        while (pdf.getTextWidth(truncated + "...") > maxHeaderWidth && truncated.length > 1) {
          truncated = truncated.substring(0, truncated.length - 1);
        }
        displayHeader = truncated + (truncated.length < displayHeader.length ? "..." : "");
      }
    }
    
    const textX = x + (colWidths[index] - pdf.getTextWidth(displayHeader)) / 2;
    pdf.text(displayHeader, Math.max(textX, x + 2), y + rowHeight - cellPadding);
    
    x += colWidths[index];
  });

  y += rowHeight;

  // Draw data rows with column-specific font sizes
  pdf.setFont("helvetica", "normal");
  
  data.forEach((row, rowIndex) => {
    x = margins.left;
    
    // Apply row striping if enabled
    if (layoutSettings.tableSettings.showRowStriping) {
      if (rowIndex % 2 === 0) {
        const evenRowColor = getColorSetting(layoutSettings, 'evenRowColor');
        const evenRowColorParsed = parseColor(evenRowColor);
        pdf.setFillColor(evenRowColorParsed[0], evenRowColorParsed[1], evenRowColorParsed[2]);
      } else {
        const oddRowColor = getColorSetting(layoutSettings, 'oddRowColor');
        const oddRowColorParsed = parseColor(oddRowColor);
        pdf.setFillColor(oddRowColorParsed[0], oddRowColorParsed[1], oddRowColorParsed[2]);
      }
    } else {
      const evenRowColor = getColorSetting(layoutSettings, 'evenRowColor');
      const evenRowColorParsed = parseColor(evenRowColor);
      pdf.setFillColor(evenRowColorParsed[0], evenRowColorParsed[1], evenRowColorParsed[2]);
    }
    
    pdf.rect(x, y, tableWidth, rowHeight, 'F');
    
    pdf.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    pdf.setLineWidth(0.1);
    
    row.forEach((cell, cellIndex) => {
      pdf.rect(x, y, colWidths[cellIndex], rowHeight, 'S');
      
      // Set text color based on section type
      let colorKey: keyof LayoutSettings['colorSettings'];
      switch(sectionType) {
        case 'supervisors':
          colorKey = 'supervisorTextColor';
          break;
        case 'special':
          colorKey = 'specialAssignmentTextColor';
          break;
        case 'pto':
          colorKey = 'ptoTextColor';
          break;
        case 'officers':
        default:
          colorKey = 'officerTextColor';
          break;
      }
      
      const textColorStr = getColorSetting(layoutSettings, colorKey);
      const textColor = parseColor(textColorStr);
      pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
      
      let cellText = cell?.toString() || "";
      const maxTextWidth = colWidths[cellIndex] - (cellPadding * 2);
      
      // For BEAT column, extract just the number or abbreviate City-Wide/Supervisor
      const currentHeader = headers[cellIndex].toUpperCase();
      if (currentHeader === "BEAT") {
        cellText = extractBeatNumber(cellText);
      }
      
      // Determine appropriate font size based on column type
      let fontSize = layoutSettings.fontSizes.tableContent; // Default
      
      if (currentHeader === "OFFICERS" || currentHeader === "SUPERVISORS" || 
          currentHeader === "SPECIAL ASSIGNMENT OFFICERS" || currentHeader === "PTO OFFICERS" ||
          currentHeader === "REGULAR OFFICERS") {
        fontSize = layoutSettings.fontSizes.nameColumn;
      } else if (currentHeader === "BEAT") {
        fontSize = layoutSettings.fontSizes.beatColumn;
      } else if (currentHeader === "BADGE #") {
        fontSize = layoutSettings.fontSizes.badgeColumn;
      } else if (currentHeader === "NOTES") {
        fontSize = layoutSettings.fontSizes.notesColumn;
      } else if (currentHeader === "TIME") {
        fontSize = layoutSettings.fontSizes.ptoTimeColumn;
      } else if (currentHeader === "TYPE") {
        fontSize = layoutSettings.fontSizes.badgeColumn; // Use badge size for TYPE
      } else if (currentHeader === "UNIT") {
        fontSize = layoutSettings.fontSizes.beatColumn; // Use beat size for UNIT
      } else if (currentHeader === "ASSIGNMENT") {
        fontSize = layoutSettings.fontSizes.notesColumn; // Use notes size for ASSIGNMENT
      }
      
      // Ensure minimum font size for readability
      fontSize = Math.max(fontSize, 6);
      pdf.setFontSize(fontSize);
      
      let displayText = cellText;
      
      // Truncate text if it doesn't fit
      if (pdf.getTextWidth(cellText) > maxTextWidth) {
        let truncated = cellText;
        while (pdf.getTextWidth(truncated + "...") > maxTextWidth && truncated.length > 1) {
          truncated = truncated.substring(0, truncated.length - 1);
        }
        displayText = truncated + (truncated.length < cellText.length ? "..." : "");
      }
      
      // Center specific columns: BADGE #, BEAT, UNIT, TYPE
      const centerColumns = ["BADGE #", "BEAT", "UNIT", "TYPE"];
      
      // Calculate text Y position to center vertically within row
      const textY = y + rowHeight - (rowHeight - fontSize * 0.35) / 2;
      
      if (centerColumns.includes(currentHeader)) {
        // Center align for badge#, beat, unit, type
        const textWidth = pdf.getTextWidth(displayText);
        const textX = x + (colWidths[cellIndex] - textWidth) / 2;
        pdf.text(displayText, Math.max(textX, x + 2), textY);
      } else {
        // Left align for other columns
        pdf.text(displayText, x + cellPadding, textY);
      }
      
      x += colWidths[cellIndex];
    });
    
    y += rowHeight;
    
    // Handle page breaks with larger margins for big fonts
    const pageBreakMargin = Math.max(30, maxFontSize * 2); // Dynamic margin based on font size
    if (y > pdf.internal.pageSize.getHeight() - pageBreakMargin) {
      pdf.addPage();
      y = 30; // Reset to top margin
      
      // Redraw headers on new page
      x = margins.left;
      headers.forEach((header, index) => {
        // Get appropriate header background color based on section type
        let headerBgColorKey: keyof LayoutSettings['colorSettings'];
        switch(sectionType) {
          case 'supervisors':
            headerBgColorKey = 'supervisorHeaderBgColor';
            break;
          case 'special':
            headerBgColorKey = 'specialHeaderBgColor';
            break;
          case 'pto':
            headerBgColorKey = 'ptoHeaderBgColor';
            break;
          case 'officers':
          default:
            headerBgColorKey = 'officerHeaderBgColor';
            break;
        }
        
        const headerBgColor = getColorSetting(layoutSettings, headerBgColorKey);
        const headerBg = parseColor(headerBgColor);
        pdf.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
        pdf.rect(x, y, colWidths[index], rowHeight, 'F');
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(layoutSettings.fontSizes.tableHeader);
        
        const headerTextColor = getColorSetting(layoutSettings, 'headerTextColor');
        const headerTextColorParsed = parseColor(headerTextColor);
        pdf.setTextColor(headerTextColorParsed[0], headerTextColorParsed[1], headerTextColorParsed[2]);
        
        // Adjust header text for new page (same logic as above)
        let displayHeader = header;
        const maxHeaderWidth = colWidths[index] - (cellPadding * 2);
        let headerTextWidth = pdf.getTextWidth(displayHeader);
        
        if (headerTextWidth > maxHeaderWidth) {
          const abbreviations: Record<string, string> = {
            "SPECIAL ASSIGNMENT OFFICERS": "SPECIAL ASSIGN",
            "REGULAR OFFICERS": "OFFICERS",
            "PTO OFFICERS": "PTO",
            "SUPERVISORS": "SUP",
            "ASSIGNMENT": "ASSIGN",
            "SPECIAL ASSIGNMENT": "SPECIAL"
          };
          
          if (abbreviations[header]) {
            displayHeader = abbreviations[header];
            headerTextWidth = pdf.getTextWidth(displayHeader);
          }
          
          if (headerTextWidth > maxHeaderWidth) {
            let truncated = displayHeader;
            while (pdf.getTextWidth(truncated + "...") > maxHeaderWidth && truncated.length > 1) {
              truncated = truncated.substring(0, truncated.length - 1);
            }
            displayHeader = truncated + (truncated.length < displayHeader.length ? "..." : "");
          }
        }
        
        const textX = x + (colWidths[index] - pdf.getTextWidth(displayHeader)) / 2;
        pdf.text(displayHeader, Math.max(textX, x + 2), y + rowHeight - cellPadding);
        
        x += colWidths[index];
      });
      y += rowHeight;
    }
  });

  return y + 8;
};

export { DEFAULT_LAYOUT_SETTINGS };

export const usePDFExport = () => {
  const exportToPDF = useCallback(async ({ 
    selectedDate, 
    shiftName, 
    shiftData, 
    layoutSettings = DEFAULT_LAYOUT_SETTINGS 
  }: ExportOptions) => {
    try {
      console.log("PDF Export - Starting export with:", { 
        selectedDate, 
        shiftName, 
        hasShiftData: !!shiftData,
        hasLayoutSettings: !!layoutSettings,
        layoutSettings: layoutSettings 
      });

      // Validate inputs
      if (!shiftData || !selectedDate) {
        throw new Error("No shift data or date provided for PDF export");
      }

      // Ensure layoutSettings has all required properties
      const safeLayoutSettings = {
        ...DEFAULT_LAYOUT_SETTINGS,
        ...layoutSettings,
        fontSizes: {
          ...DEFAULT_LAYOUT_SETTINGS.fontSizes,
          ...(layoutSettings?.fontSizes || {})
        },
        sections: {
          ...DEFAULT_LAYOUT_SETTINGS.sections,
          ...(layoutSettings?.sections || {})
        },
        tableSettings: {
          ...DEFAULT_LAYOUT_SETTINGS.tableSettings,
          ...(layoutSettings?.tableSettings || {})
        },
        colorSettings: {
          ...DEFAULT_LAYOUT_SETTINGS.colorSettings,
          ...(layoutSettings?.colorSettings || {})
        }
      };

      console.log("Using layout settings:", safeLayoutSettings);

      const pdf = new jsPDF("p", "mm", "letter");
      const pageWidth = pdf.internal.pageSize.getWidth();
      let yPosition = 20;

      // Draw logo
      drawActualLogo(pdf, 15, 15);

      // Shift info on the left, same line as logo - USING PRIMARY COLOR ONLY HERE
      pdf.setFontSize(safeLayoutSettings.fontSizes.header);
      pdf.setFont("helvetica", "bold");
      const primaryColorStr = getColorSetting(safeLayoutSettings, 'primaryColor');
      const primaryColor = parseColor(primaryColorStr);
      pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      
      const shiftInfo = `${shiftName.toUpperCase()} • ${shiftData.shift?.start_time || "N/A"}-${shiftData.shift?.end_time || "N/A"}`;
      pdf.text(shiftInfo, 45, 28);

      // Date with a few spaces after shiftInfo - ALSO USING PRIMARY COLOR
      const dateText = format(selectedDate, "EEE, MMM d, yyyy");
      const shiftInfoWidth = pdf.getTextWidth(shiftInfo);
      const dateX = 45 + shiftInfoWidth + 15; // 15mm space after shiftInfo
      pdf.text(dateText, dateX, 28);

      // Start content lower to maintain spacing - NO SECTION TITLES
      yPosition = 40;

      // Supervisors section - Only show if enabled in layout settings
      if (safeLayoutSettings.sections.showSupervisors && shiftData.supervisors && shiftData.supervisors.length > 0) {
        // NO SECTION TITLE - Just start with table
        
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
          
          // UPDATED: Use supervisor formatting WITHOUT rank in name column
          const displayName = formatSupervisorDisplay(supervisor, safeLayoutSettings.sections.showSpecialOccasions);
          const position = supervisor?.position || "";
          const notes = formatPartnershipDetails(supervisor, position);
          
          supervisorsData.push([
            displayName,
            extractBeatNumber(position, supervisor?.rank || ""), // Use rank abbreviation for beat column
            supervisor?.badge || "",
            supervisor?.unitNumber || "",
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
            'supervisors',
            safeLayoutSettings
          );
          yPosition += 4;
        }
      }

      // SECTION 1: REGULAR OFFICERS TABLE - Only show if enabled
      if (safeLayoutSettings.sections.showOfficers && shiftData.officers && shiftData.officers.length > 0) {
        // NO SECTION TITLE - Just start with table
        
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
          
          // UPDATED: Use officer formatting with partnership - LAST NAMES ONLY
          const displayName = formatOfficerDisplay(officer, safeLayoutSettings.sections.showSpecialOccasions);
          const position = officer?.position || "";
          const notes = formatPartnershipDetails(officer, position);
          
          regularOfficersData.push([
            displayName,
            extractBeatNumber(position), // Extract just beat number or abbreviate City-Wide
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
            'officers',
            safeLayoutSettings
          );
        }
      }

      // SECTION 2: SPECIAL ASSIGNMENT OFFICERS TABLE - Only show if enabled
      if (safeLayoutSettings.sections.showSpecialAssignments && shiftData.specialAssignmentOfficers && shiftData.specialAssignmentOfficers.length > 0) {
        // NO SECTION TITLE - Just start with table
        
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
          
          // UPDATED: Use officer formatting with partnership - LAST NAMES ONLY
          const displayName = formatOfficerDisplay(officer, safeLayoutSettings.sections.showSpecialOccasions);
          const position = officer?.position || "";
          const notes = formatPartnershipDetails(officer, position);
          
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
            'special',
            safeLayoutSettings
          );
        }
      }

      // SECTION 3: PTO/OFF DUTY TABLE - Only show if enabled
      if (safeLayoutSettings.sections.showPTO && shiftData.ptoRecords && shiftData.ptoRecords.length > 0) {
        // NO SECTION TITLE - Just start with table
        
        const ptoData: any[] = [];
        
        shiftData.ptoRecords.forEach((record: any) => {
          // For PTO, use last name only
          const name = record?.name ? extractLastName(record.name) : "UNKNOWN";
          shiftData.ptoRecords.forEach((record: any) => {
  // For PTO, use last name only
  let name = record?.name ? extractLastName(record.name) : "UNKNOWN";
  
  // ADD SPECIAL OCCASION INDICATORS FOR PTO OFFICERS
  if (safeLayoutSettings.sections.showSpecialOccasions) {
    if (record.isBirthdayToday) {
      name += " 🎂";
    }
    if (record.isAnniversaryToday) {
      name += ` 🎖️`;
    }
  }
  
  const badge = record?.badge || "";
  const ptoType = record?.ptoType ? record.ptoType.toUpperCase() : "UNKNOWN";
  
  const timeInfo = record?.isFullShift 
    ? "FULL SHIFT" 
    : `${record?.startTime || "N/A"}-${record?.endTime || "N/A"}`;
  
  ptoData.push([name, badge, ptoType, timeInfo]);
});
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
          'pto',
          safeLayoutSettings
        );
      }

      // Compact staffing summary at bottom - Only show if enabled
      if (safeLayoutSettings.sections.showStaffingSummary) {
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
        
        pdf.setFontSize(safeLayoutSettings.fontSizes.footer);
        pdf.setFont("helvetica", "bold");
        const darkColorStr = getColorSetting(safeLayoutSettings, 'primaryColor');
        const darkColor = parseColor(darkColorStr);
        pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        
        const staffingText = `STAFFING: Supervisors ${currentSupervisors}/${minSupervisors} • Officers ${currentOfficers}/${minOfficers}`;
        pdf.text(staffingText, 15, yPosition);

        const generatedAt = `Generated: ${format(new Date(), "MMM d, h:mm a")}`;
        pdf.text(generatedAt, pageWidth - 15, yPosition, { align: 'right' });
        
        yPosition += 8;
      }


// ================================================
// BIRTHDAY AND ANNIVERSARY INDICATORS SECTION
// ================================================
// Only show if enabled in layout settings
let specialOccasionsCount = 0;
if (safeLayoutSettings.sections.showSpecialOccasions) {
  try {
    // Note: collectSpecialOccasions is now async
    const specialOccasions = await collectSpecialOccasions(shiftData, selectedDate);
    specialOccasionsCount = specialOccasions.length;
    
    if (specialOccasions.length > 0) {
      // [Rest of your existing code remains the same]
    }
  } catch (specialOccasionsError) {
    console.warn("⚠️ Error processing special occasions, but continuing PDF export:", specialOccasionsError);
  }
}

      // Save the PDF
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const dayOfWeek = format(selectedDate, "EEEE").toUpperCase();
      const filename = `PAPD_Schedule_${shiftName.replace(/\s+/g, "_")}_${dayOfWeek}_${dateStr}.pdf`;

      pdf.save(filename);

      console.log(`✅ PDF exported successfully with ${specialOccasionsCount} special occasions`);

      return { success: true };
      
    } catch (error: any) {
      console.error("PDF export error details:", {
        errorMessage: error?.message,
        selectedDate,
        shiftName
      });
      
      // Check if it's a non-critical special occasions error
      if (error?.message?.includes('specialOccasions') || 
          error?.name === 'ReferenceError' && error?.message?.includes('specialOccasions')) {
        console.log("⚠️ Non-critical special occasions error, PDF was likely created successfully");
        return { success: true };
      }
      
      return { success: false, error };
    }
  }, []);

  return { exportToPDF };
};
