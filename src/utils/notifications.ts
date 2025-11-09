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
    const publicKey = 'BEl62iUYgU9x_jTOfV7qOA9Wb6lM6BfGJq8J1JcE7Y8XJcE7Y8XJcE7Y8XJcE7Y8XJcE7Y8XJcE7Y8';
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