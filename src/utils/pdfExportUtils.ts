// src/utils/pdfExportUtils.ts
import { format, startOfWeek, addDays, addWeeks, parseISO, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, eachMonthOfInterval, isValid } from "date-fns";
import { getLastName } from "@/utils/scheduleUtils";
import { RANK_ORDER, PREDEFINED_POSITIONS } from "@/constants/positions";

// Default fallback colors
const FALLBACK_COLORS = {
  supervisorPTO: { bg: [255, 255, 200] as [number, number, number], border: [255, 220, 100], text: [139, 69, 19] },
  officerPTO: { bg: [240, 255, 240] as [number, number, number], border: [144, 238, 144], text: [0, 100, 0] },
  sickTime: { bg: [255, 200, 200] as [number, number, number], border: [255, 100, 100], text: [139, 0, 0] },
  offDay: { bg: [220, 220, 220] as [number, number, number], text: [100, 100, 100] }
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
    }
  };
};

export const exportWeeklyPDF = async (options: WeeklyExportOptions) => {
  const { startDate, endDate, shiftName, scheduleData, minimumStaffing, selectedShiftId, colorSettings } = options;
  
  try {
    const { default: jsPDF } = await import("jspdf");
    const pdfColors = processColorSettings(colorSettings);

    const pdf = new jsPDF("portrait", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // ... Include your existing weekly PDF rendering logic here
    // (Copy the entire renderWeeklyView function from useWeeklyPDFExport.ts)

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

    // ... Include your existing monthly PDF rendering logic here
    // (Copy the entire exportMonthlyPDF function from useMonthlyPDFExport.ts)

    const filename = `Monthly_PTO_Schedule_${shiftName.replace(/\s+/g, "_")}_${format(actualStartDate, "yyyy-MM")}_to_${format(actualEndDate, "yyyy-MM")}.pdf`;
    pdf.save(filename);

    return { success: true };
  } catch (error) {
    console.error("Monthly PDF export error:", error);
    return { success: false, error };
  }
};
