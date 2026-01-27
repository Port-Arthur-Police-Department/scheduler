// src/constants/pdfLayoutSettings.ts
export interface LayoutSettings {
  pageSize?: string;
  sections: {
    showSupervisors: boolean;
    showOfficers: boolean;
    showSpecialAssignments: boolean;
    showPTO: boolean;
    showStaffingSummary: boolean;
    showLogoSection: boolean;
    showSpecialOccasions: booolean,
  };
  fontSizes: {
    header: number;
    sectionTitle: number;
    tableHeader: number;
    tableContent: number;
    footer: number;
    nameColumn: number;
    beatColumn: number;
    badgeColumn: number;
    notesColumn: number;
    ptoTimeColumn: number;
  };
  columnOrder: {
    supervisors: string;
    officers: string;
  };
  tableSettings: {
    rowHeight: number;
    cellPadding: number;
    showRowStriping: boolean;
    compactMode: boolean;
    borderWidth: number;
    columnSpacing: number;
    showVerticalLines: boolean;
    columnWidths: {
      name: number;
      beat: number;
      badge: number;
      unit: number;
      notes: number;
      assignment: number;
      type: number;
      time: number;
    };
  };
  colorSettings: {
    supervisorHeaderBgColor: string;
    officerHeaderBgColor: string;
    specialHeaderBgColor: string;
    ptoHeaderBgColor: string;
    headerTextColor: string;
    officerTextColor: string;
    supervisorTextColor: string;
    specialAssignmentTextColor: string;
    ptoTextColor: string;
    evenRowColor: string;
    oddRowColor: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    headerBgColor?: string;
  };
  pageSettings?: {
    pageMargins: string;
    pageSize: string;
    showPageNumbers: boolean;
    compressPDF: boolean;
  };
}

// UPDATED WITH YOUR CURRENT SETTINGS AS NEW DEFAULTS
export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  pageSize: "LETTER",
  sections: {
    showSupervisors: true,
    showOfficers: true,
    showSpecialAssignments: true,
    showPTO: true,
    showStaffingSummary: false, // Your setting is false
    showLogoSection: true,
    showSpecialOccasions: true
  },
  fontSizes: {
    header: 12, // Your setting
    sectionTitle: 12, // Your setting
    tableHeader: 9, // Your setting
    tableContent: 9, // Your setting
    footer: 10, // Your setting is 10, not 9
    nameColumn: 12.5, // Your setting
    beatColumn: 12.5, // Your setting
    badgeColumn: 12.5, // Your setting
    notesColumn: 12.5, // Your setting
    ptoTimeColumn: 10 // Your setting
  },
  columnOrder: {
    supervisors: "name-badge-position-unit", // Your setting
    officers: "name-badge-beat-unit" // Your setting
  },
  tableSettings: {
    rowHeight: 6, // Your setting
    cellPadding: 3, // Your setting
    showRowStriping: true, // Your setting
    compactMode: true, // Your setting
    borderWidth: 1, // Your setting
    columnSpacing: 1, // Your setting
    showVerticalLines: true, // Your setting
    columnWidths: {
      name: 0.35, // Your setting
      beat: 0.08, // Your setting
      badge: 0.1, // Your setting (0.10)
      unit: 0.1, // Your setting (0.10)
      notes: 0.35, // Your setting
      assignment: 0.22, // Your setting
      type: 0.15, // Your setting
      time: 0.35 // Your setting
    }
  },
  colorSettings: {
    supervisorHeaderBgColor: "41,128,185", // Your setting
    officerHeaderBgColor: "52,152,219", // Your setting
    specialHeaderBgColor: "155,89,182", // Your setting
    ptoHeaderBgColor: "243,156,18", // Your setting
    headerTextColor: "255,255,255", // Your setting
    officerTextColor: "0,0,0", // Your setting (from colorSettings.officerTextColor)
    supervisorTextColor: "0,0,0", // Your setting (from colorSettings.supervisorTextColor)
    specialAssignmentTextColor: "0,0,0", // Your setting (from colorSettings.specialAssignmentTextColor)
    ptoTextColor: "0,0,0", // Your setting (from colorSettings.ptoTextColor)
    evenRowColor: "255,255,255", // Your setting
    oddRowColor: "248,249,250", // Your setting (mapped from #f8f9fa)
    primaryColor: "#2980b9", // Your setting
    secondaryColor: "#3498db", // Your setting
    accentColor: "#9b59b6", // Your setting
    headerBgColor: "#2980b9" // Your setting
  },
  pageSettings: {
    pageMargins: "20,20,20,20", // Standard default
    pageSize: "LETTER", // Your setting
    showPageNumbers: true, // Standard default
    compressPDF: false // Standard default
  }
};

// Updated font size presets with your settings as the "medium" preset
export const FONT_SIZE_PRESETS = {
  small: {
    header: 10,
    sectionTitle: 9,
    tableHeader: 8,
    tableContent: 8,
    footer: 8,
    nameColumn: 8,
    beatColumn: 8,
    badgeColumn: 8,
    notesColumn: 8,
    ptoTimeColumn: 8
  },
  medium: {
    // YOUR CURRENT SETTINGS as the medium preset
    header: 12,
    sectionTitle: 12,
    tableHeader: 9,
    tableContent: 9,
    footer: 10,
    nameColumn: 12.5,
    beatColumn: 12.5,
    badgeColumn: 12.5,
    notesColumn: 12.5,
    ptoTimeColumn: 10
  },
  large: {
    header: 14,
    sectionTitle: 13,
    tableHeader: 10,
    tableContent: 10,
    footer: 11,
    nameColumn: 14,
    beatColumn: 14,
    badgeColumn: 14,
    notesColumn: 14,
    ptoTimeColumn: 12
  },
  extraLarge: {
    header: 16,
    sectionTitle: 14,
    tableHeader: 11,
    tableContent: 11,
    footer: 12,
    nameColumn: 15,
    beatColumn: 15,
    badgeColumn: 15,
    notesColumn: 15,
    ptoTimeColumn: 13
  },
  accessibility: {
    header: 18,
    sectionTitle: 16,
    tableHeader: 12,
    tableContent: 12,
    footer: 13,
    nameColumn: 16,
    beatColumn: 16,
    badgeColumn: 16,
    notesColumn: 16,
    ptoTimeColumn: 14
  },
  extraAccessibility: {
    header: 20,
    sectionTitle: 18,
    tableHeader: 14,
    tableContent: 14,
    footer: 14,
    nameColumn: 18,
    beatColumn: 18,
    badgeColumn: 18,
    notesColumn: 18,
    ptoTimeColumn: 16
  },
  giant: {
    header: 22,
    sectionTitle: 20,
    tableHeader: 16,
    tableContent: 16,
    footer: 16,
    nameColumn: 20,
    beatColumn: 20,
    badgeColumn: 20,
    notesColumn: 20,
    ptoTimeColumn: 18
  }
};

// Updated font size ranges to accommodate your larger font sizes
export const FONT_SIZE_RANGES = {
  header: { min: 8, max: 24, step: 0.5 },
  sectionTitle: { min: 8, max: 22, step: 0.5 },
  tableHeader: { min: 8, max: 18, step: 0.5 },
  tableContent: { min: 8, max: 18, step: 0.5 },
  footer: { min: 8, max: 18, step: 0.5 },
  nameColumn: { min: 8, max: 22, step: 0.5 }, // Increased max for your 12.5 setting
  beatColumn: { min: 8, max: 22, step: 0.5 }, // Increased max for your 12.5 setting
  badgeColumn: { min: 8, max: 22, step: 0.5 }, // Increased max for your 12.5 setting
  notesColumn: { min: 8, max: 22, step: 0.5 }, // Increased max for your 12.5 setting
  ptoTimeColumn: { min: 8, max: 20, step: 0.5 } // Increased max
};
