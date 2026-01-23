// src/lib/notifications.ts - SIMPLIFIED VERSION
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types for notifications
export interface NotificationPayload {
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'success' | 'error' | 'emergency';
  url?: string;
  data?: Record<string, any>;
}

// Check if browser notifications are supported and enabled
export const checkBrowserNotificationSupport = () => {
  if (typeof window === 'undefined') return false;
  
  const hasNotificationSupport = 'Notification' in window;
  const permission = Notification.permission;
  
  return {
    supported: hasNotificationSupport,
    permission,
    canShow: hasNotificationSupport && permission === 'granted'
  };
};

// Request browser notification permission
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }
  
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

// Show a browser notification (if permission granted)
export const showBrowserNotification = (payload: NotificationPayload) => {
  if (typeof window === 'undefined') return;
  
  const { canShow } = checkBrowserNotificationSupport();
  
  if (canShow) {
    try {
      const notification = new Notification(payload.title, {
        body: payload.message,
        icon: '/favicon.ico',
        tag: payload.type || 'info'
      });
      
      if (payload.url) {
        notification.onclick = () => {
          window.focus();
          window.open(payload.url, '_blank');
        };
      }
      
      return notification;
    } catch (error) {
      console.error('Error showing browser notification:', error);
      return null;
    }
  }
  
  return null;
};

// Show in-app notification (toast)
export const showInAppNotification = (payload: NotificationPayload) => {
  const { title, message, type = 'info' } = payload;
  
  switch (type) {
    case 'success':
      toast.success(`${title}: ${message}`);
      break;
    case 'warning':
      toast.warning(`${title}: ${message}`);
      break;
    case 'error':
      toast.error(`${title}: ${message}`);
      break;
    case 'emergency':
      toast.error(`${title}: ${message}`, {
        duration: 10000,
        icon: '🚨'
      });
      break;
    default:
      toast.info(`${title}: ${message}`);
      break;
  }
};

// Main function to show notification (browser + in-app)
export const showNotification = (payload: NotificationPayload) => {
  // Always show in-app notification
  showInAppNotification(payload);
  
  // Try to show browser notification
  showBrowserNotification(payload);
};

// Save notification to database for persistence
export const saveNotificationToDB = async (
  officerId: string | null,
  payload: NotificationPayload,
  sentBy: string
) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        officer_id: officerId,
        title: payload.title,
        message: payload.message,
        type: payload.type || 'info',
        url: payload.url,
        data: payload.data || {},
        sent_by: sentBy,
        read: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error saving notification to DB:', error);
    return { success: false, error };
  }
};

// Send notification to a specific officer
export async function sendNotificationToOfficer(
  officerId: string, 
  payload: NotificationPayload,
  sentBy: string = 'system'
) {
  try {
    // Save to database
    const saveResult = await saveNotificationToDB(officerId, payload, sentBy);
    
    if (!saveResult.success) {
      console.error('Failed to save notification to DB');
    }
    
    // Show in-app notification
    showNotification(payload);
    
    return { success: true };
  } catch (error) {
    console.error('Error in sendNotificationToOfficer:', error);
    return { success: false, error };
  }
}

// Send notification to multiple officers
export async function sendNotificationToOfficers(
  officerIds: string[], 
  payload: NotificationPayload,
  sentBy: string = 'system'
) {
  try {
    // Save to database for each officer
    const savePromises = officerIds.map(officerId => 
      saveNotificationToDB(officerId, payload, sentBy)
    );
    
    await Promise.all(savePromises);
    
    // Show in-app notification
    showNotification(payload);
    
    return { success: true };
  } catch (error) {
    console.error('Error in sendNotificationToOfficers:', error);
    return { success: false, error };
  }
}

// Example usage functions
export async function sendShiftChangeNotification(
  officerId: string,
  oldShift: string,
  newShift: string,
  effectiveDate: string
) {
  return sendNotificationToOfficer(officerId, {
    title: 'Shift Change Notification',
    message: `Your shift has been changed from ${oldShift} to ${newShift} effective ${effectiveDate}`,
    type: 'info',
    data: {
      type: 'SHIFT_CHANGE',
      oldShift,
      newShift,
      effectiveDate
    }
  }, 'system');
}

export async function sendEmergencyNotification(message: string) {
  // Get all officers
  const { data: officers, error } = await supabase
    .from('profiles')
    .select('id');
  
  if (error) {
    console.error('Error fetching officers:', error);
    return { success: false, error };
  }
  
  const officerIds = officers?.map(o => o.id) || [];
  
  return sendNotificationToOfficers(officerIds, {
    title: '🚨 EMERGENCY ALERT',
    message: message,
    type: 'emergency',
    data: {
      type: 'EMERGENCY',
      priority: 'HIGH'
    }
  }, 'system');
}
