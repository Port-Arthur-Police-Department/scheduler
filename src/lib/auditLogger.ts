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
  metadata?: any;
}

// Helper function to get client IP address
const getClientIP = async (): Promise<string> => {
  try {
    const methods = [
      async () => {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
      },
      async () => {
        const response = await fetch('https://api64.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
      },
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

// Helper function to get current user session
const getCurrentUserSession = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  } catch (error) {
    console.error('Error getting user session:', error);
    return null;
  }
};

export const auditLogger = {
  async log(entry: Omit<AuditLogEntry, 'user_id' | 'user_email' | 'ip_address' | 'user_agent'>) {
    try {
      // Get current user session
      const session = await getCurrentUserSession();
      
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
        description: entry.description
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

  // UPDATED PROFILE METHODS - SIMPLIFIED TO MATCH YOUR PATTERN
  async logProfileUpdate(
    officerId: string, 
    oldData: any, 
    newData: any,
    officerName?: string // Just need officer name
  ) {
    const description = officerName 
      ? `Updated profile for ${officerName} (ID: ${officerId})`
      : `Updated profile for officer ID: ${officerId}`;
    
    await this.log({
      action_type: 'profile_update',
      table_name: 'profiles',
      record_id: officerId,
      old_values: oldData,
      new_values: newData,
      description: description,
      metadata: {
        officer_name: officerName,
        officer_id: officerId
      }
    });
  },

  async logProfileCreation(
    officerId: string,
    newData: any,
    officerName?: string // Just need officer name
  ) {
    const description = officerName
      ? `Created new profile for ${officerName}`
      : `Created new officer profile`;
    
    await this.log({
      action_type: 'profile_creation',
      table_name: 'profiles',
      record_id: officerId,
      old_values: null,
      new_values: newData,
      description: description,
      metadata: {
        officer_name: officerName,
        officer_id: officerId
      }
    });
  },

  // UPDATED PTO METHOD - SIMPLIFIED TO MATCH YOUR PATTERN
  async logPTOAssignment(
    officerId: string, 
    ptoType: string, 
    date: string, 
    hours: number, 
    operation: 'add' | 'subtract',
    officerName?: string // Just need officer name
  ) {
    const description = officerName
      ? `${operation === 'add' ? 'Added' : 'Subtracted'} ${hours} ${ptoType} hours for ${officerName} on ${date}`
      : `${operation === 'add' ? 'Added' : 'Subtracted'} ${hours} ${ptoType} hours for officer ${officerId} on ${date}`;
    
    await this.log({
      action_type: 'PTO_ASSIGNMENT',
      table_name: 'schedule_exceptions',
      record_id: officerId,
      description: description,
      new_values: { 
        pto_type: ptoType, 
        date, 
        hours,
        operation
      },
      metadata: {
        officer_name: officerName,
        officer_id: officerId
      }
    });
  },

  // Keep all your existing methods as they are (they already work with officer names)
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

  // ... keep all other existing methods exactly as they are ...
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
    const descriptionText = description || `Removed ${ptoType} PTO from officer ${officerId} on ${date}`;
    
    await this.log({
      action_type: 'PTO_REMOVAL',
      table_name: 'schedule_exceptions',
      record_id: officerId,
      description: descriptionText,
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
    officerName?: string
  ) {
    const description = officerName
      ? `Password reset for ${officerName} (${officerEmail}) by ${resetBy}`
      : `Password reset for ${officerEmail} by ${resetBy}`;
    
    await this.log({
      action_type: 'PASSWORD_RESET',
      table_name: 'profiles',
      record_id: officerId,
      description: description,
      metadata: {
        officer_name: officerName,
        officer_id: officerId
      }
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

  async logSystemEvent(eventType: string, details: string, metadata?: any) {
    await this.log({
      action_type: 'SYSTEM_EVENT',
      description: `${eventType}: ${details}`,
      new_values: metadata
    });
  },

  async logError(errorType: string, errorMessage: string, context?: any) {
    await this.log({
      action_type: 'ERROR',
      description: `${errorType}: ${errorMessage}`,
      new_values: context
    });
  }
};
