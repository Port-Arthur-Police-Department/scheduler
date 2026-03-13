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

      // Get officer and partner profiles for rank checking and details
      const [{ data: officerProfile }, { data: partnerProfile }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, rank, unit_number, position_name, district")
          .eq("id", officer.officerId)
          .single(),
        supabase
          .from("profiles")
          .select("full_name, rank, unit_number, position_name, district")
          .eq("id", partnerOfficerId)
          .single()
      ]);

      // Determine if each officer is a PPO
      const isOfficerPpo = isPPOByRank(officerProfile?.rank);
      const isPartnerPpo = isPPOByRank(partnerProfile?.rank);

      console.log("🔍 Partnership rank check:", {
        officer: officerProfile?.full_name,
        officerRank: officerProfile?.rank,
        isOfficerPpo,
        partner: partnerProfile?.full_name,
        partnerRank: partnerProfile?.rank,
        isPartnerPpo
      });

      // VALIDATION: Ensure one is PPO and one is not
      if (isOfficerPpo === isPartnerPpo) {
        throw new Error("Partnership must be between a Training Officer (non-PPO) and a PPO");
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
          position: officerProfile?.position_name || officer.position || existingOfficerSchedule?.position_name || '',
          unit: officerProfile?.unit_number || officer.unitNumber || existingOfficerSchedule?.unit_number || '',
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
        
        console.log("👨‍🏫 Training officer:", trainingOfficer.name, "with position:", trainingOfficer.position);
        console.log("👶 PPO:", ppo.name, "will have NULL position");
        
      } else if (isOfficerPpo && !isPartnerPpo) {
        // Officer is PPO, partner is training officer
        
        // Get training officer's position from their profile or schedule
        let trainingOfficerPosition = '';
        let trainingOfficerUnit = '';
        
        // First try from profile
        if (partnerProfile?.position_name) {
          trainingOfficerPosition = partnerProfile.position_name;
          trainingOfficerUnit = partnerProfile.unit_number || '';
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
        
        console.log("👨‍🏫 Training officer:", trainingOfficer.name, "with position:", trainingOfficer.position);
        console.log("👶 PPO:", ppo.name, "will have NULL position");
      }

      console.log("📋 Partnership details:", {
        trainingOfficer: {
          id: trainingOfficer.id,
          name: trainingOfficer.name,
          position: trainingOfficer.position,
          unit: trainingOfficer.unit
        },
        ppo: {
          id: ppo.id,
          name: ppo.name,
          position: null // Explicitly show null
        }
      });

      // Create or update schedule exceptions for both officers
      const updates = [];

      // FOR THE TRAINING OFFICER - Keep their original position
      if (trainingOfficer.existingSchedule) {
        // Update existing exception for training officer
        updates.push(
          supabase
            .from("schedule_exceptions")
            .update({
              is_partnership: true,
              partner_officer_id: ppo.id,
              position_name: trainingOfficer.position, // Keep original position - NOT NULL
              unit_number: trainingOfficer.unit,
              schedule_type: isEmergency ? 'emergency_partnership' : 'manual_partnership',
              notes: isEmergency ? `EMERGENCY: Training PPO ${ppo.name}` : `Training PPO ${ppo.name}`
            })
            .eq("id", trainingOfficer.existingSchedule.id)
        );
      } else {
        // Create new exception for training officer
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
              position_name: trainingOfficer.position, // Keep original position - NOT NULL
              unit_number: trainingOfficer.unit,
              notes: isEmergency ? `EMERGENCY: Training PPO ${ppo.name}` : `Training PPO ${ppo.name}`,
              schedule_type: isEmergency ? 'emergency_partnership' : 'manual_partnership',
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
              schedule_type: isEmergency ? 'emergency_partnership' : 'manual_partnership',
              notes: `Riding with Training Officer ${trainingOfficer.name}`
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
              notes: `Riding with Training Officer ${trainingOfficer.name}`,
              schedule_type: isEmergency ? 'emergency_partnership' : 'manual_partnership',
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

      // Update recurring_schedules if this is a recurring partnership
      if (!isEmergency && (officer.type === 'recurring' || partnerOfficerId)) {
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
      // Handle partnership removal
      console.log("🗑️ Removing partnership for:", officer.officerId);
      
      const targetDate = officer.date || dateStr;
      const shiftId = officer.shift.id;
      const actualPartnerOfficerId = partnerOfficerId || officer.partnerOfficerId;
      
      if (!actualPartnerOfficerId) {
        throw new Error("No partner officer ID provided for removal");
      }
      
      // Get the current schedules to know what positions to restore
      const [{ data: officerSchedule }, { data: partnerSchedule }] = await Promise.all([
        supabase
          .from("schedule_exceptions")
          .select("id, position_name, unit_number, notes, schedule_type")
          .eq("officer_id", officer.officerId)
          .eq("date", targetDate)
          .eq("shift_type_id", shiftId)
          .eq("is_off", false)
          .maybeSingle(),
        supabase
          .from("schedule_exceptions")
          .select("id, position_name, unit_number, notes, schedule_type")
          .eq("officer_id", actualPartnerOfficerId)
          .eq("date", targetDate)
          .eq("shift_type_id", shiftId)
          .eq("is_off", false)
          .maybeSingle()
      ]);
      
      // Remove partnership from schedule exceptions
      const updates = [];
      
      if (officerSchedule) {
        updates.push(
          supabase
            .from("schedule_exceptions")
            .update({
              is_partnership: false,
              partner_officer_id: null,
              // Reset position based on schedule type
              position_name: officerSchedule.schedule_type === "manual_partnership" || 
                            officerSchedule.schedule_type === "emergency_partnership" 
                            ? null 
                            : officerSchedule.position_name
            })
            .eq("id", officerSchedule.id)
        );
      }
      
      if (partnerSchedule) {
        updates.push(
          supabase
            .from("schedule_exceptions")
            .update({
              is_partnership: false,
              partner_officer_id: null,
              // Reset position based on schedule type
              position_name: partnerSchedule.schedule_type === "manual_partnership" || 
                            partnerSchedule.schedule_type === "emergency_partnership" 
                            ? null 
                            : partnerSchedule.position_name
            })
            .eq("id", partnerSchedule.id)
        );
      }
      
      if (updates.length > 0) {
        const results = await Promise.all(updates);
        const errors = results.filter(r => r.error).map(r => r.error);
        if (errors.length > 0) {
          console.error("Errors removing partnership:", errors);
          throw new Error("Failed to remove partnership");
        }
      }
      
      // Also update recurring schedules to remove partnership
      const dayOfWeek = officer.dayOfWeek || parseISO(targetDate).getDay();
      
      await Promise.all([
        supabase
          .from("recurring_schedules")
          .update({
            is_partnership: false,
            partner_officer_id: null
          })
          .eq("officer_id", officer.officerId)
          .eq("shift_type_id", shiftId)
          .eq("day_of_week", dayOfWeek),
        supabase
          .from("recurring_schedules")
          .update({
            is_partnership: false,
            partner_officer_id: null
          })
          .eq("officer_id", actualPartnerOfficerId)
          .eq("shift_type_id", shiftId)
          .eq("day_of_week", dayOfWeek)
      ]);
      
      console.log("✅ Partnership removed successfully");
      return { success: true };
    }

    throw new Error(`Unknown action: ${action}`);
  },
  onSuccess: (data, variables) => {
    console.log("✅ Partnership mutation successful:", variables);
    queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
    queryClient.invalidateQueries({ queryKey: ["weekly-schedule"] });
    queryClient.invalidateQueries({ queryKey: ["available-partners"] });
    
    // Show appropriate success message
    if (variables.action === 'create') {
      if (variables.isEmergency) {
        toast.success("Emergency partnership created successfully");
      } else {
        toast.success("Partnership created successfully");
      }
    } else if (variables.action === 'remove') {
      toast.success("Partnership removed successfully");
    }
  },
  onError: (error: any) => {
    console.error("❌ Partnership mutation failed:", error);
    toast.error(error.message || "Failed to update partnership");
  }
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
