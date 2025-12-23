// Service Worker for Push Notifications
self.addEventListener('push', async (event) => {
  console.log('🔔 Push event received:', event);
  
  try {
    const data = event.data ? event.data.json() : {};
    
    const options = {
      body: data.body || 'New alert from PAPD Scheduler',
      icon: '/police-badge.png',
      badge: '/police-badge.png',
      vibrate: [200, 100, 200],
      data: {
        url: data.url || '/',
        type: data.type || 'alert',
        alertId: data.alertId,
        createdAt: new Date().toISOString()
      },
      actions: data.actions || []
    };

    // Add different behaviors based on alert type
    if (data.type === 'emergency') {
      options.requireInteraction = true;
      options.vibrate = [300, 200, 300];
      options.tag = 'emergency-alert';
    }

    event.waitUntil(
      self.registration.showNotification(
        data.title || 'PAPD Alert',
        options
      )
    );
  } catch (error) {
    console.error('Error handling push:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  console.log('Notification click:', event.notification.data);
  
  event.notification.close();

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window/tab open with the target URL
        for (const client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If no window/tab is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background sync for offline support
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event.tag);
  
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncMissedNotifications());
  }
});

async function syncMissedNotifications() {
  console.log('Syncing missed notifications...');
  // You could fetch missed notifications from an API here
}
