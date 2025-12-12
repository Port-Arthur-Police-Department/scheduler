// src/components/admin/settings/ManualAlertSender.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle } from "lucide-react";
import { 
  parseTimeToMinutes, 
  formatTimeForDisplay, 
  isOfficerCurrentlyOnShift, 
  getCurrentlyActiveShifts, 
  isDateWithinSchedulePeriod 
} from "./alertHelpers";

export const ManualAlertSender = () => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendMethod, setSendMethod] = useState<'in_app' | 'all'>('in_app');
  const [useActiveSchedulePeriod, setUseActiveSchedulePeriod] = useState(true);

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
    queryKey: ['officers-active-schedules', todayDate],
    queryFn: async () => {
      console.log('🔍 Fetching officers with active schedules...');
      
      try {
        // Get all active officers
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
                    }
                  };
                }
              }

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

        const withSchedules = officersWithCurrentShifts.filter(o => o.current_shift).length;
        const activeNow = officersWithCurrentShifts.filter(o => o.current_shift?.is_active_now).length;
        
        console.log(`📊 Results: ${withSchedules} officers with active schedules, ${activeNow} currently on shift`);
        
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

      for (const officer of filteredOfficers) {
        try {
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
            successful++;
          }

          // Optional: Send email/SMS if selected
          if (sendMethod === 'all') {
            // Email logic here
            // SMS logic here
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
          </div>

          {/* Affected Officers Count */}
          <div className="bg-muted p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium">Officers with Active Schedules:</span>
              <span className="text-lg font-bold">
                {isLoading ? 'Loading...' : filteredOfficers.length}
              </span>
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
                This alert will be sent to {filteredOfficers.length} officer(s) on {selectedShifts.join(', ')} shifts
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
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isSending}>
                Cancel
              </Button>
              <Button onClick={handleSendAlert} disabled={!message.trim() || isSending}>
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
