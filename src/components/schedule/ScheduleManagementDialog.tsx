import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Building, MapPin } from "lucide-react";

interface ScheduleManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const daysOfWeek = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export const ScheduleManagementDialog = ({ open, onOpenChange }: ScheduleManagementDialogProps) => {
  const queryClient = useQueryClient();
  const [selectedOfficer, setSelectedOfficer] = useState("");
  const [selectedShift, setSelectedShift] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("none");
  const [selectedDay, setSelectedDay] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [updateOfficerShift, setUpdateOfficerShift] = useState(true); // New toggle

  const { data: officers } = useQuery({
    queryKey: ["officers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, badge_number, shift_type_id")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: shiftTypes } = useQuery({
    queryKey: ["shift-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_types")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: positions } = useQuery({
    queryKey: ["shift-positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_positions")
        .select("id, position_name, position_order")
        .order("position_order");
      if (error) throw error;
      return data;
    },
  });

  const createScheduleMutation = useMutation({
    mutationFn: async () => {
      // Get the officer's name for logging
      const officer = officers?.find(o => o.id === selectedOfficer);
      const shift = shiftTypes?.find(s => s.id === selectedShift);
      
      console.log(`Creating schedule for officer: ${officer?.full_name}, shift: ${shift?.name}`);
      
      // Start a transaction for atomic operations
      // 1. Create the recurring schedule
      const { error: scheduleError } = await supabase
        .from("recurring_schedules")
        .insert({
          officer_id: selectedOfficer,
          shift_type_id: selectedShift,
          position_name: selectedPosition !== "none" ? selectedPosition : null,
          unit_number: unitNumber || null,
          day_of_week: parseInt(selectedDay),
          start_date: new Date().toISOString().split("T")[0],
        });
      
      if (scheduleError) throw scheduleError;
      
      console.log('Schedule created successfully');
      
      // 2. Update officer's shift_type_id if toggle is enabled
      if (updateOfficerShift && selectedShift) {
        console.log(`Updating officer's shift_type_id to: ${selectedShift}`);
        
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ shift_type_id: selectedShift })
          .eq("id", selectedOfficer);
        
        if (profileError) {
          console.error('Failed to update officer shift:', profileError);
          // Don't throw - the schedule was created successfully
          toast.warning("Schedule created but failed to update officer's shift assignment");
        } else {
          console.log('Officer shift assignment updated successfully');
        }
      }
      
      // Log to audit
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        await supabase.from('audit_logs').insert({
          user_email: currentUser.email,
          action_type: 'recurring_schedule_created',
          table_name: 'recurring_schedules',
          description: `Created recurring schedule for ${officer?.full_name} on ${daysOfWeek.find(d => d.value === parseInt(selectedDay))?.label} shift (${shift?.name}). ${updateOfficerShift ? 'Also updated officer shift assignment.' : 'Officer shift assignment not updated.'}`
        });
      }
    },
    onSuccess: () => {
      toast.success("Recurring schedule created successfully");
      queryClient.invalidateQueries({ queryKey: ["weekly-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["officers"] }); // Refresh officers list
      queryClient.invalidateQueries({ queryKey: ["officers-for-alerts"] }); // Refresh for manual alerts
      onOpenChange(false);
      setSelectedOfficer("");
      setSelectedShift("");
      setSelectedPosition("none");
      setSelectedDay("");
      setUnitNumber("");
      setUpdateOfficerShift(true); // Reset to default
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create schedule");
    },
  });

  // Get current officer's assigned shift for display
  const getCurrentOfficerShift = () => {
    if (!selectedOfficer || !officers || !shiftTypes) return null;
    
    const officer = officers.find(o => o.id === selectedOfficer);
    if (!officer?.shift_type_id) return null;
    
    return shiftTypes.find(s => s.id === officer.shift_type_id);
  };

  const currentOfficerShift = getCurrentOfficerShift();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Recurring Schedule</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Officer</Label>
            <Select value={selectedOfficer} onValueChange={setSelectedOfficer}>
              <SelectTrigger>
                <SelectValue placeholder="Select officer" />
              </SelectTrigger>
              <SelectContent>
                {officers?.map((officer) => (
                  <SelectItem key={officer.id} value={officer.id}>
                    {officer.full_name} ({officer.badge_number})
                    {officer.shift_type_id && " ✓"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Show current assigned shift if officer has one */}
            {currentOfficerShift && (
              <div className="text-sm text-muted-foreground p-2 bg-blue-50 rounded">
                Currently assigned to: <span className="font-medium">{currentOfficerShift.name}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Day of Week</Label>
            <Select value={selectedDay} onValueChange={setSelectedDay}>
              <SelectTrigger>
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {daysOfWeek.map((day) => (
                  <SelectItem key={day.value} value={day.value.toString()}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Shift Type</Label>
            <Select value={selectedShift} onValueChange={setSelectedShift}>
              <SelectTrigger>
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                {shiftTypes?.map((shift) => (
                  <SelectItem key={shift.id} value={shift.id}>
                    {shift.name} ({shift.start_time} - {shift.end_time})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* NEW: Shift Assignment Toggle */}
          <div className="space-y-2 p-3 border rounded-lg bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Update Officer's Assigned Shift</Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, this will also update the officer's profile to be assigned to this shift
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={updateOfficerShift}
                  onChange={(e) => setUpdateOfficerShift(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* Assignment Details Section */}
          <div className="space-y-4 p-4 border rounded-lg bg-blue-50/30">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Building className="h-4 w-4" />
              Assignment Details (Optional)
            </h4>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="unit-number" className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Unit Number
                </Label>
                <Input
                  id="unit-number"
                  placeholder="e.g., Unit 1, Patrol, Traffic"
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assigned-position">Assigned Position</Label>
                <Select
                  value={selectedPosition}
                  onValueChange={setSelectedPosition}
                >
                  <SelectTrigger id="assigned-position">
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No position assigned</SelectItem>
                    {positions?.map((position) => (
                      <SelectItem key={position.id} value={position.position_name}>
                        {position.position_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={() => createScheduleMutation.mutate()}
            disabled={!selectedOfficer || !selectedShift || !selectedDay || createScheduleMutation.isPending}
          >
            {createScheduleMutation.isPending ? "Creating..." : "Create Schedule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
