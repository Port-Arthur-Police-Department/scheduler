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

  async logPTOAssignment(officerId: string, ptoType: string, date: string, hours: number, userEmail?: string, description?: string) {
    await this.log({
      action_type: 'PTO_ASSIGNMENT',
      table_name: 'schedule_exceptions',
      record_id: officerId,
      description: description || `Assigned ${ptoType} PTO for officer ${officerId} on ${date} (${hours} hours)`,
      new_values: { pto_type: ptoType, date, hours }
    });
  },

  // NEW METHODS FOR SCHEDULING SYSTEM
  async logPositionChange(
    officerId: string, 
    officerName: string, 
    oldPosition: string, 
    newPosition: string, 
    userEmail?: string, 
    description?: string
  ) {
    await this.log({
      action_type: 'POSITION_CHANGE',
      table_name: 'schedule_exceptions',
      record_id: officerId,
      description: description || `Changed position from "${oldPosition}" to "${newPosition}" for ${officerName}`,
      old_values: { position: oldPosition },
      new_values: { position: newPosition }
    });
  },

  async logUnitNumberChange(
    officerId: string, 
    officerName: string, 
    oldUnit: string, 
    newUnit: string, 
    userEmail?: string, 
    description?: string
  ) {
    await this.log({
      action_type: 'UNIT_CHANGE',
      table_name: 'schedule_exceptions',
      record_id: officerId,
      description: description || `Changed unit from "${oldUnit || 'None'}" to "${newUnit}" for ${officerName}`,
      old_values: { unit_number: oldUnit },
      new_values: { unit_number: newUnit }
    });
  },

  async logNotesChange(
    officerId: string, 
    officerName: string, 
    userEmail?: string, 
    description?: string
  ) {
    await this.log({
      action_type: 'NOTES_UPDATE',
      table_name: 'schedule_exceptions',
      record_id: officerId,
      description: description || `Updated notes for ${officerName}`
    });
  },

  async logOfficerRemoval(
    officerId: string, 
    officerName: string, 
    userEmail?: string, 
    description?: string
  ) {
    await this.log({
      action_type: 'OFFICER_REMOVAL',
      table_name: 'schedule_exceptions',
      record_id: officerId,
      description: description || `Removed ${officerName} from schedule`
    });
  },

  async logPartnershipChange(
    officerId: string, 
    officerName: string, 
    partnerOfficerId: string, 
    action: 'created' | 'removed', 
    userEmail?: string, 
    description?: string
  ) {
    await this.log({
      action_type: `PARTNERSHIP_${action.toUpperCase()}`,
      table_name: 'schedule_exceptions',
      record_id: officerId,
      description: description || `${action === 'created' ? 'Created' : 'Removed'} partnership for ${officerName}`,
      new_values: action === 'created' ? { partner_officer_id: partnerOfficerId } : undefined,
      old_values: action === 'removed' ? { partner_officer_id: partnerOfficerId } : undefined
    });
  },

  async logPTORemoval(
    officerId: string,
    ptoType: string,
    date: string,
    userEmail?: string,
    description?: string
  ) {
    await this.log({
      action_type: 'PTO_REMOVAL',
      table_name: 'schedule_exceptions',
      record_id: officerId,
      description: description || `Removed ${ptoType} PTO from officer ${officerId} on ${date}`,
      old_values: { pto_type: ptoType, date }
    });
  },

  async logPDFExport(
    userEmail?: string, 
    exportType?: string, 
    description?: string
  ) {
    await this.log({
      action_type: 'PDF_EXPORT',
      table_name: 'exports',
      description: description || `Exported ${exportType} PDF`,
      new_values: { export_type: exportType }
    });
  },

  async logSettingsChange(
    userEmail?: string,
    changes?: any,
    description?: string
  ) {
    await this.log({
      action_type: 'SETTINGS_UPDATE',
      table_name: 'website_settings',
      description: description || 'Updated website settings',
      new_values: changes
    });
  },

  async logPasswordReset(
    officerId: string,
    officerEmail: string,
    resetBy: string,
    description?: string
  ) {
    await this.log({
      action_type: 'PASSWORD_RESET',
      table_name: 'profiles',
      record_id: officerId,
      description: description || `Password reset for ${officerEmail} by ${resetBy}`
    });
  },

  async logOfficerChange(
    action: string,
    officerId: string,
    officerData: any,
    userEmail?: string,
    description?: string
  ) {
    await this.log({
      action_type: `OFFICER_${action.toUpperCase()}`,
      table_name: 'officers',
      record_id: officerId,
      description: description || `${action} officer ${officerData.name || officerId}`,
      new_values: action === 'CREATE' ? officerData : undefined
    });
  },

  async logPTOStatusChange(
    ptoRequestId: string,
    oldStatus: string,
    newStatus: string,
    userEmail?: string,
    reason?: string
  ) {
    await this.log({
      action_type: 'PTO_STATUS_CHANGE',
      table_name: 'pto_requests',
      record_id: ptoRequestId,
      description: `Changed PTO status from "${oldStatus}" to "${newStatus}"${reason ? `: ${reason}` : ''}`,
      old_values: { status: oldStatus },
      new_values: { status: newStatus }
    });
  },

  // Enhanced login methods with success/failure tracking
  async logLoginSuccess(userEmail: string, ipAddress?: string, userAgent?: string) {
    await this.log({
      action_type: 'LOGIN_SUCCESS',
      description: `Successful login for ${userEmail}`,
      ip_address: ipAddress,
      user_agent: userAgent
    });
  },

  async logLoginFailure(userEmail: string, ipAddress?: string, userAgent?: string, reason?: string) {
    await this.log({
      action_type: 'LOGIN_FAILURE',
      description: `Failed login attempt for ${userEmail}${reason ? `: ${reason}` : ''}`,
      ip_address: ipAddress,
      user_agent: userAgent
    });
  },

  // Database operation logging
  async logDatabaseOperation(
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    tableName: string,
    recordId?: string,
    oldValues?: any,
    newValues?: any,
    description?: string
  ) {
    await this.log({
      action_type: `DB_${operation}`,
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues,
      new_values: newValues,
      description: description || `${operation} operation on ${tableName}`
    });
  },

  // System events
  async logSystemEvent(eventType: string, details: string, metadata?: any) {
    await this.log({
      action_type: 'SYSTEM_EVENT',
      description: `${eventType}: ${details}`,
      new_values: metadata
    });
  },

  // Error logging
  async logError(errorType: string, errorMessage: string, context?: any) {
    await this.log({
      action_type: 'ERROR',
      description: `${errorType}: ${errorMessage}`,
      new_values: context
    });
  }
};
