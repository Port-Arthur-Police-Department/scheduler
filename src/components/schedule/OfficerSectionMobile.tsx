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

// Helper functions - copy these from your DailyScheduleViewMobile
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
  const currentDate = new Date(); // Or pass date as prop if needed

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
                  
                  {/* Special Occasion Indicators */}
                  {showSpecialOccasions && (
                    <>
                      {isBirthday && (
                        <Badge variant="outline" className="bg-pink-100 text-pink-800 border-pink-300 text-xs">
                          🎂
                        </Badge>
                      )}
                      {isAnniversary && (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                          🎖️
                        </Badge>
                      )}
                    </>
                  )}
                  
                  {isProbationary && (
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-800/50 text-xs">
                      PPO
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {officer.position || (sectionType === "special" ? "Special Assignment" : "No Position")}
                  </Badge>
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

// Also create a separate PTOSectionMobile component
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
        const isBirthday = showSpecialOccasions && isBirthdayToday(ptoRecord.birthday, currentDate);
        const isAnniversary = showSpecialOccasions && isAnniversaryToday(ptoRecord.hire_date, currentDate);

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
                  
                  {showSpecialOccasions && (
                    <>
                      {isBirthday && (
                        <Badge variant="outline" className="bg-pink-100 text-pink-800 border-pink-300 text-xs">
                          🎂
                        </Badge>
                      )}
                      {isAnniversary && (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                          🎖️
                        </Badge>
                      )}
                    </>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {ptoRecord.startTime} - {ptoRecord.endTime}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};