// src/components/schedule/OfficerSectionMobile.tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Edit, FileText, MapPin, MoreVertical, Trash2, Users } from "lucide-react";
import { format, parseISO } from "date-fns";

interface OfficerSectionMobileProps {
  title: string;
  officers: any[];
  expandedOfficers: Set<string>;
  onToggleOfficer: (officerId: string, scheduleId: string) => void;
  onOfficerAction: (officer: any, action: string) => void;
  canEdit: boolean;
  sectionType?: "regular" | "supervisor" | "special" | "pto";
  showSpecialOccasions?: boolean;
  colorSettings?: any;
}

// Helper functions - UPDATED to accept currentDate parameter and use raw dates
const isBirthdayToday = (birthday: string | null | undefined, date: Date): boolean => {
  if (!birthday) return false;
  try {
    const birthDate = parseISO(birthday);
    return birthDate.getMonth() === date.getMonth() && 
           birthDate.getDate() === date.getDate();
  } catch (error) {
    return false;
  }
};

const isAnniversaryToday = (hireDate: string | null | undefined, date: Date): boolean => {
  if (!hireDate) return false;
  try {
    const anniversaryDate = parseISO(hireDate);
    return anniversaryDate.getMonth() === date.getMonth() && 
           anniversaryDate.getDate() === date.getDate();
  } catch (error) {
    return false;
  }
};

const calculateYearsOfService = (hireDate: string | null | undefined, date: Date): number => {
  if (!hireDate) return 0;
  try {
    const hireDateObj = parseISO(hireDate);
    const today = date;
    let years = today.getFullYear() - hireDateObj.getFullYear();
    if (today.getMonth() < hireDateObj.getMonth() || 
        (today.getMonth() === hireDateObj.getMonth() && today.getDate() < hireDateObj.getDate())) {
      years--;
    }
    return Math.max(0, years);
  } catch (error) {
    return 0;
  }
};

export const OfficerSectionMobile = ({
  title,
  officers,
  expandedOfficers,
  onToggleOfficer,
  onOfficerAction,
  canEdit,
  sectionType = "regular",
  showSpecialOccasions = false,
  colorSettings
}: OfficerSectionMobileProps) => {
  // Define background colors based on section type
  const getSectionStyle = () => {
    const colors = colorSettings || {};
    
    switch (sectionType) {
      case "special":
        return {
          headerBg: `bg-[rgb(${colors.schedule_special_bg || '243,229,245'})]`,
          headerBorder: `border-[rgb(${colors.schedule_special_bg || '243,229,245'})]`,
          cardBg: `bg-[rgb(${colors.schedule_special_bg || '243,229,245'})]/50`,
          cardBorder: `border-[rgb(${colors.schedule_special_bg || '243,229,245'})]`,
          textColor: `text-[rgb(${colors.schedule_special_text || '102,51,153'})]`
        };
      case "supervisor":
        return {
          headerBg: `bg-[rgb(${colors.schedule_supervisor_bg || '240,248,255'})]`,
          headerBorder: `border-[rgb(${colors.schedule_supervisor_bg || '240,248,255'})]`,
          cardBg: `bg-[rgb(${colors.schedule_supervisor_bg || '240,248,255'})]/50`,
          cardBorder: `border-[rgb(${colors.schedule_supervisor_bg || '240,248,255'})]`,
          textColor: `text-[rgb(${colors.schedule_supervisor_text || '25,25,112'})]`
        };
      case "pto":
        return {
          headerBg: `bg-[rgb(${colors.schedule_pto_bg || '230,255,242'})]`,
          headerBorder: `border-[rgb(${colors.schedule_pto_bg || '230,255,242'})]`,
          cardBg: `bg-[rgb(${colors.schedule_pto_bg || '230,255,242'})]/50`,
          cardBorder: `border-[rgb(${colors.schedule_pto_bg || '230,255,242'})]`,
          textColor: `text-[rgb(${colors.schedule_pto_text || '0,100,0'})]`
        };
      default: // regular
        return {
          headerBg: `bg-[rgb(${colors.schedule_officer_bg || '248,249,250'})]`,
          headerBorder: `border-[rgb(${colors.schedule_officer_bg || '248,249,250'})]`,
          cardBg: `bg-[rgb(${colors.schedule_officer_bg || '248,249,250'})]/50`,
          cardBorder: `border-[rgb(${colors.schedule_officer_bg || '248,249,250'})]`,
          textColor: `text-[rgb(${colors.schedule_officer_text || '33,37,41'})]`
        };
    }
  };

  const sectionStyle = getSectionStyle();
  const currentDate = new Date();

  return (
    <div className="space-y-2">
      <h4 
        className={`font-semibold text-sm border-b pb-1 p-2 rounded-t-lg ${sectionStyle.textColor}`}
        style={{
          backgroundColor: `rgb(${sectionStyle.headerBg.replace('bg-[rgb(', '').replace(')]', '')})`,
          borderColor: `rgb(${sectionStyle.headerBorder.replace('border-[rgb(', '').replace(')]', '')})`
        }}
      >
        {title}
      </h4>
      {officers.map((officer) => {
        const key = `${officer.officerId}-${officer.scheduleId}`;
        const isExpanded = expandedOfficers.has(key);
        const isProbationary = officer.rank === 'Probationary';
        
        // FIXED: Check birthdays using raw date field with currentDate parameter
        const isBirthday = showSpecialOccasions && isBirthdayToday(officer.birthday, currentDate);
        const isAnniversary = showSpecialOccasions && isAnniversaryToday(officer.hire_date, currentDate);
        const yearsOfService = showSpecialOccasions ? calculateYearsOfService(officer.hire_date, currentDate) : 0;

        return (
          <div 
            key={key} 
            className="border rounded-lg overflow-hidden"
            style={{
              backgroundColor: `rgb(${sectionStyle.cardBg.replace('bg-[rgb(', '').replace('/50', '').replace(')]', '').trim()})`,
              borderColor: `rgb(${sectionStyle.cardBorder.replace('border-[rgb(', '').replace(')]', '')})`
            }}
          >
            {/* Officer Header */}
            <div 
              className={`p-3 flex items-center justify-between transition-colors ${isExpanded ? sectionStyle.headerBg : 'active:bg-muted/50'}`}
              onClick={() => onToggleOfficer(officer.officerId, officer.scheduleId)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{officer.name}</p>
                  
                  {/* Special Occasion Indicators - FIXED: Now using correctly calculated values */}
                  {showSpecialOccasions && (
                    <>
                      {isBirthday && (
                        <Badge 
                          variant="outline" 
                          className="bg-pink-100 text-pink-800 border-pink-300 text-xs"
                          title="Birthday Today!"
                        >
                          🎂
                        </Badge>
                      )}
                      {isAnniversary && (
                        <Badge 
                          variant="outline" 
                          className="bg-amber-100 text-amber-800 border-amber-300 text-xs"
                          title={`${yearsOfService} Year Anniversary`}
                        >
                          🎖️
                        </Badge>
                      )}
                    </>
                  )}
                  
                  {isProbationary && (
                    <Badge 
                      variant="outline" 
                      className="bg-yellow-100 text-yellow-800 border-yellow-800/50 text-xs"
                    >
                      PPO
                    </Badge>
                  )}
                  {officer.partnershipSuspended && officer.isPartnership && (
                    <Badge 
                      variant="outline" 
                      className="bg-amber-100 text-amber-800 border-amber-300 text-xs"
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" />
                    </Badge>
                  )}
                  {officer.isPartnership && !officer.partnershipSuspended && (
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
                    {officer.position || (sectionType === "special" ? "Special Assignment" : "No Position")}
                  </Badge>
                  {officer.type === "exception" && (
                    <Badge variant="outline" className="text-xs bg-orange-50">
                      Extra
                    </Badge>
                  )}
                  {/* ADD THIS FOR PARTIAL OVERTIME DISPLAY */}
                  {officer.isExtraShift && officer.custom_start_time && officer.custom_end_time && (
                    <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-300">
                      {officer.custom_start_time} - {officer.custom_end_time}
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

                {/* Partial Overtime Details */}
                {officer.isExtraShift && officer.custom_start_time && officer.custom_end_time && officer.hours_worked && (
                  <div className="flex items-center gap-2 p-2 bg-orange-50 rounded border border-orange-200">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <div>
                      <p className="text-sm font-medium text-orange-800">Partial Overtime</p>
                      <p className="text-sm text-orange-700">
                        {officer.custom_start_time} - {officer.custom_end_time} ({officer.hours_worked} hours)
                      </p>
                    </div>
                  </div>
                )}

                {/* Anniversary Details */}
                {showSpecialOccasions && isAnniversary && yearsOfService > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200">
                    <div className="flex items-center">
                      <span className="mr-2">🎖️</span>
                      <div>
                        <p className="text-sm font-medium text-amber-800">
                          {yearsOfService} Year{yearsOfService > 1 ? 's' : ''} of Service
                        </p>
                        <p className="text-xs text-amber-700">
                          Hire date: {officer.hire_date ? format(parseISO(officer.hire_date), 'MMM d, yyyy') : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Birthday Details */}
                {showSpecialOccasions && isBirthday && (
                  <div className="flex items-center gap-2 p-2 bg-pink-50 rounded border border-pink-200">
                    <div className="flex items-center">
                      <span className="mr-2">🎂</span>
                      <div>
                        <p className="text-sm font-medium text-pink-800">Birthday Today!</p>
                        <p className="text-xs text-pink-700">
                          Born: {officer.birthday ? format(parseISO(officer.birthday), 'MMM d, yyyy') : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Partnership Suspended Notice */}
                {officer.partnershipSuspended && officer.isPartnership && (
                  <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Partnership Suspended</p>
                      <p className="text-sm text-amber-700">
                        {officer.partnershipSuspensionReason || 'Partner unavailable'}
                      </p>
                    </div>
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
                {officer.isPartnership && officer.partnerData && !officer.partnershipSuspended && (
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

// PTOSectionMobile Component
interface PTOSectionMobileProps {
  title: string;
  ptoRecords: any[];
  canEdit: boolean;
  showSpecialOccasions?: boolean;
  colorSettings?: any;
}

export const PTOSectionMobile = ({ 
  title, 
  ptoRecords, 
  canEdit, 
  showSpecialOccasions = false,
  colorSettings 
}: PTOSectionMobileProps) => {
  const colors = colorSettings || {};
  const currentDate = new Date();

  // Helper functions - UPDATED to use raw date fields
  const isBirthdayToday = (birthday: string | null | undefined): boolean => {
    if (!birthday) return false;
    try {
      const birthDate = parseISO(birthday);
      return birthDate.getMonth() === currentDate.getMonth() && 
             birthDate.getDate() === currentDate.getDate();
    } catch (error) {
      return false;
    }
  };

  const isAnniversaryToday = (hireDate: string | null | undefined): boolean => {
    if (!hireDate) return false;
    try {
      const anniversaryDate = parseISO(hireDate);
      return anniversaryDate.getMonth() === currentDate.getMonth() && 
             anniversaryDate.getDate() === currentDate.getDate();
    } catch (error) {
      return false;
    }
  };

  const calculateYearsOfService = (hireDate: string | null | undefined): number => {
    if (!hireDate) return 0;
    try {
      const hireDateObj = parseISO(hireDate);
      const today = currentDate;
      let years = today.getFullYear() - hireDateObj.getFullYear();
      if (today.getMonth() < hireDateObj.getMonth() || 
          (today.getMonth() === hireDateObj.getMonth() && today.getDate() < hireDateObj.getDate())) {
        years--;
      }
      return Math.max(0, years);
    } catch (error) {
      return 0;
    }
  };

  return (
    <div className="space-y-2">
      <h4 
        className="font-semibold text-sm border-b pb-1 p-2 rounded-t-lg"
        style={{
          backgroundColor: `rgb(${colors.schedule_pto_bg || '230,255,242'})`,
          borderColor: `rgb(${colors.schedule_pto_bg || '230,255,242'})`,
          color: `rgb(${colors.schedule_pto_text || '0,100,0'})`
        }}
      >
        {title}
      </h4>
      {ptoRecords.map((ptoRecord) => {
        // FIXED: Use raw date fields for birthday/anniversary detection
        const isBirthday = showSpecialOccasions && isBirthdayToday(ptoRecord.birthday);
        const isAnniversary = showSpecialOccasions && isAnniversaryToday(ptoRecord.hire_date);
        const yearsOfService = showSpecialOccasions ? calculateYearsOfService(ptoRecord.hire_date) : 0;

        return (
          <div 
            key={ptoRecord.id} 
            className="border rounded-lg p-3"
            style={{
              backgroundColor: `rgb(${colors.schedule_pto_bg || '230,255,242'})/0.5`,
              borderColor: `rgb(${colors.schedule_pto_bg || '230,255,242'})`,
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium">{ptoRecord.name}</p>
                  
                  {/* ADD INDICATORS FOR PTO RECORDS TOO - FIXED: Now using correctly calculated values */}
                  {showSpecialOccasions && (
                    <>
                      {isBirthday && (
                        <Badge 
                          variant="outline" 
                          className="bg-pink-100 text-pink-800 border-pink-300 text-xs"
                          title="Birthday Today!"
                        >
                          🎂
                        </Badge>
                      )}
                      {isAnniversary && (
                        <Badge 
                          variant="outline" 
                          className="bg-amber-100 text-amber-800 border-amber-300 text-xs"
                          title={`${yearsOfService} Year Anniversary`}
                        >
                          🎖️
                        </Badge>
                      )}
                    </>
                  )}
                </div>
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
                
                {/* Add anniversary/birthday details for PTO records */}
                {showSpecialOccasions && isAnniversary && yearsOfService > 0 && (
                  <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200">
                    <span className="text-sm font-medium">🎖️ {yearsOfService} Year{yearsOfService > 1 ? 's' : ''} Anniversary</span>
                  </div>
                )}
                
                {showSpecialOccasions && isBirthday && (
                  <div className="mt-2 p-2 bg-pink-50 rounded border border-pink-200">
                    <span className="text-sm font-medium">🎂 Birthday Today!</span>
                  </div>
                )}
              </div>
              {canEdit && (
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
