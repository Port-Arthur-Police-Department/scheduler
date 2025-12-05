// hooks/useNotifications.ts - FIXED VERSION
import { useState, useEffect } from 'react';
import { NotificationService } from '../utils/notifications';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth'; // You need to import your auth hook

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
  const queryClient = useQueryClient();
  
  // ADD THIS: Get current user from auth
  const { user } = useAuth(); // or however you get current user in your app
  const userId = user?.id; // Get user ID

  useEffect(() => {
    const initNotifications = async () => {
      // Check if notifications are supported
      const supported = 'Notification' in window && 'serviceWorker' in navigator;
      setIsSupported(supported);

      if (supported) {
        const service = NotificationService.getInstance();
        setNotificationService(service);
        
        // Initialize notifications
        await service.initialize();
        
        // Get current permission status
        const currentPermission = Notification.permission;
        setPermission(currentPermission);
        setIsEnabled(currentPermission === 'granted');
      }
    };

    initNotifications();
  }, []);

  // Fetch in-app notifications - FIXED
  const { data: inAppNotifications, isLoading: notificationsLoading } = useQuery({
    queryKey: ['in-app-notifications', userId], // Already correct
    queryFn: async () => {
      if (!userId) {
        console.log('No user ID, skipping notification fetch');
        return [];
      }
      
      console.log('🔔 Fetching notifications for user:', userId);
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId) // Filter by current user
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching notifications:', error);
        throw error;
      }
      
      console.log(`✅ Found ${data?.length || 0} notifications for user ${userId}`);
      return data as InAppNotification[];
    },
    enabled: !!userId, // Only run if userId exists
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch unread count - FIXED (ADDED USER FILTER)
  const { data: unreadCount } = useQuery({
    queryKey: ['unread-notifications-count', userId], // Add userId to query key
    queryFn: async () => {
      if (!userId) {
        console.log('No user ID, skipping unread count');
        return 0;
      }
      
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId) // CRITICAL: Filter by current user
        .eq('is_read', false);

      if (error) {
        console.error('Error fetching unread count:', error);
        return 0;
      }
      
      console.log(`🔔 User ${userId} has ${count || 0} unread notifications`);
      return count || 0;
    },
    enabled: !!userId, // Only run if userId exists
    refetchInterval: 30000,
  });

  // Mark notification as read - FIXED (ADDED USER FILTER FOR SECURITY)
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
        .eq('user_id', userId); // CRITICAL: Ensure user can only mark their own notifications as read

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['in-app-notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['unread-notifications-count', userId] });
    },
  });

  // Mark all as read - FIXED (ADDED USER FILTER)
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('No user ID');
      
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('user_id', userId) // CRITICAL: Only mark current user's notifications
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['in-app-notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['unread-notifications-count', userId] });
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
  };
};
