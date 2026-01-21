// src/constants/pdfLayoutSettings.ts
export interface LayoutSettings {
  fontSizes: {
    header: number;
    sectionTitle: number;
    tableHeader: number;
    tableContent: number;
    footer: number;
    // NEW: Column-specific font sizes for better control
    nameColumn: number;
    beatColumn: number;
    badgeColumn: number;
    notesColumn: number;
    ptoTimeColumn: number;
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
    // NEW: Column width adjustments
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
  };
}

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  fontSizes: {
    header: 12, // Increased default
    sectionTitle: 10, // Increased default
    tableHeader: 9, // Increased default
    tableContent: 9, // Increased default
    footer: 9, // Increased default
    nameColumn: 9, // Increased default
    beatColumn: 9, // Increased default
    badgeColumn: 9, // Increased default
    notesColumn: 9, // Increased default
    ptoTimeColumn: 9 // Increased default
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
    compactMode: false,
    columnWidths: {
      name: 0.35,
      beat: 0.08,
      badge: 0.10,
      unit: 0.10,
      notes: 0.35,
      assignment: 0.22,
      type: 0.15,
      time: 0.35
    }
  },
  colorSettings: {
    supervisorHeaderBgColor: "41,128,185",
    officerHeaderBgColor: "52,152,219",
    specialHeaderBgColor: "155,89,182",
    ptoHeaderBgColor: "243,156,18",
    headerTextColor: "255,255,255",
    officerTextColor: "44,62,80",
    supervisorTextColor: "44,62,80",
    specialAssignmentTextColor: "102,51,153",
    ptoTextColor: "139,0,0",
    evenRowColor: "255,255,255",
    oddRowColor: "248,249,250",
    primaryColor: "41,128,185",
    secondaryColor: "52,152,219",
    accentColor: "155,89,182"
  }
};

// NEW: Updated font size presets with MUCH larger sizes
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
    header: 12,
    sectionTitle: 10,
    tableHeader: 9,
    tableContent: 9,
    footer: 9,
    nameColumn: 9,
    beatColumn: 9,
    badgeColumn: 9,
    notesColumn: 9,
    ptoTimeColumn: 9
  },
  large: {
    header: 14,
    sectionTitle: 12,
    tableHeader: 10,
    tableContent: 10,
    footer: 10,
    nameColumn: 10,
    beatColumn: 10,
    badgeColumn: 10,
    notesColumn: 10,
    ptoTimeColumn: 10
  },
  extraLarge: {
    header: 16,
    sectionTitle: 13,
    tableHeader: 11,
    tableContent: 11,
    footer: 11,
    nameColumn: 11,
    beatColumn: 11,
    badgeColumn: 11,
    notesColumn: 11,
    ptoTimeColumn: 11
  },
  accessibility: {
    header: 18,
    sectionTitle: 14,
    tableHeader: 12,
    tableContent: 12,
    footer: 12,
    nameColumn: 12,
    beatColumn: 12,
    badgeColumn: 12,
    notesColumn: 12,
    ptoTimeColumn: 12
  },
  // NEW: Extra large preset for maximum readability
  extraAccessibility: {
    header: 20,
    sectionTitle: 16,
    tableHeader: 14,
    tableContent: 14,
    footer: 14,
    nameColumn: 14,
    beatColumn: 14,
    badgeColumn: 14,
    notesColumn: 14,
    ptoTimeColumn: 14
  },
  // NEW: Giant preset for printed copies
  giant: {
    header: 22,
    sectionTitle: 18,
    tableHeader: 16,
    tableContent: 16,
    footer: 16,
    nameColumn: 16,
    beatColumn: 16,
    badgeColumn: 16,
    notesColumn: 16,
    ptoTimeColumn: 16
  }
};

// NEW: Updated font size ranges for validation - MUCH larger maximums
export const FONT_SIZE_RANGES = {
  header: { min: 8, max: 24, step: 0.5 },
  sectionTitle: { min: 8, max: 20, step: 0.5 },
  tableHeader: { min: 8, max: 18, step: 0.5 },
  tableContent: { min: 8, max: 18, step: 0.5 },
  footer: { min: 8, max: 16, step: 0.5 },
  nameColumn: { min: 8, max: 18, step: 0.5 },
  beatColumn: { min: 8, max: 18, step: 0.5 },
  badgeColumn: { min: 8, max: 18, step: 0.5 },
  notesColumn: { min: 8, max: 18, step: 0.5 },
  ptoTimeColumn: { min: 8, max: 18, step: 0.5 }
};
