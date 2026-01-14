// src/constants/pdfLayoutSettings.ts
export interface LayoutSettings {
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
