import { useState, useEffect } from 'react';
import { NotificationService } from '../utils/notifications';

export const useNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isEnabled, setIsEnabled] = useState(false);
  const [notificationService, setNotificationService] = useState<NotificationService | null>(null);

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
    isSupported,
    permission,
    isEnabled,
    requestPermission,
    showNotification,
    testNotification,
    scheduleShiftReminder,
    notificationService
  };
};