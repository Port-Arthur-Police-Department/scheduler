// src/components/schedule/DailyScheduleViewMobile.tsx
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Clock, Users, MapPin, FileText, Edit, Trash2, UserPlus, Download, MoreVertical, ChevronLeft, ChevronRight } from "lucide-react";
import { format, isToday, isTomorrow, isYesterday, addDays, subDays, parseISO } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { OfficerSectionMobile, PTOSectionMobile } from "./OfficerSectionMobile";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePDFExport } from "@/hooks/usePDFExport";
import { PTOAssignmentDialog } from "./PTOAssignmentDialog";
import { getScheduleData } from "./DailyScheduleView";
import { PREDEFINED_POSITIONS } from "@/constants/positions";
import { useScheduleMutations } from "@/hooks/useScheduleMutations";
import { useWebsiteSettings } from "@/hooks/useWebsiteSettings";
import { DEFAULT_LAYOUT_SETTINGS } from "@/constants/pdfLayoutSettings";
import { 
  isShiftUnderstaffed,
  getStaffingDescription,
  getStaffingSeverity,
  formatStaffingCount,
  hasMinimumRequirements 
} from "@/utils/staffingUtils";

// Add Popover and Calendar imports
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

// In DailyScheduleViewMobile.tsx - Update the props interface (MOVE THIS OUTSIDE COMPONENT)
interface DailyScheduleViewMobileProps {
  filterShiftId?: string;
  isAdminOrSupervisor?: boolean;
  userRole?: 'officer' | 'supervisor' | 'admin';
  userCurrentShift?: string;
}

export const DailyScheduleViewMobile = ({ 
  filterShiftId = "all", 
  isAdminOrSupervisor = false,
  userRole = 'officer',
  userCurrentShift = "all"
}: DailyScheduleViewMobileProps) => {
  // ✅ CORRECT: No interface definitions inside function body
  // Initialize with current date - LOCAL STATE
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [expandedShifts, setExpandedShifts] = useState<Set<string>>(new Set());
  const [expandedOfficers, setExpandedOfficers] = useState<Set<string>>(new Set());
  const [selectedOfficer, setSelectedOfficer] = useState<any>(null);
  const [ptoDialogOpen, setPtoDialogOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string>(userCurrentShift);
  const [isLoadingShifts, setIsLoadingShifts] = useState(false);
  const [addOfficerDialogOpen, setAddOfficerDialogOpen] = useState(false);
  const [selectedShiftForAdd, setSelectedShiftForAdd] = useState<any>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { exportToPDF } = usePDFExport();
  const canEdit = userRole === 'supervisor' || userRole === 'admin';
  
  // This should now use the LOCAL selectedDate state
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  
  // Add website settings hook
  const { data: websiteSettings } = useWebsiteSettings();
  
  // Check if we should show special occasions
  const showSpecialOccasions = websiteSettings?.show_special_occasions_in_schedule !== false;
  
  // Add useEffect to update selectedShiftId when userCurrentShift changes
  useEffect(() => {
    if (userCurrentShift && userCurrentShift !== selectedShiftId) {
      console.log("🔄 Mobile: Updating selected shift from prop:", userCurrentShift);
      setSelectedShiftId(userCurrentShift);
    }
  }, [userCurrentShift]);

  // Fetch all available shifts first
  const { data: allShifts, isLoading: shiftsLoading } = useQuery({
    queryKey: ["shift-types-mobile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_types")
        .select("*")
        .order("start_time");
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        if (userCurrentShift && userCurrentShift !== "all") {
          const userShiftExists = data.some(shift => shift.id === userCurrentShift);
          if (userShiftExists) {
            console.log("🎯 Mobile: Setting user's assigned shift:", userCurrentShift);
          } else {
            console.log("⚠️ Mobile: User's assigned shift not found, using first shift");
            setSelectedShiftId(data[0].id);
          }
        } else if (!selectedShiftId) {
          setSelectedShiftId(data[0].id);
        }
      }
      
      return data || [];
    },
  });

  // Fetch schedule data only for the selected shift
  const { data: scheduleData, isLoading: scheduleLoading, refetch: refetchSchedule } = useQuery({
    queryKey: ["daily-schedule-mobile", dateStr, selectedShiftId],
    queryFn: () => {
      if (!selectedShiftId) return Promise.resolve([]);
      return getScheduleData(selectedDate, selectedShiftId); 
    },
    enabled: !!selectedShiftId,
  });

  const { updateScheduleMutation, removeOfficerMutation, removePTOMutation } = useScheduleMutations(dateStr);

  // NEW: Date navigation functions
  const goToPreviousDay = () => {
    setSelectedDate(prev => subDays(prev, 1));
  };

  const goToNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1));
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setCalendarOpen(false);
    }
  };

  // NEW: Format date for display with relative day names
  const formatDateDisplay = (date: Date) => {
    if (isToday(date)) {
      return `Today, ${format(date, "MMM d")}`;
    }
    if (isTomorrow(date)) {
      return `Tomorrow, ${format(date, "MMM d")}`;
    }
    if (isYesterday(date)) {
      return `Yesterday, ${format(date, "MMM d")}`;
    }
    return format(date, "EEE, MMM d");
  };

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

  // Handle shift selection change
  const handleShiftChange = (shiftId: string) => {
    setSelectedShiftId(shiftId);
    setExpandedShifts(new Set());
    setExpandedOfficers(new Set());
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
          removeOfficerMutation.mutate(officer, {
            onSuccess: () => {
              refetchSchedule();
            }
          });
        }
        break;
    }
  };

  // Handle PTO edit
  const handleEditPTO = (ptoRecord: any) => {
    setSelectedOfficer({
      officerId: ptoRecord.officerId,
      name: ptoRecord.name,
      scheduleId: ptoRecord.id,
      type: "exception",
      existingPTO: {
        id: ptoRecord.id,
        ptoType: ptoRecord.ptoType,
        startTime: ptoRecord.startTime,
        endTime: ptoRecord.endTime,
        isFullShift: ptoRecord.isFullShift
      }
    });
    setSelectedShift({
      id: ptoRecord.shiftTypeId,
      name: "Unknown Shift",
      start_time: ptoRecord.startTime,
      end_time: ptoRecord.endTime
    });
    setPtoDialogOpen(true);
  };

  // Handle PTO removal
  const handleRemovePTO = (ptoRecord: any) => {
    if (confirm(`Remove PTO for ${ptoRecord.name}?`)) {
      removePTOMutation.mutate(ptoRecord, {
        onSuccess: () => {
          refetchSchedule();
        }
      });
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
      }, {
        onSuccess: () => {
          refetchSchedule();
          setEditSheetOpen(false);
        }
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
      }, {
        onSuccess: () => {
          refetchSchedule();
          setEditSheetOpen(false);
        }
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
      }, {
        onSuccess: () => {
          refetchSchedule();
          setEditSheetOpen(false);
        }
      });
    }
  };

  // Export shift to PDF
  const handleExportShiftToPDF = async (shiftData: any) => {
    try {
      toast.info("Generating PDF...");
      const result = await exportToPDF({
        selectedDate: selectedDate, 
        shiftName: shiftData.shift.name,
        shiftData: shiftData,
        layoutSettings: DEFAULT_LAYOUT_SETTINGS
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

  // Handle add officer button click
  const handleAddOfficerClick = (shiftData: any) => {
    setSelectedShiftForAdd(shiftData.shift);
    setAddOfficerDialogOpen(true);
  };

  if (shiftsLoading) {
    return (
      <Card className="mx-4 mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Daily Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-full rounded-lg mb-4" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="pb-20">
      {/* Date Navigation Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPreviousDay}
              className="h-8 w-8"
              title="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="gap-2 font-medium"
                >
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="min-w-[140px] text-center">
                    {formatDateDisplay(selectedDate)} 
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate} 
                  onSelect={handleDateSelect}
                  initialFocus
                  className="rounded-md border"
                />
                <div className="p-3 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={goToToday}
                    disabled={isToday(selectedDate)} 
                  >
                    Go to Today
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextDay}
              className="h-8 w-8"
              title="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {format(selectedDate, "EEEE, MMMM d, yyyy")} 
            </p>
          </div>
        </div>
      </div>

      <Card className="mx-4 mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            <Calendar className="h-5 w-5 inline mr-2" />
            Schedule for {format(selectedDate, "MMM d, yyyy")} 
            {userCurrentShift !== "all" && selectedShiftId === userCurrentShift && (
              <Badge variant="outline" className="ml-2 text-xs bg-primary/10">
                Your Shift
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Shift Selector */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Select value={selectedShiftId} onValueChange={handleShiftChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a shift">
                    {allShifts?.find(s => s.id === selectedShiftId)?.name || "Select a shift"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shifts</SelectItem>
                  {allShifts?.map((shift) => (
                    <SelectItem key={shift.id} value={shift.id}>
                      {shift.name} ({shift.start_time} - {shift.end_time})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedShiftId && allShifts?.find(s => s.id === selectedShiftId) ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {allShifts.find(s => s.id === selectedShiftId)?.start_time} - {allShifts.find(s => s.id === selectedShiftId)?.end_time}
                </p>
                {userCurrentShift !== "all" && selectedShiftId === userCurrentShift && (
                  <Badge variant="secondary" className="text-xs">
                    Your Assigned Shift
                  </Badge>
                )}
              </div>
            ) : selectedShiftId === "all" ? (
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Viewing all shifts
              </p>
            ) : null}
          </div>

          {/* Loading state for schedule */}
          {scheduleLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          ) : scheduleData?.map((shiftData) => {
            const shiftId = shiftData.shift.id;
            const isExpanded = expandedShifts.has(shiftId);
            const isAnyUnderstaffed = isShiftUnderstaffed(
              shiftData.currentSupervisors,
              shiftData.minSupervisors,
              shiftData.currentOfficers,
              shiftData.minOfficers
            );
            const supervisorsUnderstaffed = shiftData.minSupervisors > 0 && shiftData.currentSupervisors < shiftData.minSupervisors;
            const officersUnderstaffed = shiftData.minOfficers > 0 && shiftData.currentOfficers < shiftData.minOfficers;

            // Use the severity function for visual indicators
            const staffingSeverity = getStaffingSeverity(
              shiftData.currentSupervisors,
              shiftData.minSupervisors,
              shiftData.currentOfficers,
              shiftData.minOfficers
            );

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
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={staffingSeverity === "danger" ? "destructive" : staffingSeverity === "warning" ? "warning" : "default"} className="gap-1">
                        {isAnyUnderstaffed ? (
                          <>
                            <AlertTriangle className="h-3 w-3" />
                            Understaffed
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-3 w-3" />
                            {hasMinimumRequirements(shiftData.minSupervisors, shiftData.minOfficers) ? "Fully Staffed" : "No Requirements"}
                          </>
                        )}
                      </Badge>
                      <Badge variant="outline">
                        {formatStaffingCount(shiftData.currentSupervisors, shiftData.minSupervisors, 'Sup')}
                      </Badge>
                      <Badge variant="outline">
                        {formatStaffingCount(shiftData.currentOfficers, shiftData.minOfficers, 'Off')}
                      </Badge>
                      
                      {/* ADD THIS LINE - Description tooltip */}
                      <div className="mt-1 text-xs text-muted-foreground">
                        {shiftData.minSupervisors === 0 && shiftData.minOfficers === 0 ? 
                          "No minimum requirements set" : 
                          isAnyUnderstaffed ? "Staffing below minimum" : "Meeting minimum requirements"
                        }
                      </div>
                    </div>
                  </div>
                </div>
                {/* Shift Content - Collapsible */}
                {isExpanded && (
                  <div className="p-4 pt-0 space-y-4">
                    {/* Shift Actions */}
                    <div className="flex gap-2 pt-2">
                      {canEdit && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => handleAddOfficerClick(shiftData)}
                        >
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
                        sectionType="supervisor"
                        showSpecialOccasions={showSpecialOccasions}
                        colorSettings={websiteSettings?.color_settings}
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
                        sectionType="regular"
                        showSpecialOccasions={showSpecialOccasions}
                        colorSettings={websiteSettings?.color_settings}
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
                        sectionType="special"
                        showSpecialOccasions={showSpecialOccasions}
                        colorSettings={websiteSettings?.color_settings}
                      />
                    )}

                    {/* PTO Records */}
                    {shiftData.ptoRecords && shiftData.ptoRecords.length > 0 && (
                      <PTOSectionMobile
                        title="Time Off"
                        ptoRecords={shiftData.ptoRecords}
                        canEdit={canEdit}
                        showSpecialOccasions={showSpecialOccasions}
                        colorSettings={websiteSettings?.color_settings}
                        onEditPTO={handleEditPTO}
                        onRemovePTO={handleRemovePTO}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {selectedShiftId && scheduleData?.length === 0 && !scheduleLoading && (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No schedule data available for selected shift</p>
              <p className="text-sm mt-2">Select a different shift or date</p>
            </div>
          )}

          {!selectedShiftId && (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Please select a shift to view schedule</p>
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
        allShifts={allShifts}
      />

      {/* Add Officer Dialog */}
      <AddOfficerDialogMobile
        open={addOfficerDialogOpen}
        onOpenChange={setAddOfficerDialogOpen}
        shift={selectedShiftForAdd}
        date={dateStr}
        onSuccess={() => {
          setAddOfficerDialogOpen(false);
          setSelectedShiftForAdd(null);
          refetchSchedule();
        }}
      />
    </div>
  );
};

// Edit Officer Sheet Component - UPDATED with shift selector
interface EditOfficerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  officer: any;
  onSave: (field: 'position' | 'unit' | 'notes', value: string) => void;
  isLoading: boolean;
  allShifts?: any[];
}

const EditOfficerSheet = ({ open, onOpenChange, officer, onSave, isLoading, allShifts }: EditOfficerSheetProps) => {
  const [position, setPosition] = useState(officer?.position || "");
  const [unitNumber, setUnitNumber] = useState(officer?.unitNumber || "");
  const [notes, setNotes] = useState(officer?.notes || "");
  const [customPosition, setCustomPosition] = useState("");

  if (!officer) return null;

  const handleSubmit = (field: 'position' | 'unit' | 'notes') => {
    let value = "";
    if (field === 'position') {
      value = position === "Other (Custom)" ? customPosition : position;
      if (!value) {
        toast.error("Please select or enter a position");
        return;
      }
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

            {/* Current Shift Info */}
            {allShifts && officer?.shift && (
              <div className="space-y-3 p-3 bg-muted rounded-lg">
                <h3 className="font-medium">Current Assignment</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shift:</span>
                    <span className="font-medium">{officer.shift.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time:</span>
                    <span className="font-medium">{officer.shift.start_time} - {officer.shift.end_time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-medium">{format(new Date(officer.date || new Date()), "MMM d, yyyy")}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

// Add Officer Dialog for Mobile with partial shift support
interface AddOfficerDialogMobileProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: any;
  date: string;
  onSuccess: () => void;
}

const AddOfficerDialogMobile = ({ open, onOpenChange, shift, date, onSuccess }: AddOfficerDialogMobileProps) => {
  const [selectedOfficerId, setSelectedOfficerId] = useState("");
  const [position, setPosition] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [customPosition, setCustomPosition] = useState("");
  const [isPartialShift, setIsPartialShift] = useState(false);
  const [customStartTime, setCustomStartTime] = useState("");
  const [customEndTime, setCustomEndTime] = useState("");

  const { data: officers, isLoading } = useQuery({
    queryKey: ["available-officers-mobile", shift?.id, date],
    queryFn: async () => {
      if (!shift) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, badge_number, rank")
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: open && !!shift,
  });

  // Set default times when dialog opens
  useEffect(() => {
    if (open && shift) {
      setCustomStartTime(shift.start_time);
      setCustomEndTime(shift.end_time);
      setIsPartialShift(false);
      setSelectedOfficerId("");
      setPosition("");
      setCustomPosition("");
      setUnitNumber("");
      setNotes("");
    }
  }, [open, shift]);

  // Helper function to check if a shift crosses midnight
  const doesShiftCrossMidnight = (startTime: string, endTime: string): boolean => {
    const [startHour] = startTime.split(":").map(Number);
    const [endHour] = endTime.split(":").map(Number);
    return endHour < startHour;
  };

  // Helper to format shift display with next day indicator
  const formatShiftDisplay = (startTime: string, endTime: string): string => {
    const crossesMidnight = doesShiftCrossMidnight(startTime, endTime);
    if (crossesMidnight) {
      return `${startTime} - ${endTime} (next day)`;
    }
    return `${startTime} - ${endTime}`;
  };

  // Updated calculateHours function to handle midnight crossing
  const calculateHours = (start: string, end: string) => {
    const [startHour, startMin] = start.split(":").map(Number);
    const [endHour, endMin] = end.split(":").map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    let endMinutes = endHour * 60 + endMin;
    
    // Handle shifts crossing midnight
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }
    
    return (endMinutes - startMinutes) / 60;
  };

  const addOfficerMutation = useMutation({
    mutationFn: async () => {
      if (!shift) throw new Error("No shift selected");
      
      const finalPosition = position === "Other (Custom)" ? customPosition : position;
      
      if (!finalPosition) {
        throw new Error("Please select or enter a position");
      }
      
      if (!selectedOfficerId) {
        throw new Error("Please select an officer");
      }
      
      // Validate custom times if partial shift
      if (isPartialShift) {
        if (!customStartTime || !customEndTime) {
          throw new Error("Please enter both start and end times");
        }
        
        // Check if shift crosses midnight
        const shiftCrossesMidnight = doesShiftCrossMidnight(shift.start_time, shift.end_time);
        const customCrossesMidnight = doesShiftCrossMidnight(customStartTime, customEndTime);
        
        // For shifts that don't cross midnight, end must be after start
        if (!shiftCrossesMidnight && !customCrossesMidnight && customStartTime >= customEndTime) {
          throw new Error("End time must be after start time");
        }
        
        // If original shift crosses midnight but custom doesn't, warn but allow
        if (shiftCrossesMidnight && !customCrossesMidnight) {
          console.log("⚠️ Original shift crosses midnight but custom times don't");
        }
      }
      
      // Check for existing schedule
      const { data: existingExceptions } = await supabase
        .from("schedule_exceptions")
        .select("id")
        .eq("officer_id", selectedOfficerId)
        .eq("date", date)
        .eq("shift_type_id", shift.id);

      if (existingExceptions && existingExceptions.length > 0) {
        throw new Error("Officer already has a schedule for this date and shift");
      }

      // Calculate hours worked
      const startTime = isPartialShift ? customStartTime : shift.start_time;
      const endTime = isPartialShift ? customEndTime : shift.end_time;
      const hoursWorked = calculateHours(startTime, endTime);

      // Create schedule exception
      const { error } = await supabase
        .from("schedule_exceptions")
        .insert({
          officer_id: selectedOfficerId,
          date: date,
          shift_type_id: shift.id,
          position_name: finalPosition,
          unit_number: unitNumber,
          notes: notes || `${isPartialShift ? 'Partial' : 'Full'} overtime shift`,
          is_off: false,
          is_extra_shift: true,
          schedule_type: "exception",
          custom_start_time: isPartialShift ? customStartTime : null,
          custom_end_time: isPartialShift ? customEndTime : null,
          is_partial_shift: isPartialShift,
          hours_worked: hoursWorked
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Officer added to schedule");
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add officer");
    }
  });

  // Generate time options
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute of ["00", "30"]) {
        options.push(`${hour.toString().padStart(2, '0')}:${minute}`);
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  if (!shift) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Officer to Shift</DialogTitle>
          <DialogDescription>
            Add an officer to {shift.name} {formatShiftDisplay(shift.start_time, shift.end_time)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Officer Selection */}
          <div className="space-y-2">
            <Label>Officer</Label>
            <Select value={selectedOfficerId} onValueChange={setSelectedOfficerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select officer" />
              </SelectTrigger>
              <SelectContent>
                {officers?.map((officer) => (
                  <SelectItem key={officer.id} value={officer.id}>
                    {officer.full_name} ({officer.badge_number}) {officer.rank ? `• ${officer.rank}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Position Selection */}
          <div className="space-y-2">
            <Label>Position</Label>
            <Select value={position} onValueChange={setPosition}>
              <SelectTrigger>
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                {PREDEFINED_POSITIONS.map((pos) => (
                  <SelectItem key={pos} value={pos}>
                    {pos}
                  </SelectItem>
                ))}
                <SelectItem value="Other (Custom)">Other (Custom)</SelectItem>
              </SelectContent>
            </Select>
            
            {position === "Other (Custom)" && (
              <Input
                placeholder="Enter custom position"
                value={customPosition}
                onChange={(e) => setCustomPosition(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {/* Shift Hours Selection */}
          <div className="space-y-2">
            <Label>Shift Hours</Label>
            <div className="space-y-3">
              {/* Full Shift Option */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="fullShift"
                  checked={!isPartialShift}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setIsPartialShift(false);
                    }
                  }}
                />
                <Label htmlFor="fullShift" className="cursor-pointer">
                  Full Shift {formatShiftDisplay(shift.start_time, shift.end_time)}
                </Label>
              </div>
              
              {/* Partial Shift Option */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="partialShift"
                  checked={isPartialShift}
                  onCheckedChange={(checked) => {
                    setIsPartialShift(checked === true);
                  }}
                />
                <Label htmlFor="partialShift" className="cursor-pointer">
                  Partial/Custom Hours
                </Label>
              </div>
              
              {/* Warning for midnight-crossing shifts */}
              {isPartialShift && doesShiftCrossMidnight(shift.start_time, shift.end_time) && (
                <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200 ml-6">
                  ⚠️ This shift crosses midnight. For partial shifts, ensure your end time is correct.
                  Example: Working 21:30 - 02:30 should be entered as 21:30 - 02:30 (it will calculate as 5 hours).
                </div>
              )}
              
              {isPartialShift && (
                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Select value={customStartTime} onValueChange={setCustomStartTime}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {timeOptions.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Select value={customEndTime} onValueChange={setCustomEndTime}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {timeOptions.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              
              {/* Display calculated hours */}
              {isPartialShift && customStartTime && customEndTime && (
                <div className="text-sm text-muted-foreground ml-6">
                  Shift Duration: {calculateHours(customStartTime, customEndTime).toFixed(1)} hours
                </div>
              )}
            </div>
          </div>

          {/* Unit Number */}
          <div className="space-y-2">
            <Label htmlFor="unitNumber">Unit Number (Optional)</Label>
            <Input
              id="unitNumber"
              placeholder="Enter unit number"
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input
              id="notes"
              placeholder="Enter notes (e.g., reason for overtime)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={() => onOpenChange(false)}
              disabled={addOfficerMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1" 
              onClick={() => addOfficerMutation.mutate()}
              disabled={!selectedOfficerId || !position || addOfficerMutation.isPending}
            >
              {addOfficerMutation.isPending ? "Adding..." : "Add Officer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
