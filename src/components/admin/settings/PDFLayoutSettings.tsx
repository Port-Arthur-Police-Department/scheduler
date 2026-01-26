// src/components/admin/settings/PDFPreviewDialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { usePDFExport } from "@/hooks/usePDFExport";
import { DEFAULT_LAYOUT_SETTINGS } from "@/constants/pdfLayoutSettings";
import { useEffect, useState } from "react";

interface PDFPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewData: any;
  layoutSettings: any;
  selectedDate: Date;
}

// Helper function to parse color string to RGB array
const parseColorForPreview = (colorString: string | undefined): number[] => {
  if (!colorString) return [44, 62, 80];
  
  if (colorString.includes(',')) {
    const parts = colorString.split(',').map(num => parseInt(num.trim(), 10));
    if (parts.length === 3 && parts.every(num => !isNaN(num))) {
      return parts;
    }
  }
  
  return [44, 62, 80]; // Default dark gray
};

// Helper to get the right header color for each section
const getHeaderColorForSection = (layoutSettings: any, sectionType: string): number[] => {
  if (!layoutSettings?.colorSettings) return parseColorForPreview(DEFAULT_LAYOUT_SETTINGS.colorSettings.primaryColor);
  
  switch(sectionType) {
    case 'supervisors':
      return parseColorForPreview(layoutSettings.colorSettings.supervisorHeaderBgColor || DEFAULT_LAYOUT_SETTINGS.colorSettings.supervisorHeaderBgColor);
    case 'officers':
      return parseColorForPreview(layoutSettings.colorSettings.officerHeaderBgColor || DEFAULT_LAYOUT_SETTINGS.colorSettings.officerHeaderBgColor);
    case 'special':
      return parseColorForPreview(layoutSettings.colorSettings.specialHeaderBgColor || DEFAULT_LAYOUT_SETTINGS.colorSettings.specialHeaderBgColor);
    case 'pto':
      return parseColorForPreview(layoutSettings.colorSettings.ptoHeaderBgColor || DEFAULT_LAYOUT_SETTINGS.colorSettings.ptoHeaderBgColor);
    default:
      return parseColorForPreview(layoutSettings.colorSettings.primaryColor || DEFAULT_LAYOUT_SETTINGS.colorSettings.primaryColor);
  }
};

// Helper to safely extract data from previewData
const getSectionData = (previewData: any, sectionKey: string): any[] => {
  if (!previewData) return [];
  
  // Try different possible data structures
  const data = previewData[sectionKey] || 
               previewData[sectionKey.toLowerCase()] || 
               previewData[`${sectionKey}Data`] || 
               [];
  
  return Array.isArray(data) ? data : [];
};

// Helper to get officer name safely
const getOfficerName = (officer: any): string => {
  if (!officer) return "Unknown Officer";
  
  return officer.name || 
         officer.fullName || 
         officer.officerName || 
         `${officer.firstName || ''} ${officer.lastName || ''}`.trim() || 
         "Unknown Officer";
};

export const PDFPreviewDialog = ({ 
  open, 
  onOpenChange, 
  previewData, 
  layoutSettings = DEFAULT_LAYOUT_SETTINGS, 
  selectedDate 
}: PDFPreviewDialogProps) => {
  const { exportToPDF } = usePDFExport();
  const [processedData, setProcessedData] = useState<any>(null);

  useEffect(() => {
    if (previewData) {
      console.log("Preview Data Structure:", previewData); // Debug log
      processPreviewData();
    }
  }, [previewData]);

  const processPreviewData = () => {
    if (!previewData) {
      setProcessedData(null);
      return;
    }

    const processed = {
      shift: previewData.shift || {
        name: "Shift Name",
        start_time: "00:00",
        end_time: "23:59"
      },
      
      // Extract supervisors with fallback
      supervisors: getSectionData(previewData, 'supervisors').map((supervisor: any) => ({
        name: getOfficerName(supervisor),
        position: supervisor.position || supervisor.rank || "Supervisor",
        badge: supervisor.badge || supervisor.badgeNumber || supervisor.id || "",
        unitNumber: supervisor.unitNumber || supervisor.unit || supervisor.carNumber || "",
        // Additional fields that might exist
        ...supervisor
      })),
      
      // Extract officers with fallback
      officers: getSectionData(previewData, 'officers').map((officer: any) => ({
        name: getOfficerName(officer),
        position: officer.position || officer.assignment || officer.beat || "",
        badge: officer.badge || officer.badgeNumber || officer.id || "",
        unitNumber: officer.unitNumber || officer.unit || officer.carNumber || "",
        // Additional fields that might exist
        ...officer
      })),
      
      // Extract special assignments
      specialAssignmentOfficers: getSectionData(previewData, 'specialAssignmentOfficers').map((officer: any) => ({
        name: getOfficerName(officer),
        position: officer.position || officer.assignment || officer.specialAssignment || "Special Assignment",
        badge: officer.badge || officer.badgeNumber || officer.id || "",
        unitNumber: officer.unitNumber || officer.unit || officer.carNumber || "",
        // Additional fields that might exist
        ...officer
      })),
      
      // Extract PTO records
      ptoRecords: getSectionData(previewData, 'ptoRecords').map((record: any) => ({
        name: getOfficerName(record),
        badge: record.badge || record.badgeNumber || record.id || "",
        ptoType: record.ptoType || record.type || record.absenceType || "PTO",
        startTime: record.startTime || record.start || "00:00",
        endTime: record.endTime || record.end || "23:59",
        // Additional fields that might exist
        ...record
      })),
      
      // Staffing counts with fallbacks
      currentSupervisors: previewData.currentSupervisors || 
                         previewData.supervisorCount || 
                         getSectionData(previewData, 'supervisors').length || 
                         0,
      minSupervisors: previewData.minSupervisors || previewData.requiredSupervisors || 0,
      currentOfficers: previewData.currentOfficers || 
                      previewData.officerCount || 
                      getSectionData(previewData, 'officers').length || 
                      0,
      minOfficers: previewData.minOfficers || previewData.requiredOfficers || 0
    };

    console.log("Processed Preview Data:", processed); // Debug log
    setProcessedData(processed);
  };

  const handleExportPreview = async () => {
    if (!previewData) return;
    
    await exportToPDF({
      selectedDate,
      shiftName: previewData.shift?.name || "Shift",
      shiftData: previewData,
      layoutSettings
    });
  };

  // Safely get layout settings with defaults
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

  const primaryColor = parseColorForPreview(safeLayoutSettings.colorSettings.primaryColor);
  const headerTextColor = parseColorForPreview(safeLayoutSettings.colorSettings.headerTextColor);
  const officerTextColor = parseColorForPreview(safeLayoutSettings.colorSettings.officerTextColor);
  const supervisorTextColor = parseColorForPreview(safeLayoutSettings.colorSettings.supervisorTextColor);
  const specialTextColor = parseColorForPreview(safeLayoutSettings.colorSettings.specialAssignmentTextColor);
  const ptoTextColor = parseColorForPreview(safeLayoutSettings.colorSettings.ptoTextColor);
  const evenRowColor = parseColorForPreview(safeLayoutSettings.colorSettings.evenRowColor);
  const oddRowColor = parseColorForPreview(safeLayoutSettings.colorSettings.oddRowColor);

  // If no data is loaded yet, show loading state
  if (!processedData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>PDF Layout Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-4 text-gray-500">Loading preview data...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>PDF Layout Preview</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto border rounded-md p-4 bg-gray-50">
          {/* Preview content that mimics PDF layout */}
          <div className="bg-white p-6 shadow-lg" style={{ 
            minHeight: '842px', 
            width: '595px', 
            margin: '0 auto',
            fontFamily: 'Helvetica, Arial, sans-serif'
          }}>
            {/* Header */}
            <div className="flex items-start mb-6">
              <div 
                className="w-16 h-16 flex items-center justify-center text-white font-bold text-xs"
                style={{ 
                  backgroundColor: `rgb(${primaryColor.join(',')})`,
                  borderRadius: '2px'
                }}
              >
                LOGO
              </div>
              <div className="ml-4">
                <div style={{ 
                  fontSize: `${safeLayoutSettings.fontSizes.header}pt`,
                  fontWeight: 'bold',
                  color: `rgb(${primaryColor.join(',')})`,
                  marginBottom: '2px'
                }}>
                  {processedData.shift.name} • {processedData.shift.start_time}-{processedData.shift.end_time}
                </div>
                <div style={{
                  fontSize: `${safeLayoutSettings.fontSizes.header}pt`,
                  color: `rgb(${primaryColor.join(',')})`
                }}>
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
              </div>
            </div>

            {/* Supervisors Section */}
            {safeLayoutSettings.sections.showSupervisors && processedData.supervisors.length > 0 && (
              <div className="mb-8">
                <div className="border rounded overflow-hidden" style={{ borderColor: '#dee2e6' }}>
                  {/* Table Header */}
                  <div style={{
                    backgroundColor: `rgb(${getHeaderColorForSection(safeLayoutSettings, 'supervisors').join(',')})`,
                    color: `rgb(${headerTextColor.join(',')})`,
                    fontSize: `${safeLayoutSettings.fontSizes.tableHeader}pt`,
                    padding: `${safeLayoutSettings.tableSettings.cellPadding}px`,
                    display: 'grid',
                    gridTemplateColumns: '35% 8% 15% 10% 32%',
                    fontWeight: 'bold'
                  }}>
                    <div>SUPERVISORS</div>
                    <div style={{ textAlign: 'center' }}>BEAT</div>
                    <div style={{ textAlign: 'center' }}>BADGE #</div>
                    <div style={{ textAlign: 'center' }}>UNIT</div>
                    <div>NOTES</div>
                  </div>
                  
                  {/* Table Rows */}
                  {processedData.supervisors.map((supervisor: any, index: number) => (
                    <div key={index} style={{
                      backgroundColor: safeLayoutSettings.tableSettings.showRowStriping && index % 2 === 1
                        ? `rgb(${oddRowColor.join(',')})`
                        : `rgb(${evenRowColor.join(',')})`,
                      fontSize: `${safeLayoutSettings.fontSizes.tableContent}pt`,
                      padding: `${safeLayoutSettings.tableSettings.cellPadding}px`,
                      height: `${safeLayoutSettings.tableSettings.rowHeight}px`,
                      display: 'grid',
                      gridTemplateColumns: '35% 8% 15% 10% 32%',
                      alignItems: 'center',
                      borderTop: index > 0 ? '1px solid #dee2e6' : 'none'
                    }}>
                      <div style={{ color: `rgb(${supervisorTextColor.join(',')})` }}>{supervisor.name}</div>
                      <div style={{ 
                        color: `rgb(${supervisorTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{supervisor.position?.match(/\d+/)?.[0] || ''}</div>
                      <div style={{ 
                        color: `rgb(${supervisorTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{supervisor.badge}</div>
                      <div style={{ 
                        color: `rgb(${supervisorTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{supervisor.unitNumber}</div>
                      <div style={{ color: `rgb(${supervisorTextColor.join(',')})` }}>
                        {supervisor.notes || supervisor.comments || 'Partnership details...'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Officers Section */}
            {safeLayoutSettings.sections.showOfficers && processedData.officers.length > 0 && (
              <div className="mb-8">
                <div className="border rounded overflow-hidden" style={{ borderColor: '#dee2e6' }}>
                  {/* Table Header */}
                  <div style={{
                    backgroundColor: `rgb(${getHeaderColorForSection(safeLayoutSettings, 'officers').join(',')})`,
                    color: `rgb(${headerTextColor.join(',')})`,
                    fontSize: `${safeLayoutSettings.fontSizes.tableHeader}pt`,
                    padding: `${safeLayoutSettings.tableSettings.cellPadding}px`,
                    display: 'grid',
                    gridTemplateColumns: '35% 8% 15% 10% 32%',
                    fontWeight: 'bold'
                  }}>
                    <div>OFFICERS</div>
                    <div style={{ textAlign: 'center' }}>BEAT</div>
                    <div style={{ textAlign: 'center' }}>BADGE #</div>
                    <div style={{ textAlign: 'center' }}>UNIT</div>
                    <div>NOTES</div>
                  </div>
                  
                  {/* Table Rows */}
                  {processedData.officers.map((officer: any, index: number) => (
                    <div key={index} style={{
                      backgroundColor: safeLayoutSettings.tableSettings.showRowStriping && index % 2 === 1
                        ? `rgb(${oddRowColor.join(',')})`
                        : `rgb(${evenRowColor.join(',')})`,
                      fontSize: `${safeLayoutSettings.fontSizes.tableContent}pt`,
                      padding: `${safeLayoutSettings.tableSettings.cellPadding}px`,
                      height: `${safeLayoutSettings.tableSettings.rowHeight}px`,
                      display: 'grid',
                      gridTemplateColumns: '35% 8% 15% 10% 32%',
                      alignItems: 'center',
                      borderTop: index > 0 ? '1px solid #dee2e6' : 'none'
                    }}>
                      <div style={{ color: `rgb(${officerTextColor.join(',')})` }}>{officer.name}</div>
                      <div style={{ 
                        color: `rgb(${officerTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{officer.position?.match(/\d+/)?.[0] || ''}</div>
                      <div style={{ 
                        color: `rgb(${officerTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{officer.badge}</div>
                      <div style={{ 
                        color: `rgb(${officerTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{officer.unitNumber}</div>
                      <div style={{ color: `rgb(${officerTextColor.join(',')})` }}>
                        {officer.notes || officer.comments || 'Regular assignment...'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Special Assignments Section */}
            {safeLayoutSettings.sections.showSpecialAssignments && processedData.specialAssignmentOfficers.length > 0 && (
              <div className="mb-8">
                <div className="border rounded overflow-hidden" style={{ borderColor: '#dee2e6' }}>
                  {/* Table Header */}
                  <div style={{
                    backgroundColor: `rgb(${getHeaderColorForSection(safeLayoutSettings, 'special').join(',')})`,
                    color: `rgb(${headerTextColor.join(',')})`,
                    fontSize: `${safeLayoutSettings.fontSizes.tableHeader}pt`,
                    padding: `${safeLayoutSettings.tableSettings.cellPadding}px`,
                    display: 'grid',
                    gridTemplateColumns: '35% 22% 15% 10% 18%',
                    fontWeight: 'bold'
                  }}>
                    <div>SPECIAL ASSIGNMENT OFFICERS</div>
                    <div>ASSIGNMENT</div>
                    <div style={{ textAlign: 'center' }}>BADGE #</div>
                    <div style={{ textAlign: 'center' }}>UNIT</div>
                    <div>NOTES</div>
                  </div>
                  
                  {/* Table Rows */}
                  {processedData.specialAssignmentOfficers.map((officer: any, index: number) => (
                    <div key={index} style={{
                      backgroundColor: safeLayoutSettings.tableSettings.showRowStriping && index % 2 === 1
                        ? `rgb(${oddRowColor.join(',')})`
                        : `rgb(${evenRowColor.join(',')})`,
                      fontSize: `${safeLayoutSettings.fontSizes.tableContent}pt`,
                      padding: `${safeLayoutSettings.tableSettings.cellPadding}px`,
                      height: `${safeLayoutSettings.tableSettings.rowHeight}px`,
                      display: 'grid',
                      gridTemplateColumns: '35% 22% 15% 10% 18%',
                      alignItems: 'center',
                      borderTop: index > 0 ? '1px solid #dee2e6' : 'none'
                    }}>
                      <div style={{ color: `rgb(${specialTextColor.join(',')})` }}>{officer.name}</div>
                      <div style={{ color: `rgb(${specialTextColor.join(',')})` }}>{officer.position}</div>
                      <div style={{ 
                        color: `rgb(${specialTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{officer.badge}</div>
                      <div style={{ 
                        color: `rgb(${specialTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{officer.unitNumber}</div>
                      <div style={{ color: `rgb(${specialTextColor.join(',')})` }}>
                        {officer.notes || officer.comments || 'Special duty...'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PTO Section */}
            {safeLayoutSettings.sections.showPTO && processedData.ptoRecords.length > 0 && (
              <div className="mb-8">
                <div className="border rounded overflow-hidden" style={{ borderColor: '#dee2e6' }}>
                  {/* Table Header */}
                  <div style={{
                    backgroundColor: `rgb(${getHeaderColorForSection(safeLayoutSettings, 'pto').join(',')})`,
                    color: `rgb(${headerTextColor.join(',')})`,
                    fontSize: `${safeLayoutSettings.fontSizes.tableHeader}pt`,
                    padding: `${safeLayoutSettings.tableSettings.cellPadding}px`,
                    display: 'grid',
                    gridTemplateColumns: '35% 15% 15% 35%',
                    fontWeight: 'bold'
                  }}>
                    <div>PTO OFFICERS</div>
                    <div style={{ textAlign: 'center' }}>BADGE #</div>
                    <div style={{ textAlign: 'center' }}>TYPE</div>
                    <div style={{ textAlign: 'center' }}>TIME</div>
                  </div>
                  
                  {/* Table Rows */}
                  {processedData.ptoRecords.map((record: any, index: number) => (
                    <div key={index} style={{
                      backgroundColor: safeLayoutSettings.tableSettings.showRowStriping && index % 2 === 1
                        ? `rgb(${oddRowColor.join(',')})`
                        : `rgb(${evenRowColor.join(',')})`,
                      fontSize: `${safeLayoutSettings.fontSizes.tableContent}pt`,
                      padding: `${safeLayoutSettings.tableSettings.cellPadding}px`,
                      height: `${safeLayoutSettings.tableSettings.rowHeight}px`,
                      display: 'grid',
                      gridTemplateColumns: '35% 15% 15% 35%',
                      alignItems: 'center',
                      borderTop: index > 0 ? '1px solid #dee2e6' : 'none'
                    }}>
                      <div style={{ color: `rgb(${ptoTextColor.join(',')})` }}>{record.name}</div>
                      <div style={{ 
                        color: `rgb(${ptoTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{record.badge}</div>
                      <div style={{ 
                        color: `rgb(${ptoTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{record.ptoType}</div>
                      <div style={{ 
                        color: `rgb(${ptoTextColor.join(',')})`,
                        textAlign: 'center'
                      }}>{record.startTime}-{record.endTime}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Staffing Summary */}
            {safeLayoutSettings.sections.showStaffingSummary && (
              <div className="mt-8 pt-4 border-t" style={{ borderColor: '#dee2e6' }}>
                <div style={{
                  fontSize: `${safeLayoutSettings.fontSizes.footer}pt`,
                  fontWeight: 'bold',
                  color: `rgb(${primaryColor.join(',')})`
                }}>
                  STAFFING: Supervisors {processedData.currentSupervisors}/{processedData.minSupervisors} • 
                  Officers {processedData.currentOfficers}/{processedData.minOfficers}
                </div>
                <div style={{
                  fontSize: `${safeLayoutSettings.fontSizes.footer}pt`,
                  color: `rgb(${primaryColor.join(',')})`,
                  textAlign: 'right',
                  marginTop: '2px'
                }}>
                  Generated: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleExportPreview}>
            <Download className="h-4 w-4 mr-2" />
            Export Preview as PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
