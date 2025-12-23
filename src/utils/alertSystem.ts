import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendInAppNotification, notifySupervisorsAndAdmins } from "./notifications";
import { 
  sendPushNotification, 
  sendPushNotificationToAll, 
  sendPushNotificationToRole,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications 
} from "./supabasePushNotifications";

export class AlertSystem {
  private static instance: AlertSystem;

  private constructor() {}

  public static getInstance(): AlertSystem {
    if (!AlertSystem.instance) {
      AlertSystem.instance = new AlertSystem();
    }
    return AlertSystem.instance;
  }

  /**
   * Send alert to all users
   */
  async sendAlertToAll(
    title: string, 
    message: string, 
    alertType: 'info' | 'warning' | 'critical' | 'emergency' = 'info'
  ): Promise<void> {
    try {
      console.log(`📢 Sending alert to ALL users: ${title}`);

      // Send push notifications
      const pushResult = await sendPushNotificationToAll(title, message, alertType);
      
      // Send in-app notifications to all active users
      const { data: allUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('active', true);

      if (allUsers && allUsers.length > 0) {
        const userIds = allUsers.map(user => user.id);
        
        // Create in-app notification records
        const notifications = userIds.map(userId => ({
          user_id: userId,
          title,
          message,
          type: 'alert',
          alert_type: alertType,
          is_read: false,
          created_at: new Date().toISOString(),
          metadata: { alertType }
        }));

        const { error } = await supabase
          .from('notifications')
          .insert(notifications);

        if (error) {
          console.error('Error creating in-app notifications:', error);
        }
      }

      toast.success(`Alert sent to all users (${pushResult.results?.successful || 0} via push)`);

    } catch (error) {
      console.error('Error sending alert to all:', error);
      toast.error('Failed to send alert');
    }
  }

  /**
   * Send alert to specific role
   */
  async sendAlertToRole(
    role: 'officer' | 'supervisor' | 'admin', 
    title: string, 
    message: string, 
    alertType: 'info' | 'warning' | 'critical' | 'emergency' = 'info'
  ): Promise<void> {
    try {
      console.log(`📢 Sending alert to ${role}s: ${title}`);

      // Send push notifications
      const pushResult = await sendPushNotificationToRole(role, title, message, alertType);
      
      // Get all users with this role for in-app notifications
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', role);

      if (userRoles && userRoles.length > 0) {
        const userIds = userRoles.map(role => role.user_id);
        
        const notifications = userIds.map(userId => ({
          user_id: userId,
          title,
          message,
          type: 'alert',
          alert_type: alertType,
          is_read: false,
          created_at: new Date().toISOString(),
          metadata: { alertType, role }
        }));

        const { error } = await supabase
          .from('notifications')
          .insert(notifications);

        if (error) {
          console.error('Error creating in-app notifications:', error);
        }
      }

      toast.success(`Alert sent to ${role}s (${pushResult.results?.successful || 0} via push)`);

    } catch (error) {
      console.error(`Error sending alert to ${role}s:`, error);
      toast.error(`Failed to send alert to ${role}s`);
    }
  }

  /**
   * Send alert to specific users
   */
  async sendAlertToUsers(
    userIds: string | string[], 
    title: string, 
    message: string, 
    alertType: 'info' | 'warning' | 'critical' | 'emergency' = 'info'
  ): Promise<void> {
    try {
      const userIdsArray = Array.isArray(userIds) ? userIds : [userIds];
      console.log(`📢 Sending alert to ${userIdsArray.length} users: ${title}`);

      // Send push notifications
      const pushResult = await sendPushNotification(userIdsArray, title, message, alertType);
      
      // Create in-app notifications
      const notifications = userIdsArray.map(userId => ({
        user_id: userId,
        title,
        message,
        type: 'alert',
        alert_type: alertType,
        is_read: false,
        created_at: new Date().toISOString(),
        metadata: { alertType }
      }));

      const { error } = await supabase
        .from('notifications')
        .insert(notifications);

      if (error) {
        console.error('Error creating in-app notifications:', error);
      }

      toast.success(`Alert sent to ${userIdsArray.length} users (${pushResult.results?.successful || 0} via push)`);

    } catch (error) {
      console.error('Error sending alert to users:', error);
      toast.error('Failed to send alert');
    }
  }

  /**
   * Send emergency alert (bypasses some user settings)
   */
  async sendEmergencyAlert(title: string, message: string): Promise<void> {
    try {
      console.log(`🚨 Sending EMERGENCY alert: ${title}`);

      // Send emergency push notifications
      const pushResult = await sendPushNotificationToAll(
        `🚨 EMERGENCY: ${title}`,
        message,
        'emergency',
        { priority: 'high', sound: 'default' }
      );

      // Create in-app emergency notifications for all active users
      const { data: allUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('active', true);

      if (allUsers && allUsers.length > 0) {
        const notifications = allUsers.map(user => ({
          user_id: user.id,
          title: `🚨 EMERGENCY: ${title}`,
          message,
          type: 'emergency',
          alert_type: 'critical',
          is_read: false,
          created_at: new Date().toISOString(),
          metadata: { emergency: true, timestamp: new Date().toISOString() }
        }));

        await supabase
          .from('notifications')
          .insert(notifications);
      }

      console.log(`🚨 Emergency alert sent: ${pushResult.results?.successful || 0} via push`);
      toast.success(`Emergency alert sent (${pushResult.results?.successful || 0} via push)`);

    } catch (error) {
      console.error('Error sending emergency alert:', error);
      toast.error('Failed to send emergency alert');
    }
  }

  /**
   * Send PTO request notification
   */
  async sendPTORequestNotification(
    requestId: string,
    userId: string,
    action: 'created' | 'approved' | 'denied'
  ): Promise<void> {
    try {
      console.log(`🔔 Sending PTO notification for request ${requestId}, action: ${action}`);

      // Get request details
      const { data: request, error: requestError } = await supabase
        .from('time_off_requests')
        .select(`
          *,
          profiles!time_off_requests_officer_id_fkey(full_name, badge_number)
        `)
        .eq('id', requestId)
        .single();

      if (requestError) {
        console.error('Error fetching PTO request:', requestError);
        return;
      }

      if (action === 'created') {
        const message = `${request.profiles?.full_name} has submitted a ${request.pto_type} time off request`;

        // Notify supervisors and admins
        await notifySupervisorsAndAdmins(
          'New PTO Request Submitted',
          message,
          'pto_request',
          requestId
        );

        toast.success('PTO request submitted. Supervisors have been notified.');
        
      } else if (action === 'approved' || action === 'denied') {
        const statusMessage = action === 'approved' 
          ? `Your ${request.pto_type} time off request has been approved`
          : `Your ${request.pto_type} time off request has been denied`;

        // Notify the officer
        await this.sendAlertToUsers(
          request.officer_id,
          `PTO Request ${action === 'approved' ? 'Approved' : 'Denied'}`,
          statusMessage,
          'info'
        );

        toast.success(`Officer has been notified of the ${action} status`);
      }

    } catch (error) {
      console.error('Error in sendPTORequestNotification:', error);
      toast.error('Failed to send notification');
    }
  }

  /**
   * Send shift change notification
   */
  async sendShiftChangeAlert(userId: string, oldShift: string, newShift: string, date: string): Promise<void> {
    const message = `Your shift on ${new Date(date).toLocaleDateString()} has been changed from ${oldShift} to ${newShift}`;
    
    await this.sendAlertToUsers(
      userId,
      'Shift Change Notification',
      message,
      'warning'
    );
  }

  /**
   * Send vacancy alert
   */
  async sendVacancyAlert(position: string, date: string, shift: string): Promise<void> {
    const message = `New vacancy posted for ${position} on ${new Date(date).toLocaleDateString()} (${shift})`;
    
    await this.sendAlertToRole(
      'supervisor',
      'New Vacancy Posted',
      message,
      'info'
    );
  }

  /**
   * Get user notification settings
   */
  async getUserNotificationSettings(userId: string): Promise<{
    push_enabled: boolean;
    in_app_enabled: boolean;
    email_enabled: boolean;
    preferences: Record<string, boolean>;
  }> {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('notification_settings')
        .eq('id', userId)
        .single();

      return profile?.notification_settings || {
        push_enabled: false,
        in_app_enabled: true,
        email_enabled: false,
        preferences: {
          pto_alerts: true,
          shift_alerts: true,
          emergency_alerts: true,
          schedule_changes: true,
          vacancy_alerts: true
        }
      };
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      return {
        push_enabled: false,
        in_app_enabled: true,
        email_enabled: false,
        preferences: {
          pto_alerts: true,
          shift_alerts: true,
          emergency_alerts: true,
          schedule_changes: true,
          vacancy_alerts: true
        }
      };
    }
  }

  /**
   * Update user notification settings
   */
  async updateUserNotificationSettings(
    userId: string,
    settings: Partial<{
      push_enabled: boolean;
      in_app_enabled: boolean;
      email_enabled: boolean;
      preferences: Record<string, boolean>;
    }>
  ): Promise<void> {
    try {
      // Get current settings
      const currentSettings = await this.getUserNotificationSettings(userId);
      
      // Merge settings
      const updatedSettings = {
        ...currentSettings,
        ...settings,
        preferences: {
          ...currentSettings.preferences,
          ...settings.preferences
        },
        updated_at: new Date().toISOString()
      };

      // Update in database
      const { error } = await supabase
        .from('profiles')
        .update({ 
          notification_settings: updatedSettings,
          notifications_enabled: updatedSettings.push_enabled || updatedSettings.in_app_enabled || updatedSettings.email_enabled
        })
        .eq('id', userId);

      if (error) {
        console.error('Error updating notification settings:', error);
        throw error;
      }

      console.log('Notification settings updated for user:', userId);

      // If push notifications are being enabled, register for them
      if (settings.push_enabled === true) {
        await subscribeToPushNotifications(userId);
      } else if (settings.push_enabled === false) {
        await unsubscribeFromPushNotifications(userId);
      }

    } catch (error) {
      console.error('Error updating notification settings:', error);
      throw error;
    }
  }

  /**
   * Test notification system
   */
  async sendTestNotification(userId: string): Promise<void> {
    try {
      await this.sendAlertToUsers(
        userId,
        'Test Notification',
        'This is a test notification to verify the system is working correctly.',
        'info'
      );
      
      toast.success('Test notification sent!');
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Failed to send test notification');
    }
  }
}

export const alertSystem = AlertSystem.getInstance();
