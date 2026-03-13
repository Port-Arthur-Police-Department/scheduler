// src/hooks/useScheduleMutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PTO_TYPES } from "@/constants/positions";
import { format, parseISO } from "date-fns";
import { isPPOByRank } from "@/utils/ppoUtils";

interface UpdateScheduleParams {
  scheduleId: string;
  type: "recurring" | "exception";
  positionName: string;
  unitNumber?: string;
  notes?: string;
  date: string;
  officerId: string;
  shiftTypeId: string;
  partnerOfficerId?: string;
  isPartnership?: boolean;
}

// Helper function to calculate hours
const calculateHours = (start: string, end: string) => {
  const [startHour, startMin] = start.split(":").map(Number);
  const [endHour, endMin] = end.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return (endMinutes - startMinutes) / 60;
};

// Function to update recurring schedule partnerships
const updateRecurringPartnership = async (
  officerId: string,
  partnerOfficerId: string,
  shiftId: string,
  dayOfWeek: number,
  officerPosition: string,
  partnerPosition: string
) => {
  try {
    console.log("🔄 Updating recurring partnership in database");
    
    // Find both officers' recurring schedules
    const [{ data: officerRecurring }, { data: partnerRecurring }] = await Promise.all([
      supabase
        .from("recurring_schedules")
        .select("id")
        .eq("officer_id", officerId)
        .eq("shift_type_id", shiftId)
        .eq("day_of_week", dayOfWeek)
        .maybeSingle(),
      supabase
        .from("recurring_schedules")
        .select("id")
        .eq("officer_id", partnerOfficerId)
        .eq("shift_type_id", shiftId)
        .eq("day_of_week", dayOfWeek)
        .maybeSingle()
    ]);

    if (!officerRecurring || !partnerRecurring) {
      console.log("⚠️ One or both officers don't have recurring schedules for this day");
      return { success: false, error: "Missing recurring schedules" };
    }

    // Update both records
    const [officerResult, partnerResult] = await Promise.all([
      supabase
        .from("recurring_schedules")
        .update({
          is_partnership: true,
          partner_officer_id: partnerOfficerId,
          position_name: officerPosition
        })
        .eq("id", officerRecurring.id),
      supabase
        .from("recurring_schedules")
        .update({
          is_partnership: true,
          partner_officer_id: officerId,
          position_name: partnerPosition
        })
        .eq("id", partnerRecurring.id)
    ]);

    if (officerResult.error || partnerResult.error) {
      console.error("Error updating recurring schedules:", officerResult.error || partnerResult.error);
      return { success: false, error: officerResult.error || partnerResult.error };
    }

    console.log("✅ Recurring partnership updated in database");
    return { success: true };
  } catch (error) {
    console.error("Error in updateRecurringPartnership:", error);
    return { success: false, error };
  }
};

// Function to remove recurring partnership
const removeRecurringPartnership = async (
  officerId: string,
  partnerOfficerId: string,
  shiftId: string,
  dayOfWeek: number
) => {
  try {
    console.log("🔄 Removing recurring partnership from database");
    
    // Find both officers' recurring schedules
    const [{ data: officerRecurring }, { data: partnerRecurring }] = await Promise.all([
      supabase
        .from("recurring_schedules")
        .select("id, position_name")
        .eq("officer_id", officerId)
        .eq("shift_type_id", shiftId)
        .eq("day_of_week", dayOfWeek)
        .maybeSingle(),
      supabase
        .from("recurring_schedules")
        .select("id, position_name")
        .eq("officer_id", partnerOfficerId)
        .eq("shift_type_id", shiftId)
        .eq("day_of_week", dayOfWeek)
        .maybeSingle()
    ]);

    const updates = [];

    // Remove partnership from officer's recurring schedule
    if (officerRecurring) {
      updates.push(
        supabase
          .from("recurring_schedules")
          .update({
            is_partnership: false,
            partner_officer_id: null,
            // Reset position to default if it was a partnership-specific position
            position_name: officerRecurring.position_name?.includes("Riding Partner") ? null : officerRecurring.position_name
          })
          .eq("id", officerRecurring.id)
      );
    }

    // Remove partnership from partner's recurring schedule
    if (partnerRecurring) {
      updates.push(
        supabase
          .from("recurring_schedules")
          .update({
            is_partnership: false,
            partner_officer_id: null,
            // Reset position to default if it was a partnership-specific position
            position_name: partnerRecurring.position_name?.includes("Riding Partner") ? null : partnerRecurring.position_name
          })
          .eq("id", partnerRecurring.id)
      );
    }

    if (updates.length > 0) {
      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error).map(r => r.error);
      
      if (errors.length > 0) {
        console.error("Error removing recurring partnerships:", errors);
        return { success: false, errors };
      }
    }

    console.log("✅ Recurring partnership removed from database");
    return { success: true };
  } catch (error) {
    console.error("Error in removeRecurringPartnership:", error);
    return { success: false, error };
  }
};

export const useScheduleMutations = (dateStr: string) => {
  const queryClient = useQueryClient();

  // Function to suspend partnership when officer takes PTO
  const suspendPartnershipForPTO = async (
    officerId: string, 
    partnerId: string | null, 
    ptoType: string,
    shiftId: string
  ) => {
    if (!partnerId) {
      console.log("No partner to suspend");
      return;
    }

    console.log(`🔄 Suspending partnership: ${officerId} with ${partnerId} for ${ptoType} PTO`);

    try {
      // Get officer and partner names for logging
      const [{ data: officerData }, { data: partnerData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, rank")
          .eq("id", officerId)
          .single(),
        supabase
          .from("profiles")
          .select("full_name, rank")
          .eq("id", partnerId)
          .single()
      ]);

      // 1. Check for existing schedule exceptions for both officers
      const [{ data: officerException }, { data: partnerException }] = await Promise.all([
        supabase
          .from("schedule_exceptions")
          .select("id, is_partnership, is_off")
          .eq("officer_id", officerId)
          .eq("date", dateStr)
          .eq("shift_type_id", shiftId)
          .maybeSingle(),
        supabase
          .from("schedule_exceptions")
          .select("id, is_partnership, is_off")
          .eq("officer_id", partnerId)
          .eq("date", dateStr)
          .eq("shift_type_id", shiftId)
          .maybeSingle()
      ]);

      const updates = [];

      // Officer's record (going on PTO)
      if (officerException) {
        updates.push(
          supabase
            .from("schedule_exceptions")
            .update({
              is_partnership: false,
              partnership_suspended: true,
              partnership_suspension_reason: ptoType,
              partner_officer_id: partnerId
            })
            .eq("id", officerException.id)
        );
      } else {
        updates.push(
          supabase
            .from("schedule_exceptions")
            .insert({
              officer_id: officerId,
              date: dateStr,
              shift_type_id: shiftId,
              is_off: true, // Officer is on PTO
              reason: ptoType,
              is_partnership: false,
              partnership_suspended: true,
              partnership_suspension_reason: ptoType,
              partner_officer_id: partnerId,
              schedule_type: "pto_partnership_suspension"
            })
        );
      }

      // Partner's record (still working, available for reassignment)
      if (partnerException) {
        updates.push(
          supabase
            .from("schedule_exceptions")
            .update({
              is_partnership: false,
              partnership_suspended: true,
              partnership_suspension_reason: ptoType,
              partner_officer_id: officerId,
              is_off: false // Partner is still working
            })
            .eq("id", partnerException.id)
        );
      } else {
        // Check if partner has a recurring schedule for this day
        const dayOfWeek = parseISO(dateStr).getDay();
        const { data: partnerRecurring } = await supabase
          .from("recurring_schedules")
          .select("position_name")
          .eq("officer_id", partnerId)
          .eq("shift_type_id", shiftId)
          .eq("day_of_week", dayOfWeek)
          .maybeSingle();

        updates.push(
          supabase
            .from("schedule_exceptions")
            .insert({
              officer_id: partnerId,
              date: dateStr,
              shift_type_id: shiftId,
              is_off: false,
              is_partnership: false,
              partnership_suspended: true,
              partnership_suspension_reason: ptoType,
              partner_officer_id: officerId,
              schedule_type: "pto_partner_available",
              position_name: partnerRecurring?.position_name || "Available for Reassignment"
            })
        );
      }

      // Execute all updates
      const results = await Promise.all(updates);
      results.forEach((result, index) => {
        if (result.error) {
          console.error(`Error updating record ${index}:`, result.error);
        }
      });

      // Log the partnership suspension
      await supabase
        .from("partnership_exceptions")
        .insert({
          officer_id: officerId,
          partner_officer_id: partnerId,
          date: dateStr,
          shift_type_id: shiftId,
          reason: `Officer on ${ptoType} leave`,
          exception_type: 'pto_suspension',
          created_at: new Date().toISOString()
        });

      console.log(`✅ Partnership suspended: ${officerData?.full_name} ↔ ${partnerData?.full_name}`);
      return {
        success: true,
        partnerName: partnerData?.full_name
      };

    } catch (error) {
      console.error("Error suspending partnership:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  };

  // Function to restore partnership when PTO is removed
  const restorePartnershipAfterPTO = async (officerId: string, shiftId: string) => {
    console.log(`🔄 Checking for partnership restoration for officer: ${officerId}`);

    try {
      // Find suspended partnership for this officer
      const { data: suspendedPartnership } = await supabase
        .from("schedule_exceptions")
        .select(`
          id,
          partner_officer_id,
          partnership_suspended,
          partner_profile:profiles!schedule_exceptions_partner_officer_id_fkey (
            id,
            full_name
          )
        `)
        .eq("officer_id", officerId)
        .eq("date", dateStr)
        .eq("shift_type_id", shiftId)
        .eq("partnership_suspended", true)
        .maybeSingle();

      if (!suspendedPartnership?.partnership_suspended || !suspendedPartnership.partner_officer_id) {
        console.log("No suspended partnership found");
        return { success: false, restored: false };
      }

      console.log("🔄 Restoring suspended partnership...");

      // Restore officer's partnership record
      await supabase
        .from("schedule_exceptions")
        .update({
          is_partnership: true,
          partnership_suspended: false,
          partnership_suspension_reason: null
        })
        .eq("officer_id", officerId)
        .eq("date", dateStr)
        .eq("shift_type_id", shiftId);

      // Restore partner's partnership record
      await supabase
        .from("schedule_exceptions")
        .update({
          is_partnership: true,
          partnership_suspended: false,
          partnership_suspension_reason: null
        })
        .eq("officer_id", suspendedPartnership.partner_officer_id)
        .eq("date", dateStr)
        .eq("shift_type_id", shiftId);

      // Mark partnership exception as resolved
      await supabase
        .from("partnership_exceptions")
        .update({
          resolved_at: new Date().toISOString()
        })
        .eq("officer_id", officerId)
        .eq("partner_officer_id", suspendedPartnership.partner_officer_id)
        .eq("date", dateStr)
        .eq("shift_type_id", shiftId)
        .eq("exception_type", 'pto_suspension');

      console.log(`✅ Partnership restored with ${suspendedPartnership.partner_profile?.full_name}`);
      return {
        success: true,
        restored: true,
        partnerName: suspendedPartnership.partner_profile?.full_name
      };

    } catch (error) {
      console.error("Error restoring partnership:", error);
      return {
        success: false,
        restored: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  };

  // Function to auto-create partnerships from recurring schedules
  const autoCreatePartnershipsFromRecurring = async (dateStr: string) => {
    const dayOfWeek = parseISO(dateStr).getDay();
    
    console.log(`🤖 Auto-creating partnerships from recurring schedules for ${dateStr} (day ${dayOfWeek})`);

    // Get all active recurring partnerships for this day
    const { data: recurringPartnerships, error } = await supabase
      .from("recurring_schedules")
      .select(`
        id,
        officer_id,
        partner_officer_id,
        shift_type_id,
        day_of_week,
        start_date,
        end_date,
        officer_profile:profiles!recurring_schedules_officer_id_fkey (
          id,
          full_name,
          rank
        ),
        partner_profile:profiles!recurring_schedules_partner_officer_id_fkey (
          id,
          full_name,
          rank
        ),
        shift_types (
          id,
          name
        )
      `)
      .eq("is_partnership", true)
      .eq("day_of_week", dayOfWeek)
      .lte("start_date", dateStr)
      .or(`end_date.is.null,end_date.gte.${dateStr}`);

    if (error) {
      console.error("Error fetching recurring partnerships:", error);
      return { created: 0, errors: [] };
    }

    if (!recurringPartnerships || recurringPartnerships.length === 0) {
      console.log("No recurring partnerships found for today");
      return { created: 0, errors: [] };
    }

    console.log(`Found ${recurringPartnerships.length} recurring partnerships to process`);
    const errors = [];
    let created = 0;

    for (const recurring of recurringPartnerships) {
      try {
        // Check if partnership already exists for today
        const { data: existingPartnership } = await supabase
          .from("schedule_exceptions")
          .select("id")
          .eq("officer_id", recurring.officer_id)
          .eq("date", dateStr)
          .eq("shift_type_id", recurring.shift_type_id)
          .eq("is_partnership", true)
          .maybeSingle();

        if (existingPartnership) {
          console.log(`Skipping - partnership already exists for ${recurring.officer_profile?.full_name}`);
          continue;
        }

        // Check if either officer is on PTO today
        const [{ data: officerPTO }, { data: partnerPTO }] = await Promise.all([
          supabase
            .from("schedule_exceptions")
            .select("id")
            .eq("officer_id", recurring.officer_id)
            .eq("date", dateStr)
            .eq("shift_type_id", recurring.shift_type_id)
            .eq("is_off", true)
            .maybeSingle(),
          supabase
            .from("schedule_exceptions")
            .select("id")
            .eq("officer_id", recurring.partner_officer_id)
            .eq("date", dateStr)
            .eq("shift_type_id", recurring.shift_type_id)
            .eq("is_off", true)
            .maybeSingle()
        ]);

        // If either officer is on PTO, don't create partnership
        if (officerPTO || partnerPTO) {
          console.log(`Skipping - ${officerPTO ? recurring.officer_profile?.full_name : recurring.partner_profile?.full_name} is on PTO`);
          continue;
        }

        // Create partnership exception for today
        const { error: createError } = await supabase
          .from("schedule_exceptions")
          .insert([
            {
              officer_id: recurring.officer_id,
              partner_officer_id: recurring.partner_officer_id,
              date: dateStr,
              shift_type_id: recurring.shift_type_id,
              is_partnership: true,
              is_off: false,
              schedule_type: "partnership_from_recurring",
              position_name: isPPOByRank(recurring.officer_profile?.rank) 
                ? "Riding Partner (PPO)" 
                : "Riding Partner"
            },
            {
              officer_id: recurring.partner_officer_id,
              partner_officer_id: recurring.officer_id,
              date: dateStr,
              shift_type_id: recurring.shift_type_id,
              is_partnership: true,
              is_off: false,
              schedule_type: "partnership_from_recurring",
              position_name: isPPOByRank(recurring.partner_profile?.rank) 
                ? "Riding Partner (PPO)" 
                : "Riding Partner"
            }
          ]);

        if (createError) {
          console.error(`Error creating partnership for ${recurring.officer_profile?.full_name}:`, createError);
          errors.push(createError.message);
        } else {
          console.log(`✅ Created partnership: ${recurring.officer_profile?.full_name} ↔ ${recurring.partner_profile?.full_name}`);
          created++;
        }
      } catch (error) {
        console.error(`Error processing recurring partnership ${recurring.id}:`, error);
        errors.push(error instanceof Error ? error.message : "Unknown error");
      }
    }

    console.log(`Auto-creation complete: ${created} partnerships created, ${errors.length} errors`);
    return { created, errors };
  };

const updateScheduleMutation = useMutation({
  mutationFn: async (params: UpdateScheduleParams) => {
    console.log("📝 Updating schedule with params:", params);

    // Check if this is a special assignment (position contains "other" case-insensitive)
    const isSpecialAssignment = params.positionName?.toLowerCase().includes('other');
    
    // FIRST: Check if this officer is in a partnership
    const { data: currentSchedule, error: fetchError } = await supabase
      .from("schedule_exceptions")
      .select("id, is_partnership, partner_officer_id, position_name, unit_number, notes, schedule_type")
      .eq("officer_id", params.officerId)
      .eq("date", params.date)
      .eq("shift_type_id", params.shiftTypeId)
      .eq("is_off", false)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching current schedule:", fetchError);
      throw fetchError;
    }

    // If this is a special assignment AND the officer is in a partnership
    if (isSpecialAssignment && currentSchedule?.is_partnership && currentSchedule?.partner_officer_id) {
      console.log("🔴 Handling special assignment for training officer in partnership:", params.officerId);
      
      // Get the training officer's profile
      const { data: officerProfile, error: officerProfileError } = await supabase
        .from("profiles")
        .select("default_position, default_unit, full_name, rank")
        .eq("id", params.officerId)
        .single();

      if (officerProfileError) {
        console.error("Error fetching officer profile:", officerProfileError);
        throw officerProfileError;
      }

      // Get the PPO's profile
      const { data: ppoProfile, error: ppoProfileError } = await supabase
        .from("profiles")
        .select("full_name, rank")
        .eq("id", currentSchedule.partner_officer_id)
        .single();

      if (ppoProfileError) {
        console.error("Error fetching PPO profile:", ppoProfileError);
        throw ppoProfileError;
      }

      // Get the PPO's current schedule
      let { data: partnerSchedule, error: partnerScheduleError } = await supabase
        .from("schedule_exceptions")
        .select("id, position_name, unit_number, notes, schedule_type, partnership_suspended")
        .eq("officer_id", currentSchedule.partner_officer_id)
        .eq("date", params.date)
        .eq("shift_type_id", params.shiftTypeId)
        .eq("is_off", false)
        .maybeSingle();

      if (partnerScheduleError) {
        console.error("Error fetching partner schedule:", partnerScheduleError);
        throw partnerScheduleError;
      }

      // Store the original position
      const originalPosition = officerProfile?.default_position || currentSchedule.position_name || 'Unknown';
      
      console.log("📋 Special assignment details:", {
        trainingOfficer: officerProfile?.full_name,
        trainingOfficerId: params.officerId,
        originalPosition,
        newPosition: params.positionName,
        ppo: ppoProfile?.full_name,
        ppoId: currentSchedule.partner_officer_id,
        ppoHasSchedule: !!partnerSchedule
      });

      // CRITICAL: Update the training officer to special assignment but KEEP the partnership reference
      const { error: officerError } = await supabase
        .from("schedule_exceptions")
        .update({
          position_name: params.positionName, // This will be "other (custom)"
          unit_number: params.unitNumber || currentSchedule.unit_number,
          notes: `SPECIAL ASSIGNMENT: ${params.positionName} - Original position: ${originalPosition}`,
          schedule_type: 'special_assignment',
          // CRITICAL: Keep the partnership info - DON'T break it
          is_partnership: true,
          partner_officer_id: currentSchedule.partner_officer_id,
          // Clear any suspension flags for the trainer
          partnership_suspended: false,
          partnership_suspension_reason: null
        })
        .eq("id", currentSchedule.id);

      if (officerError) {
        console.error("Error updating training officer:", officerError);
        throw officerError;
      }

      console.log("✅ Training officer updated successfully");

      // CRITICAL: Update or create the PPO's record with partnership reference preserved
      if (partnerSchedule) {
        // Update existing PPO schedule
        console.log("Updating existing PPO schedule:", partnerSchedule.id);
        const { error: partnerError } = await supabase
          .from("schedule_exceptions")
          .update({
            position_name: null, // PPO should have null position
            unit_number: params.unitNumber || currentSchedule.unit_number,
            notes: `PARTNERSHIP SUSPENDED - Training Officer (${officerProfile?.full_name}) on special assignment: ${params.positionName}`,
            schedule_type: 'partnership_suspended',
            // CRITICAL: Keep the partnership reference
            is_partnership: true,
            partner_officer_id: params.officerId,
            // CRITICAL: Mark as suspended so UI moves them to suspended section
            partnership_suspended: true,
            partnership_suspension_reason: 'training_officer_special_assignment',
            is_off: false
          })
          .eq("id", partnerSchedule.id);

        if (partnerError) {
          console.error("Error updating PPO schedule:", partnerError);
          throw partnerError;
        }
        console.log("✅ PPO schedule updated successfully");
      } else {
        // Create new exception for PPO - this is crucial if they don't have one yet
        console.log("Creating new PPO schedule");
        const { error: createPartnerError } = await supabase
          .from("schedule_exceptions")
          .insert({
            officer_id: currentSchedule.partner_officer_id,
            date: params.date,
            shift_type_id: params.shiftTypeId,
            is_off: false,
            position_name: null,
            unit_number: params.unitNumber || currentSchedule.unit_number,
            notes: `PARTNERSHIP SUSPENDED - Training Officer (${officerProfile?.full_name}) on special assignment: ${params.positionName}`,
            schedule_type: 'partnership_suspended',
            // CRITICAL: Set partnership reference
            is_partnership: true,
            partner_officer_id: params.officerId,
            // CRITICAL: Mark as suspended
            partnership_suspended: true,
            partnership_suspension_reason: 'training_officer_special_assignment',
            custom_start_time: null,
            custom_end_time: null
          });

        if (createPartnerError) {
          console.error("Error creating PPO schedule:", createPartnerError);
          throw createPartnerError;
        }
        console.log("✅ PPO schedule created successfully");
      }

      // Also update recurring_schedules if this is a recurring day
      const dayOfWeek = parseISO(params.date).getDay();
      
      // Check if this is a recurring schedule day for training officer
      const { data: trainingRecurring, error: trainingRecurringError } = await supabase
        .from("recurring_schedules")
        .select("id")
        .eq("officer_id", params.officerId)
        .eq("shift_type_id", params.shiftTypeId)
        .eq("day_of_week", dayOfWeek)
        .maybeSingle();

      if (trainingRecurringError) {
        console.error("Error fetching training recurring:", trainingRecurringError);
      } else if (trainingRecurring) {
        // Update training officer's recurring schedule to note special assignment
        const { error: updateTrainingRecurringError } = await supabase
          .from("recurring_schedules")
          .update({
            is_partnership: true,
            partner_officer_id: currentSchedule.partner_officer_id,
            position_name: originalPosition, // Keep original position in recurring
            unit_number: params.unitNumber || currentSchedule.unit_number
          })
          .eq("id", trainingRecurring.id);

        if (updateTrainingRecurringError) {
          console.error("Error updating training recurring:", updateTrainingRecurringError);
        } else {
          console.log("✅ Training officer recurring schedule updated");
        }
      }

      // Check for PPO's recurring schedule
      const { data: ppoRecurring, error: ppoRecurringError } = await supabase
        .from("recurring_schedules")
        .select("id")
        .eq("officer_id", currentSchedule.partner_officer_id)
        .eq("shift_type_id", params.shiftTypeId)
        .eq("day_of_week", dayOfWeek)
        .maybeSingle();

      if (ppoRecurringError) {
        console.error("Error fetching PPO recurring:", ppoRecurringError);
      } else if (ppoRecurring) {
        // Update PPO's recurring schedule to mark as suspended
        const { error: updatePPORecurringError } = await supabase
          .from("recurring_schedules")
          .update({
            is_partnership: true,
            partner_officer_id: params.officerId,
            position_name: null,
            unit_number: params.unitNumber || currentSchedule.unit_number
          })
          .eq("id", ppoRecurring.id);

        if (updatePPORecurringError) {
          console.error("Error updating PPO recurring:", updatePPORecurringError);
        } else {
          console.log("✅ PPO recurring schedule updated");
        }
      }

      // Check if a partnership exception already exists for today
      const { data: existingException, error: checkExceptionError } = await supabase
        .from("partnership_exceptions")
        .select("id")
        .eq("officer_id", params.officerId)
        .eq("partner_officer_id", currentSchedule.partner_officer_id)
        .eq("date", params.date)
        .eq("shift_type_id", params.shiftTypeId)
        .maybeSingle();

      if (checkExceptionError) {
        console.error("Error checking existing partnership exception:", checkExceptionError);
      }

      // Only insert if no existing exception
      if (!existingException) {
        console.log("Creating new partnership exception record");
        const { error: insertExceptionError } = await supabase
          .from("partnership_exceptions")
          .insert({
            officer_id: params.officerId,
            partner_officer_id: currentSchedule.partner_officer_id,
            date: params.date,
            shift_type_id: params.shiftTypeId,
            reason: `Training Officer on special assignment: ${params.positionName}`,
            exception_type: 'special_assignment_suspension',
            created_at: new Date().toISOString()
          });

        if (insertExceptionError) {
          console.error("Error inserting partnership exception:", insertExceptionError);
          // Don't throw - this is non-critical
        } else {
          console.log("✅ Partnership exception created");
        }
      } else {
        console.log("Partnership exception already exists, skipping insert");
      }

      console.log("✅ Special assignment created, partnership preserved and suspended:", {
        trainingOfficer: officerProfile?.full_name,
        trainingOfficerId: params.officerId,
        trainingOfficerNewPosition: params.positionName,
        ppo: ppoProfile?.full_name,
        ppoId: currentSchedule.partner_officer_id,
        partnershipIntact: true,
        ppoSuspended: true
      });

      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["available-partners"] });
      
      toast.success(`${officerProfile?.full_name} assigned to ${params.positionName}`);
      toast.info(`${ppoProfile?.full_name} moved to suspended partnerships`);

      return; // Exit early
    }
    
    if (params.type === "recurring") {
      // For recurring officers, update via exceptions table
      const { data: existingExceptions, error: checkError } = await supabase
        .from("schedule_exceptions")
        .select("id, is_partnership, partner_officer_id, position_name, notes")
        .eq("officer_id", params.officerId)
        .eq("date", params.date)
        .eq("shift_type_id", params.shiftTypeId)
        .eq("is_off", false);

      if (checkError) throw checkError;

      if (existingExceptions && existingExceptions.length > 0) {
        const exception = existingExceptions[0];
        
        // If updating partnership status, handle partner updates too
        if (params.isPartnership && params.partnerOfficerId) {
          console.log("🤝 Updating partnership in exception");
          
          const updateData: any = {
            position_name: params.positionName,
            unit_number: params.unitNumber,
            partner_officer_id: params.partnerOfficerId,
            is_partnership: params.isPartnership
          };

          // For regular officers not in partnership, this won't trigger
          if (isSpecialAssignment) {
            const { data: officerProfile } = await supabase
              .from("profiles")
              .select("default_position")
              .eq("id", params.officerId)
              .single();
            
            updateData.notes = `Special assignment - Original position: ${officerProfile?.default_position || 'Unknown'}`;
            updateData.schedule_type = 'special_assignment';
          } else {
            updateData.notes = params.notes;
          }
          
          const { error } = await supabase
            .from("schedule_exceptions")
            .update(updateData)
            .eq("id", exception.id);
          
          if (error) throw error;

          // Find and update partner's exception
          const { data: partnerException } = await supabase
            .from("schedule_exceptions")
            .select("id")
            .eq("officer_id", params.partnerOfficerId)
            .eq("date", params.date)
            .eq("shift_type_id", params.shiftTypeId)
            .eq("is_off", false)
            .maybeSingle();

          if (partnerException) {
            await supabase
              .from("schedule_exceptions")
              .update({
                partner_officer_id: params.officerId,
                is_partnership: params.isPartnership,
                notes: isSpecialAssignment ? `Training Officer on special assignment` : null
              })
              .eq("id", partnerException.id);
          }
        } else {
          // Normal update without partnership
          const updateData: any = {
            position_name: params.positionName,
            unit_number: params.unitNumber,
            partner_officer_id: params.partnerOfficerId || null,
            is_partnership: params.isPartnership || false
          };

          if (isSpecialAssignment && exception.is_partnership) {
            updateData.notes = `Special assignment - Original position: ${exception.position_name || 'Unknown'}`;
            updateData.schedule_type = 'special_assignment';
          } else {
            updateData.notes = params.notes;
          }

          const { error } = await supabase
            .from("schedule_exceptions")
            .update(updateData)
            .eq("id", exception.id);
          
          if (error) throw error;
        }
      } else {
        // Create new exception
        const insertData: any = {
          officer_id: params.officerId,
          date: params.date,
          shift_type_id: params.shiftTypeId,
          is_off: false,
          position_name: params.positionName,
          unit_number: params.unitNumber,
          partner_officer_id: params.partnerOfficerId,
          is_partnership: params.isPartnership,
          custom_start_time: null,
          custom_end_time: null
        };

        if (isSpecialAssignment && params.isPartnership) {
          const { data: officerProfile } = await supabase
            .from("profiles")
            .select("default_position")
            .eq("id", params.officerId)
            .single();
          
          insertData.notes = `Special assignment - Original position: ${officerProfile?.default_position || 'Unknown'}`;
          insertData.schedule_type = 'special_assignment';
        } else {
          insertData.notes = params.notes;
        }

        const { error } = await supabase
          .from("schedule_exceptions")
          .insert(insertData);
        
        if (error) throw error;
      }
    } else {
      // For exception officers
      const updateData: any = {
        position_name: params.positionName,
        unit_number: params.unitNumber,
        partner_officer_id: params.partnerOfficerId,
        is_partnership: params.isPartnership
      };

      // Handle special assignment for existing exception
      if (isSpecialAssignment) {
        const { data: currentSchedule } = await supabase
          .from("schedule_exceptions")
          .select("position_name, is_partnership")
          .eq("id", params.scheduleId)
          .single();

        if (currentSchedule?.is_partnership) {
          updateData.notes = `Special assignment - Original position: ${currentSchedule.position_name || 'Unknown'}`;
          updateData.schedule_type = 'special_assignment';
        }
      } else {
        updateData.notes = params.notes;
      }

      const { error } = await supabase
        .from("schedule_exceptions")
        .update(updateData)
        .eq("id", params.scheduleId);
        
      if (error) throw error;

      // If updating partnership, also update partner's record
      if (params.isPartnership && params.partnerOfficerId) {
        const { data: partnerException } = await supabase
          .from("schedule_exceptions")
          .select("id")
          .eq("officer_id", params.partnerOfficerId)
          .eq("date", params.date)
          .eq("shift_type_id", params.shiftTypeId)
          .maybeSingle();

        if (partnerException) {
          await supabase
            .from("schedule_exceptions")
            .update({
              partner_officer_id: params.officerId,
              is_partnership: params.isPartnership,
              notes: isSpecialAssignment ? `Training Officer on special assignment` : null
            })
            .eq("id", partnerException.id);
        }
      }
    }
  },
  onSuccess: (data, variables) => {
    // Only show toast if we haven't already shown one in the special assignment handler
    if (!variables.positionName?.toLowerCase().includes('other')) {
      toast.success("Schedule updated");
    }
    queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  },
  onError: (error: any) => {
    toast.error(error.message || "Failed to update schedule");
  },
});

// Enhanced partnership mutation with PTO handling, verification, and better error handling
const updatePartnershipMutation = useMutation({
  mutationFn: async ({ 
    officer, 
    partnerOfficerId, 
    action,
    position,
    isEmergency,
    isOfficerPPO
  }: { 
    officer: any; 
    partnerOfficerId?: string; 
    action: 'create' | 'remove' | 'emergency';
    position?: string;
    isEmergency?: boolean;
    isOfficerPPO?: boolean;
  }) => {
    console.log("🔄 Partnership mutation:", { 
      officerName: officer.name, 
      officerId: officer.officerId,
      officerRank: officer.rank,
      officerPosition: officer.position,
      partnerOfficerId, 
      action,
      position,
      isEmergency,
      isOfficerPPO
    });

    if (action === 'create' && partnerOfficerId) {
      // Validate inputs
      if (!officer.officerId || !partnerOfficerId) {
        throw new Error("Missing officer IDs for partnership");
      }

      const targetDate = officer.date || dateStr;
      const shiftId = officer.shift.id;
      const dayOfWeek = officer.dayOfWeek || parseISO(targetDate).getDay();

      // FIRST - Get officer and partner profiles for rank checking and details
      // Using correct column names from your profile table
      console.log("📊 Fetching profiles for officers:", {
        officerId: officer.officerId,
        partnerId: partnerOfficerId
      });

      const [officerProfileResult, partnerProfileResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, rank, default_position, default_unit")
          .eq("id", officer.officerId)
          .single(),
        supabase
          .from("profiles")
          .select("full_name, rank, default_position, default_unit")
          .eq("id", partnerOfficerId)
          .single()
      ]);

      if (officerProfileResult.error) {
        console.error("Error fetching officer profile:", officerProfileResult.error);
        throw new Error(`Failed to fetch officer profile: ${officerProfileResult.error.message}`);
      }

      if (partnerProfileResult.error) {
        console.error("Error fetching partner profile:", partnerProfileResult.error);
        throw new Error(`Failed to fetch partner profile: ${partnerProfileResult.error.message}`);
      }

      const officerProfile = officerProfileResult.data;
      const partnerProfile = partnerProfileResult.data;

      console.log("🔍 Raw values from profiles:", {
        officer: {
          id: officer.officerId,
          name: officerProfile?.full_name,
          rank: officerProfile?.rank,
          default_position: officerProfile?.default_position,
          default_unit: officerProfile?.default_unit
        },
        partner: {
          id: partnerOfficerId,
          name: partnerProfile?.full_name,
          rank: partnerProfile?.rank,
          default_position: partnerProfile?.default_position,
          default_unit: partnerProfile?.default_unit
        }
      });

      // Custom function to check if a rank is PPO
      const isRankPPO = (rank: any): boolean => {
        if (!rank) {
          console.log("⚠️ Rank is null or undefined, defaulting to non-PPO");
          return false;
        }
        
        const rankStr = String(rank).toLowerCase().trim();
        console.log(`Checking rank "${rankStr}" for PPO status`);
        
        // List of ranks that are NOT PPO (Training Officers)
        const nonPPORanks = [
          'police officer',
          'officer',
          'training officer',
          'field training officer',
          'fto',
          'senior officer',
          'master officer',
          'corporal',
          'sergeant',
          'lieutenant',
          'captain',
          'commander',
          'chief',
          'deputy',
          'sheriff',
          'marshal',
          'agent',
          'inspector'
        ];
        
        // If it's in the non-PPO list, it's NOT a PPO
        if (nonPPORanks.some(r => rankStr.includes(r))) {
          console.log(`Rank "${rankStr}" is NOT a PPO (matched non-PPO list: "${nonPPORanks.find(r => rankStr.includes(r))}")`);
          return false;
        }
        
        // Check if it's explicitly a PPO rank
        const isPPO = rankStr.includes('ppo') || 
                      rankStr.includes('probationary') || 
                      rankStr === 'p' ||
                      rankStr === 'ppo' ||
                      rankStr.includes('probationary police officer');
        
        console.log(`Rank "${rankStr}" is ${isPPO ? '' : 'NOT '}a PPO`);
        return isPPO;
      };

      // Determine if each officer is a PPO using our custom function
      const isOfficerPpo = isRankPPO(officerProfile?.rank);
      const isPartnerPpo = isRankPPO(partnerProfile?.rank);

      console.log("🔍 Partnership rank check (after processing):", {
        officer: {
          id: officer.officerId,
          name: officerProfile?.full_name,
          rawRank: officerProfile?.rank,
          processedRank: String(officerProfile?.rank || '').toLowerCase().trim(),
          isPPO: isOfficerPpo
        },
        partner: {
          id: partnerOfficerId,
          name: partnerProfile?.full_name,
          rawRank: partnerProfile?.rank,
          processedRank: String(partnerProfile?.rank || '').toLowerCase().trim(),
          isPPO: isPartnerPpo
        }
      });

      // Check if either officer is on PTO (now that we have profiles)
      const [{ data: officerPTO }, { data: partnerPTO }] = await Promise.all([
        supabase
          .from("schedule_exceptions")
          .select("id")
          .eq("officer_id", officer.officerId)
          .eq("date", targetDate)
          .eq("shift_type_id", shiftId)
          .eq("is_off", true)
          .maybeSingle(),
        supabase
          .from("schedule_exceptions")
          .select("id")
          .eq("officer_id", partnerOfficerId)
          .eq("date", targetDate)
          .eq("shift_type_id", shiftId)
          .eq("is_off", true)
          .maybeSingle()
      ]);

      if (officerPTO) {
        throw new Error(`${officerProfile?.full_name || officer.name} is on PTO and cannot be partnered`);
      }

      if (partnerPTO) {
        throw new Error(`${partnerProfile?.full_name} is on PTO and cannot be partnered`);
      }

      // Check if either officer already has a partnership for this date/shift
      const [{ data: existingOfficerSchedule }, { data: existingPartnerSchedule }] = await Promise.all([
        supabase
          .from("schedule_exceptions")
          .select("id, is_partnership, position_name, unit_number, notes, schedule_type")
          .eq("officer_id", officer.officerId)
          .eq("date", targetDate)
          .eq("shift_type_id", shiftId)
          .eq("is_off", false)
          .maybeSingle(),
        supabase
          .from("schedule_exceptions")
          .select("id, is_partnership, position_name, unit_number, notes, schedule_type")
          .eq("officer_id", partnerOfficerId)
          .eq("date", targetDate)
          .eq("shift_type_id", shiftId)
          .eq("is_off", false)
          .maybeSingle()
      ]);

      // Check if officer already has a partnership
      if (existingOfficerSchedule?.is_partnership) {
        throw new Error(`${officerProfile?.full_name || officer.name} is already in a partnership for this shift`);
      }

      // Check if partner already has a partnership
      if (existingPartnerSchedule?.is_partnership) {
        throw new Error(`${partnerProfile?.full_name} is already in a partnership for this shift`);
      }

      // VALIDATION: Ensure one is PPO and one is not
      if (isOfficerPpo === isPartnerPpo) {
        console.error("❌ Partnership validation failed:", {
          officer: {
            id: officer.officerId,
            name: officerProfile?.full_name,
            rank: officerProfile?.rank,
            isPPO: isOfficerPpo
          },
          partner: {
            id: partnerOfficerId,
            name: partnerProfile?.full_name,
            rank: partnerProfile?.rank,
            isPPO: isPartnerPpo
          },
          message: "Both officers have the same PPO status"
        });
        
        // Provide a more helpful error message
        if (isOfficerPpo && isPartnerPpo) {
          throw new Error(`Cannot create partnership between two PPOs (${officerProfile?.full_name} and ${partnerProfile?.full_name}). A Training Officer (non-PPO) is required.`);
        } else {
          throw new Error(`Cannot create partnership between two Training Officers (${officerProfile?.full_name} and ${partnerProfile?.full_name}). A PPO is required.`);
        }
      }

      // DETERMINE WHO IS THE TRAINING OFFICER (non-PPO) AND WHO IS THE PPO
      let trainingOfficer = {
        id: '',
        name: '',
        position: '',
        unit: '',
        scheduleId: '',
        type: '',
        existingSchedule: null as any,
        profile: null as any
      };
      
      let ppo = {
        id: '',
        name: '',
        scheduleId: '',
        type: '',
        existingSchedule: null as any,
        profile: null as any
      };

      if (!isOfficerPpo && isPartnerPpo) {
        // Officer is training officer, partner is PPO
        trainingOfficer = {
          id: officer.officerId,
          name: officerProfile?.full_name || officer.name,
          position: officerProfile?.default_position || officer.position || existingOfficerSchedule?.position_name || '',
          unit: officerProfile?.default_unit || officer.unitNumber || existingOfficerSchedule?.unit_number || '',
          scheduleId: officer.scheduleId,
          type: officer.type,
          existingSchedule: existingOfficerSchedule,
          profile: officerProfile
        };
        
        ppo = {
          id: partnerOfficerId,
          name: partnerProfile?.full_name || 'Unknown',
          scheduleId: existingPartnerSchedule?.id || null,
          type: 'exception',
          existingSchedule: existingPartnerSchedule,
          profile: partnerProfile
        };
        
        console.log("👨‍🏫 Training officer (non-PPO):", trainingOfficer.name, "with position:", trainingOfficer.position);
        console.log("👶 PPO:", ppo.name);
        
      } else if (isOfficerPpo && !isPartnerPpo) {
        // Officer is PPO, partner is training officer
        
        // Get training officer's position from their profile or schedule
        let trainingOfficerPosition = '';
        let trainingOfficerUnit = '';
        
        // First try from profile
        if (partnerProfile?.default_position) {
          trainingOfficerPosition = partnerProfile.default_position;
          trainingOfficerUnit = partnerProfile.default_unit || '';
        } 
        // Then try from existing schedule
        else if (existingPartnerSchedule?.position_name) {
          trainingOfficerPosition = existingPartnerSchedule.position_name;
          trainingOfficerUnit = existingPartnerSchedule.unit_number || '';
        } 
        // Finally try from recurring_schedules
        else {
          const { data: trainingOfficerSchedule } = await supabase
            .from("recurring_schedules")
            .select("position_name, unit_number")
            .eq("officer_id", partnerOfficerId)
            .eq("shift_type_id", shiftId)
            .eq("day_of_week", dayOfWeek)
            .maybeSingle();
            
          trainingOfficerPosition = trainingOfficerSchedule?.position_name || '';
          trainingOfficerUnit = trainingOfficerSchedule?.unit_number || '';
        }
        
        // If still no position, use a default
        if (!trainingOfficerPosition) {
          trainingOfficerPosition = 'Training Officer';
        }
        
        trainingOfficer = {
          id: partnerOfficerId,
          name: partnerProfile?.full_name || 'Unknown',
          position: trainingOfficerPosition,
          unit: trainingOfficerUnit,
          scheduleId: existingPartnerSchedule?.id || null,
          type: 'recurring',
          existingSchedule: existingPartnerSchedule,
          profile: partnerProfile
        };
        
        ppo = {
          id: officer.officerId,
          name: officerProfile?.full_name || officer.name,
          scheduleId: officer.scheduleId,
          type: officer.type,
          existingSchedule: existingOfficerSchedule,
          profile: officerProfile
        };
        
        console.log("👨‍🏫 Training officer (non-PPO):", trainingOfficer.name, "with position:", trainingOfficer.position);
        console.log("👶 PPO:", ppo.name);
      }

      console.log("📋 Partnership details:", {
        trainingOfficer: {
          id: trainingOfficer.id,
          name: trainingOfficer.name,
          position: trainingOfficer.position,
          unit: trainingOfficer.unit,
          rank: trainingOfficer.profile?.rank,
          isPPO: false
        },
        ppo: {
          id: ppo.id,
          name: ppo.name,
          position: null,
          rank: ppo.profile?.rank,
          isPPO: true
        }
      });

      // Create or update schedule exceptions for both officers
      const updates = [];

      // FOR THE TRAINING OFFICER - Keep their original position stored but allow temporary "Other"
      if (trainingOfficer.existingSchedule) {
        // Check if this is a special assignment (position is "Other")
        const isSpecialAssignment = position === 'Other' || position === 'other';
        
        // Store the original position in a separate field or notes if needed
        updates.push(
          supabase
            .from("schedule_exceptions")
            .update({
              is_partnership: true,
              partner_officer_id: ppo.id,
              // If this is a special assignment, use "Other" but keep partnership
              // Otherwise use their original position
              position_name: isSpecialAssignment ? 'Other' : trainingOfficer.position,
              unit_number: trainingOfficer.unit,
              schedule_type: isSpecialAssignment ? 'special_assignment' : (isEmergency ? 'emergency_partnership' : 'manual_partnership'),
              // Store the original position in notes
              notes: isSpecialAssignment ? `Original position: ${trainingOfficer.position}` : null
            })
            .eq("id", trainingOfficer.existingSchedule.id)
        );
      } else {
        // Create new exception for training officer
        const isSpecialAssignment = position === 'Other' || position === 'other';
        
        updates.push(
          supabase
            .from("schedule_exceptions")
            .insert({
              officer_id: trainingOfficer.id,
              date: targetDate,
              shift_type_id: shiftId,
              is_off: false,
              is_partnership: true,
              partner_officer_id: ppo.id,
              // If this is a special assignment, use "Other" but keep partnership
              // Otherwise use their original position
              position_name: isSpecialAssignment ? 'Other' : trainingOfficer.position,
              unit_number: trainingOfficer.unit,
              schedule_type: isSpecialAssignment ? 'special_assignment' : (isEmergency ? 'emergency_partnership' : 'manual_partnership'),
              // Store the original position in notes
              notes: isSpecialAssignment ? `Original position: ${trainingOfficer.position}` : null,
              custom_start_time: null,
              custom_end_time: null
            })
        );
      }

      // FOR THE PPO - EXPLICITLY SET position_name TO null (NO POSITION)
      if (ppo.existingSchedule) {
        // Update existing exception for PPO
        updates.push(
          supabase
            .from("schedule_exceptions")
            .update({
              is_partnership: true,
              partner_officer_id: trainingOfficer.id,
              position_name: null, // CRITICAL: EXPLICITLY SET TO null - NO POSITION
              unit_number: trainingOfficer.unit, // Use training officer's unit
              schedule_type: isEmergency ? 'emergency_partnership' : 'manual_partnership'
              // notes field removed - will keep existing notes or null
            })
            .eq("id", ppo.existingSchedule.id)
        );
      } else {
        // Create new exception for PPO
        updates.push(
          supabase
            .from("schedule_exceptions")
            .insert({
              officer_id: ppo.id,
              date: targetDate,
              shift_type_id: shiftId,
              is_off: false,
              is_partnership: true,
              partner_officer_id: trainingOfficer.id,
              position_name: null, // CRITICAL: EXPLICITLY SET TO null - NO POSITION
              unit_number: trainingOfficer.unit, // Use training officer's unit
              schedule_type: isEmergency ? 'emergency_partnership' : 'manual_partnership',
              custom_start_time: null,
              custom_end_time: null
              // notes field omitted - will default to null
            })
        );
      }

      // Execute all updates
      const results = await Promise.all(updates);
      const errors = results.filter(result => result.error).map(result => result.error);
      
      if (errors.length > 0) {
        console.error("Errors creating partnership:", errors);
        throw new Error(`Failed to create partnership: ${errors[0]?.message}`);
      }

      // Update recurring_schedules if this is a recurring partnership
      if (!isEmergency && (officer.type === 'recurring' || officer.type === 'recurring')) {
        console.log("🔄 Updating recurring_schedules for partnership");
        
        // For training officer (recurring)
        const { data: trainingRecurring } = await supabase
          .from("recurring_schedules")
          .select("id")
          .eq("officer_id", trainingOfficer.id)
          .eq("shift_type_id", shiftId)
          .eq("day_of_week", dayOfWeek)
          .maybeSingle();
          
        if (trainingRecurring) {
          const { error: trainingError } = await supabase
            .from("recurring_schedules")
            .update({
              is_partnership: true,
              partner_officer_id: ppo.id,
              position_name: trainingOfficer.position, // Keep position - NOT NULL
              unit_number: trainingOfficer.unit
            })
            .eq("id", trainingRecurring.id);
            
          if (trainingError) {
            console.warn("Error updating training officer recurring:", trainingError);
          } else {
            console.log("✅ Updated training officer recurring schedule with position:", trainingOfficer.position);
          }
        }
        
        // For PPO (recurring) - EXPLICITLY SET position_name TO null
        const { data: ppoRecurring } = await supabase
          .from("recurring_schedules")
          .select("id")
          .eq("officer_id", ppo.id)
          .eq("shift_type_id", shiftId)
          .eq("day_of_week", dayOfWeek)
          .maybeSingle();
          
        if (ppoRecurring) {
          const { error: ppoError } = await supabase
            .from("recurring_schedules")
            .update({
              is_partnership: true,
              partner_officer_id: trainingOfficer.id,
              position_name: null, // CRITICAL: EXPLICITLY SET TO null - NO POSITION
              unit_number: trainingOfficer.unit
            })
            .eq("id", ppoRecurring.id);
            
          if (ppoError) {
            console.warn("Error updating PPO recurring:", ppoError);
          } else {
            console.log("✅ Updated PPO recurring schedule with position: null");
          }
        }
      }

      // Verify the PPO has null position
      const { data: verifyPPO } = await supabase
        .from("schedule_exceptions")
        .select("position_name")
        .eq("officer_id", ppo.id)
        .eq("date", targetDate)
        .eq("shift_type_id", shiftId)
        .single();

      console.log("🔍 Verification - PPO position_name:", verifyPPO?.position_name);

      console.log("✅ Partnership created successfully:", {
        trainingOfficer: trainingOfficer.name,
        trainingOfficerPosition: trainingOfficer.position,
        ppo: ppo.name,
        ppoPosition: null
      });

      return { 
        success: true,
        trainingOfficer: trainingOfficer.name,
        ppo: ppo.name,
        message: `${trainingOfficer.name} (${trainingOfficer.position}) is now training ${ppo.name}`
      };

    } else if (action === 'remove') {
      console.log("Removing partnership for officer:", officer.officerId);
      
      const targetDate = officer.date || dateStr;
      const shiftId = officer.shift.id;
      const dayOfWeek = officer.dayOfWeek || parseISO(targetDate).getDay();
      const actualPartnerOfficerId = partnerOfficerId || officer.partnerOfficerId;

      // Get officer's current schedule to check if it's a special assignment
      const { data: officerSchedule } = await supabase
        .from("schedule_exceptions")
        .select("position_name, unit_number, notes, schedule_type")
        .eq("officer_id", officer.officerId)
        .eq("date", targetDate)
        .eq("shift_type_id", shiftId)
        .eq("is_off", false)
        .maybeSingle();

      // Determine what position to restore
      let restoredPosition = null;
      
      // If this was a special assignment, try to restore the original position from notes
      if (officerSchedule?.schedule_type === 'special_assignment' && officerSchedule?.notes) {
        const noteMatch = officerSchedule.notes.match(/Original position: (.+)$/);
        if (noteMatch && noteMatch[1]) {
          restoredPosition = noteMatch[1];
          console.log("🔄 Restoring original position from special assignment:", restoredPosition);
        }
      }

      // Remove partnership from officer's schedule exception
      const { error: officerError } = await supabase
        .from("schedule_exceptions")
        .update({
          is_partnership: false,
          partner_officer_id: null,
          partnership_suspended: false,
          partnership_suspension_reason: null,
          // If it was a manual partnership or special assignment, restore original position or set to null
          position_name: restoredPosition || (
            officerSchedule?.schedule_type === "manual_partnership" || 
            officerSchedule?.schedule_type === "emergency_partnership" ||
            officerSchedule?.schedule_type === "special_assignment"
            ? null 
            : officerSchedule?.position_name
          ),
          // Clear notes if they were for special assignment
          notes: officerSchedule?.schedule_type === 'special_assignment' ? null : officerSchedule?.notes
        })
        .eq("officer_id", officer.officerId)
        .eq("date", targetDate)
        .eq("shift_type_id", shiftId)
        .eq("is_off", false);

      if (officerError) {
        console.error("Error removing officer partnership:", officerError);
        throw officerError;
      }

      console.log("Successfully removed partnership from officer");

      // Remove partnership from partner officer if partner exists
      if (actualPartnerOfficerId) {
        console.log("Removing partnership from partner officer:", actualPartnerOfficerId);

        // Get partner's current schedule
        const { data: partnerSchedule } = await supabase
          .from("schedule_exceptions")
          .select("position_name, unit_number, notes, schedule_type")
          .eq("officer_id", actualPartnerOfficerId)
          .eq("date", targetDate)
          .eq("shift_type_id", shiftId)
          .eq("is_off", false)
          .maybeSingle();

        const { error: partnerError } = await supabase
          .from("schedule_exceptions")
          .update({
            is_partnership: false,
            partner_officer_id: null,
            partnership_suspended: false,
            partnership_suspension_reason: null,
            // If it was a manual partnership, keep the position, otherwise reset to null
            position_name: partnerSchedule?.schedule_type === "manual_partnership" || 
                          partnerSchedule?.schedule_type === "emergency_partnership" 
                          ? null 
                          : partnerSchedule?.position_name,
            // Clear special assignment notes from partner
            notes: partnerSchedule?.notes === "Training Officer on special assignment" ? null : partnerSchedule?.notes
          })
          .eq("officer_id", actualPartnerOfficerId)
          .eq("date", targetDate)
          .eq("shift_type_id", shiftId)
          .eq("is_off", false);

        if (partnerError) {
          console.error("Error removing partner relationship:", partnerError);
          // Don't throw - we still want to remove the primary officer's partnership
        } else {
          console.log("Successfully removed partnership from partner officer");
        }
      } else {
        console.warn("No partnerOfficerId found for removal");
      }

      // NEW: Also remove from recurring_schedules if this is a recurring partnership
      if (officer.type === 'recurring' || officer.originalScheduleId) {
        console.log("🔄 Also removing from recurring_schedules");
        
        if (actualPartnerOfficerId) {
          const recurringResult = await removeRecurringPartnership(
            officer.officerId,
            actualPartnerOfficerId,
            shiftId,
            dayOfWeek
          );
          
          if (!recurringResult.success) {
            console.warn("⚠️ Could not remove from recurring schedules:", recurringResult.error);
          }
        }
      }

      // Log partnership removal
      await supabase
        .from("partnership_exceptions")
        .insert({
          officer_id: officer.officerId,
          partner_officer_id: actualPartnerOfficerId,
          date: targetDate,
          shift_type_id: shiftId,
          reason: 'Partnership removed',
          exception_type: 'removed',
          created_at: new Date().toISOString()
        });

      return {
        success: true,
        officerName: officer.name,
        partnerName: officer.partnerData?.partnerName
      };
    }

    throw new Error(`Unknown action: ${action}`);
  },
  onSuccess: (data, variables) => {
    const action = variables.action;
    if (action === 'remove') {
      toast.success("Partnership removed successfully");
    } else if (action === 'emergency') {
      toast.success("Emergency partnership created successfully");
    } else {
      toast.success("Partnership created successfully");
    }
    
    // Force refresh all relevant queries
    queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
    queryClient.invalidateQueries({ queryKey: ["weekly-schedule"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    queryClient.invalidateQueries({ queryKey: ["available-partners"] });
    
    // Add a small delay to ensure the backend has processed the changes
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
    }, 500);
  },
  onError: (error: any) => {
    console.error("Partnership mutation error:", error);
    toast.error(error.message || "Failed to update partnership");
  },
});

  const addOfficerMutation = useMutation({
    mutationFn: async ({ 
      officerId, 
      shiftId, 
      position, 
      unitNumber, 
      notes,
      partnerOfficerId,
      isPartnership
    }: { 
      officerId: string; 
      shiftId: string; 
      position: string; 
      unitNumber?: string; 
      notes?: string;
      partnerOfficerId?: string;
      isPartnership?: boolean;
    }) => {
      const { data: existingExceptions, error: checkError } = await supabase
        .from("schedule_exceptions")
        .select("id")
        .eq("officer_id", officerId)
        .eq("date", dateStr)
        .eq("shift_type_id", shiftId)
        .eq("is_off", false);

      if (checkError) throw checkError;

      if (existingExceptions && existingExceptions.length > 0) {
        // Handle duplicates
        if (existingExceptions.length > 1) {
          const recordsToDelete = existingExceptions.slice(1);
          for (const record of recordsToDelete) {
            await supabase
              .from("schedule_exceptions")
              .delete()
              .eq("id", record.id);
          }
        }
        
        const { error } = await supabase
          .from("schedule_exceptions")
          .update({
            position_name: position,
            unit_number: unitNumber,
            notes: notes,
            partner_officer_id: partnerOfficerId,
            is_partnership: isPartnership,
            custom_start_time: null,
            custom_end_time: null
          })
          .eq("id", existingExceptions[0].id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("schedule_exceptions")
          .insert({
            officer_id: officerId,
            date: dateStr,
            shift_type_id: shiftId,
            is_off: false,
            position_name: position,
            unit_number: unitNumber,
            notes: notes,
            partner_officer_id: partnerOfficerId,
            is_partnership: isPartnership,
            custom_start_time: null,
            custom_end_time: null
          });
        
        if (error) throw error;

        // If creating a partnership, also create partner's record
        if (isPartnership && partnerOfficerId) {
          const { error: partnerError } = await supabase
            .from("schedule_exceptions")
            .insert({
              officer_id: partnerOfficerId,
              date: dateStr,
              shift_type_id: shiftId,
              is_off: false,
              position_name: "Riding Partner",
              partner_officer_id: officerId,
              is_partnership: true,
              custom_start_time: null,
              custom_end_time: null
            });
          
          if (partnerError) {
            console.error("Error creating partner record:", partnerError);
            // Don't throw - the main officer was added successfully
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("Officer added to schedule");
      queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add officer");
    },
  });

  const updatePTODetailsMutation = useMutation({
    mutationFn: async ({ 
      ptoId, 
      unitNumber, 
      notes 
    }: { 
      ptoId: string; 
      unitNumber?: string; 
      notes?: string; 
    }) => {
      const { error } = await supabase
        .from("schedule_exceptions")
        .update({ 
          unit_number: unitNumber,
          notes: notes
        })
        .eq("id", ptoId);
        
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("PTO details updated");
      queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update PTO details");
    },
  });

  const removeOfficerMutation = useMutation({
    mutationFn: async (officer: any) => {
      console.log("🗑️ Removing officer from schedule:", officer);
      
      if (officer.type === "exception") {
        // Check if officer is in a partnership
        if (officer.isPartnership && officer.partnerOfficerId) {
          console.log("⚠️ Officer is in a partnership, removing partner too");
          
          // Remove partnership from officer's record
          await supabase
            .from("schedule_exceptions")
            .update({
              partner_officer_id: null,
              is_partnership: false,
              partnership_suspended: false,
              partnership_suspension_reason: null
            })
            .eq("id", officer.scheduleId);

          // Also remove from partner's record
          const { data: partnerSchedule } = await supabase
            .from("schedule_exceptions")
            .select("id")
            .eq("officer_id", officer.partnerOfficerId)
            .eq("date", dateStr)
            .eq("shift_type_id", officer.shift.id)
            .maybeSingle();

          if (partnerSchedule) {
            await supabase
              .from("schedule_exceptions")
              .update({
                partner_officer_id: null,
                is_partnership: false,
                partnership_suspended: false,
                partnership_suspension_reason: null
              })
              .eq("id", partnerSchedule.id);
          }
        }

        // Delete the officer's schedule exception
        const { error } = await supabase
          .from("schedule_exceptions")
          .delete()
          .eq("id", officer.scheduleId);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Officer removed from daily schedule");
      queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove officer");
    },
  });

  const removePTOMutation = useMutation({
    mutationFn: async (ptoRecord: any) => {
      // Note: ptoBalancesEnabled is not defined in this file - you'll need to add it or remove this check
      const ptoBalancesEnabled = false; // Add this line or get from your config
      const hoursUsed = calculateHours(ptoRecord.startTime, ptoRecord.endTime);
      const ptoColumn = PTO_TYPES.find((t) => t.value === ptoRecord.ptoType)?.column;
      
      // Restore PTO balance if enabled
      if (ptoBalancesEnabled && ptoColumn) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", ptoRecord.officerId)
          .single();

        if (profileError) throw profileError;

        const currentBalance = profile[ptoColumn as keyof typeof profile] as number;
        
        const { error: restoreError } = await supabase
          .from("profiles")
          .update({
            [ptoColumn]: currentBalance + hoursUsed,
          })
          .eq("id", ptoRecord.officerId);

        if (restoreError) throw restoreError;
      }

      // Restore partnership if it was suspended
      const restorationResult = await restorePartnershipAfterPTO(ptoRecord.officerId, ptoRecord.shiftTypeId);

      // Delete the PTO exception
      const { error: deleteError } = await supabase
        .from("schedule_exceptions")
        .delete()
        .eq("id", ptoRecord.id);

      if (deleteError) throw deleteError;

      // Also delete any associated working time exception
      await supabase
        .from("schedule_exceptions")
        .delete()
        .eq("officer_id", ptoRecord.officerId)
        .eq("date", dateStr)
        .eq("shift_type_id", ptoRecord.shiftTypeId)
        .eq("is_off", false);

      return {
        restorationResult,
        hoursUsed
      };
    },
    onSuccess: (data) => {
      let message = "PTO removed and balance restored";
      if (data.restorationResult.restored) {
        message += `. Partnership with ${data.restorationResult.partnerName} has been restored.`;
      }
      toast.success(message);
      
      queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-schedule"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove PTO");
    },
  });

  return {
    updateScheduleMutation,
    updatePTODetailsMutation,
    removeOfficerMutation,
    addOfficerMutation,
    removePTOMutation,
    updatePartnershipMutation,
    // Export helper functions
    suspendPartnershipForPTO,
    restorePartnershipAfterPTO,
    autoCreatePartnershipsFromRecurring,
    // NEW: Export recurring partnership functions
    updateRecurringPartnership,
    removeRecurringPartnership
  };
};
