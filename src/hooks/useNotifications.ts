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

  useEffect(() => {
    let mounted = true;

    const initNotifications = async () => {
      try {
        // Get current user from Supabase auth
        const { data: { user } } = await supabase.auth.getUser();
        
        if (mounted) {
          setUserId(user?.id || null);
          console.log('👤 Current user ID for notifications:', user?.id);
        }

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
      } catch (error) {
        console.error('Error initializing notifications:', error);
      }
    };

    initNotifications();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (mounted) {
          setUserId(session?.user?.id || null);
          console.log('🔄 Auth state changed for notifications:', event, 'User ID:', session?.user?.id);
          
          // Invalidate queries when user changes
          queryClient.invalidateQueries({ queryKey: ['in-app-notifications'] });
          queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  // Fetch in-app notifications
  const { data: inAppNotifications, isLoading: notificationsLoading } = useQuery({
    queryKey: ['in-app-notifications', userId],
    queryFn: async () => {
      if (!userId) {
        console.log('⚠️ No user ID, skipping notification fetch');
        return [];
      }
      
      console.log('🔔 Fetching notifications for user:', userId);
      
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('❌ Error fetching notifications:', error);
          throw error;
        }
        
        console.log(`✅ Found ${data?.length || 0} notifications for user ${userId}`);
        return data as InAppNotification[];
      } catch (error) {
        console.error('❌ Failed to fetch notifications:', error);
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
