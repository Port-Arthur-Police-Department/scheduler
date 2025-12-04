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

// Helper function to get client IP address
const getClientIP = async (): Promise<string> => {
  try {
    // Try multiple methods to get the client IP
    const methods = [
      // Method 1: Direct IP detection service
      async () => {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
      },
      // Method 2: Alternative IP service
      async () => {
        const response = await fetch('https://api64.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
      },
      // Method 3: Cloudflare compatible (if using Cloudflare)
      async () => {
        const response = await fetch('https://www.cloudflare.com/cdn-cgi/trace');
        const text = await response.text();
        const ipMatch = text.match(/ip=([\d\.]+)/);
        return ipMatch ? ipMatch[1] : null;
      }
    ];

    for (const method of methods) {
      try {
        const ip = await method();
        if (ip) {
          console.log('Detected IP address:', ip);
          return ip;
        }
      } catch (error) {
        console.warn('IP detection method failed:', error);
        continue;
      }
    }
    
    return 'unknown';
  } catch (error) {
    console.error('All IP detection methods failed:', error);
    return 'unknown';
  }
};

// Helper function to get user agent
const getUserAgent = (): string => {
  return navigator.userAgent || 'unknown';
};

export const auditLogger = {
  async log(entry: Omit<AuditLogEntry, 'user_id' | 'user_email' | 'ip_address' | 'user_agent'>) {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.warn('No session found for audit logging');
        return;
      }

      // Get client IP and user agent
      const ipAddress = await getClientIP();
      const userAgent = getUserAgent();

      const fullEntry: AuditLogEntry = {
        user_id: session.user.id,
        user_email: session.user.email!,
        ip_address: ipAddress,
        user_agent: userAgent,
        ...entry
      };

      console.log('Logging audit entry:', {
        action: entry.action_type,
        user: session.user.email,
        ip: ipAddress
      });

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

  // Helper to format field names for display
  formatFieldName(field: string): string {
    const fieldNames: Record<string, string> = {
      'full_name': 'name',
      'badge_number': 'badge number',
      'hire_date': 'hire date',
      'promotion_date_sergeant': 'sergeant promotion date',
      'promotion_date_lieutenant': 'lieutenant promotion date',
      'service_credit_override': 'service credit adjustment',
      'vacation_hours': 'vacation hours',
      'sick_hours': 'sick hours',
      'comp_hours': 'comp hours',
      'holiday_hours': 'holiday hours'
    };
    
    return fieldNames[field] || field.replace(/_/g, ' ');
  },

  // Helper to format values for display
  formatValueForDisplay(field: string, value: any): string {
    if (value == null) return 'None';
    
    // Format dates
    if (field.includes('_date')) {
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return String(value);
      }
    }
    
    // Format hours
    if (field.includes('_hours')) {
      return `${value} hours`;
    }
    
    // For sensitive fields like emails, show partial info
    if (field === 'email') {
      const emailStr = String(value);
      if (emailStr.includes('@')) {
        const [user, domain] = emailStr.split('@');
        return `${user.substring(0, 3)}...@${domain}`;
      }
      return emailStr;
    }
    
    // For phone numbers, format
    if (field === 'phone') {
      const phone = String(value).replace(/\D/g, '');
      if (phone.length === 10) {
        return `(${phone.substring(0,3)}) ${phone.substring(3,6)}-${phone.substring(6)}`;
      }
    }
    
    return String(value);
  },

  // Helper function to generate detailed change descriptions
  generateProfileChangeDescription(officerName: string, oldData: any, newData: any): string {
    const changes: string[] = [];
    
    // Define fields to track changes for
    const trackedFields = [
      'full_name', 'email', 'phone', 'badge_number', 'rank',
      'hire_date', 'promotion_date_sergeant', 'promotion_date_lieutenant',
      'service_credit_override', 'vacation_hours', 'sick_hours',
      'comp_hours', 'holiday_hours'
    ];
    
    for (const field of trackedFields) {
      const oldValue = oldData?.[field];
      const newValue = newData[field];
      
      // Handle null/undefined comparisons
      if (oldValue !== newValue && !(oldValue == null && newValue == null)) {
        const oldDisplay = this.formatValueForDisplay(field, oldValue);
        const newDisplay = this.formatValueForDisplay(field, newValue);
        const fieldName = this.formatFieldName(field);
        
        if (oldData === null) {
          // This is a creation, not an update
          changes.push(`set ${fieldName} to ${newDisplay}`);
        } else if (newValue == null) {
          changes.push(`removed ${fieldName} (was ${oldDisplay})`);
        } else if (oldValue == null) {
          changes.push(`added ${fieldName} as ${newDisplay}`);
        } else {
          changes.push(`changed ${fieldName} from ${oldDisplay} to ${newDisplay}`);
        }
      }
    }
    
    if (changes.length === 0) {
      return `Updated profile for ${officerName} (no field changes detected)`;
    }
    
    return `Updated profile for ${officerName}: ${changes.join(', ')}`;
  },

  // Convenience methods for common actions
  async logLogin(userEmail: string, ipAddress?: string, userAgent?: string) {
    const ip = ipAddress || await getClientIP();
    const ua = userAgent || getUserAgent();
    
    await this.log({
      action_type: 'login',
      description: `User ${userEmail} logged in`,
      ip_address: ip,
      user_agent: ua
    });
  },

  async logLoginSuccess(userEmail: string, ipAddress?: string, userAgent?: string) {
    const ip = ipAddress || await getClientIP();
    const ua = userAgent || getUserAgent();
    
    await this.log({
      action_type: 'LOGIN_SUCCESS',
      description: `Successful login for ${userEmail}`,
      ip_address: ip,
      user_agent: ua
    });
  },

  async logLoginFailure(userEmail: string, ipAddress?: string, userAgent?: string, reason?: string) {
    const ip = ipAddress || await getClientIP();
    const ua = userAgent || getUserAgent();
    
    await this.log({
      action_type: 'LOGIN_FAILURE',
      description: `Failed login attempt for ${userEmail}${reason ? `: ${reason}` : ''}`,
      ip_address: ip,
      user_agent: ua
    });
  },

  async logProfileUpdate(
    officerId: string, 
    officerName: string,
    oldValues: any, 
    newValues: any,
    userId?: string,
    userEmail?: string,
    description?: string
  ) {
    // If description is provided, use it; otherwise generate detailed description
    let detailedDescription = description;
    
    if (!detailedDescription && oldValues && newValues) {
      detailedDescription = this.generateProfileChangeDescription(officerName, oldValues, newValues);
    } else if (!detailedDescription) {
      detailedDescription = oldValues 
        ? `Updated profile for ${officerName}` 
        : `Created profile for ${officerName}`;
    }

    await this.log({
      action_type: 'profile_update',
      table_name: 'profiles',
      record_id: officerId,
      old_values: oldValues,
      new_values: newValues,
      description: detailedDescription
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
  },

  // Additional specialized profile logging functions (optional - use if you want more granular control)
  async logProfileRankChange(
    officerId: string,
    officerName: string,
    oldRank: string,
    newRank: string,
    userEmail?: string
  ) {
    await this.log({
      action_type: 'PROFILE_RANK_CHANGE',
      table_name: 'profiles',
      record_id: officerId,
      description: `Changed rank from "${oldRank}" to "${newRank}" for ${officerName}`,
      old_values: { rank: oldRank },
      new_values: { rank: newRank }
    });
  },

  async logProfileDateChange(
    officerId: string,
    officerName: string,
    dateType: 'hire' | 'sergeant_promotion' | 'lieutenant_promotion',
    oldDate: string | null,
    newDate: string | null,
    userEmail?: string
  ) {
    const dateNames = {
      'hire': 'hire date',
      'sergeant_promotion': 'sergeant promotion date',
      'lieutenant_promotion': 'lieutenant promotion date'
    };
    
    const oldDisplay = oldDate ? new Date(oldDate).toLocaleDateString() : 'None';
    const newDisplay = newDate ? new Date(newDate).toLocaleDateString() : 'None';
    
    await this.log({
      action_type: 'PROFILE_DATE_CHANGE',
      table_name: 'profiles',
      record_id: officerId,
      description: `Changed ${dateNames[dateType]} from ${oldDisplay} to ${newDisplay} for ${officerName}`,
      old_values: { [dateType]: oldDate },
      new_values: { [dateType]: newDate }
    });
  },

  async logProfileContactChange(
    officerId: string,
    officerName: string,
    field: 'email' | 'phone' | 'badge_number',
    oldValue: string,
    newValue: string,
    userEmail?: string
  ) {
    const fieldNames = {
      'email': 'email',
      'phone': 'phone number',
      'badge_number': 'badge number'
    };
    
    await this.log({
      action_type: 'PROFILE_CONTACT_CHANGE',
      table_name: 'profiles',
      record_id: officerId,
      description: `Changed ${fieldNames[field]} from "${oldValue}" to "${newValue}" for ${officerName}`,
      old_values: { [field]: oldValue },
      new_values: { [field]: newValue }
    });
  }
};
