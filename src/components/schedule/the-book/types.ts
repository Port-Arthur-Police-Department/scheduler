// src/components/schedule/the-book/types.ts
import { PREDEFINED_POSITIONS, RANK_ORDER } from "@/constants/positions";
import { Tables } from "@/integrations/supabase/types";

export type TheBookView = "weekly" | "monthly" | "force-list" | "vacation-list" | "beat-preferences";
export type ScheduleType = "recurring" | "exception";
export type PTOType = "vacation" | "holiday" | "sick" | "comp";
export type ForceType = "true-force" | "regular-force";

export interface ForceListFilters {
  startDate: Date;
  endDate: Date;
  forceType: ForceType;
}

export interface VacationListFilters {
  year: number;
  showAll: boolean;
}

export interface BeatPreference {
  officerId: string;
  officerName: string;
  rank?: string;
  badgeNumber?: string;
  preferredBeats: string[];
  unavailableBeats: string[];
  notes?: string;
}

// Base interfaces
export interface OfficerSchedule {
  officerId: string;
  officerName: string;
  badgeNumber?: string;
  rank?: string;
  service_credit: number;
  date: string;
  dayOfWeek: number;
  isRegularRecurringDay: boolean;
  shiftInfo: ShiftInfo;
  weeklySchedule?: Record<string, any>;
  recurringDays?: Set<number>;
  profiles?: Tables<"profiles">;
}

export interface ShiftInfo {
  type: string;
  time: string;
  position: string;
  unitNumber?: string;
  scheduleId: string;
  scheduleType: ScheduleType;
  shift: Tables<"shift_types">;
  isOff: boolean;
  hasPTO?: boolean;
  ptoData?: PTOData;
  reason?: string;
}

export interface PTOData {
  id: string;
  ptoType: PTOType;
  startTime: string;
  endTime: string;
  isFullShift: boolean;
  shiftTypeId?: string;
}

export interface DailySchedule {
  date: string;
  dayOfWeek: number;
  officers: OfficerSchedule[];
  categorizedOfficers: {
    supervisors: OfficerSchedule[];
    officers: OfficerSchedule[];
    ppos: OfficerSchedule[];
  };
  staffing: {
    supervisors: number;
    officers: number;
    total: number;
  };
  isCurrentMonth?: boolean;
}

export interface ScheduleData {
  dailySchedules: DailySchedule[];
  dates: string[];
  recurring: Tables<"recurring_schedules">[];
  exceptions: Tables<"schedule_exceptions">[];
  startDate: string;
  endDate: string;
  minimumStaffing?: Map<number, Map<string, { minimumOfficers: number; minimumSupervisors: number }>>;
}

// Props interfaces
export interface TheBookProps {
  userRole?: 'officer' | 'supervisor' | 'admin';
  isAdminOrSupervisor?: boolean;
}

export interface ViewProps {
  currentDate: Date;
  selectedShiftId: string;
  schedules: ScheduleData | null;
  shiftTypes: Tables<"shift_types">[];
  isAdminOrSupervisor: boolean;
  weeklyColors: any;
  onDateNavigation: {
    goToPrevious: () => void;
    goToNext: () => void;
    goToCurrent: () => void;
  };
  onEventHandlers: {
    onAssignPTO: (schedule: any, date: string, officerId: string, officerName: string) => void;
    onRemovePTO: (schedule: any, date: string, officerId: string) => void;
    onEditAssignment: (officer: any, dateStr: string) => void;
    onRemoveOfficer: (scheduleId: string, type: ScheduleType, officerData?: any) => void;
  };
  mutations: {
    removeOfficerMutation: any;
    removePTOMutation: any;
  };
  navigateToDailySchedule: (dateStr: string) => void;
  getLastName: (name: string) => string;
  getRankAbbreviation: (rank: string) => string;
  getRankPriority: (rank: string) => number;
  isSupervisorByRank: (officer: any) => boolean;
}

export interface ExportOptions {
  startDate: Date;
  endDate: Date;
  shiftName: string;
  scheduleData: any[];
}
