import { supabase } from "@/integrations/supabase/client";

export class BackgroundTaskManager {
  private static instance: BackgroundTaskManager;
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private isPWA = false;

  private constructor() {}

  static getInstance(): BackgroundTaskManager {
    if (!BackgroundTaskManager.instance) {
      BackgroundTaskManager.instance = new BackgroundTaskManager();
    }
    return BackgroundTaskManager.instance;
  }

  async initialize() {
    if ('serviceWorker' in navigator) {
      try {
        this.serviceWorkerRegistration = await navigator.serviceWorker.ready;
        console.log('✅ BackgroundTaskManager initialized');
        
        // Check if app is installed as PWA
        this.isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                    (window.navigator as any).standalone === true;
        
        if (this.isPWA) {
          this.setupBackgroundTasks();
        }
      } catch (error) {
        console.error('❌ Failed to initialize BackgroundTaskManager:', error);
      }
    }
  }

  private setupBackgroundTasks() {
    console.log('🔄 Setting up background tasks for PWA');
    
    // Schedule background checks
    this.scheduleAnniversaryCheck();
    
    // Listen for messages from service worker
    if (this.serviceWorkerRegistration?.active) {
      navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage);
    }
  }

  private scheduleAnniversaryCheck() {
    // Use the Background Sync API if available
    if (this.serviceWorkerRegistration?.sync) {
      this.serviceWorkerRegistration.sync.register('anniversary-check')
        .then(() => {
          console.log('✅ Background sync registered for anniversary check');
        })
        .catch(err => {
          console.error('❌ Background sync registration failed:', err);
          this.schedulePeriodicCheck();
        });
    } else {
      // Fallback to periodic check
      this.schedulePeriodicCheck();
    }
  }

  private schedulePeriodicCheck() {
    // Send message to service worker to schedule check
    if (this.serviceWorkerRegistration?.active) {
      this.serviceWorkerRegistration.active.postMessage({
        type: 'SCHEDULE_ANNIVERSARY_CHECK'
      });
    }
  }

  private handleServiceWorkerMessage = (event: MessageEvent) => {
    const { data } = event;
    
    if (data.type === 'BACKGROUND_CHECK_ANNIVERSARIES') {
      console.log('📨 Received background check request from service worker');
      this.performAnniversaryCheck();
    }
  }

  private async performAnniversaryCheck() {
    try {
      console.log('🔔 Performing background anniversary check');
      
      // Get current user from auth (if available)
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Call the anniversary check function
        const { error } = await supabase.rpc('check_anniversary_alerts');
        
        if (error) {
          console.error('❌ Background anniversary check failed:', error);
        } else {
          console.log('✅ Background anniversary check completed');
          
          // Send notification to service worker about successful check
          if (this.serviceWorkerRegistration?.active) {
            this.serviceWorkerRegistration.active.postMessage({
              type: 'ANNIVERSARY_CHECK_COMPLETED',
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    } catch (error) {
      console.error('❌ Error in background anniversary check:', error);
    }
  }

  async sendPushNotification(title: string, body: string, options?: any) {
    if (!this.serviceWorkerRegistration) {
      console.warn('⚠️ Service worker not available for push notification');
      return;
    }

    try {
      const notificationOptions = {
        body,
        icon: '/icon-192.png',
        badge: '/badge-96.png',
        vibrate: [200, 100, 200],
        data: {
          url: options?.url || '/',
          notificationId: options?.notificationId || Date.now().toString(),
          type: options?.type || 'general'
        },
        actions: [
          {
            action: 'view',
            title: 'View'
          },
          {
            action: 'dismiss',
            title: 'Dismiss'
          }
        ]
      };

      await this.serviceWorkerRegistration.showNotification(title, notificationOptions);
      console.log('✅ Push notification sent:', title);
    } catch (error) {
      console.error('❌ Failed to send push notification:', error);
    }
  }

  // Clean up
  destroy() {
    if (this.serviceWorkerRegistration?.active) {
      navigator.serviceWorker.removeEventListener('message', this.handleServiceWorkerMessage);
    }
  }
}

// Export singleton instance
export const backgroundTaskManager = BackgroundTaskManager.getInstance();
