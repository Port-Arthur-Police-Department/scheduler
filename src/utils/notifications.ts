// utils/notifications.ts - UPDATED TO USE user_roles TABLE
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

/**
 * Check if a specific notification type is enabled in settings
 */
export const isNotificationTypeEnabled = async (type: string): Promise<boolean> => {
  try {
    const { data: settings } = await supabase
      .from('website_settings')
      .select('*')
      .single();

    if (!settings?.enable_notifications) {
      console.log('Notifications are disabled globally');
      return false;
    }

    // Check specific notification type settings
    switch (type) {
      case 'pto_request':
        return settings?.enable_pto_request_notifications !== false;
        
      case 'pto_status':
        return settings?.enable_pto_status_notifications !== false;
        
      case 'schedule_change':
        return settings?.enable_schedule_change_notifications !== false;
        
      case 'vacancy_alert':
        return settings?.enable_vacancy_alerts !== false;
        
      default:
        return true;
    }
  } catch (error) {
    console.error('Error checking notification settings:', error);
    return false;
  }
};

export const sendInAppNotification = async (
  userId: string,
  title: string,
  message: string,
  type: string = 'general',
  relatedId?: string
): Promise<boolean> => {
  try {
    console.log(`📤 [SEND DEBUG] ===== START =====`);
    console.log(`📤 User: ${userId}, Title: "${title}"`);
    
    // Step 1: Check if user exists
    console.log(`🔍 Step 1: Checking if user ${userId} exists in profiles...`);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, active')
      .eq('id', userId)
      .maybeSingle(); // Use maybeSingle instead of single to avoid throwing

    if (profileError || !profile) {
      console.error(`❌ Step 1 FAILED: User ${userId} not found or error:`, profileError?.message || 'No profile');
      console.log(`📤 [SEND DEBUG] ===== END (User not found) =====`);
      return false;
    }
    
    console.log(`✅ Step 1 PASSED: User found - ${profile.full_name} (active: ${profile.active})`);
    
    // Step 2: Try database function
    console.log(`🔍 Step 2: Calling create_pto_notification function...`);
    const { data: notificationId, error: functionError } = await supabase.rpc('create_pto_notification', {
      p_user_id: userId,
      p_title: title,
      p_message: message,
      p_type: type
    });

    if (functionError) {
      console.error(`❌ Step 2 FAILED - Database function error:`, {
        code: functionError.code,
        message: functionError.message,
        details: functionError.details
      });
      
      // Step 3: Fallback to direct insert
      console.log(`🔄 Step 3: Trying fallback direct insert...`);
      const { error: insertError } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title,
          message,
          type,
          related_id: relatedId,
          is_read: false,
          created_at: new Date().toISOString(),
          metadata: {}
        })
        .select('id')
        .single();

      if (insertError) {
        console.error(`❌ Step 3 FAILED - Direct insert error:`, {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details
        });
        console.log(`📤 [SEND DEBUG] ===== END (All methods failed) =====`);
        return false;
      }
      
      console.log(`✅ Step 3 PASSED: Notification created via fallback insert`);
      console.log(`📤 [SEND DEBUG] ===== END (Success via fallback) =====`);
      return true;
    }

    console.log(`✅ Step 2 PASSED: Notification created via function, ID: ${notificationId}`);
    console.log(`📤 [SEND DEBUG] ===== END (Success via function) =====`);
    return true;
    
  } catch (error) {
    console.error(`❌ [SEND DEBUG] Unexpected error for user ${userId}:`, error);
    console.log(`📤 [SEND DEBUG] ===== END (Error) =====`);
    return false;
  }
};

/**
 * Send notification to all supervisors and admins - SIMPLIFIED VERSION
 */
export const notifySupervisorsAndAdmins = async (
  title: string,
  message: string,
  type: string = 'general',
  relatedId?: string
): Promise<void> => {
  try {
    console.log(`📢 Starting to notify supervisors and admins: ${title}`);
    
    // SIMPLE QUERY: Just get user_ids from user_roles table (no join needed)
    const { data: userRoles, error } = await supabase
      .from('user_roles')
      .select('user_id')  // Only need user_id
      .in('role', ['supervisor', 'admin']);

    if (error) {
      console.error('❌ Error fetching user roles:', error);
      console.log('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details
      });
      return;
    }

    console.log(`👥 Found ${userRoles?.length || 0} supervisor/admin user IDs:`, userRoles);

    if (userRoles && userRoles.length > 0) {
      // Send notifications to each user_id
      const notificationPromises = userRoles.map(role => 
        sendInAppNotification(role.user_id, title, message, type, relatedId)
      );

      const results = await Promise.all(notificationPromises);
      const successful = results.filter(result => result).length;
      
      console.log(`🎯 Notifications sent: ${successful}/${userRoles.length} successful`);
      
      if (successful > 0) {
        toast.success(`Notified ${successful} supervisor(s) and admin(s)`);
      } else {
        console.error('❌ All notifications failed to send');
        toast.error('Failed to send notifications to supervisors');
      }
    } else {
      console.warn('⚠️ WARNING: No supervisors/admins found in user_roles table!');
      toast.warning('No supervisors found to notify. Please check user roles.');
    }
  } catch (error) {
    console.error('❌ Error in notifySupervisorsAndAdmins:', error);
  }
};

/**
 * Send PTO request notifications - UPDATED
 */
export const sendPTORequestNotification = async (
  requestId: string,
  userId: string,
  action: 'created' | 'approved' | 'denied'
): Promise<void> => {
  try {
    console.log(`🔔 Starting PTO notification for request ${requestId}, action: ${action}`);
    
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
      console.error('❌ Error fetching PTO request:', requestError);
      return;
    }

    console.log('📋 PTO request details:', {
      officer: request.profiles?.full_name,
      type: request.pto_type,
      dates: `${request.start_date} to ${request.end_date}`
    });

    if (action === 'created') {
      // Check if PTO request notifications are enabled
      const enabled = await isNotificationTypeEnabled('pto_request');
      if (!enabled) {
        console.log('🔕 PTO request notifications are disabled');
        return;
      }

      console.log('📢 Sending PTO request notification to supervisors/admins');
      
      // Build notification message
      const message = `${request.profiles?.full_name} has submitted a ${request.pto_type} time off request from ${format(new Date(request.start_date), 'MMM d, yyyy')} to ${format(new Date(request.end_date), 'MMM d, yyyy')}${request.reason ? ` - Reason: ${request.reason}` : ''}`;
      
      // Notify all supervisors and admins
      await notifySupervisorsAndAdmins(
        'New PTO Request Submitted',
        message,
        'pto_request',
        requestId
      );

      toast.success('PTO request submitted. Supervisors have been notified.');
      
    } else if (action === 'approved' || action === 'denied') {
      // Check if PTO status notifications are enabled
      const enabled = await isNotificationTypeEnabled('pto_status');
      if (!enabled) {
        console.log('🔕 PTO status notifications are disabled');
        return;
      }

      console.log(`📢 Sending PTO ${action} notification to officer`);
      
      const statusMessage = action === 'approved' 
        ? `Your ${request.pto_type} time off request for ${format(new Date(request.start_date), 'MMM d, yyyy')} to ${format(new Date(request.end_date), 'MMM d, yyyy')} has been approved${request.review_notes ? ` - Notes: ${request.review_notes}` : ''}`
        : `Your ${request.pto_type} time off request for ${format(new Date(request.start_date), 'MMM d, yyyy')} to ${format(new Date(request.end_date), 'MMM d, yyyy')} has been denied${request.review_notes ? ` - Reason: ${request.review_notes}` : ''}`;

      const success = await sendInAppNotification(
        request.officer_id,
        `PTO Request ${action === 'approved' ? 'Approved' : 'Denied'}`,
        statusMessage,
        'pto_status',
        requestId
      );

      if (success) {
        console.log(`✅ PTO ${action} notification sent to officer`);
        toast.success(`Officer has been notified of the ${action} status`);
      } else {
        console.error(`❌ Failed to send PTO ${action} notification to officer`);
      }
    }

  } catch (error) {
    console.error('❌ Error in sendPTORequestNotification:', error);
    toast.error('Failed to send notification');
  }
};

/**
 * Send vacancy alert notifications - SIMPLIFIED VERSION
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
    if (!enabled) {
      console.log('🔕 Vacancy alerts are disabled');
      return;
    }

    console.log('📢 Sending vacancy alert to supervisors/admins');
    
    // SIMPLE QUERY: Just get user_ids
    const { data: userRoles, error } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['supervisor', 'admin']);

    if (error) {
      console.error('❌ Error fetching user roles:', error);
      return;
    }

    console.log(`👥 Found ${userRoles?.length || 0} supervisors/admins in user_roles`);

    if (userRoles && userRoles.length > 0) {
      const formattedDate = format(new Date(date), 'MMM d, yyyy');
      const notificationMessage = `Vacancy created for ${position} on ${formattedDate} (${shift})`;
      
      const notificationPromises = userRoles.map(role => 
        sendInAppNotification(
          role.user_id,
          'New Vacancy Alert',
          notificationMessage,
          'vacancy_alert'
        )
      );

      const results = await Promise.all(notificationPromises);
      const successful = results.filter(result => result).length;
      
      console.log(`🎯 Vacancy notifications sent: ${successful}/${userRoles.length} successful`);
      
      if (successful > 0) {
        toast.success(`Vacancy alert sent to ${successful} supervisor(s)`);
      }
    } else {
      console.warn('⚠️ No supervisors/admins found to notify');
    }
  } catch (error) {
    console.error('❌ Error sending vacancy alert:', error);
  }
};
/**
 * Send batch notifications to multiple users - SHOULD WORK
 */
export const sendBatchNotifications = async (
  userIds: string[],
  title: string,
  message: string,
  type: string = 'general',
  relatedId?: string
): Promise<void> => {
  try {
    console.log(`📢 Sending batch notification to ${userIds.length} users: ${title}`);
    
    const notificationPromises = userIds.map(userId => 
      sendInAppNotification(userId, title, message, type, relatedId)
    );

    const results = await Promise.all(notificationPromises);
    const successful = results.filter(result => result).length;
    
    console.log(`🎯 Batch notifications sent: ${successful}/${userIds.length} successful`);
  } catch (error) {
    console.error('❌ Error in sendBatchNotifications:', error);
  }
};

/**
 * Clear old notifications (older than 30 days) - SHOULD WORK
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
      console.error('❌ Error clearing old notifications:', error);
    } else {
      console.log('✅ Old notifications cleared');
    }
  } catch (error) {
    console.error('❌ Error in clearOldNotifications:', error);
  }
};

/**
 * Get notification statistics - SHOULD WORK
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
  } catch (Error) {
    console.error('❌ Error getting notification stats:', Error);
    return { total: 0, unread: 0, byType: {} };
  }
};

// Your existing NotificationService class - UNCHANGED
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
    const publicKey = 'BEl62iUYgU9x_jTOfV7qOA9Wb6lM6BfGJq8J1JcE7Y8XJcE7Y8XJcE7Y8XJcE7Y8';
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
