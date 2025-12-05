// utils/notifications.ts
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Check if a specific notification type is enabled in settings
 */
export const isNotificationTypeEnabled = async (type: string): Promise<boolean> => {
  try {
    // First check if notifications are enabled globally
    const { data: settings } = await supabase
      .from('website_settings')
      .select('enable_notifications')
      .single();

    if (!settings?.enable_notifications) {
      console.log('Notifications are disabled globally');
      return false;
    }

    // Check specific notification type settings
    switch (type) {
      case 'pto_request':
        const { data: ptoRequestSettings } = await supabase
          .from('website_settings')
          .select('enable_pto_request_notifications')
          .single();
        return ptoRequestSettings?.enable_pto_request_notifications || false;

      case 'pto_status':
        const { data: ptoStatusSettings } = await supabase
          .from('website_settings')
          .select('enable_pto_status_notifications')
          .single();
        return ptoStatusSettings?.enable_pto_status_notifications || false;

      case 'schedule_change':
        const { data: scheduleSettings } = await supabase
          .from('website_settings')
          .select('enable_schedule_change_notifications')
          .single();
        return scheduleSettings?.enable_schedule_change_notifications || false;

      case 'vacancy_alert':
        const { data: vacancySettings } = await supabase
          .from('website_settings')
          .select('enable_vacancy_alerts')
          .single();
        return vacancySettings?.enable_vacancy_alerts || false;

      default:
        return true; // Other notification types are enabled by default
    }
  } catch (error) {
    console.error('Error checking notification settings:', error);
    return false;
  }
};

/**
 * Send an in-app notification to a user
 */
export const sendInAppNotification = async (
  userId: string,
  title: string,
  message: string,
  type: string = 'general',
  relatedId?: string
): Promise<boolean> => {
  try {
    // Check if this notification type is enabled
    const enabled = await isNotificationTypeEnabled(type);
    if (!enabled) {
      console.log(`Notification type "${type}" is disabled`);
      return false;
    }

    // Create the notification
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
        related_id: relatedId,
        is_read: false,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error creating notification:', error);
      return false;
    }

    console.log(`In-app notification sent to user ${userId}: ${title}`);
    return true;
    
  } catch (error) {
    console.error('Error in sendInAppNotification:', error);
    return false;
  }
};

/**
 * Send notification to all supervisors and admins
 */
export const notifySupervisorsAndAdmins = async (
  title: string,
  message: string,
  type: string = 'general',
  relatedId?: string
): Promise<void> => {
  try {
    const { data: supervisors, error } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['supervisor', 'admin']);

    if (!error && supervisors && supervisors.length > 0) {
      const notifications = supervisors.map(supervisor => ({
        user_id: supervisor.user_id,
        title,
        message,
        type,
        related_id: relatedId,
        is_read: false,
        created_at: new Date().toISOString()
      }));

      await supabase
        .from('notifications')
        .insert(notifications);
    }
  } catch (error) {
    console.error('Error notifying supervisors:', error);
  }
};

/**
 * Send notification to a specific user
 */
export const notifyUser = async (
  userId: string,
  title: string,
  message: string,
  type: string = 'general',
  relatedId?: string
): Promise<void> => {
  try {
    await sendInAppNotification(userId, title, message, type, relatedId);
  } catch (error) {
    console.error('Error notifying user:', error);
  }
};

/**
 * Send PTO request notifications to supervisors and admins
 */
export const sendPTORequestNotification = async (
  requestId: string,
  userId: string,
  action: 'created' | 'approved' | 'denied'
): Promise<void> => {
  try {
    // Get request details
    const { data: request, error: requestError } = await supabase
      .from('time_off_requests')
      .select(`
        *,
        profiles!time_off_requests_officer_id_fkey(full_name, badge_number)
      `)
      .eq('id', requestId)
      .single();

    if (requestError) throw requestError;

    if (action === 'created') {
      // Check if PTO request notifications are enabled
      const enabled = await isNotificationTypeEnabled('pto_request');
      if (!enabled) return;

      // Get all supervisors and admins
      const { data: supervisors, error: supervisorError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['supervisor', 'admin']);

      if (!supervisorError && supervisors && supervisors.length > 0) {
        // Create notifications for each supervisor/admin
        const notifications = supervisors.map(supervisor => ({
          user_id: supervisor.user_id,
          title: 'New PTO Request Submitted',
          message: `${request.profiles.full_name} has submitted a ${request.pto_type} time off request for ${request.start_date} to ${request.end_date}`,
          type: 'pto_request',
          related_id: requestId,
          is_read: false,
          created_at: new Date().toISOString()
        }));

        const { error: notificationError } = await supabase
          .from('notifications')
          .insert(notifications);

        if (!notificationError) {
          toast.success(`Supervisors and admins have been notified`);
          
          // Also show browser notifications if available
          if (NotificationService.getInstance().isEnabled()) {
            const service = NotificationService.getInstance();
            supervisors.forEach(supervisor => {
              service.showNotification('New PTO Request', {
                body: `${request.profiles.full_name} submitted a time off request`,
                icon: '/icons/icon-192x192.png',
                tag: 'pto_request',
                requireInteraction: true
              });
            });
          }
        }
      }
    } else if (action === 'approved' || action === 'denied') {
      // Check if PTO status notifications are enabled
      const enabled = await isNotificationTypeEnabled('pto_status');
      if (!enabled) return;

      const statusMessage = action === 'approved' 
        ? `Your ${request.pto_type} time off request for ${request.start_date} to ${request.end_date} has been approved`
        : `Your ${request.pto_type} time off request for ${request.start_date} to ${request.end_date} has been denied`;

      const success = await sendInAppNotification(
        request.officer_id,
        `PTO Request ${action === 'approved' ? 'Approved' : 'Denied'}`,
        statusMessage,
        'pto_status',
        requestId
      );

      if (success) {
        toast.success(`Officer has been notified of the ${action} status`);
        
        // Also show browser notification
        if (NotificationService.getInstance().isEnabled()) {
          const service = NotificationService.getInstance();
          service.showNotification(
            `PTO Request ${action === 'approved' ? 'Approved' : 'Denied'}`,
            {
              body: statusMessage,
              icon: '/icons/icon-192x192.png',
              tag: 'pto_status'
            }
          );
        }
      }
    }

  } catch (error) {
    console.error('Error sending PTO notification:', error);
  }
};

/**
 * Send vacancy alert notifications
 */
export const sendVacancyAlert = async (
  position: string,
  date: string,
  shift: string,
  createdByUserId: string
): Promise<void> => {
  try {
    // Check if vacancy alerts are enabled
    const enabled = await isNotificationTypeEnabled('vacancy_alert');
    if (!enabled) return;

    // Get all supervisors and admins
    const { data: supervisors, error } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['supervisor', 'admin']);

    if (!error && supervisors && supervisors.length > 0) {
      const notifications = supervisors.map(supervisor => ({
        user_id: supervisor.user_id,
        title: 'New Vacancy Alert',
        message: `Vacancy created for ${position} on ${date} (${shift})`,
        type: 'vacancy_alert',
        is_read: false,
        created_at: new Date().toISOString()
      }));

      await supabase
        .from('notifications')
        .insert(notifications);

      toast.success('Vacancy alert sent to supervisors and admins');
    }
  } catch (error) {
    console.error('Error sending vacancy alert:', error);
  }
};

/**
 * Send schedule change notification
 */
export const sendScheduleChangeNotification = async (
  officerId: string,
  changeType: 'added' | 'updated' | 'removed',
  scheduleDetails: string
): Promise<void> => {
  try {
    // Check if schedule change notifications are enabled
    const enabled = await isNotificationTypeEnabled('schedule_change');
    if (!enabled) return;

    const title = 'Schedule Update';
    const message = `Your schedule has been ${changeType}: ${scheduleDetails}`;

    const success = await sendInAppNotification(
      officerId,
      title,
      message,
      'schedule_change'
    );

    if (success && NotificationService.getInstance().isEnabled()) {
      const service = NotificationService.getInstance();
      service.showNotification(title, {
        body: message,
        icon: '/icons/icon-192x192.png',
        tag: 'schedule_change'
      });
    }
  } catch (error) {
    console.error('Error sending schedule change notification:', error);
  }
};

/**
 * Send batch notifications to multiple users
 */
export const sendBatchNotifications = async (
  userIds: string[],
  title: string,
  message: string,
  type: string = 'general',
  relatedId?: string
): Promise<void> => {
  try {
    const notifications = userIds.map(userId => ({
      user_id: userId,
      title,
      message,
      type,
      related_id: relatedId,
      is_read: false,
      created_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('notifications')
      .insert(notifications);

    if (error) {
      console.error('Error sending batch notifications:', error);
    }
  } catch (error) {
    console.error('Error in sendBatchNotifications:', error);
  }
};

/**
 * Clear old notifications (older than 30 days)
 */
export const clearOldNotifications = async (userId?: string): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let query = supabase
      .from('notifications')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString());

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { error } = await query;

    if (error) {
      console.error('Error clearing old notifications:', error);
    }
  } catch (error) {
    console.error('Error in clearOldNotifications:', error);
  }
};

/**
 * Get notification statistics
 */
export const getNotificationStats = async (): Promise<{
  total: number;
  unread: number;
  byType: Record<string, number>;
}> => {
  try {
    const { data: allNotifications, error: allError } = await supabase
      .from('notifications')
      .select('id, type, is_read');

    if (allError) throw allError;

    const stats = {
      total: allNotifications?.length || 0,
      unread: allNotifications?.filter(n => !n.is_read).length || 0,
      byType: {} as Record<string, number>
    };

    // Count by type
    allNotifications?.forEach(notification => {
      stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error('Error getting notification stats:', error);
    return { total: 0, unread: 0, byType: {} };
  }
};

// Your existing NotificationService class
export class NotificationService {
  private static instance: NotificationService;
  private permission: NotificationPermission = 'default';
  private swRegistration: ServiceWorkerRegistration | null = null;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Initialize notifications
  public async initialize(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.log('Service workers not supported');
      return;
    }

    if (!('Notification' in window)) {
      console.log('Notifications not supported');
      return;
    }

    try {
      // Register service worker
      this.swRegistration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker registered:', this.swRegistration);

      // Request notification permission
      await this.requestPermission();

      // Subscribe to push notifications if permission granted
      if (this.permission === 'granted') {
        await this.subscribeToPushNotifications();
      }
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
    }
  }

  // Request notification permission
  public async requestPermission(): Promise<NotificationPermission> {
    if (this.permission === 'granted') {
      return this.permission;
    }

    this.permission = await Notification.requestPermission();
    console.log('Notification permission:', this.permission);
    
    return this.permission;
  }

  // Check if notifications are enabled
  public isEnabled(): boolean {
    return this.permission === 'granted';
  }

  // Show a local notification
  public showNotification(title: string, options?: NotificationOptions): void {
    if (!this.isEnabled()) {
      console.log('Notifications not enabled');
      return;
    }

    if ('serviceWorker' in navigator && this.swRegistration) {
      this.swRegistration.showNotification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        ...options
      });
    } else {
      new Notification(title, {
        icon: '/icons/icon-192x192.png',
        ...options
      });
    }
  }

  // Subscribe to push notifications
  private async subscribeToPushNotifications(): Promise<void> {
    if (!this.swRegistration) {
      console.log('Service worker not registered');
      return;
    }

    try {
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.getPublicKey()
      });

      console.log('Push subscription:', subscription);
      
      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
    }
  }

  // Get public key for push notifications (you'll need to generate this)
  private getPublicKey(): Uint8Array {
    // This is a demo key - replace with your actual VAPID public key
    const publicKey = 'BEl62iUYgU9x_jTOfV7qOA9Wb6lM6BfGJq8J1JcE7Y8XJcE7Y8XJcE7Y8XJcE7Y8XJcE7Y8';
    return this.urlBase64ToUint8Array(publicKey);
  }

  // Convert base64 to Uint8Array
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Send subscription to server
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      // Replace with your actual API endpoint
      await fetch('/api/save-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
    }
  }

  // Schedule a notification
  public scheduleNotification(title: string, body: string, delay: number): void {
    setTimeout(() => {
      this.showNotification(title, {
        body,
        tag: 'scheduled-notification',
        requireInteraction: true
      });
    }, delay);
  }

  // Schedule shift reminder
  public scheduleShiftReminder(shiftTime: Date, shiftDetails: string): void {
    const now = new Date();
    const reminderTime = new Date(shiftTime.getTime() - 30 * 60 * 1000); // 30 minutes before
    
    if (reminderTime > now) {
      const delay = reminderTime.getTime() - now.getTime();
      this.scheduleNotification(
        'Shift Reminder',
        `Your shift starts in 30 minutes: ${shiftDetails}`,
        delay
      );
    }
  }

  // Test notification
  public testNotification(): void {
    this.showNotification('Test Notification', {
      body: 'Notifications are working correctly!',
      tag: 'test-notification',
      requireInteraction: false
    });
  }
}
