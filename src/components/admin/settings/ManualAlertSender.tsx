import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, Bell, Smartphone, MessageSquare } from "lucide-react";
import { 
  parseTimeToMinutes, 
  formatTimeForDisplay, 
  isOfficerCurrentlyOnShift, 
  getCurrentlyActiveShifts, 
  isDateWithinSchedulePeriod 
} from "./alertHelpers";
import { alertSystem } from "@/utils/alertSystem";

export const ManualAlertSender = () => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendMethod, setSendMethod] = useState<'in_app' | 'push' | 'both'>('both');
  const [useActiveSchedulePeriod, setUseActiveSchedulePeriod] = useState(true);
  const [alertType, setAlertType] = useState<'info' | 'warning' | 'critical'>('info');
  const [usePushNotifications, setUsePushNotifications] = useState(true);

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

  // Get ALL officers and their current assigned shift
  const { data: officersWithShifts, isLoading } = useQuery({
    queryKey: ['officers-active-schedules', todayDate, useActiveSchedulePeriod],
    queryFn: async () => {
      console.log('🔍 Fetching officers with active schedules...');
      
      try {
        // Get all active officers WITH push subscription info
        const { data: officers, error: officersError } = await supabase
          .from('profiles')
          .select('id, full_name, badge_number, phone, email, push_subscription, notification_preferences')
          .eq('active', true)
          .order('full_name', { ascending: true });

        if (officersError) {
          console.error('❌ Error fetching officers:', officersError);
          return [];
        }

        console.log(`✅ Found ${officers?.length || 0} active officers`);

        // For each officer, find their MOST RECENT active schedule
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

              if (!useActiveSchedulePeriod) {
                query = query.eq('day_of_week', todayDayOfWeek);
              }

              const { data: activeSchedules } = await query;

              if (activeSchedules && activeSchedules.length > 0) {
                const schedule = activeSchedules[0];
                const shiftType = schedule.shift_types;
                
                if (shiftType) {
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
                    },
                    has_push: !!officer.push_subscription && officer.notification_preferences?.push_enabled !== false
                  };
                }
              }

              return {
                ...officer,
                current_shift: null,
                schedule_info: null,
                has_push: !!officer.push_subscription && officer.notification_preferences?.push_enabled !== false
              };
            } catch (error) {
              console.error(`❌ Error processing ${officer.full_name}:`, error);
              return {
                ...officer,
                current_shift: null,
                schedule_info: null,
                has_push: !!officer.push_subscription && officer.notification_preferences?.push_enabled !== false
              };
            }
          })
        );

        const withSchedules = officersWithCurrentShifts.filter(o => o.current_shift).length;
        const activeNow = officersWithCurrentShifts.filter(o => o.current_shift?.is_active_now).length;
        const withPush = officersWithCurrentShifts.filter(o => o.has_push).length;
        
        console.log(`📊 Results: ${withSchedules} with schedules, ${activeNow} on shift, ${withPush} with push`);
        
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
    }
  }, [shiftTypes]);

  // Calculate which shifts are active right now
  const activeShiftsNow = getCurrentlyActiveShifts(shiftTypes || []);

  // Filter officers by selected shifts
  const filteredOfficers = officersWithShifts?.filter(officer => {
    if (!officer.current_shift) return false;
    return selectedShifts.includes(officer.current_shift.name);
  }) || [];

  // Count officers with push notifications enabled
  const officersWithPush = filteredOfficers.filter(o => o.has_push).length;
  const officersWithoutPush = filteredOfficers.length - officersWithPush;

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
      let inAppSuccess = 0;
      let pushSuccess = 0;
      let failed = 0;

      // Prepare title based on alert type
      const alertTitle = `${alertType === 'critical' ? '🚨 CRITICAL: ' : alertType === 'warning' ? '⚠️ WARNING: ' : ''}Department Alert`;

      // Get officer IDs for alert system
      const officerIds = filteredOfficers.map(officer => officer.id);

      // Send alert using alertSystem for push notifications
      if (usePushNotifications && officersWithPush > 0 && (sendMethod === 'push' || sendMethod === 'both')) {
        try {
          const pushAlertType = alertType === 'critical' ? 'critical' : 
                               alertType === 'warning' ? 'warning' : 'info';
          
          await alertSystem.sendAlertToUsers(
            officerIds,
            alertTitle,
            message,
            pushAlertType
          );
          pushSuccess = officersWithPush;
        } catch (error) {
          console.error('Error sending push notifications:', error);
        }
      }

      // Handle in-app notifications separately
      if (sendMethod === 'in_app' || sendMethod === 'both') {
        // Create in-app notification records for all officers
        const notifications = filteredOfficers.map(officer => ({
          user_id: officer.id,
          title: alertTitle,
          message: message,
          type: 'manual_alert',
          alert_type: alertType,
          is_read: false,
          created_at: new Date().toISOString()
        }));

        const { error: notificationError, count } = await supabase
          .from('notifications')
          .insert(notifications, { count: 'exact' });

        if (notificationError) {
          console.error('❌ Failed to create in-app notifications:', notificationError);
          failed += filteredOfficers.length;
        } else {
          inAppSuccess = count || filteredOfficers.length;
        }
      }

      // Log to audit
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert({
        user_email: userData.user?.email,
        action_type: 'manual_alert_sent',
        table_name: 'notifications',
        description: `Sent ${alertType} alert to ${filteredOfficers.length} officers on shifts: ${selectedShifts.join(', ')}. Push: ${pushSuccess} sent, In-app: ${inAppSuccess}.`
      });

      toast.success(
        `Alert sent! In-app: ${inAppSuccess}, Push: ${pushSuccess}, Failed: ${failed}`,
        {
          duration: 5000,
          action: {
            label: 'Details',
            onClick: () => {
              toast.info(
                `Total: ${filteredOfficers.length} officers\n` +
                `With push: ${officersWithPush}\n` +
                `Without push: ${officersWithoutPush}\n` +
                `Shifts: ${selectedShifts.join(', ')}`
              );
            }
          }
        }
      );

      setOpen(false);
      setMessage("");

    } catch (error) {
      console.error('❌ Error sending manual alert:', error);
      toast.error('Failed to send alert');
    } finally {
      setIsSending(false);
    }
  };

  // Helper function to send individual push notifications (kept for backward compatibility)
  const sendIndividualPushNotification = async (officer: any, title: string, message: string) => {
    try {
      await alertSystem.sendAlertToUsers(
        [officer.id],
        title,
        message,
        alertType === 'critical' ? 'critical' : 
        alertType === 'warning' ? 'warning' : 'info'
      );
      return true;
    } catch (error) {
      console.error(`Push failed for ${officer.full_name}:`, error);
      return false;
    }
  };

  const getAlertTypeColor = (type: string) => {
    switch (type) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'warning': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Manual Alert System
        </CardTitle>
        <CardDescription>
          Send alerts to officers based on their assigned shifts. Now with push notifications!
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

          {/* Alert Type Selection */}
          <div>
            <Label className="text-base mb-2 block">Alert Type</Label>
            <div className="flex flex-wrap gap-2">
              {(['info', 'warning', 'critical'] as const).map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant={alertType === type ? "default" : "outline"}
                  onClick={() => setAlertType(type)}
                  className={`flex-1 min-w-[100px] ${
                    type === 'critical' ? 'hover:bg-red-100' :
                    type === 'warning' ? 'hover:bg-amber-100' :
                    'hover:bg-blue-100'
                  }`}
                >
                  {type === 'critical' && '🚨 '}
                  {type === 'warning' && '⚠️ '}
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Button>
              ))}
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
          </div>

          {/* Affected Officers Count with Push Info */}
          <div className="bg-muted p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-medium">Total Officers:</span>
                <div className="text-2xl font-bold mt-1">
                  {isLoading ? '...' : filteredOfficers.length}
                </div>
              </div>
              <div>
                <span className="font-medium">Push Enabled:</span>
                <div className="text-2xl font-bold mt-1">
                  {isLoading ? '...' : officersWithPush}
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({Math.round((officersWithPush / filteredOfficers.length) * 100) || 0}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Send Method Selection */}
          <div>
            <Label className="text-base mb-2 block">Send Method</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={sendMethod === 'in_app' ? "default" : "outline"}
                onClick={() => setSendMethod('in_app')}
                className="flex-1 min-w-[100px] flex flex-col items-center py-3"
              >
                <MessageSquare className="h-4 w-4 mb-1" />
                In-App Only
              </Button>
              <Button
                type="button"
                variant={sendMethod === 'push' ? "default" : "outline"}
                onClick={() => setSendMethod('push')}
                className="flex-1 min-w-[100px] flex flex-col items-center py-3"
              >
                <Smartphone className="h-4 w-4 mb-1" />
                Push Only
              </Button>
              <Button
                type="button"
                variant={sendMethod === 'both' ? "default" : "outline"}
                onClick={() => setSendMethod('both')}
                className="flex-1 min-w-[100px] flex flex-col items-center py-3"
              >
                <Bell className="h-4 w-4 mb-1" />
                Both
              </Button>
            </div>
          </div>

          {/* Push Notifications Toggle */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                <label className="font-medium">Enable Push Notifications</label>
              </div>
              <p className="text-sm text-muted-foreground">
                Send push notifications to officers' devices
              </p>
            </div>
            <Switch
              checked={usePushNotifications}
              onCheckedChange={setUsePushNotifications}
              disabled={officersWithPush === 0}
            />
          </div>

          {officersWithPush === 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                No officers have push notifications enabled. 
                <Button variant="link" className="p-0 h-auto ml-1" onClick={() => toast.info('Officers need to enable push notifications in their settings')}>
                  Learn more
                </Button>
              </p>
            </div>
          )}
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
              <DialogTitle className="flex items-center gap-2">
                <Badge className={getAlertTypeColor(alertType)}>
                  {alertType.toUpperCase()}
                </Badge>
                Send Manual Alert
              </DialogTitle>
              <DialogDescription>
                This alert will be sent to {filteredOfficers.length} officer(s) on {selectedShifts.join(', ')} shifts
                {usePushNotifications && officersWithPush > 0 && (
                  <span className="block mt-1">
                    <Smartphone className="h-3 w-3 inline mr-1" />
                    Push notifications will be sent to {officersWithPush} officer(s)
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="alert-message">Alert Message *</Label>
                <Textarea
                  id="alert-message"
                  placeholder="Enter your alert message here... Be clear and concise."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="resize-none font-mono"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  {message.length}/500 characters
                </p>
              </div>
            </div>
            
            <DialogFooter className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isSending}>
                Cancel
              </Button>
              <Button 
                onClick={handleSendAlert} 
                disabled={!message.trim() || isSending || message.length > 500}
                className={`${
                  alertType === 'critical' ? 'bg-red-600 hover:bg-red-700' :
                  alertType === 'warning' ? 'bg-amber-600 hover:bg-amber-700' :
                  ''
                }`}
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Bell className="h-4 w-4 mr-2" />
                    Send Alert
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
