// src/hooks/useScheduleMutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PTO_TYPES } from "@/constants/positions";
import { format, parseISO } from "date-fns";

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

// Helper function to check if officer is PPO
const isPPO = (rank: string | undefined | null): boolean => {
  if (!rank) return false;
  const rankLower = rank.toLowerCase();
  return rankLower.includes('probationary') || rankLower.includes('ppo');
};

// Helper function to calculate hours
const calculateHours = (start: string, end: string) => {
  const [startHour, startMin] = start.split(":").map(Number);
  const [endHour, endMin] = end.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return (endMinutes - startMinutes) / 60;
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
          .single(),
        supabase
          .from("schedule_exceptions")
          .select("id, is_partnership, is_off")
          .eq("officer_id", partnerId)
          .eq("date", dateStr)
          .eq("shift_type_id", shiftId)
          .single()
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
          .single();

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
        .single();

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
          .single();

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
            .single(),
          supabase
            .from("schedule_exceptions")
            .select("id")
            .eq("officer_id", recurring.partner_officer_id)
            .eq("date", dateStr)
            .eq("shift_type_id", recurring.shift_type_id)
            .eq("is_off", true)
            .single()
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
              position_name: isPPO(recurring.officer_profile?.rank) 
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
              position_name: isPPO(recurring.partner_profile?.rank) 
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
              .single();

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
            .single();

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

  // Enhanced partnership mutation with PTO handling
  const updatePartnershipMutation = useMutation({
    mutationFn: async ({ 
      officer, 
      partnerOfficerId, 
      action 
    }: { 
      officer: any; 
      partnerOfficerId?: string; 
      action: 'create' | 'remove' | 'emergency' 
    }) => {
      console.log("🔄 Partnership mutation:", { 
        officerName: officer.name, 
        officerId: officer.officerId,
        partnerOfficerId, 
        action 
      });

      if (action === 'create' && partnerOfficerId) {
        // Validate inputs
        if (!officer.officerId || !partnerOfficerId) {
          throw new Error("Missing officer IDs for partnership");
        }

        // Check if either officer is on PTO
        const [{ data: officerPTO }, { data: partnerPTO }] = await Promise.all([
          supabase
            .from("schedule_exceptions")
            .select("id")
            .eq("officer_id", officer.officerId)
            .eq("date", officer.date || dateStr)
            .eq("shift_type_id", officer.shift.id)
            .eq("is_off", true)
            .single(),
          supabase
            .from("schedule_exceptions")
            .select("id")
            .eq("officer_id", partnerOfficerId)
            .eq("date", officer.date || dateStr)
            .eq("shift_type_id", officer.shift.id)
            .eq("is_off", true)
            .single()
        ]);

        if (officerPTO) {
          throw new Error(`${officer.name} is on PTO and cannot be partnered`);
        }

        if (partnerPTO) {
          throw new Error("Partner officer is on PTO and cannot be partnered");
        }

        // Check if either officer already has a partnership
        const [{ data: existingOfficerPartnership }, { data: existingPartnerPartnership }] = await Promise.all([
          supabase
            .from("schedule_exceptions")
            .select("id, is_partnership")
            .eq("officer_id", officer.officerId)
            .eq("date", officer.date || dateStr)
            .eq("shift_type_id", officer.shift.id)
            .eq("is_partnership", true)
            .single(),
          supabase
            .from("schedule_exceptions")
            .select("id, is_partnership")
            .eq("officer_id", partnerOfficerId)
            .eq("date", officer.date || dateStr)
            .eq("shift_type_id", officer.shift.id)
            .eq("is_partnership", true)
            .single()
        ]);

        if (existingOfficerPartnership?.is_partnership) {
          throw new Error(`${officer.name} is already in a partnership`);
        }

        if (existingPartnerPartnership?.is_partnership) {
          throw new Error("Partner officer is already in a partnership");
        }

        // Update current officer with partner
        const updateData = {
          partner_officer_id: partnerOfficerId,
          is_partnership: true,
          partnership_suspended: false,
          partnership_suspension_reason: null
        };

        let updatePromise;
        
        if (officer.type === "recurring") {
          updatePromise = supabase
            .from("recurring_schedules")
            .update(updateData)
            .eq("id", officer.scheduleId);
        } else {
          updatePromise = supabase
            .from("schedule_exceptions")
            .update(updateData)
            .eq("id", officer.scheduleId);
        }

        const { error, data } = await updatePromise;
        if (error) {
          console.error("Error updating officer partnership:", error);
          throw error;
        }

        // Also update the partner's record to create reciprocal relationship
        const partnerUpdateData = {
          partner_officer_id: officer.officerId,
          is_partnership: true,
          partnership_suspended: false,
          partnership_suspension_reason: null
        };

        let partnerUpdatePromise;
        
        if (officer.type === "recurring") {
          // Find partner's recurring schedule
          const { data: partnerSchedule } = await supabase
            .from("recurring_schedules")
            .select("id")
            .eq("officer_id", partnerOfficerId)
            .eq("shift_type_id", officer.shift.id)
            .eq("day_of_week", officer.dayOfWeek)
            .single();

          if (!partnerSchedule) {
            throw new Error("Partner recurring schedule not found");
          }

          partnerUpdatePromise = supabase
            .from("recurring_schedules")
            .update(partnerUpdateData)
            .eq("id", partnerSchedule.id);
        } else {
          // For exceptions, use the date
          const { data: partnerSchedule } = await supabase
            .from("schedule_exceptions")
            .select("id")
            .eq("officer_id", partnerOfficerId)
            .eq("shift_type_id", officer.shift.id)
            .eq("date", officer.date || dateStr)
            .single();

          if (!partnerSchedule) {
            throw new Error("Partner exception schedule not found");
          }

          partnerUpdatePromise = supabase
            .from("schedule_exceptions")
            .update(partnerUpdateData)
            .eq("id", partnerSchedule.id);
        }

        const { error: partnerError } = await partnerUpdatePromise;
        if (partnerError) {
          console.error("Error updating partner relationship:", partnerError);
          throw partnerError;
        }

        // Log partnership creation
        await supabase
          .from("partnership_exceptions")
          .insert({
            officer_id: officer.officerId,
            partner_officer_id: partnerOfficerId,
            date: officer.date || dateStr,
            shift_type_id: officer.shift.id,
            reason: action === 'emergency' ? 'Emergency reassignment' : 'Partnership created',
            exception_type: action === 'emergency' ? 'emergency_reassignment' : 'created',
            created_at: new Date().toISOString()
          });

      } else if (action === 'remove') {
        console.log("Removing partnership for officer:", officer.officerId);
        
        // Remove partnership from current officer
        const removeData = {
          partner_officer_id: null,
          is_partnership: false,
          partnership_suspended: false,
          partnership_suspension_reason: null
        };

        // Remove from current officer
        let removePromise;
        
        if (officer.type === "recurring") {
          console.log("Removing from recurring schedule:", officer.scheduleId);
          removePromise = supabase
            .from("recurring_schedules")
            .update(removeData)
            .eq("id", officer.scheduleId);
        } else {
          console.log("Removing from exception schedule:", officer.scheduleId);
          removePromise = supabase
            .from("schedule_exceptions")
            .update(removeData)
            .eq("id", officer.scheduleId);
        }

        const { error, data } = await removePromise;
        if (error) {
          console.error("Error removing officer partnership:", error);
          throw error;
        }
        console.log("Successfully removed partnership from officer");

        // Remove from partner officer - CRITICAL FIX
        const actualPartnerOfficerId = officer.partnerOfficerId || officer.partnerData?.partnerOfficerId;
        if (actualPartnerOfficerId) {
          console.log("Removing partnership from partner officer:", actualPartnerOfficerId);

          let partnerRemovePromise;
          
          if (officer.type === "recurring") {
            // Find partner's recurring schedule for the same shift and day
            const { data: partnerSchedule, error: partnerFindError } = await supabase
              .from("recurring_schedules")
              .select("id")
              .eq("officer_id", actualPartnerOfficerId)
              .eq("shift_type_id", officer.shift.id)
              .eq("day_of_week", officer.dayOfWeek)
              .single();

            if (partnerFindError) {
              console.error("Error finding partner recurring schedule:", partnerFindError);
              // Don't throw - we still want to remove the primary officer's partnership
            } else if (partnerSchedule) {
              partnerRemovePromise = supabase
                .from("recurring_schedules")
                .update(removeData)
                .eq("id", partnerSchedule.id);
            }
          } else {
            // For exceptions, use the date
            const { data: partnerSchedule, error: partnerFindError } = await supabase
              .from("schedule_exceptions")
              .select("id")
              .eq("officer_id", actualPartnerOfficerId)
              .eq("shift_type_id", officer.shift.id)
              .eq("date", officer.date || dateStr)
              .single();

            if (partnerFindError) {
              console.error("Error finding partner exception schedule:", partnerFindError);
              // Don't throw - we still want to remove the primary officer's partnership
            } else if (partnerSchedule) {
              partnerRemovePromise = supabase
                .from("schedule_exceptions")
                .update(removeData)
                .eq("id", partnerSchedule.id);
            }
          }

          if (partnerRemovePromise) {
            const { error: partnerError } = await partnerRemovePromise;
            if (partnerError) {
              console.error("Error removing partner relationship:", partnerError);
              // Don't throw - we still want to remove the primary officer's partnership
            } else {
              console.log("Successfully removed partnership from partner officer");
            }
          }
        } else {
          console.warn("No partnerOfficerId found for removal");
        }

        // Log partnership removal
        await supabase
          .from("partnership_exceptions")
          .insert({
            officer_id: officer.officerId,
            partner_officer_id: actualPartnerOfficerId,
            date: officer.date || dateStr,
            shift_type_id: officer.shift.id,
            reason: 'Partnership removed',
            exception_type: 'removed',
            created_at: new Date().toISOString()
          });
      }
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
            .single();

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
    autoCreatePartnershipsFromRecurring
  };
};
