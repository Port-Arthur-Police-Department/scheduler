// components/settings/WebsiteSettings.tsx - UPDATED WITH IMPROVED NOTIFICATION CONTROLS
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Loader2, 
  Palette, 
  Eye, 
  EyeOff, 
  Download, 
  Filter, 
  Search, 
  Trash2, 
  CalendarIcon, 
  Bell, 
  AlertCircle // Make sure AlertCircle is here
} from "lucide-react";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PasswordResetManager } from "@/components/admin/PasswordResetManager";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { exportAuditToPDF } from "@/utils/auditPdfExport";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


// Update your DEFAULT_COLORS in WebsiteSettings.tsx
const DEFAULT_COLORS = {
  // PDF Export Colors
  pdf_supervisor_pto_bg: "255,255,200",
  pdf_supervisor_pto_border: "255,220,100", 
  pdf_supervisor_pto_text: "139,69,19",
  
  pdf_officer_pto_bg: "240,255,240",
  pdf_officer_pto_border: "144,238,144",
  pdf_officer_pto_text: "0,100,0",
  
  // NEW: Different PTO type colors
  pdf_vacation_bg: "173,216,230", // Light blue
  pdf_vacation_border: "100,149,237",
  pdf_vacation_text: "0,0,139",
  
  pdf_sick_bg: "255,200,200", // Light red
  pdf_sick_border: "255,100,100",
  pdf_sick_text: "139,0,0",
  
  pdf_holiday_bg: "255,218,185", // Light orange
  pdf_holiday_border: "255,165,0",
  pdf_holiday_text: "165,42,42",
  
  pdf_comp_bg: "221,160,221", // Light purple
  pdf_comp_border: "186,85,211",
  pdf_comp_text: "128,0,128",
  
  pdf_off_day_bg: "220,220,220",
  pdf_off_day_text: "100,100,100",
  
  // Weekly Schedule Colors - SYNC WITH PDF COLORS
  weekly_supervisor_bg: "255,255,255",
  weekly_supervisor_text: "0,0,0",
  
  weekly_officer_bg: "255,255,255", 
  weekly_officer_text: "0,0,0",
  
  weekly_ppo_bg: "255,250,240",
  weekly_ppo_text: "150,75,0",
  
  // NEW: Weekly PTO type colors (same as PDF but in RGB format)
  weekly_vacation_bg: "173,216,230",
  weekly_vacation_text: "0,0,139",
  
  weekly_sick_bg: "255,200,200",
  weekly_sick_text: "139,0,0",
  
  weekly_holiday_bg: "255,218,185",
  weekly_holiday_text: "165,42,42",
  
  weekly_comp_bg: "221,160,221",
  weekly_comp_text: "128,0,128",
  
  weekly_pto_bg: "144,238,144", // General PTO fallback
  weekly_pto_text: "0,100,0",
  
  weekly_off_bg: "240,240,240",
  weekly_off_text: "100,100,100",

    // NEW: Schedule Section Colors for both Desktop and Mobile
  schedule_supervisor_bg: "240,248,255", // Light blue (AliceBlue)
  schedule_supervisor_text: "25,25,112", // Dark blue text
  
  schedule_officer_bg: "248,249,250", // Light gray
  schedule_officer_text: "33,37,41", // Dark gray text
  
  schedule_special_bg: "243,229,245", // Light purple
  schedule_special_text: "102,51,153", // Dark purple text (RebeccaPurple)
  
  schedule_pto_bg: "230,255,242", // Light green (MintCream variant)
  schedule_pto_text: "0,100,0", // Dark green text (DarkGreen)
};

// Default PTO type visibility settings
const DEFAULT_PTO_VISIBILITY = {
  show_vacation_pto: true,
  show_holiday_pto: true,
  show_sick_pto: false,
  show_comp_pto: false,
};

// Default notification settings
const DEFAULT_NOTIFICATION_SETTINGS = {
  // Global notification sending toggle (ONLY for sending notifications)
  enable_notifications: false,
  
  // Mass alert sending feature (send to people + allow responses)
  enable_mass_alert_sending: true,  // NEW: Controls the mass alert sending feature

  // Staffing Overview toggle
  show_staffing_overview: true, // NEW: Controls the Staffing Overview section
  
  // Specific notification types
  enable_vacancy_alerts: true,
  enable_pto_request_notifications: true,
  enable_pto_status_notifications: true,
  enable_supervisor_pto_notifications: true,
  enable_schedule_change_notifications: true,
  
  // Button visibility (always visible when mass alert sending is enabled)
  show_vacancy_alert_buttons: true,
  
  // Notification display settings
  show_pto_balances: false,
  pto_balances_visible: false,

  enable_supervisor_pto_notifications: true, // Add this line
};

interface WebsiteSettingsProps {
  isAdmin?: boolean;
  isSupervisor?: boolean;
}

// Add this interface
interface AuditLog {
  id: string;
  user_email: string;
  action_type: string;
  table_name?: string;
  description: string;
  created_at: string;
  ip_address?: string;
  old_values?: any;
  new_values?: any;
}


interface Officer {
  id: string;
  full_name: string;
  badge_number?: string;
  phone?: string;
  email?: string;
  current_shift?: {
    id: string;
    name: string;
  } | null;
}


// Add this component inside your WebsiteSettings component
const AuditLogViewer = () => {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 2),
    to: new Date()
  });
  const [selectedActionTypes, setSelectedActionTypes] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ['audit-logs', dateRange, selectedActionTypes, selectedUsers, selectedTables],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .order('created_at', { ascending: false });

      if (selectedActionTypes.length > 0) {
        query = query.in('action_type', selectedActionTypes);
      }

      if (selectedUsers.length > 0) {
        query = query.in('user_email', selectedUsers);
      }

      if (selectedTables.length > 0) {
        query = query.in('table_name', selectedTables);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching audit logs:', error);
        throw error;
      }

      return data as AuditLog[];
    },
  });

  const { data: distinctValues } = useQuery({
    queryKey: ['audit-distinct-values'],
    queryFn: async () => {
      const { data: actionTypes } = await supabase
        .from('audit_logs')
        .select('action_type')
        .not('action_type', 'is', null);

      const { data: users } = await supabase
        .from('audit_logs')
        .select('user_email')
        .not('user_email', 'is', null);

      const { data: tables } = await supabase
        .from('audit_logs')
        .select('table_name')
        .not('table_name', 'is', null);

      return {
        actionTypes: [...new Set(actionTypes?.map(a => a.action_type) || [])],
        users: [...new Set(users?.map(u => u.user_email) || [])],
        tables: [...new Set(tables?.map(t => t.table_name) || [])],
      };
    },
  });

  const filteredLogs = auditLogs?.filter(log => 
    log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.action_type.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleExportPDF = async () => {
    if (!filteredLogs.length) {
      toast.error("No audit data to export");
      return;
    }

    try {
      const success = await exportAuditToPDF(
        filteredLogs,
        {
          startDate: dateRange.from,
          endDate: dateRange.to,
          actionTypes: selectedActionTypes,
          users: selectedUsers,
          tables: selectedTables
        },
        `audit-report-${new Date().toISOString().split('T')[0]}.pdf`
      );

      if (success) {
        toast.success("Audit report exported successfully");
      } else {
        toast.error("Failed to export audit report");
      }
    } catch (error) {
      toast.error("Error exporting audit report");
    }
  };

  const clearFilters = () => {
    setSelectedActionTypes([]);
    setSelectedUsers([]);
    setSelectedTables([]);
    setSearchQuery("");
    setDateRange({
      from: subDays(new Date(), 2),
      to: new Date()
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Audit Logs
        </CardTitle>
        <CardDescription>
          View and export system activity and changes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg">
          {/* Date Range */}
          <div className="space-y-2">
            <Label>Date Range</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={(range) => setDateRange(range as { from: Date; to: Date })}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Action Type Filter */}
          <div className="space-y-2">
            <Label>Action Type</Label>
            <Select
              value=""
              onValueChange={(value) => {
                if (value && !selectedActionTypes.includes(value)) {
                  setSelectedActionTypes([...selectedActionTypes, value]);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                {distinctValues?.actionTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              {selectedActionTypes.map(type => (
                <Badge key={type} variant="secondary" className="flex items-center gap-1">
                  {type}
                  <button
                    onClick={() => setSelectedActionTypes(selectedActionTypes.filter(t => t !== type))}
                    className="hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* User Filter */}
          <div className="space-y-2">
            <Label>User</Label>
            <Select
              value=""
              onValueChange={(value) => {
                if (value && !selectedUsers.includes(value)) {
                  setSelectedUsers([...selectedUsers, value]);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by user" />
              </SelectTrigger>
              <SelectContent>
                {distinctValues?.users.map(user => (
                  <SelectItem key={user} value={user}>
                    {user}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              {selectedUsers.map(user => (
                <Badge key={user} variant="secondary" className="flex items-center gap-1">
                  {user}
                  <button
                    onClick={() => setSelectedUsers(selectedUsers.filter(u => u !== user))}
                    className="hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="space-y-2">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button onClick={handleExportPDF} disabled={!filteredLogs.length}>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
          <Badge variant="secondary">
            {filteredLogs.length} events
          </Badge>
        </div>

        {/* Audit Logs Table */}
        <div className="border rounded-lg">
          <div className="max-h-96 overflow-auto">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading audit logs...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No audit logs found for the selected filters
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Timestamp</th>
                    <th className="p-2 text-left">User</th>
                    <th className="p-2 text-left">Action</th>
                    <th className="p-2 text-left">Description</th>
                    <th className="p-2 text-left">IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-t hover:bg-muted/30">
                      <td className="p-2">
                        {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm')}
                      </td>
                      <td className="p-2 font-medium">{log.user_email}</td>
                      <td className="p-2">
                        <Badge variant="outline">{log.action_type}</Badge>
                      </td>
                      <td className="p-2">{log.description}</td>
                      <td className="p-2 text-muted-foreground">
                        {log.ip_address || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const WebsiteSettings = ({ isAdmin = false, isSupervisor = false }: WebsiteSettingsProps) => {
  const queryClient = useQueryClient();
  const [colorSettings, setColorSettings] = useState(DEFAULT_COLORS);
  const [ptoVisibility, setPtoVisibility] = useState(DEFAULT_PTO_VISIBILITY);

  // ========== MANUAL ALERT SENDER COMPONENT ==========
  const ManualAlertSender = () => {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
    const [isSending, setIsSending] = useState(false);
    const [sendMethod, setSendMethod] = useState<'in_app' | 'all'>('in_app');
    const [useActiveSchedulePeriod, setUseActiveSchedulePeriod] = useState(true); // New toggle

    // ========== HELPER FUNCTIONS ==========
    // Helper function to parse time string to minutes since midnight
    const parseTimeToMinutes = (timeStr: string): number => {
      if (!timeStr) return 0;
      
      const parts = timeStr.split(':').map(Number);
      const hours = parts[0];
      const minutes = parts[1] || 0;
      
      return hours * 60 + minutes;
    };

    // Helper to format time for display (24h to 12h)
    const formatTimeForDisplay = (timeStr: string): string => {
      const minutes = parseTimeToMinutes(timeStr);
      const hours24 = Math.floor(minutes / 60);
      const mins = minutes % 60;
      
      const period = hours24 >= 12 ? 'PM' : 'AM';
      const hours12 = hours24 % 12 || 12;
      
      return `${hours12}:${mins.toString().padStart(2, '0')} ${period}`;
    };

    // Main function to check if officer is on shift NOW
    const isOfficerCurrentlyOnShift = (shiftType: any): boolean => {
      if (!shiftType) return false;
      
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      const startMinutes = parseTimeToMinutes(shiftType.start_time);
      const endMinutes = parseTimeToMinutes(shiftType.end_time);
      const crossesMidnight = shiftType.crosses_midnight || endMinutes < startMinutes;
      
      if (crossesMidnight) {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      } else {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      }
    };

    // Get which shifts are currently active based on time
    const getCurrentlyActiveShifts = (shiftTypes: any[]): string[] => {
      const activeShifts: string[] = [];
      const currentTime = new Date();
      const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
      
      shiftTypes?.forEach(shift => {
        if (isOfficerCurrentlyOnShift(shift)) {
          activeShifts.push(shift.name);
        }
      });
      
      return activeShifts;
    };

    // Check if a date is within schedule period
    const isDateWithinSchedulePeriod = (startDate: string, endDate: string | null, checkDate: string): boolean => {
      const check = new Date(checkDate);
      const start = new Date(startDate);
      
      if (check < start) return false;
      
      if (endDate) {
        const end = new Date(endDate);
        return check <= end;
      }
      
      return true; // No end date means indefinite
    };
    // ========== END HELPER FUNCTIONS ==========

    // Get shift types from database
    const { data: shiftTypes } = useQuery({
      queryKey: ['shift-types'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('shift_types')
          .select('id, name, start_time, end_time, crosses_midnight')
          .order('name', { ascending: true });
        
        if (error) {
          console.error('Error fetching shift types:', error);
          return [];
        }
        return data;
      },
    });

    // Get today's date info
    const todayDate = new Date().toISOString().split('T')[0];
    const todayDayOfWeek = new Date().getDay();
    
    console.log(`📅 Today: ${todayDate}, Day of week: ${todayDayOfWeek}`);

    // Get ALL officers and their current assigned shift (based on ANY active schedule)
    const { data: officersWithShifts, isLoading } = useQuery({
      queryKey: ['officers-active-schedules', todayDate],
      queryFn: async () => {
        console.log('🔍 Fetching officers with active schedules...');
        
        try {
          // 1. Get all active officers
          const { data: officers, error: officersError } = await supabase
            .from('profiles')
            .select('id, full_name, badge_number, phone, email')
            .eq('active', true)
            .order('full_name', { ascending: true });

          if (officersError) {
            console.error('❌ Error fetching officers:', officersError);
            return [];
          }

          console.log(`✅ Found ${officers?.length || 0} active officers`);

          // 2. For each officer, find their MOST RECENT active schedule
          const officersWithCurrentShifts = await Promise.all(
            officers.map(async (officer) => {
              try {
                let query = supabase
                  .from('recurring_schedules')
                  .select(`
                    shift_type_id,
                    start_date,
                    end_date,
                    day_of_week,
                    shift_types!inner(id, name, start_time, end_time, crosses_midnight)
                  `)
                  .eq('officer_id', officer.id)
                  .eq('is_active', true)
                  .lte('start_date', todayDate)
                  .or(`end_date.is.null,end_date.gte.${todayDate}`)
                  .order('created_at', { ascending: false })
                  .limit(1);

                // If using active schedule period only (not specific day of week)
                if (useActiveSchedulePeriod) {
                  // Don't filter by day_of_week - include all schedules in period
                  // Just get the most recent schedule
                } else {
                  // Original logic: filter by today's day of week
                  query = query.eq('day_of_week', todayDayOfWeek);
                }

                const { data: activeSchedules } = await query;

                // If officer has an active schedule within period
                if (activeSchedules && activeSchedules.length > 0) {
                  const schedule = activeSchedules[0];
                  const shiftType = schedule.shift_types;
                  
                  if (shiftType) {
                    // Check if this shift is currently active based on time
                    const isCurrentlyOnShift = isOfficerCurrentlyOnShift(shiftType);
                    
                    return {
                      ...officer,
                      current_shift: {
                        id: shiftType.id,
                        name: shiftType.name,
                        is_active_now: isCurrentlyOnShift,
                        schedule_type: useActiveSchedulePeriod ? 'period' : 'specific_day'
                      },
                      shift_details: shiftType,
                      schedule_info: {
                        start_date: schedule.start_date,
                        end_date: schedule.end_date,
                        day_of_week: schedule.day_of_week
                      }
                    };
                  }
                }

                // No active schedule found
                return {
                  ...officer,
                  current_shift: null,
                  schedule_info: null
                };
              } catch (error) {
                console.error(`❌ Error processing ${officer.full_name}:`, error);
                return {
                  ...officer,
                  current_shift: null,
                  schedule_info: null
                };
              }
            })
          );

          // Log results
          const withSchedules = officersWithCurrentShifts.filter(o => o.current_shift).length;
          const activeNow = officersWithCurrentShifts.filter(o => o.current_shift?.is_active_now).length;
          
          console.log(`📊 Results: ${withSchedules} officers with active schedules, ${activeNow} currently on shift`);
          console.log(`⚙️ Using schedule type: ${useActiveSchedulePeriod ? 'Active Period Only' : 'Specific Day of Week'}`);
          
          if (withSchedules > 0) {
            console.log('👮 Officers with active schedules:',
              officersWithCurrentShifts
                .filter(o => o.current_shift)
                .slice(0, 5)
                .map(o => `${o.full_name} (${o.current_shift?.name})`)
            );
          }

          return officersWithCurrentShifts;
        } catch (error) {
          console.error('❌ Error fetching officers:', error);
          return [];
        }
      },
      enabled: !!shiftTypes,
    });

    // Set default selected shifts when shiftTypes are loaded
    useEffect(() => {
      if (shiftTypes && shiftTypes.length > 0 && selectedShifts.length === 0) {
        const allShiftNames = shiftTypes.map(st => st.name);
        setSelectedShifts(allShiftNames);
        console.log('✅ Default shifts selected:', allShiftNames);
      }
    }, [shiftTypes]);

    // Calculate which shifts are active right now
    const activeShiftsNow = getCurrentlyActiveShifts(shiftTypes || []);

    // Filter officers by selected shifts
    const filteredOfficers = officersWithShifts?.filter(officer => {
      if (!officer.current_shift) return false;
      return selectedShifts.includes(officer.current_shift.name);
    }) || [];

    const handleShiftToggle = (shift: string) => {
      if (selectedShifts.includes(shift)) {
        setSelectedShifts(selectedShifts.filter(s => s !== shift));
      } else {
        setSelectedShifts([...selectedShifts, shift]);
      }
    };

    const handleSendAlert = async () => {
      if (!message.trim()) {
        toast.error("Please enter a message");
        return;
      }

      if (filteredOfficers.length === 0) {
        toast.error("No officers match the selected shifts");
        return;
      }

      setIsSending(true);
      console.log(`📤 Starting to send alert to ${filteredOfficers.length} officers...`);

      try {
        let successful = 0;
        let failed = 0;

        // Process each officer
        for (const officer of filteredOfficers) {
          try {
            console.log(`📤 Sending to ${officer.full_name} (${officer.current_shift?.name})...`);
            
            // Send in-app notification
            const { error: notificationError } = await supabase
              .from('notifications')
              .insert({
                user_id: officer.id,
                title: 'Department Alert',
                message: message,
                type: 'manual_alert',
                is_read: false,
                created_at: new Date().toISOString()
              });

            if (notificationError) {
              console.error(`❌ Failed to send in-app notification:`, notificationError);
              failed++;
            } else {
              console.log(`✅ In-app notification sent to ${officer.full_name}`);
              successful++;
            }

            // Optional: Send email if selected
            if (sendMethod === 'all' && officer.email) {
              try {
                const emailResponse = await fetch('/api/send-vacancy-alert', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    to: officer.email,
                    subject: 'Department Alert',
                    message: message,
                    customMessage: message
                  })
                });

                if (!emailResponse.ok) {
                  console.warn(`⚠️ Email failed for ${officer.full_name}`);
                } else {
                  console.log(`✅ Email sent to ${officer.full_name}`);
                }
              } catch (emailError) {
                console.warn(`⚠️ Email error:`, emailError);
              }
            }

            // Optional: Send SMS if selected  
            if (sendMethod === 'all' && officer.phone) {
              try {
                const smsResponse = await fetch('/api/send-text-alert', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    to: officer.phone,
                    message: `Department Alert: ${message}`
                  })
                });

                if (!smsResponse.ok) {
                  console.warn(`⚠️ SMS failed for ${officer.full_name}`);
                } else {
                  console.log(`✅ SMS sent to ${officer.full_name}`);
                }
              } catch (smsError) {
                console.warn(`⚠️ SMS error:`, smsError);
              }
            }

          } catch (error) {
            console.error(`❌ Error sending to ${officer.full_name}:`, error);
            failed++;
          }
        }

        // Log to audit
        const { data: userData } = await supabase.auth.getUser();
        await supabase.from('audit_logs').insert({
          user_email: userData.user?.email,
          action_type: 'manual_alert_sent',
          table_name: 'notifications',
          description: `Sent manual alert to ${successful} officers on shifts: ${selectedShifts.join(', ')}. Message: ${message.substring(0, 100)}...`
        });

        toast.success(`Alert sent to ${successful} officers on ${selectedShifts.length} shift(s)`);
        setOpen(false);
        setMessage("");

      } catch (error) {
        console.error('❌ Error sending manual alert:', error);
        toast.error('Failed to send alert');
      } finally {
        setIsSending(false);
      }
    };

    // Debug logging
    useEffect(() => {
      console.log('🔍 DEBUG - Manual Alert System:', {
        todayDate,
        todayDayOfWeek,
        shiftTypesCount: shiftTypes?.length,
        officersCount: officersWithShifts?.length,
        filteredCount: filteredOfficers.length,
        selectedShifts,
        activeShiftsNow,
        useActiveSchedulePeriod
      });
    }, [shiftTypes, officersWithShifts, filteredOfficers, selectedShifts, todayDate, todayDayOfWeek, activeShiftsNow, useActiveSchedulePeriod]);

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Manual Alert System
          </CardTitle>
          <CardDescription>
            Send alerts to officers based on their assigned shifts during active schedule periods
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {/* Schedule Type Toggle */}
            <div className="p-3 border rounded-lg bg-blue-50">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium text-blue-800">Schedule Filtering</Label>
                  <p className="text-sm text-blue-700">
                    {useActiveSchedulePeriod 
                      ? 'Include all officers with active schedules (any day of week)' 
                      : 'Only officers scheduled for today\'s specific day of week'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Day of Week</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={useActiveSchedulePeriod}
                      onChange={(e) => setUseActiveSchedulePeriod(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                  <span className="text-sm text-gray-600">Active Period</span>
                </div>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                <strong>Active Period:</strong> Includes officers with ANY schedule between {todayDate} (even if not working today)<br/>
                <strong>Day of Week:</strong> Only includes officers scheduled for {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][todayDayOfWeek]}
              </p>
            </div>

            {/* Current Time Info */}
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-green-800">Current Status</h4>
                  <p className="text-sm text-green-700">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}<br/>
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-green-800">
                    Active shifts: {activeShiftsNow.length > 0 ? activeShiftsNow.join(', ') : 'None'}
                  </p>
                </div>
              </div>
            </div>

            {/* Shift Schedule Display */}
            <div>
              <Label className="text-base mb-2 block">Shift Schedule</Label>
              <div className="space-y-2 text-sm">
                {shiftTypes?.map(shift => {
                  const startTime = formatTimeForDisplay(shift.start_time);
                  const endTime = formatTimeForDisplay(shift.end_time);
                  const crosses = shift.crosses_midnight || parseTimeToMinutes(shift.end_time) < parseTimeToMinutes(shift.start_time);
                  const isActive = activeShiftsNow.includes(shift.name);
                  
                  return (
                    <div 
                      key={shift.id} 
                      className={`flex justify-between items-center p-2 rounded ${isActive ? 'bg-green-100 border border-green-200' : 'bg-gray-50'}`}
                    >
                      <span className="font-medium">{shift.name}</span>
                      <span>
                        {startTime} - {endTime}
                        {crosses && ' 🌙'}
                      </span>
                      {isActive && <span className="text-green-600 font-bold text-xs">ACTIVE</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Shift Filter */}
            <div>
              <Label className="text-base mb-2 block">Filter by Shift</Label>
              <div className="flex flex-wrap gap-2">
                {shiftTypes?.map((shift) => (
                  <Button
                    key={shift.id}
                    type="button"
                    variant={selectedShifts.includes(shift.name) ? "default" : "outline"}
                    onClick={() => handleShiftToggle(shift.name)}
                    className="flex-1 min-w-[100px]"
                  >
                    {shift.name}
                  </Button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Selected: {selectedShifts.length > 0 ? selectedShifts.join(', ') : 'None'}
              </p>
            </div>

            {/* Affected Officers Count */}
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium">Officers with Active Schedules:</span>
                <span className="text-lg font-bold">
                  {isLoading ? 'Loading...' : filteredOfficers.length}
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                {selectedShifts.length === 0 
                  ? 'Select shifts to see affected officers' 
                  : filteredOfficers.length === 0 
                    ? 'No officers on selected shifts' 
                    : `${filteredOfficers.length} officer(s) will receive the alert`}
              </div>
              {!isLoading && officersWithShifts && (
                <div className="text-xs text-muted-foreground mt-2">
                  Total officers with schedules: {officersWithShifts.filter(o => o.current_shift).length}
                </div>
              )}
            </div>

            {/* Send Method Selection */}
            <div>
              <Label className="text-base mb-2 block">Send Method</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={sendMethod === 'in_app' ? "default" : "outline"}
                  onClick={() => setSendMethod('in_app')}
                  className="flex-1 min-w-[100px]"
                >
                  In-App Only
                </Button>
                <Button
                  type="button"
                  variant={sendMethod === 'all' ? "default" : "outline"}
                  onClick={() => setSendMethod('all')}
                  className="flex-1 min-w-[100px]"
                >
                  All Methods
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                <strong>In-App Only:</strong> Send only in-app notifications (always works)<br/>
                <strong>All Methods:</strong> Also try email/SMS (requires contact info)
              </p>
            </div>
          </div>

          {/* Send Button Dialog */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button 
                className="w-full" 
                size="lg"
                disabled={isLoading || filteredOfficers.length === 0 || selectedShifts.length === 0}
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Create Manual Alert
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Send Manual Alert</DialogTitle>
                <DialogDescription>
                  This alert will be sent to {filteredOfficers.length} officer(s) on {selectedShifts.join(', ')} shifts via {sendMethod === 'in_app' ? 'in-app notifications only' : 'in-app, email, and SMS'}.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="alert-message">Alert Message *</Label>
                  <Textarea
                    id="alert-message"
                    placeholder="Enter your alert message here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    className="resize-none"
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    {message.length}/500 characters
                  </p>
                </div>
                
                <div className="bg-muted p-3 rounded-lg">
                  <h4 className="font-medium mb-2">Preview:</h4>
                  <p className="text-sm whitespace-pre-wrap">{message || 'Your message will appear here...'}</p>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  <strong>Schedule Filter:</strong> {useActiveSchedulePeriod ? 'Active Period' : 'Specific Day'} mode<br/>
                  <strong>Recipients:</strong> Officers assigned to {selectedShifts.join(', ')} shifts
                </div>
              </div>
              
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isSending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendAlert}
                  disabled={!message.trim() || isSending}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Alert'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    );
  };
  // ========== END OF MANUAL ALERT SENDER ==========
  
  // Fetch current settings with better error handling
  const { data: settings, isLoading } = useQuery({
    queryKey: ['website-settings'],
    queryFn: async () => {
      console.log('Fetching website settings...');
      
      const { data, error } = await supabase
        .from('website_settings')
        .select('*')
        .single();

      if (error) {
        console.log('Error fetching settings:', error);
        
        // If no settings exist yet, create default record
        if (error.code === 'PGRST116') {
          console.log('No settings found, creating default...');
          const { data: newSettings, error: createError } = await supabase
            .from('website_settings')
            .insert({
              ...DEFAULT_NOTIFICATION_SETTINGS,
              color_settings: DEFAULT_COLORS,
              pto_type_visibility: DEFAULT_PTO_VISIBILITY
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating default settings:', createError);
            throw createError;
          }
          
          console.log('Default settings created:', newSettings);
          return newSettings;
        }
        throw error;
      }

      console.log('Settings fetched successfully:', data);
      
      // Ensure color_settings exists and has all required properties
      if (!data.color_settings) {
        console.log('No color_settings found, using defaults');
        data.color_settings = DEFAULT_COLORS;
      } else {
        // Merge with defaults to ensure all properties exist
        data.color_settings = { ...DEFAULT_COLORS, ...data.color_settings };
      }
      
      // Ensure pto_type_visibility exists and has all required properties
      if (!data.pto_type_visibility) {
        console.log('No pto_type_visibility found, using defaults');
        data.pto_type_visibility = DEFAULT_PTO_VISIBILITY;
      } else {
        // Merge with defaults to ensure all properties exist
        data.pto_type_visibility = { ...DEFAULT_PTO_VISIBILITY, ...data.pto_type_visibility };
      }
      
      // Ensure notification settings exist
      for (const key in DEFAULT_NOTIFICATION_SETTINGS) {
        if (data[key] === undefined) {
          data[key] = DEFAULT_NOTIFICATION_SETTINGS[key as keyof typeof DEFAULT_NOTIFICATION_SETTINGS];
        }
      }
      
      return data;
    },
    retry: 1,
  });

  // Update color settings when settings load
  useEffect(() => {
    if (settings?.color_settings) {
      console.log('Setting color settings:', settings.color_settings);
      setColorSettings(settings.color_settings);
    }
    if (settings?.pto_type_visibility) {
      console.log('Setting PTO visibility:', settings.pto_type_visibility);
      setPtoVisibility(settings.pto_type_visibility);
    }
  }, [settings]);

  // Update settings mutation with better error handling
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      console.log('Updating settings:', newSettings);
      
      const { data, error } = await supabase
        .from('website_settings')
        .upsert({
          ...newSettings,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error updating settings:', error);
        throw error;
      }
      
      console.log('Settings updated successfully:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website-settings'] });
      toast.success("Settings updated successfully");
    },
    onError: (error) => {
      console.error("Error updating settings:", error);
      toast.error("Failed to update settings");
    },
  });

  const handleToggle = (key: string, value: boolean) => {
    updateSettingsMutation.mutate({
      id: settings?.id,
      [key]: value,
      color_settings: colorSettings,
      pto_type_visibility: ptoVisibility,
    });
  };

  const handlePtoVisibilityToggle = (key: string, value: boolean) => {
    const newPtoVisibility = { ...ptoVisibility, [key]: value };
    setPtoVisibility(newPtoVisibility);
    
    updateSettingsMutation.mutate({
      id: settings?.id,
      pto_type_visibility: newPtoVisibility,
      color_settings: colorSettings,
    });
  };

  // Helper function to convert hex to RGB string
  const hexToRgbString = (hex: string): string => {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Validate hex length
    if (hex.length !== 6) {
      console.warn('Invalid hex length:', hex, 'using default white');
      return '255,255,255';
    }
    
    try {
      // Parse hex values
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      
      // Validate parsed values
      if (isNaN(r) || isNaN(g) || isNaN(b)) {
        console.warn('Invalid hex values:', hex, 'using default white');
        return '255,255,255';
      }
      
      return `${r},${g},${b}`;
    } catch (error) {
      console.error('Error converting hex to RGB:', error, 'hex:', hex);
      return '255,255,255';
    }
  };

  // Helper function to convert RGB string to hex
  const rgbStringToHex = (rgb: string | undefined): string => {
    // If rgb is undefined, return default black
    if (!rgb) {
      console.warn('RGB string is undefined, returning default black');
      return '#000000';
    }
    
    try {
      const parts = rgb.split(',').map(part => parseInt(part.trim()));
      
      // Validate that we have exactly 3 parts and they're all numbers
      if (parts.length !== 3 || parts.some(isNaN)) {
        console.warn('Invalid RGB string:', rgb, 'returning default black');
        return '#000000';
      }
      
      return `#${parts[0].toString(16).padStart(2, '0')}${parts[1].toString(16).padStart(2, '0')}${parts[2].toString(16).padStart(2, '0')}`;
    } catch (error) {
      console.error('Error converting RGB to hex:', error, 'rgb:', rgb);
      return '#000000';
    }
  };

  const handleColorChange = (key: string, value: string) => {
    const rgbValue = hexToRgbString(value);
    const newColors = { ...colorSettings, [key]: rgbValue };
    setColorSettings(newColors);
    
    console.log('Color changed:', { key, value, rgbValue });
    
    // Auto-save color changes
    updateSettingsMutation.mutate({
      id: settings?.id,
      color_settings: newColors,
      pto_type_visibility: ptoVisibility,
    });
  };

  const resetToDefaults = () => {
    console.log('Resetting to default colors and PTO visibility');
    setColorSettings(DEFAULT_COLORS);
    setPtoVisibility(DEFAULT_PTO_VISIBILITY);
    updateSettingsMutation.mutate({
      id: settings?.id,
      color_settings: DEFAULT_COLORS,
      pto_type_visibility: DEFAULT_PTO_VISIBILITY,
      ...DEFAULT_NOTIFICATION_SETTINGS,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading settings...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      
{/* NOTIFICATION SETTINGS CARD - RESTRUCTURED */}
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Bell className="h-5 w-5" />
      Notification & Alert Settings
    </CardTitle>
    <CardDescription>
      Control different notification features and alert systems
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-8">
    
    {/* SECTION 1: Mass Alert Sending System */}
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Mass Alert System</h3>
      <div className="pl-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="mass-alert-toggle" className="text-base">
              Enable Mass Alert Sending
            </Label>
            <div className="text-sm text-muted-foreground">
              Controls the "Create Manual Alert" and "Create All Alerts" buttons on the Vacancy Management page.
              When disabled, users cannot send alerts to people or receive responses.
            </div>
          </div>
          <Switch
            id="mass-alert-toggle"
            checked={settings?.enable_mass_alert_sending !== false}
            onCheckedChange={(checked) => 
              handleToggle('enable_mass_alert_sending', checked)
            }
            disabled={updateSettingsMutation.isPending}
          />
        </div>
        
        {/* Vacancy Alert Buttons (only shown when mass alerts are enabled) */}
        <div className={`flex items-center justify-between ${!settings?.enable_mass_alert_sending ? 'opacity-60' : ''}`}>
          <div className="space-y-0.5">
            <Label 
              htmlFor="vacancy-button-toggle" 
              className={`text-base ${!settings?.enable_mass_alert_sending ? 'text-muted-foreground' : ''}`}
            >
              Show Vacancy Alert Subscription Buttons
            </Label>
            <div className={`text-sm ${!settings?.enable_mass_alert_sending ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
              Allow users to subscribe to vacancy alerts (requires Mass Alert System to be enabled)
            </div>
          </div>
          <Switch
            id="vacancy-button-toggle"
            checked={settings?.show_vacancy_alert_buttons !== false}
            onCheckedChange={(checked) => 
              handleToggle('show_vacancy_alert_buttons', checked)
            }
            disabled={updateSettingsMutation.isPending || !settings?.enable_mass_alert_sending}
          />
        </div>
      </div>
    </div>

    <Separator />

<div className="space-y-4">
  <h3 className="text-lg font-semibold">Dashboard Display Settings</h3>
  <div className="pl-4 space-y-4">
    {/* Staffing Overview Toggle */}
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor="staffing-overview-toggle" className="text-base">
          Show Staffing Overview
        </Label>
        <div className="text-sm text-muted-foreground">
          Display the Staffing Overview section on the dashboard for admin/supervisor users
        </div>
      </div>
      <Switch
        id="staffing-overview-toggle"
        checked={settings?.show_staffing_overview !== false}
        onCheckedChange={(checked) => 
          handleToggle('show_staffing_overview', checked)
        }
        disabled={updateSettingsMutation.isPending}
      />
    </div>
  </div>
</div>
    
    <Separator />
    
    {/* SECTION 2: Automated Notifications */}
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Automated Notifications</h3>
      <div className="pl-4 space-y-4">
        {/* Global Notification Sending Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notifications-toggle" className="text-base">
              Enable All Automated Notifications
            </Label>
            <div className="text-sm text-muted-foreground">
              Master switch for automated notifications (PTO requests, schedule changes, etc.)
            </div>
          </div>
          <Switch
            id="notifications-toggle"
            checked={settings?.enable_notifications || false}
            onCheckedChange={(checked) => 
              handleToggle('enable_notifications', checked)
            }
            disabled={updateSettingsMutation.isPending}
          />
        </div>
{/* Supervisor PTO Notification Settings */}
        <div className={`flex items-center justify-between ${!settings?.enable_notifications ? 'opacity-60' : ''}`}>
  <div className="space-y-0.5">
    <Label 
      htmlFor="supervisor-pto-notifications-toggle" 
      className={`text-base ${!settings?.enable_notifications ? 'text-muted-foreground' : ''}`}
    >
      Supervisor PTO Notifications
    </Label>
    <div className={`text-sm ${!settings?.enable_notifications ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
      Notify supervisors when other supervisors request PTO
    </div>
  </div>
  <Switch
    id="supervisor-pto-notifications-toggle"
    checked={settings?.enable_supervisor_pto_notifications !== false}
    onCheckedChange={(checked) => 
      handleToggle('enable_supervisor_pto_notifications', checked)
    }
    disabled={updateSettingsMutation.isPending || !settings?.enable_notifications}
  />
</div>

        {/* Show a message when notifications are disabled */}
        {!settings?.enable_notifications && (
          <Alert className="bg-gray-50 border-gray-200">
            <AlertCircle className="h-4 w-4 text-gray-600" />
            <AlertDescription className="text-gray-700">
              Automated notifications are currently disabled. Enable above to configure individual settings.
            </AlertDescription>
          </Alert>
        )}

        {/* Vacancy Alert NOTIFICATIONS */}
        <div className={`flex items-center justify-between ${!settings?.enable_notifications ? 'opacity-60' : ''}`}>
          <div className="space-y-0.5">
            <Label 
              htmlFor="vacancy-alerts-toggle" 
              className={`text-base ${!settings?.enable_notifications ? 'text-muted-foreground' : ''}`}
            >
              Send Vacancy Alert Notifications
            </Label>
            <div className={`text-sm ${!settings?.enable_notifications ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
              Automatically send notifications when vacancies occur to subscribed users
            </div>
          </div>
          <Switch
            id="vacancy-alerts-toggle"
            checked={settings?.enable_vacancy_alerts !== false}
            onCheckedChange={(checked) => 
              handleToggle('enable_vacancy_alerts', checked)
            }
            disabled={updateSettingsMutation.isPending || !settings?.enable_notifications}
          />
        </div>

        {/* PTO Request Notifications */}
        <div className={`flex items-center justify-between ${!settings?.enable_notifications ? 'opacity-60' : ''}`}>
          <div className="space-y-0.5">
            <Label 
              htmlFor="pto-request-notifications-toggle" 
              className={`text-base ${!settings?.enable_notifications ? 'text-muted-foreground' : ''}`}
            >
              PTO Request Notifications
            </Label>
            <div className={`text-sm ${!settings?.enable_notifications ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
              Notify supervisors and admins when a new PTO request is submitted
            </div>
          </div>
          <Switch
            id="pto-request-notifications-toggle"
            checked={settings?.enable_pto_request_notifications !== false}
            onCheckedChange={(checked) => 
              handleToggle('enable_pto_request_notifications', checked)
            }
            disabled={updateSettingsMutation.isPending || !settings?.enable_notifications}
          />
        </div>

        {/* PTO Status Notifications */}
        <div className={`flex items-center justify-between ${!settings?.enable_notifications ? 'opacity-60' : ''}`}>
          <div className="space-y-0.5">
            <Label 
              htmlFor="pto-status-notifications-toggle" 
              className={`text-base ${!settings?.enable_notifications ? 'text-muted-foreground' : ''}`}
            >
              PTO Status Notifications
            </Label>
            <div className={`text-sm ${!settings?.enable_notifications ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
              Notify officers when their PTO request is approved or denied
            </div>
          </div>
          <Switch
            id="pto-status-notifications-toggle"
            checked={settings?.enable_pto_status_notifications !== false}
            onCheckedChange={(checked) => 
              handleToggle('enable_pto_status_notifications', checked)
            }
            disabled={updateSettingsMutation.isPending || !settings?.enable_notifications}
          />
        </div>

        {/* Schedule Change Notifications */}
        <div className={`flex items-center justify-between ${!settings?.enable_notifications ? 'opacity-60' : ''}`}>
          <div className="space-y-0.5">
            <Label 
              htmlFor="schedule-change-notifications-toggle" 
              className={`text-base ${!settings?.enable_notifications ? 'text-muted-foreground' : ''}`}
            >
              Schedule Change Notifications
            </Label>
            <div className={`text-sm ${!settings?.enable_notifications ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
              Notify users when their schedule is updated
            </div>
          </div>
          <Switch
            id="schedule-change-notifications-toggle"
            checked={settings?.enable_schedule_change_notifications !== false}
            onCheckedChange={(checked) => 
              handleToggle('enable_schedule_change_notifications', checked)
            }
            disabled={updateSettingsMutation.isPending || !settings?.enable_notifications}
          />
        </div>
      </div>
    </div>
  </CardContent>
</Card>
      {/* PTO Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>PTO Settings</CardTitle>
          <CardDescription>
            Manage PTO balance visibility and tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="pto-toggle" className="text-base">
                Enable PTO Balances
              </Label>
              <div className="text-sm text-muted-foreground">
                When disabled, all PTO balance tracking is turned off and treated as indefinite
              </div>
            </div>
            <Switch
              id="pto-toggle"
              checked={settings?.show_pto_balances || false}
              onCheckedChange={(checked) => 
                handleToggle('show_pto_balances', checked)
              }
              disabled={updateSettingsMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="pto-visibility-toggle" className="text-base">
                Show PTO Balances in Staff Profiles
              </Label>
              <div className="text-sm text-muted-foreground">
                When enabled, PTO balances will be visible in staff profiles (requires PTO Balances to be enabled)
              </div>
            </div>
            <Switch
              id="pto-visibility-toggle"
              checked={settings?.pto_balances_visible || false}
              onCheckedChange={(checked) => 
                handleToggle('pto_balances_visible', checked)
              }
              disabled={updateSettingsMutation.isPending || !settings?.show_pto_balances}
            />
          </div>
        </CardContent>
      </Card>

      {/* PTO Type Visibility Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            PTO Type Visibility
          </CardTitle>
          <CardDescription>
            Control which PTO types are displayed in the monthly calendar view
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="vacation-pto-toggle" className="text-base">
                Show Vacation PTO
              </Label>
              <div className="text-sm text-muted-foreground">
                Display vacation time off in the monthly calendar view
              </div>
            </div>
            <Switch
              id="vacation-pto-toggle"
              checked={ptoVisibility?.show_vacation_pto || false}
              onCheckedChange={(checked) => 
                handlePtoVisibilityToggle('show_vacation_pto', checked)
              }
              disabled={updateSettingsMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="holiday-pto-toggle" className="text-base">
                Show Holiday PTO
              </Label>
              <div className="text-sm text-muted-foreground">
                Display holiday time off in the monthly calendar view
              </div>
            </div>
            <Switch
              id="holiday-pto-toggle"
              checked={ptoVisibility?.show_holiday_pto || false}
              onCheckedChange={(checked) => 
                handlePtoVisibilityToggle('show_holiday_pto', checked)
              }
              disabled={updateSettingsMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sick-pto-toggle" className="text-base">
                Show Sick PTO
              </Label>
              <div className="text-sm text-muted-foreground">
                Display sick time off in the monthly calendar view
              </div>
            </div>
            <Switch
              id="sick-pto-toggle"
              checked={ptoVisibility?.show_sick_pto || false}
              onCheckedChange={(checked) => 
                handlePtoVisibilityToggle('show_sick_pto', checked)
              }
              disabled={updateSettingsMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="comp-pto-toggle" className="text-base">
                Show Comp Time PTO
              </Label>
              <div className="text-sm text-muted-foreground">
                Display comp time off in the monthly calendar view
              </div>
            </div>
            <Switch
              id="comp-pto-toggle"
              checked={ptoVisibility?.show_comp_pto || false}
              onCheckedChange={(checked) => 
                handlePtoVisibilityToggle('show_comp_pto', checked)
              }
              disabled={updateSettingsMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Schedule Section Colors Card */}
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Palette className="h-5 w-5" />
      Riding List - Schedule Section Colors
    </CardTitle>
    <CardDescription>
      Customize the background colors for different sections in daily schedule view
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      
      {/* Supervisor Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: `rgb(${colorSettings.schedule_supervisor_bg})` }} />
          <Label className="font-medium">Supervisor Section</Label>
        </div>
        <div className="space-y-2">
          <Label>Background Color</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={rgbStringToHex(colorSettings.schedule_supervisor_bg)}
              onChange={(e) => handleColorChange('schedule_supervisor_bg', e.target.value)}
              className="w-12 h-10 p-1"
            />
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">RGB: {colorSettings.schedule_supervisor_bg}</div>
              <div className="text-sm">{rgbStringToHex(colorSettings.schedule_supervisor_bg)}</div>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={rgbStringToHex(colorSettings.schedule_supervisor_text)}
              onChange={(e) => handleColorChange('schedule_supervisor_text', e.target.value)}
              className="w-12 h-10 p-1"
            />
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">RGB: {colorSettings.schedule_supervisor_text}</div>
              <div className="text-sm">{rgbStringToHex(colorSettings.schedule_supervisor_text)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Officer Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: `rgb(${colorSettings.schedule_officer_bg})` }} />
          <Label className="font-medium">Officer Section</Label>
        </div>
        <div className="space-y-2">
          <Label>Background Color</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={rgbStringToHex(colorSettings.schedule_officer_bg)}
              onChange={(e) => handleColorChange('schedule_officer_bg', e.target.value)}
              className="w-12 h-10 p-1"
            />
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">RGB: {colorSettings.schedule_officer_bg}</div>
              <div className="text-sm">{rgbStringToHex(colorSettings.schedule_officer_bg)}</div>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={rgbStringToHex(colorSettings.schedule_officer_text)}
              onChange={(e) => handleColorChange('schedule_officer_text', e.target.value)}
              className="w-12 h-10 p-1"
            />
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">RGB: {colorSettings.schedule_officer_text}</div>
              <div className="text-sm">{rgbStringToHex(colorSettings.schedule_officer_text)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Special Assignment Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: `rgb(${colorSettings.schedule_special_bg})` }} />
          <Label className="font-medium">Special Assignment Section</Label>
        </div>
        <div className="space-y-2">
          <Label>Background Color</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={rgbStringToHex(colorSettings.schedule_special_bg)}
              onChange={(e) => handleColorChange('schedule_special_bg', e.target.value)}
              className="w-12 h-10 p-1"
            />
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">RGB: {colorSettings.schedule_special_bg}</div>
              <div className="text-sm">{rgbStringToHex(colorSettings.schedule_special_bg)}</div>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={rgbStringToHex(colorSettings.schedule_special_text)}
              onChange={(e) => handleColorChange('schedule_special_text', e.target.value)}
              className="w-12 h-10 p-1"
            />
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">RGB: {colorSettings.schedule_special_text}</div>
              <div className="text-sm">{rgbStringToHex(colorSettings.schedule_special_text)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* PTO Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: `rgb(${colorSettings.schedule_pto_bg})` }} />
          <Label className="font-medium">PTO Section</Label>
        </div>
       <div className="space-y-2">
  <Label>Background Color</Label>
  <div className="flex gap-2">
    <Input
      type="color"
      value={rgbStringToHex(colorSettings.schedule_pto_bg)}
      onChange={(e) => handleColorChange('schedule_pto_bg', e.target.value)}
      className="w-12 h-10 p-1"
    />
    <div className="flex-1">
      <div className="text-xs text-muted-foreground">RGB: {colorSettings.schedule_pto_bg}</div>
      <div className="text-sm">{rgbStringToHex(colorSettings.schedule_pto_bg)}</div>
    </div>
  </div>
</div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={rgbStringToHex(colorSettings.schedule_pto_text)}
              onChange={(e) => handleColorChange('schedule_pto_text', e.target.value)}
              className="w-12 h-10 p-1"
            />
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">RGB: {colorSettings.schedule_pto_text}</div>
              <div className="text-sm">{rgbStringToHex(colorSettings.schedule_pto_text)}</div>
            </div>
          </div>
        </div>
      </div>

    </div>

    {/* Reset Button for Schedule Colors */}
    <div className="flex justify-end pt-4 border-t">
      <Button 
        variant="outline" 
        onClick={() => {
          const defaultScheduleColors = {
            schedule_supervisor_bg: "240,248,255",
            schedule_supervisor_text: "25,25,112",
            schedule_officer_bg: "248,249,250",
            schedule_officer_text: "33,37,41",
            schedule_special_bg: "243,229,245",
            schedule_special_text: "102,51,153",
            schedule_pto_bg: "230,255,242",
            schedule_pto_text: "0,100,0",
            schedule_pto_bg_mobile: "230,255,242"
          };
          setColorSettings({...colorSettings, ...defaultScheduleColors});
          updateSettingsMutation.mutate({
            id: settings?.id,
            color_settings: {...colorSettings, ...defaultScheduleColors},
            pto_type_visibility: ptoVisibility,
          });
        }}
        disabled={updateSettingsMutation.isPending}
      >
        Reset Schedule Colors to Defaults
      </Button>
    </div>
  </CardContent>
</Card>

      {/* Color Customization Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Color Customization
          </CardTitle>
          <CardDescription>
            Customize the colors used in PDF exports and weekly schedule display
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* PDF Export Colors */}
          <div className="space-y-4">
            <h4 className="font-semibold">PDF Export Colors</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Supervisor PTO */}
              <div className="space-y-2">
                <Label>Supervisor PTO Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.pdf_supervisor_pto_bg)}
                    onChange={(e) => handleColorChange('pdf_supervisor_pto_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.pdf_supervisor_pto_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.pdf_supervisor_pto_bg)}</div>
                  </div>
                </div>
              </div>

              {/* Officer PTO */}
              <div className="space-y-2">
                <Label>Officer PTO Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.pdf_officer_pto_bg)}
                    onChange={(e) => handleColorChange('pdf_officer_pto_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.pdf_officer_pto_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.pdf_officer_pto_bg)}</div>
                  </div>
                </div>
              </div>

              {/* Sick Time */}
              <div className="space-y-2">
                <Label>Sick Time Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.pdf_sick_bg)}
                    onChange={(e) => handleColorChange('pdf_sick_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.pdf_sick_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.pdf_sick_bg)}</div>
                  </div>
                </div>
              </div>

              {/* Off Days */}
              <div className="space-y-2">
                <Label>Off Days Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.pdf_off_day_bg)}
                    onChange={(e) => handleColorChange('pdf_off_day_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.pdf_off_day_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.pdf_off_day_bg)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Weekly Schedule Colors */}
          <div className="space-y-4">
            <h4 className="font-semibold">Weekly Schedule Colors</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Supervisor */}
              <div className="space-y-2">
                <Label>Supervisor Rows Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.weekly_supervisor_bg)}
                    onChange={(e) => handleColorChange('weekly_supervisor_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.weekly_supervisor_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.weekly_supervisor_bg)}</div>
                  </div>
                </div>
              </div>

              {/* Officer */}
              <div className="space-y-2">
                <Label>Officer Rows Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.weekly_officer_bg)}
                    onChange={(e) => handleColorChange('weekly_officer_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.weekly_officer_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.weekly_officer_bg)}</div>
                  </div>
                </div>
              </div>

              {/* PPO */}
              <div className="space-y-2">
                <Label>PPO Rows Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.weekly_ppo_bg)}
                    onChange={(e) => handleColorChange('weekly_ppo_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.weekly_ppo_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.weekly_ppo_bg)}</div>
                  </div>
                </div>
              </div>

              {/* PTO */}
              <div className="space-y-2">
                <Label>PTO Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.weekly_pto_bg)}
                    onChange={(e) => handleColorChange('weekly_pto_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.weekly_pto_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.weekly_pto_bg)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PTO Type Colors */}
          <div className="space-y-4">
            <h4 className="font-semibold">PTO Type Colors</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Vacation */}
              <div className="space-y-2">
                <Label>Vacation Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.pdf_vacation_bg)}
                    onChange={(e) => handleColorChange('pdf_vacation_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.pdf_vacation_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.pdf_vacation_bg)}</div>
                  </div>
                </div>
              </div>

              {/* Sick */}
              <div className="space-y-2">
                <Label>Sick Time Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.pdf_sick_bg)}
                    onChange={(e) => handleColorChange('pdf_sick_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.pdf_sick_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.pdf_sick_bg)}</div>
                  </div>
                </div>
              </div>

              {/* Holiday */}
              <div className="space-y-2">
                <Label>Holiday Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.pdf_holiday_bg)}
                    onChange={(e) => handleColorChange('pdf_holiday_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.pdf_holiday_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.pdf_holiday_bg)}</div>
                  </div>
                </div>
              </div>

              {/* Comp Time */}
              <div className="space-y-2">
                <Label>Comp Time Background</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={rgbStringToHex(colorSettings.pdf_comp_bg)}
                    onChange={(e) => handleColorChange('pdf_comp_bg', e.target.value)}
                    className="w-12 h-10 p-1"
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">RGB: {colorSettings.pdf_comp_bg}</div>
                    <div className="text-sm">{rgbStringToHex(colorSettings.pdf_comp_bg)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reset Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={resetToDefaults} disabled={updateSettingsMutation.isPending}>
              Reset to Default Colors
            </Button>
          </div>
        </CardContent>
      </Card>

{/* Password Reset Manager - Only for Admin/Supervisor */}
    {(isAdmin || isSupervisor) && <PasswordResetManager />}

      {/* Audit Log Viewer */}
          <AuditLogViewer />

  {/* Manual Alert System Card - Only for Admin/Supervisor */}
      {(isAdmin || isSupervisor) && <ManualAlertSender />}

      {/* Instructions Card */}
<Card>
  <CardHeader>
    <CardTitle className="text-lg">How These Settings Work</CardTitle>
  </CardHeader>
  <CardContent className="space-y-3 text-sm text-muted-foreground">
    <div>
      <strong>Mass Alert System:</strong> Controls the entire vacancy alert system including 
      "Create Manual Alert" and "Create All Alerts" buttons. When disabled, users cannot 
      send mass alerts or receive responses from them.
    </div>
    <div>
      <strong>Vacancy Alert Subscription Buttons:</strong> When disabled, users cannot 
      subscribe to vacancy alerts. Requires Mass Alert System to be enabled.
    </div>
    <div>
      <strong>Automated Notifications:</strong> Master switch for all automated notification 
      features (PTO requests, schedule changes, etc.). When disabled, no automated 
      notifications will be sent regardless of individual settings.
    </div>
    <div>
      <strong>Vacancy Alert Notifications:</strong> When enabled, automatically sends 
      notifications to subscribed users when vacancies occur. Requires Automated Notifications 
      to be enabled.
    </div>
    <div>
      <strong>PTO Request Notifications:</strong> Supervisors and administrators will receive 
      in-app notifications when officers submit new time off requests.
    </div>
    <div>
      <strong>PTO Status Notifications:</strong> Officers will receive in-app notifications 
      when their time off requests are approved or denied.
    </div>
    <div>
      <strong>Schedule Change Notifications:</strong> Users will be notified when their 
      schedule is modified by supervisors or administrators.
    </div>
      <div>
      <strong>Show Staffing Overview:</strong> When enabled, admin and supervisor users 
      will see the Staffing Overview section on their dashboard showing current shift 
      staffing levels. When disabled, this section is hidden.
    </div>
    <div>
      <strong>PTO Balances:</strong> When disabled, all PTO balance tracking is turned off. 
      Staff will have indefinite time off availability, and balance calculations are suspended.
    </div>
    <div>
      <strong>PTO Type Visibility:</strong> Control which types of PTO are displayed in the 
      monthly calendar view. This does not affect PTO assignment or balance tracking.
    </div>
    <div>
      <strong>Color Customization:</strong> Changes to colors will affect both PDF exports and 
      the weekly schedule display. Changes are saved automatically.
    </div>
  </CardContent>
</Card>
    </div>
  );
};
