// src/constants/pdfLayoutSettings.ts
export const DEFAULT_LAYOUT_SETTINGS = {
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
    // Header Colors - Each section has different background
    supervisorHeaderBgColor: "41,128,185",
    officerHeaderBgColor: "52,152,219",
    specialHeaderBgColor: "155,89,182",
    ptoHeaderBgColor: "243,156,18",
    headerTextColor: "255,255,255",
    
    // Table Content Colors
    officerTextColor: "44,62,80",
    supervisorTextColor: "44,62,80",
    specialAssignmentTextColor: "102,51,153",
    ptoTextColor: "139,0,0",
    
    // Row Colors
    evenRowColor: "255,255,255",
    oddRowColor: "248,249,250",
    
    // Accent Colors (top header only)
    primaryColor: "41,128,185",
    secondaryColor: "52,152,219",
    accentColor: "155,89,182"
  }
};
