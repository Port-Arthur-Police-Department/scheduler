// src/components/admin/settings/PDFPreviewDialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePDFExport } from "@/hooks/usePDFExport";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface PDFPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewData: any;
  layoutSettings: any;
  selectedDate: Date;
}

export const PDFPreviewDialog = ({ 
  open, 
  onOpenChange, 
  previewData, 
  layoutSettings, 
  selectedDate 
}: PDFPreviewDialogProps) => {
  const { exportToPDF } = usePDFExport();

  const handleExportPreview = async () => {
    if (!previewData) return;
    
    await exportToPDF({
      selectedDate,
      shiftName: previewData.shift.name,
      shiftData: previewData,
      layoutSettings // Pass layout settings to export function
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>PDF Layout Preview</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto border rounded-md p-4 bg-gray-50">
          {/* Preview content that mimics PDF layout */}
          <div className="bg-white p-6 shadow-lg" style={{ minHeight: '842px', width: '595px', margin: '0 auto' }}>
            {/* Header */}
            <div className="flex items-start mb-6">
              <div className="w-16 h-16 bg-blue-500 flex items-center justify-center text-white font-bold text-xs">
                LOGO
              </div>
              <div className="ml-4">
                <div style={{ 
                  fontSize: `${layoutSettings?.fontSizes?.header || 10}pt`,
                  fontWeight: 'bold',
                  color: `rgb(${layoutSettings?.colorSettings?.primaryColor || '41,128,185'})`
                }}>
                  {previewData?.shift.name} • {previewData?.shift.start_time}-{previewData?.shift.end_time}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Preview Date
                </div>
              </div>
            </div>

            {/* Supervisors Section */}
            {layoutSettings?.sections?.showSupervisors && previewData?.supervisors?.length > 0 && (
              <div className="mb-8">
                <div style={{
                  fontSize: `${layoutSettings?.fontSizes?.sectionTitle || 9}pt`,
                  fontWeight: 'bold',
                  color: `rgb(${layoutSettings?.colorSettings?.primaryColor || '41,128,185'})`,
                  marginBottom: '8px'
                }}>
                  SUPERVISORS
                </div>
                <div className="border rounded overflow-hidden">
                  {/* Table Header */}
                  <div style={{
                    backgroundColor: `rgb(${layoutSettings?.colorSettings?.headerBgColor || '41,128,185'})`,
                    color: `rgb(${layoutSettings?.colorSettings?.headerTextColor || '255,255,255'})`,
                    fontSize: `${layoutSettings?.fontSizes?.tableHeader || 7}pt`,
                    padding: `${layoutSettings?.tableSettings?.cellPadding || 3}px`,
                    display: 'grid',
                    gridTemplateColumns: '35% 20% 15% 30%'
                  }}>
                    <div>SUPERVISORS</div>
                    <div>BEAT</div>
                    <div>BADGE #</div>
                    <div>UNIT</div>
                  </div>
                  
                  {/* Table Rows */}
                  {previewData.supervisors.map((supervisor: any, index: number) => (
                    <div key={index} style={{
                      backgroundColor: layoutSettings?.tableSettings?.showRowStriping && index % 2 === 1
                        ? `rgb(${layoutSettings?.colorSettings?.oddRowColor || '248,249,250'})`
                        : `rgb(${layoutSettings?.colorSettings?.evenRowColor || '255,255,255'})`,
                      fontSize: `${layoutSettings?.fontSizes?.tableContent || 7}pt`,
                      padding: `${layoutSettings?.tableSettings?.cellPadding || 3}px`,
                      height: `${layoutSettings?.tableSettings?.rowHeight || 8}px`,
                      display: 'grid',
                      gridTemplateColumns: '35% 20% 15% 30%',
                      alignItems: 'center'
                    }}>
                      <div>{supervisor.name}</div>
                      <div>{supervisor.position}</div>
                      <div>{supervisor.badge}</div>
                      <div>{supervisor.unitNumber}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Show other sections similarly... */}
            
            {/* Staffing Summary */}
            {layoutSettings?.sections?.showStaffingSummary && (
              <div className="mt-8 pt-4 border-t">
                <div style={{
                  fontSize: `${layoutSettings?.fontSizes?.footer || 7}pt`,
                  fontWeight: 'bold'
                }}>
                  STAFFING: Supervisors {previewData?.currentSupervisors}/{previewData?.minSupervisors} • 
                  Officers {previewData?.currentOfficers}/{previewData?.minOfficers}
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
