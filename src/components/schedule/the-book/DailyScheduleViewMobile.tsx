import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Clock, Users, MapPin, FileText, Edit, Trash2, UserPlus, Download, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { usePDFExport } from "@/hooks/usePDFExport";
import { PTOAssignmentDialog } from "./PTOAssignmentDialog";
import { getScheduleData } from "./DailyScheduleView";
import { PREDEFINED_POSITIONS } from "@/constants/positions";
import { useScheduleMutations } from "@/hooks/useScheduleMutations";

interface DailyScheduleViewMobileProps {
  selectedDate: Date;
  filterShiftId?: string;
  isAdminOrSupervisor?: boolean;
  userRole?: 'officer' | 'supervisor' | 'admin';
}

export const DailyScheduleViewMobile = ({ 
  selectedDate, 
  filterShiftId = "all", 
  isAdminOrSupervisor = false,
  userRole = 'officer'
}: DailyScheduleViewMobileProps) => {
  const [expandedShifts, setExpandedShifts] = useState<Set<string>>(new Set());
  const [expandedOfficers, setExpandedOfficers] = useState<Set<string>>(new Set());
  const [selectedOfficer, setSelectedOfficer] = useState<any>(null);
  const [ptoDialogOpen, setPtoDialogOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const { exportToPDF } = usePDFExport();
  const canEdit = userRole === 'supervisor' || userRole === 'admin';
  
  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ["daily-schedule-mobile", dateStr, filterShiftId],
    queryFn: () => getScheduleData(selectedDate, filterShiftId),
  });

  const { updateScheduleMutation, removeOfficerMutation } = useScheduleMutations(dateStr);

  // Toggle shift expansion
  const toggleShift = (shiftId: string) => {
    const newExpanded = new Set(expandedShifts);
    if (newExpanded.has(shiftId)) {
      newExpanded.delete(shiftId);
    } else {
      newExpanded.add(shiftId);
    }
    setExpandedShifts(newExpanded);
  };

  // Toggle officer details
  const toggleOfficerDetails = (officerId: string, scheduleId: string) => {
    const key = `${officerId}-${scheduleId}`;
    const newExpanded = new Set(expandedOfficers);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedOfficers(newExpanded);
  };

  // Handle officer action
  const handleOfficerAction = (officer: any, action: string) => {
    setSelectedOfficer(officer);
    
    switch (action) {
      case 'edit':
        setEditSheetOpen(true);
        break;
      case 'pto':
        setSelectedShift(officer.shift);
        setPtoDialogOpen(true);
        break;
      case 'remove':
        if (confirm(`Remove ${officer.name} from this shift?`)) {
          removeOfficerMutation.mutate(officer);
        }
        break;
    }
  };

  // Handle save from edit sheet
  const handleSaveEdit = (field: 'position' | 'unit' | 'notes', value: string) => {
    if (!selectedOfficer) return;

    if (field === 'position') {
      updateScheduleMutation.mutate({
        scheduleId: selectedOfficer.scheduleId,
        type: selectedOfficer.type,
        positionName: value,
        date: dateStr,
        officerId: selectedOfficer.officerId,
        shiftTypeId: selectedOfficer.shift.id,
        currentPosition: selectedOfficer.position,
        unitNumber: selectedOfficer.unitNumber,
        notes: selectedOfficer.notes
      });
    } else if (field === 'unit') {
      updateScheduleMutation.mutate({
        scheduleId: selectedOfficer.scheduleId,
        type: selectedOfficer.type,
        positionName: selectedOfficer.position,
        date: dateStr,
        officerId: selectedOfficer.officerId,
        shiftTypeId: selectedOfficer.shift.id,
        currentPosition: selectedOfficer.position,
        unitNumber: value,
        notes: selectedOfficer.notes
      });
    } else if (field === 'notes') {
      updateScheduleMutation.mutate({
        scheduleId: selectedOfficer.scheduleId,
        type: selectedOfficer.type,
        positionName: selectedOfficer.position,
        date: dateStr,
        officerId: selectedOfficer.officerId,
        shiftTypeId: selectedOfficer.shift.id,
        currentPosition: selectedOfficer.position,
        unitNumber: selectedOfficer.unitNumber,
        notes: value
      });
    }

    setEditSheetOpen(false);
  };

  // Export shift to PDF
  const handleExportShiftToPDF = async (shiftData: any) => {
    try {
      toast.info("Generating PDF...");
      const result = await exportToPDF({
        selectedDate: selectedDate,
        shiftName: shiftData.shift.name,
        shiftData: shiftData
      });

      if (result.success) {
        toast.success("PDF exported successfully");
      } else {
        toast.error("Failed to export PDF");
      }
    } catch (error) {
      toast.error("Error generating PDF");
    }
  };

  if (isLoading) {
    return (
      <Card className="mx-4 mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Daily Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg mt-4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="pb-20">
      <Card className="mx-4 mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            <Calendar className="h-5 w-5 inline mr-2" />
            Schedule for {format(selectedDate, "MMM d, yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {scheduleData?.map((shiftData) => {
            const shiftId = shiftData.shift.id;
            const isExpanded = expandedShifts.has(shiftId);
            const supervisorsUnderstaffed = shiftData.currentSupervisors < shiftData.minSupervisors;
            const officersUnderstaffed = shiftData.currentOfficers < shiftData.minOfficers;
            const isAnyUnderstaffed = supervisorsUnderstaffed || officersUnderstaffed;

            return (
              <div key={shiftId} className="border rounded-lg overflow-hidden">
                {/* Shift Header - Always visible */}
                <div 
                  className="p-4 bg-muted/50 flex items-center justify-between active:bg-muted/70 transition-colors"
                  onClick={() => toggleShift(shiftId)}
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{shiftData.shift.name}</h3>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {shiftData.shift.start_time} - {shiftData.shift.end_time}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={isAnyUnderstaffed ? "destructive" : "default"} className="gap-1">
                        {isAnyUnderstaffed ? (
                          <>
                            <AlertTriangle className="h-3 w-3" />
                            Understaffed
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-3 w-3" />
                            Fully Staffed
                          </>
                        )}
                      </Badge>
                      <Badge variant="outline">
                        {shiftData.currentSupervisors}/{shiftData.minSupervisors} Sup
                      </Badge>
                      <Badge variant="outline">
                        {shiftData.currentOfficers}/{shiftData.minOfficers} Off
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Shift Content - Collapsible */}
                {isExpanded && (
                  <div className="p-4 pt-0 space-y-4">
                    {/* Shift Actions */}
                    <div className="flex gap-2 pt-2">
                      {canEdit && (
                        <Button size="sm" variant="outline" className="flex-1">
                          <UserPlus className="h-4 w-4 mr-1" />
                          Add Officer
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => handleExportShiftToPDF(shiftData)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Export PDF
                      </Button>
                    </div>

                    {/* Supervisors Section */}
                    {shiftData.supervisors.length > 0 && (
                      <OfficerSectionMobile
                        title="Supervisors"
                        officers={shiftData.supervisors}
                        expandedOfficers={expandedOfficers}
                        onToggleOfficer={toggleOfficerDetails}
                        onOfficerAction={handleOfficerAction}
                        canEdit={canEdit}
                      />
                    )}

                    {/* Officers Section */}
                    {shiftData.officers.length > 0 && (
                      <OfficerSectionMobile
                        title="Officers"
                        officers={shiftData.officers}
                        expandedOfficers={expandedOfficers}
                        onToggleOfficer={toggleOfficerDetails}
                        onOfficerAction={handleOfficerAction}
                        canEdit={canEdit}
                      />
                    )}

                    {/* Special Assignments */}
                    {shiftData.specialAssignmentOfficers && shiftData.specialAssignmentOfficers.length > 0 && (
                      <OfficerSectionMobile
                        title="Special Assignments"
                        officers={shiftData.specialAssignmentOfficers}
                        expandedOfficers={expandedOfficers}
                        onToggleOfficer={toggleOfficerDetails}
                        onOfficerAction={handleOfficerAction}
                        canEdit={canEdit}
                        isSpecial={true}
                      />
                    )}

                    {/* PTO Records */}
                    {shiftData.ptoRecords && shiftData.ptoRecords.length > 0 && (
                      <PTOSectionMobile
                        title="Time Off"
                        ptoRecords={shiftData.ptoRecords}
                        canEdit={canEdit}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {scheduleData?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No schedule data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* PTO Assignment Dialog */}
      {selectedOfficer && selectedShift && (
        <PTOAssignmentDialog
          open={ptoDialogOpen}
          onOpenChange={setPtoDialogOpen}
          officer={selectedOfficer}
          shift={selectedShift}
          date={dateStr}
        />
      )}

      {/* Edit Officer Sheet */}
      <EditOfficerSheet
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        officer={selectedOfficer}
        onSave={handleSaveEdit}
        isLoading={updateScheduleMutation.isPending}
      />
    </div>
  );
};

// Mobile Officer Section Component
interface OfficerSectionMobileProps {
  title: string;
  officers: any[];
  expandedOfficers: Set<string>;
  onToggleOfficer: (officerId: string, scheduleId: string) => void;
  onOfficerAction: (officer: any, action: string) => void;
  canEdit: boolean;
  isSpecial?: boolean;
}

const OfficerSectionMobile = ({
  title,
  officers,
  expandedOfficers,
  onToggleOfficer,
  onOfficerAction,
  canEdit,
  isSpecial = false
}: OfficerSectionMobileProps) => {
  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-sm border-b pb-1">{title}</h4>
      {officers.map((officer) => {
        const key = `${officer.officerId}-${officer.scheduleId}`;
        const isExpanded = expandedOfficers.has(key);
        const isProbationary = officer.rank === 'Probationary';

        return (
          <div key={key} className="border rounded-lg overflow-hidden">
            {/* Officer Header */}
            <div 
              className="p-3 flex items-center justify-between active:bg-muted/50 transition-colors"
              onClick={() => onToggleOfficer(officer.officerId, officer.scheduleId)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{officer.name}</p>
                  {isProbationary && (
                    <Badge 
                      variant="outline" 
                      className="bg-yellow-100 text-yellow-800 border-yellow-800/50 text-xs"
                    >
                      PPO
                    </Badge>
                  )}
                  {officer.isPartnership && (
                    <Badge 
                      variant="outline" 
                      className="bg-blue-100 text-blue-800 border-blue-800/50 text-xs"
                    >
                      <Users className="h-3 w-3 mr-1" />
                    </Badge>
                  )}
                  {officer.hasPTO && !officer.ptoData?.isFullShift && (
                    <Badge 
                      variant="outline" 
                      className="bg-green-100 text-green-800 border-green-800/50 text-xs"
                    >
                      <Clock className="h-3 w-3 mr-1" />
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {officer.position || (isSpecial ? "Special Assignment" : "No Position")}
                  </Badge>
                  {officer.type === "exception" && (
                    <Badge variant="outline" className="text-xs bg-orange-50">
                      Extra
                    </Badge>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>

            {/* Officer Details - Collapsible */}
            {isExpanded && (
              <div className="p-3 pt-0 space-y-3 border-t">
                {/* Officer Info */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Rank</p>
                    <p className="font-medium">{officer.rank || 'Officer'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Badge</p>
                    <p className="font-medium">{officer.badge || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Unit</p>
                    <p className="font-medium">{officer.unitNumber || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Type</p>
                    <p className="font-medium capitalize">{officer.type}</p>
                  </div>
                </div>

                {/* Custom Time */}
                {officer.customTime && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{officer.customTime}</span>
                  </div>
                )}

                {/* Notes */}
                {officer.notes && (
                  <div className="flex items-start gap-2 p-2 bg-muted rounded">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span className="text-sm flex-1">{officer.notes}</span>
                  </div>
                )}

                {/* Partnership Info */}
                {officer.isPartnership && officer.partnerData && (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200">
                    <Users className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">Partner</p>
                      <p className="text-sm text-blue-700">
                        {officer.partnerData.partnerName}
                        {officer.partnerData.partnerBadge && ` (${officer.partnerData.partnerBadge})`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {canEdit && (
                  <div className="flex gap-2 pt-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1">
                          <MoreVertical className="h-4 w-4 mr-1" />
                          Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => onOfficerAction(officer, 'edit')}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onOfficerAction(officer, 'pto')}>
                          <Clock className="h-4 w-4 mr-2" />
                          Assign PTO
                        </DropdownMenuItem>
                        {officer.type === "exception" && (
                          <DropdownMenuItem 
                            onClick={() => onOfficerAction(officer, 'remove')}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove Shift
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Mobile PTO Section Component
interface PTOSectionMobileProps {
  title: string;
  ptoRecords: any[];
  canEdit: boolean;
}

const PTOSectionMobile = ({ title, ptoRecords, canEdit }: PTOSectionMobileProps) => {
  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-sm border-b pb-1">{title}</h4>
      {ptoRecords.map((ptoRecord) => (
        <div key={ptoRecord.id} className="border rounded-lg p-3 bg-muted/30">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="font-medium">{ptoRecord.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {ptoRecord.ptoType}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {ptoRecord.isFullShift ? "Full Day" : "Partial"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {ptoRecord.startTime} - {ptoRecord.endTime}
              </p>
              {ptoRecord.unitNumber && (
                <div className="flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm">Unit: {ptoRecord.unitNumber}</span>
                </div>
              )}
              {ptoRecord.notes && (
                <p className="text-sm mt-1">{ptoRecord.notes}</p>
              )}
            </div>
            {canEdit && (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// Edit Officer Sheet Component
interface EditOfficerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  officer: any;
  onSave: (field: 'position' | 'unit' | 'notes', value: string) => void;
  isLoading: boolean;
}

const EditOfficerSheet = ({ open, onOpenChange, officer, onSave, isLoading }: EditOfficerSheetProps) => {
  const [position, setPosition] = useState(officer?.position || "");
  const [unitNumber, setUnitNumber] = useState(officer?.unitNumber || "");
  const [notes, setNotes] = useState(officer?.notes || "");
  const [customPosition, setCustomPosition] = useState("");

  if (!officer) return null;

  const handleSubmit = (field: 'position' | 'unit' | 'notes') => {
    let value = "";
    if (field === 'position') {
      value = position === "Other (Custom)" ? customPosition : position;
      if (!value) return;
    } else if (field === 'unit') {
      value = unitNumber;
    } else if (field === 'notes') {
      value = notes;
    }
    
    onSave(field, value);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader className="text-left">
          <SheetTitle>Edit {officer.name}</SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-full pr-4">
          <div className="space-y-6 py-4">
            {/* Position Section */}
            <div className="space-y-3">
              <h3 className="font-medium">Position</h3>
              <select 
                className="w-full p-3 border rounded-lg"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              >
                <option value="">Select Position</option>
                {PREDEFINED_POSITIONS.map((pos) => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
                <option value="Other (Custom)">Other (Custom)</option>
              </select>
              
              {position === "Other (Custom)" && (
                <input
                  type="text"
                  placeholder="Enter custom position"
                  value={customPosition}
                  onChange={(e) => setCustomPosition(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                />
              )}
              
              <Button 
                className="w-full" 
                onClick={() => handleSubmit('position')}
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Save Position"}
              </Button>
            </div>

            {/* Unit Number Section */}
            <div className="space-y-3">
              <h3 className="font-medium">Unit Number</h3>
              <input
                type="text"
                placeholder="Unit number"
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                className="w-full p-3 border rounded-lg"
              />
              <Button 
                className="w-full" 
                onClick={() => handleSubmit('unit')}
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Save Unit"}
              </Button>
            </div>

            {/* Notes Section */}
            <div className="space-y-3">
              <h3 className="font-medium">Notes</h3>
              <textarea
                placeholder="Add notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 border rounded-lg min-h-[100px]"
              />
              <Button 
                className="w-full" 
                onClick={() => handleSubmit('notes')}
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Save Notes"}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
