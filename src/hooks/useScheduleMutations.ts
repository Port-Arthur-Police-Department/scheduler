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

      if (params.type === "recurring") {
        // For recurring officers, update via exceptions table
        const { data: existingExceptions, error: checkError } = await supabase
          .from("schedule_exceptions")
          .select("id, is_partnership, partner_officer_id")
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
            
            // Update current officer
            const { error } = await supabase
              .from("schedule_exceptions")
              .update({
                position_name: params.positionName,
                unit_number: params.unitNumber,
                notes: params.notes,
                partner_officer_id: params.partnerOfficerId,
                is_partnership: params.isPartnership
              })
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
                  is_partnership: params.isPartnership
                })
                .eq("id", partnerException.id);
            }
          } else {
            // Normal update without partnership
            const { error } = await supabase
              .from("schedule_exceptions")
              .update({
                position_name: params.positionName,
                unit_number: params.unitNumber,
                notes: params.notes,
                partner_officer_id: params.partnerOfficerId || null,
                is_partnership: params.isPartnership || false
              })
              .eq("id", exception.id);
            
            if (error) throw error;
          }
        } else {
          // Create new exception
          const { error } = await supabase
            .from("schedule_exceptions")
            .insert({
              officer_id: params.officerId,
              date: params.date,
              shift_type_id: params.shiftTypeId,
              is_off: false,
              position_name: params.positionName,
              unit_number: params.unitNumber,
              notes: params.notes,
              partner_officer_id: params.partnerOfficerId,
              is_partnership: params.isPartnership,
              custom_start_time: null,
              custom_end_time: null
            });
          
          if (error) throw error;
        }
      } else {
        // For exception officers
        const { error } = await supabase
          .from("schedule_exceptions")
          .update({
            position_name: params.positionName,
            unit_number: params.unitNumber,
            notes: params.notes,
            partner_officer_id: params.partnerOfficerId,
            is_partnership: params.isPartnership
          })
          .eq("id", params.scheduleId);
          
        if (error) throw error;

        // If updating partnership, also update partner's record
        if (params.isPartnership && params.partnerOfficerId) {
          // Find partner's exception for this date/shift
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
                is_partnership: params.isPartnership
              })
              .eq("id", partnerException.id);
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("Schedule updated");
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
      position
    }: { 
      officer: any; 
      partnerOfficerId?: string; 
      action: 'create' | 'remove' | 'emergency';
      position?: string;
    }) => {
      console.log("🔄 Partnership mutation:", { 
        officerName: officer.name, 
        officerId: officer.officerId,
        partnerOfficerId, 
        action,
        position 
      });

      if (action === 'create' && partnerOfficerId) {
        // Validate inputs
        if (!officer.officerId || !partnerOfficerId) {
          throw new Error("Missing officer IDs for partnership");
        }

        const targetDate = officer.date || dateStr;
        const shiftId = officer.shift.id;
        const dayOfWeek = officer.dayOfWeek || parseISO(targetDate).getDay();

        // Check if either officer is on PTO
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
          throw new Error(`${officer.name} is on PTO and cannot be partnered`);
        }

        if (partnerPTO) {
          throw new Error("Partner officer is on PTO and cannot be partnered");
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
          throw new Error(`${officer.name} is already in a partnership for this shift`);
        }

        // Check if partner already has a partnership
        if (existingPartnerSchedule?.is_partnership) {
          throw new Error("Partner officer is already in a partnership for this shift");
        }

        // Get officer and partner profiles for rank checking
        const [{ data: officerProfile }, { data: partnerProfile }] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, rank")
            .eq("id", officer.officerId)
            .single(),
          supabase
            .from("profiles")
            .select("full_name, rank")
            .eq("id", partnerOfficerId)
            .single()
        ]);

        // Determine positions
        // Use provided position, existing position, or default based on rank
        const officerPosition = position || 
                               existingOfficerSchedule?.position_name || 
                               (isPPOByRank(officerProfile?.rank) ? "Riding Partner (PPO)" : "Riding Partner");
        
        // For partner, use their existing position or default based on rank
        const partnerPosition = existingPartnerSchedule?.position_name || 
                                (isPPOByRank(partnerProfile?.rank) ? "Riding Partner (PPO)" : "Riding Partner");

        // Check if this is a recurring day (not a one-time exception)
        const isRecurringDay = officer.type === 'recurring' || 
                               (officer.dayOfWeek !== undefined && officer.dayOfWeek !== null);

        // Create or update schedule exceptions for both officers
        const updates = [];

        // For officer
        if (existingOfficerSchedule) {
          // Update existing exception to be a partnership
          updates.push(
            supabase
              .from("schedule_exceptions")
              .update({
                is_partnership: true,
                partner_officer_id: partnerOfficerId,
                position_name: officerPosition,
                schedule_type: action === 'emergency' ? 'emergency_partnership' : 'manual_partnership'
                // Keep existing unit_number and notes
              })
              .eq("id", existingOfficerSchedule.id)
          );
        } else {
          // Create new exception for officer
          updates.push(
            supabase
              .from("schedule_exceptions")
              .insert({
                officer_id: officer.officerId,
                date: targetDate,
                shift_type_id: shiftId,
                is_off: false,
                is_partnership: true,
                partner_officer_id: partnerOfficerId,
                position_name: officerPosition,
                unit_number: officer.unitNumber || null,
                notes: officer.notes || null,
                schedule_type: action === 'emergency' ? 'emergency_partnership' : 'manual_partnership',
                custom_start_time: null,
                custom_end_time: null
              })
          );
        }

        // For partner
        if (existingPartnerSchedule) {
          // Update existing exception to be a partnership
          updates.push(
            supabase
              .from("schedule_exceptions")
              .update({
                is_partnership: true,
                partner_officer_id: officer.officerId,
                position_name: partnerPosition,
                schedule_type: action === 'emergency' ? 'emergency_partnership' : 'manual_partnership'
                // Keep existing unit_number and notes
              })
              .eq("id", existingPartnerSchedule.id)
          );
        } else {
          // Create new exception for partner
          updates.push(
            supabase
              .from("schedule_exceptions")
              .insert({
                officer_id: partnerOfficerId,
                date: targetDate,
                shift_type_id: shiftId,
                is_off: false,
                is_partnership: true,
                partner_officer_id: officer.officerId,
                position_name: partnerPosition,
                unit_number: officer.partnerUnitNumber || null,
                notes: officer.partnerNotes || null,
                schedule_type: action === 'emergency' ? 'emergency_partnership' : 'manual_partnership',
                custom_start_time: null,
                custom_end_time: null
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

        // NEW: Also update recurring_schedules if this is a recurring partnership
        if (isRecurringDay) {
          console.log("🔄 Updating recurring_schedules for partnership");
          const recurringResult = await updateRecurringPartnership(
            officer.officerId,
            partnerOfficerId,
            shiftId,
            dayOfWeek,
            officerPosition,
            partnerPosition
          );
          
          if (!recurringResult.success) {
            console.warn("⚠️ Could not update recurring schedules, but exception was created:", recurringResult.error);
          }
        }

        // VERIFY partnership was created correctly
        const verificationPromises = [
          supabase
            .from("schedule_exceptions")
            .select("id, is_partnership, partner_officer_id, position_name")
            .eq("officer_id", officer.officerId)
            .eq("date", targetDate)
            .eq("shift_type_id", shiftId)
            .eq("is_off", false)
            .single(),
          supabase
            .from("schedule_exceptions")
            .select("id, is_partnership, partner_officer_id, position_name")
            .eq("officer_id", partnerOfficerId)
            .eq("date", targetDate)
            .eq("shift_type_id", shiftId)
            .eq("is_off", false)
            .single()
        ];

        const verificationResults = await Promise.all(verificationPromises);
        
        const [officerVerification, partnerVerification] = verificationResults;
        
        if (officerVerification.error || !officerVerification.data?.is_partnership) {
          console.error("❌ Officer partnership verification failed:", officerVerification.error);
          throw new Error("Failed to verify officer partnership creation");
        }
        
        if (partnerVerification.error || !partnerVerification.data?.is_partnership) {
          console.error("❌ Partner partnership verification failed:", partnerVerification.error);
          throw new Error("Failed to verify partner partnership creation");
        }

        console.log("✅ Partnership verified for both officers");

        // Log partnership creation
        await supabase
          .from("partnership_exceptions")
          .insert({
            officer_id: officer.officerId,
            partner_officer_id: partnerOfficerId,
            date: targetDate,
            shift_type_id: shiftId,
            reason: action === 'emergency' ? 'Emergency reassignment' : 'Partnership created',
            exception_type: action === 'emergency' ? 'emergency_reassignment' : 'created',
            created_at: new Date().toISOString()
          });

        console.log(`✅ Partnership created: ${officerProfile?.full_name} ↔ ${partnerProfile?.full_name}`);

        return {
          success: true,
          officerName: officerProfile?.full_name,
          partnerName: partnerProfile?.full_name,
          officerPosition: officerPosition,
          partnerPosition: partnerPosition
        };

      } else if (action === 'remove') {
        console.log("Removing partnership for officer:", officer.officerId);
        
        const targetDate = officer.date || dateStr;
        const shiftId = officer.shift.id;
        const dayOfWeek = officer.dayOfWeek || parseISO(targetDate).getDay();
        const actualPartnerOfficerId = officer.partnerOfficerId || officer.partnerData?.partnerOfficerId;

        // Get officer's current schedule to preserve unit_number and notes
        const { data: officerSchedule } = await supabase
          .from("schedule_exceptions")
          .select("position_name, unit_number, notes, schedule_type")
          .eq("officer_id", officer.officerId)
          .eq("date", targetDate)
          .eq("shift_type_id", shiftId)
          .eq("is_off", false)
          .maybeSingle();

        // Remove partnership from officer's schedule exception
        const { error: officerError } = await supabase
          .from("schedule_exceptions")
          .update({
            is_partnership: false,
            partner_officer_id: null,
            partnership_suspended: false,
            partnership_suspension_reason: null,
            // If it was a manual partnership, keep the position, otherwise reset to null
            position_name: officerSchedule?.schedule_type === "manual_partnership" || 
                          officerSchedule?.schedule_type === "emergency_partnership" 
                          ? null 
                          : officerSchedule?.position_name
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
                            : partnerSchedule?.position_name
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
