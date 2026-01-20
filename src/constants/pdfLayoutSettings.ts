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
    header: 10,
    sectionTitle: 9,
    tableHeader: 7,
    tableContent: 7,
    footer: 7,
    // NEW: Default column font sizes (same as tableContent for consistency)
    nameColumn: 7,
    beatColumn: 7,
    badgeColumn: 7,
    notesColumn: 7,
    ptoTimeColumn: 7
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
    // NEW: Column width percentages
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

// NEW: Font size presets for quick selection
export const FONT_SIZE_PRESETS = {
  small: {
    header: 8,
    sectionTitle: 7,
    tableHeader: 6,
    tableContent: 6,
    footer: 6,
    nameColumn: 6,
    beatColumn: 6,
    badgeColumn: 6,
    notesColumn: 6,
    ptoTimeColumn: 6
  },
  medium: {
    header: 10,
    sectionTitle: 9,
    tableHeader: 7,
    tableContent: 7,
    footer: 7,
    nameColumn: 7,
    beatColumn: 7,
    badgeColumn: 7,
    notesColumn: 7,
    ptoTimeColumn: 7
  },
  large: {
    header: 12,
    sectionTitle: 10,
    tableHeader: 8,
    tableContent: 8,
    footer: 8,
    nameColumn: 8,
    beatColumn: 8,
    badgeColumn: 8,
    notesColumn: 8,
    ptoTimeColumn: 8
  },
  extraLarge: {
    header: 14,
    sectionTitle: 11,
    tableHeader: 9,
    tableContent: 9,
    footer: 9,
    nameColumn: 9,
    beatColumn: 9,
    badgeColumn: 9,
    notesColumn: 9,
    ptoTimeColumn: 9
  },
  accessibility: {
    header: 16,
    sectionTitle: 12,
    tableHeader: 10,
    tableContent: 10,
    footer: 10,
    nameColumn: 10,
    beatColumn: 10,
    badgeColumn: 10,
    notesColumn: 10,
    ptoTimeColumn: 10
  }
};

// NEW: Font size ranges for validation
export const FONT_SIZE_RANGES = {
  header: { min: 8, max: 20, step: 0.5 },
  sectionTitle: { min: 8, max: 16, step: 0.5 },
  tableHeader: { min: 6, max: 14, step: 0.5 },
  tableContent: { min: 6, max: 14, step: 0.5 },
  footer: { min: 6, max: 12, step: 0.5 },
  nameColumn: { min: 6, max: 14, step: 0.5 },
  beatColumn: { min: 6, max: 14, step: 0.5 },
  badgeColumn: { min: 6, max: 14, step: 0.5 },
  notesColumn: { min: 6, max: 14, step: 0.5 },
  ptoTimeColumn: { min: 6, max: 14, step: 0.5 }
};
