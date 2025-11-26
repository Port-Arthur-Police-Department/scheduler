// lib/auditLogger.ts
import { supabase } from "@/integrations/supabase/client";

export interface AuditLogEntry {
  user_id: string;
  user_email: string;
  action_type: string;
  table_name?: string;
  record_id?: string;
  old_values?: any;
  new_values?: any;
  description: string;
  ip_address?: string;
  user_agent?: string;
}

export const auditLogger = {
  async log(entry: Omit<AuditLogEntry, 'user_id' | 'user_email'>) {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.warn('No session found for audit logging');
        return;
      }

      const fullEntry: AuditLogEntry = {
        user_id: session.user.id,
        user_email: session.user.email!,
        ...entry
      };

      const { error } = await supabase
        .from('audit_logs')
        .insert(fullEntry);

      if (error) {
        console.error('Failed to log audit entry:', error);
      }
    } catch (error) {
      console.error('Audit logging error:', error);
    }
  },

  // Convenience methods for common actions
  async logLogin(userEmail: string, ipAddress?: string, userAgent?: string) {
    await this.log({
      action_type: 'login',
      description: `User ${userEmail} logged in`,
      ip_address: ipAddress,
      user_agent: userAgent
    });
  },

  async logProfileUpdate(userId: string, oldValues: any, newValues: any) {
    await this.log({
      action_type: 'profile_update',
      table_name: 'profiles',
      record_id: userId,
      old_values: oldValues,
      new_values: newValues,
      description: `Updated profile for user ${userId}`
    });
  },

  async logScheduleChange(action: string, scheduleId: string, details: string, oldValues?: any, newValues?: any) {
    await this.log({
      action_type: 'schedule_change',
      table_name: 'recurring_schedules',
      record_id: scheduleId,
      old_values: oldValues,
      new_values: newValues,
      description: `${action}: ${details}`
    });
  },

  async logPTOAssignment(officerId: string, ptoType: string, date: string, hours: number) {
    await this.log({
      action_type: 'pto_assignment',
      table_name: 'schedule_exceptions',
      description: `Assigned ${ptoType} PTO for officer ${officerId} on ${date} (${hours} hours)`
    });
  }
};
