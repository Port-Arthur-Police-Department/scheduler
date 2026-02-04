// hooks/useUnderstaffedDetection.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { getScheduleData } from "@/components/schedule/DailyScheduleView";
import { 
  isShiftUnderstaffed, 
  getStaffingDescription,
  getRequirementsSummary 
} from "@/utils/staffingUtils";

export const useUnderstaffedDetection = (selectedShiftId: string = "all") => {
  return useQuery({
    queryKey: ["understaffed-shifts-detection", selectedShiftId],
    queryFn: async () => {
      console.log("🔍 Starting understaffed shift detection...");
      
      const allUnderstaffedShifts = [];
      const today = new Date();

      // Check each date in the next 7 days
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(today.getDate() + i);
        const dateStr = format(date, "yyyy-MM-dd");
        const dayOfWeek = date.getDay();

        try {
          // Get minimum staffing requirements for this day of week
          const { data: minimumStaffing, error: minError } = await supabase
            .from("minimum_staffing")
            .select("minimum_officers, minimum_supervisors, shift_type_id")
            .eq("day_of_week", dayOfWeek);
          
          if (minError) {
            console.error(`❌ Error getting minimum staffing for ${dateStr}:`, minError);
            continue;
          }

          console.log("📊 Minimum staffing requirements:", minimumStaffing);

          // Use the getScheduleData function from DailyScheduleView with correct path
          const scheduleData = await getScheduleData(date, selectedShiftId);
          
          if (!scheduleData || scheduleData.length === 0) {
            console.log(`❌ No schedule data found for ${dateStr}`);
            continue;
          }

          console.log(`📋 Schedule data for ${dateStr}:`, scheduleData);

          // Check each shift for understaffing
          for (const shiftData of scheduleData) {
            const shift = shiftData.shift;
            
            // Filter by selected shift if needed
            if (selectedShiftId !== "all" && shift.id !== selectedShiftId) {
              continue;
            }

            // Get minimum staffing for this specific shift from the database
            const minStaff = minimumStaffing?.find(m => m.shift_type_id === shift.id);
            
            // If no minimum staffing rule exists, skip understaffing check
            if (!minStaff) {
              console.log(`⚠️ No minimum staffing rule found for shift: ${shift.name} (ID: ${shift.id})`);
              continue;
            }

            // Use the values from the database (could be 0 or more)
            const minSupervisors = minStaff.minimum_supervisors;
            const minOfficers = minStaff.minimum_officers;

            console.log(`\n🔍 Checking shift: ${shift.name} (${shift.start_time} - ${shift.end_time})`);
            console.log(`📋 Min requirements: ${minSupervisors} supervisors, ${minOfficers} officers`);
            console.log(`👥 Current staffing: ${shiftData.currentSupervisors} supervisors, ${shiftData.currentOfficers} officers`);

            // Check if understaffed using the utility function
            const isUnderstaffedShift = isShiftUnderstaffed(
              shiftData.currentSupervisors,
              minSupervisors,
              shiftData.currentOfficers,
              minOfficers
            );

            if (isUnderstaffedShift) {
              // Fix the assigned officers mapping
              const assignedOfficers = Array.isArray(shiftData.officers) ? shiftData.officers.map((officer: any) => {
                // Handle different possible data structures
                const fullName = officer.full_name || officer.name || officer.profiles?.full_name || "Unknown";
                const isSupervisor = officer.is_supervisor || officer.profiles?.is_supervisor || false;
                const badgeNumber = officer.badge_number || officer.profiles?.badge_number || "N/A";
                
                return {
                  name: fullName,
                  position: isSupervisor ? "Supervisor" : "Officer",
                  isSupervisor: isSupervisor,
                  badge: badgeNumber
                };
              }) : [];

              // Get staffing description using utility function
              const staffingDescription = getStaffingDescription(
                shiftData.currentSupervisors,
                minSupervisors,
                shiftData.currentOfficers,
                minOfficers
              );

              const shiftAlertData = {
                date: dateStr,
                shift_type_id: shift.id,
                shift_types: {
                  id: shift.id,
                  name: shift.name,
                  start_time: shift.start_time,
                  end_time: shift.end_time
                },
                current_staffing: shiftData.currentSupervisors + shiftData.currentOfficers,
                minimum_required: minSupervisors + minOfficers,
                current_supervisors: shiftData.currentSupervisors,
                current_officers: shiftData.currentOfficers,
                min_supervisors: minSupervisors,
                min_officers: minOfficers,
                day_of_week: dayOfWeek,
                isSupervisorsUnderstaffed: minSupervisors > 0 && shiftData.currentSupervisors < minSupervisors,
                isOfficersUnderstaffed: minOfficers > 0 && shiftData.currentOfficers < minOfficers,
                position_type: staffingDescription,
                assigned_officers: assignedOfficers,
                // Add metadata about the check
                hasMinimumRule: true,
                isZeroMinimum: minSupervisors === 0 && minOfficers === 0,
                requirements_summary: getRequirementsSummary(minSupervisors, minOfficers),
                staffing_status: isUnderstaffedShift ? "understaffed" : "adequate"
              };

              console.log("📊 Storing understaffed shift data:", shiftAlertData);
              allUnderstaffedShifts.push(shiftAlertData);
            } else {
              console.log("✅ Shift is properly staffed");
              // Log if it's a zero-minimum shift
              if (minSupervisors === 0 && minOfficers === 0) {
                console.log(`📝 Shift has no minimum requirements (0/0)`);
              }
            }
          }
        } catch (dayError) {
          console.error(`❌ Error processing date ${dateStr}:`, dayError);
          continue;
        }
      }

      console.log("🎯 Total understaffed shifts found:", allUnderstaffedShifts.length);
      
      // Log summary of understaffed shifts
      if (allUnderstaffedShifts.length > 0) {
        console.log("📋 Understaffed Shifts Summary:");
        allUnderstaffedShifts.forEach((shift, index) => {
          console.log(`${index + 1}. ${shift.date} - ${shift.shift_types.name}: ${shift.position_type}`);
        });
      }

      return allUnderstaffedShifts;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};
