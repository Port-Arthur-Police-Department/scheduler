import { supabase } from "@/integrations/supabase/client";
import { NotificationService } from "./notifications";

export class AlertNotifier {
  private static instance: AlertNotifier;
  private notificationService: NotificationService;

  private constructor() {
    this.notificationService = NotificationService.getInstance();
  }

  public static getInstance(): AlertNotifier {
    if (!AlertNotifier.instance) {
      AlertNotifier.instance = new AlertNotifier();
    }
    return AlertNotifier.instance;
  }

  /**
   * Send an alert to all users
   */
  async sendAlertToAll(title: string, message: string, alertType: 'info' | 'warning' | 'critical' = 'info') {
    try {
      console.log(`📢 Sending alert to all users: ${title}`);
      
      // 1. Create notification records for all users in database
      const { data: allUsers, error: usersError } = await supabase
        .from('profiles')
        .select('id, role');

      if (usersError) {
        console.error('❌ Error fetching users:', usersError);
        return;
      }

      if (!allUsers || allUsers.length === 0) {
        console.warn('⚠️ No users found to send alerts to');
        return;
      }

      // 2. Create notification records for each user
      const notifications = allUsers.map(user => ({
        user_id: user.id,
        title,
        message,
        type: 'alert',
        alert_type: alertType,
        is_read: false,
        created_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('❌ Error creating notification records:', insertError);
        return;
      }

      console.log(`✅ Created ${notifications.length} notification records`);

      // 3. Send browser push notifications to users with permission
      this.sendBrowserNotification(title, message, alertType);

    } catch (error) {
      console.error('❌ Error sending alert:', error);
    }
  }

  /**
   * Send alert to specific role (officers, supervisors, admins)
   */
  async sendAlertToRole(role: 'officer' | 'supervisor' | 'admin', title: string, message: string, alertType: 'info' | 'warning' | 'critical' = 'info') {
    try {
      console.log(`📢 Sending alert to ${role}s: ${title}`);
      
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', role);

      if (usersError) {
        console.error('❌ Error fetching users by role:', usersError);
        return;
      }

      if (!users || users.length === 0) {
        console.warn(`⚠️ No ${role}s found to send alerts to`);
        return;
      }

      const notifications = users.map(user => ({
        user_id: user.id,
        title,
        message,
        type: 'alert',
        alert_type: alertType,
        is_read: false,
        created_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('❌ Error creating notification records:', insertError);
        return;
      }

      console.log(`✅ Created ${notifications.length} notification records for ${role}s`);
      this.sendBrowserNotification(title, message, alertType);

    } catch (error) {
      console.error('❌ Error sending role alert:', error);
    }
  }

  /**
   * Send alert to specific users
   */
  async sendAlertToUsers(userIds: string[], title: string, message: string, alertType: 'info' | 'warning' | 'critical' = 'info') {
    try {
      console.log(`📢 Sending alert to ${userIds.length} users: ${title}`);
      
      const notifications = userIds.map(userId => ({
        user_id: userId,
        title,
        message,
        type: 'alert',
        alert_type: alertType,
        is_read: false,
        created_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('❌ Error creating notification records:', insertError);
        return;
      }

      console.log(`✅ Created ${notifications.length} notification records`);
      this.sendBrowserNotification(title, message, alertType);

    } catch (error) {
      console.error('❌ Error sending user alert:', error);
    }
  }

  /**
   * Send browser push notification
   */
  private async sendBrowserNotification(title: string, message: string, alertType: 'info' | 'warning' | 'critical') {
    try {
      // Check if notifications are supported and permission is granted
      if ('Notification' in window && Notification.permission === 'granted') {
        const options: NotificationOptions = {
          body: message,
          icon: '/police-badge.png', // You should add this icon
          badge: '/police-badge.png',
          tag: 'alert', // Group similar alerts
          requireInteraction: alertType === 'critical',
          silent: alertType === 'info',
        };

        if (alertType === 'warning' || alertType === 'critical') {
          options.vibrate = [200, 100, 200];
        }

        const notification = new Notification(`PAPD Alert: ${title}`, options);
        
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
        
        console.log('📱 Browser notification sent');
      } else {
        console.log('ℹ️ Browser notifications not enabled or not supported');
      }
    } catch (error) {
      console.error('❌ Error sending browser notification:', error);
    }
  }

  /**
   * Send shift-related alerts
   */
  async sendShiftAlert(shiftId: string, title: string, message: string) {
    // Get all officers assigned to this shift
    const { data: assignments, error } = await supabase
      .from('shift_assignments') // Adjust table name as needed
      .select('officer_id')
      .eq('shift_id', shiftId);

    if (error) {
      console.error('❌ Error fetching shift assignments:', error);
      return;
    }

    if (assignments && assignments.length > 0) {
      const userIds = assignments.map(a => a.officer_id);
      await this.sendAlertToUsers(userIds, title, message, 'info');
    }
  }

  /**
   * Send vacancy alert
   */
  async sendVacancyAlert(vacancyDetails: string) {
    await this.sendAlertToAll(
      'New Vacancy Posted',
      vacancyDetails,
      'info'
    );
  }

  /**
   * Send PTO status alert
   */
  async sendPTOStatusAlert(userId: string, status: 'approved' | 'denied' | 'pending', details: string) {
    const title = status === 'approved' ? 'PTO Request Approved' :
                 status === 'denied' ? 'PTO Request Denied' : 'PTO Request Submitted';
    
    await this.sendAlertToUsers([userId], title, details, 'info');
    
    // Also notify supervisors if needed
    if (status === 'pending') {
      const { data: supervisors } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['supervisor', 'admin']);
      
      if (supervisors && supervisors.length > 0) {
        const supervisorIds = supervisors.map(s => s.id);
        await this.sendAlertToUsers(
          supervisorIds,
          'New PTO Request',
          `A new PTO request needs your attention. ${details}`,
          'info'
        );
      }
    }
  }
}

export const alertNotifier = AlertNotifier.getInstance();
