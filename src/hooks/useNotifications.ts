// hooks/useNotifications.ts - FINAL VERSION
import { useState, useEffect } from 'react';
import { NotificationService } from '../utils/notifications';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface InAppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  related_id?: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

export const useNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isEnabled, setIsEnabled] = useState(false);
  const [notificationService, setNotificationService] = useState<NotificationService | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

// Add this debug useEffect at the top of your hook, after state declarations
useEffect(() => {
  console.log('🔔 [HOOK STATE] Current state:', {
    userId,
    inAppNotificationsCount: inAppNotifications?.length,
    unreadCount,
    notificationsLoading,
    queryEnabled: !!userId
  });
}, [userId, inAppNotifications, unreadCount, notificationsLoading]);

// Also update the query to log more details
const { data: inAppNotifications, isLoading: notificationsLoading } = useQuery({
  queryKey: ['in-app-notifications', userId],
  queryFn: async () => {
    if (!userId) {
      console.log('⚠️ [QUERY] No user ID, skipping notification fetch');
      return [];
    }
    
    console.log('🔔 [QUERY] Fetching notifications for user:', userId);
    
    try {
      // Test the query with very simple parameters first
      console.log('🔔 [QUERY] Testing simple query...');
      
      const { data, error, count } = await supabase
        .from('notifications')
        .select('id, title', { count: 'exact' }) // Start with minimal fields
        .eq('user_id', userId)
        .limit(5);

      console.log('🔔 [QUERY] Simple test result:', {
        success: !error,
        dataLength: data?.length,
        count,
        error: error?.message,
        userId
      });

      if (error) {
        console.error('❌ [QUERY] Error in simple test:', error);
        // Try without user_id filter to see if RLS is the issue
        const { data: allData, error: allError } = await supabase
          .from('notifications')
          .select('id, user_id, title')
          .limit(5);
        
        console.log('🔔 [QUERY] All notifications test:', {
          allDataLength: allData?.length,
          allError: allError?.message
        });
        
        throw error;
      }

      // If simple query worked, get full data
      console.log('🔔 [QUERY] Simple query successful, fetching full data...');
      
      const { data: fullData, error: fullError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fullError) {
        console.error('❌ [QUERY] Error fetching full data:', fullError);
        throw fullError;
      }
      
      console.log(`✅ [QUERY] Found ${fullData?.length || 0} notifications for user ${userId}`);
      console.log('✅ [QUERY] First notification:', fullData?.[0]);
      return fullData as InAppNotification[];
    } catch (error) {
      console.error('❌ [QUERY] Failed to fetch notifications:', error);
      return [];
    }
  },
  enabled: !!userId,
  refetchInterval: 30000,
});

  // Fetch unread count
  const { data: unreadCount } = useQuery({
    queryKey: ['unread-notifications-count', userId],
    queryFn: async () => {
      if (!userId) {
        console.log('⚠️ No user ID, skipping unread count');
        return 0;
      }
      
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_read', false);

        if (error) {
          console.error('❌ Error fetching unread count:', error);
          return 0;
        }
        
        console.log(`🔔 User ${userId} has ${count || 0} unread notifications`);
        return count || 0;
      } catch (error) {
        console.error('❌ Failed to fetch unread count:', error);
        return 0;
      }
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!userId) throw new Error('No user ID');
      
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['in-app-notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['unread-notifications-count', userId] });
    },
    onError: (error) => {
      console.error('❌ Error marking notification as read:', error);
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('No user ID');
      
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['in-app-notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['unread-notifications-count', userId] });
    },
    onError: (error) => {
      console.error('❌ Error marking all as read:', error);
    },
  });

  const requestPermission = async (): Promise<boolean> => {
    if (!notificationService) return false;

    try {
      const newPermission = await notificationService.requestPermission();
      setPermission(newPermission);
      setIsEnabled(newPermission === 'granted');
      return newPermission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  const showNotification = (title: string, options?: NotificationOptions) => {
    if (notificationService && isEnabled) {
      notificationService.showNotification(title, options);
    }
  };

  const testNotification = () => {
    if (notificationService && isEnabled) {
      notificationService.testNotification();
    }
  };

  const scheduleShiftReminder = (shiftTime: Date, shiftDetails: string) => {
    if (notificationService && isEnabled) {
      notificationService.scheduleShiftReminder(shiftTime, shiftDetails);
    }
  };

  return {
    // Browser notifications
    isSupported,
    permission,
    isEnabled,
    requestPermission,
    showNotification,
    testNotification,
    scheduleShiftReminder,
    notificationService,
    
    // In-app notifications
    inAppNotifications: inAppNotifications || [],
    notificationsLoading,
    unreadCount: unreadCount || 0,
    markAsRead: (notificationId: string) => markAsReadMutation.mutate(notificationId),
    markAllAsRead: () => markAllAsReadMutation.mutate(),
    
    // Add for debugging
    userId,
  };
};
