// Enhanced service worker for PWA with push notifications
const CACHE_NAME = 'pd-scheduler-v3'; // Updated version
const APP_PATH = '/scheduler/';
const urlsToCache = [
  `${APP_PATH}`,
  `${APP_PATH}index.html`,
  `${APP_PATH}manifest.json`,
  `${APP_PATH}icons/icon-192.png`,
  `${APP_PATH}icons/icon-512.png`,
  `${APP_PATH}icons/badge-96.png`,
  `${APP_PATH}icons/icon-144.png`
];

// Add cache versioning
const CURRENT_CACHES = {
  prefetch: 'pd-scheduler-v3-prefetch-' + new Date().toISOString()
};

self.addEventListener('install', event => {
  console.log('🔧 PAPD Scheduler PWA: Installing v3 with push support...');
  
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CURRENT_CACHES.prefetch)
      .then(cache => {
        console.log('📦 Caching essential files for offline use');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('❌ Cache failed:', error);
      })
  );
});

self.addEventListener('activate', event => {
  console.log('🚀 PAPD Scheduler PWA: Activating v3...');
  
  event.waitUntil(
    Promise.all([
      // Claim clients immediately
      self.clients.claim(),
      
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Delete caches that aren't current
            if (!CURRENT_CACHES.prefetch.includes(cacheName)) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    ]).then(() => {
      console.log('✅ Service Worker activated and ready for /scheduler/');
      // Send ready message to all clients
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_READY',
            version: 'v3',
            appPath: APP_PATH
          });
        });
      });
    })
  );
});

// ========== PUSH NOTIFICATION HANDLING ==========

self.addEventListener('push', function(event) {
  console.log('🔔 [Service Worker] Push received:', event);
  
  if (!event.data) {
    console.error('❌ Push event has no data');
    return;
  }

  try {
    let data;
    
    // Try to parse as JSON first
    try {
      data = event.data.json();
    } catch {
      // If not JSON, try as text
      const text = event.data.text();
      data = {
        title: 'Port Arthur PD',
        body: text,
        data: {
          url: `${APP_PATH}#/dashboard`,
          type: 'general'
        }
      };
    }
    
    console.log('📨 Push data parsed:', data);
    
    const title = data.title || 'Port Arthur PD';
    const body = data.body || 'New notification';
    const icon = data.icon || `${APP_PATH}icons/icon-192.png`;
    const badge = data.badge || `${APP_PATH}icons/badge-96.png`;
    const tag = data.tag || 'pd-notification-' + Date.now();
    
    const options = {
      body: body,
      icon: icon,
      badge: badge,
      tag: tag,
      data: data.data || {
        url: `${APP_PATH}#/dashboard`,
        notificationId: Date.now().toString(),
        type: data.type || 'general',
        timestamp: new Date().toISOString()
      },
      vibrate: [200, 100, 200],
      requireInteraction: data.requireInteraction || false,
      silent: data.silent || false,
      actions: [
        {
          action: 'view',
          title: 'View',
          icon: `${APP_PATH}icons/icon-192.png`
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: `${APP_PATH}icons/icon-192.png`
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
        .then(() => {
          console.log('✅ Push notification shown:', title);
        })
        .catch(error => {
          console.error('❌ Failed to show notification:', error);
        })
    );
  } catch (error) {
    console.error('❌ Error processing push notification:', error);
    
    // Fallback simple notification
    event.waitUntil(
      self.registration.showNotification('Port Arthur PD', {
        body: 'New notification received',
        icon: `${APP_PATH}icons/icon-192.png`,
        tag: 'fallback-notification'
      })
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  console.log('👆 [Service Worker] Notification clicked:', event.notification.data);
  
  event.notification.close();

  const notificationData = event.notification.data || {};
  const urlToOpen = notificationData.url || `${APP_PATH}#/dashboard`;
  const action = event.action || 'view';
  
  console.log(`Action: ${action}, URL: ${urlToOpen}`);
  
  if (action === 'dismiss') {
    console.log('❌ Notification dismissed');
    return;
  }

  // Default action: open/focus the app
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      // Check if there's already a window/tab open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        // Check if client URL matches our app
        if (client.url.includes(window.location.origin) && 'focus' in client) {
          console.log('🔍 Found existing client, focusing:', client.url);
          
          // Post message to navigate to specific tab if needed
          if (notificationData.type === 'anniversary' || notificationData.type === 'birthday') {
            client.postMessage({
              type: 'NAVIGATE_TO_TAB',
              tab: 'staff'
            });
          }
          
          return client.focus();
        }
      }
      
      // If no window is open, open a new one
      console.log('🌐 Opening new window:', urlToOpen);
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('notificationclose', function(event) {
  console.log('📪 [Service Worker] Notification closed:', event.notification.tag);
});

// ========== BACKGROUND SYNC ==========

self.addEventListener('sync', function(event) {
  console.log('🔄 [Service Worker] Background sync event:', event.tag);
  
  if (event.tag === 'anniversary-check') {
    console.log('📅 Running anniversary check via background sync');
    event.waitUntil(checkAnniversariesInBackground());
  }
});

// ========== BACKGROUND TASKS ==========

async function checkAnniversariesInBackground() {
  console.log('📅 [Service Worker] Checking anniversaries in background');
  
  try {
    // Get all connected clients
    const allClients = await clients.matchAll();
    
    if (allClients.length > 0) {
      // App is open, ask the main app to check
      console.log('📱 App is open, delegating to main app');
      allClients.forEach(client => {
        client.postMessage({
          type: 'BACKGROUND_CHECK_ANNIVERSARIES',
          timestamp: new Date().toISOString()
        });
      });
    } else {
      // App is closed, we can't run Supabase queries directly
      // Instead, we'll show a notification reminding about checks
      console.log('📱 App is closed, showing reminder');
      await self.registration.showNotification('PAPD Scheduler', {
        body: 'Daily anniversary check pending - open app to run check',
        icon: `${APP_PATH}icons/icon-192.png`,
        tag: 'anniversary-reminder',
        requireInteraction: false,
        data: {
          url: `${APP_PATH}#/dashboard`,
          type: 'reminder'
        }
      });
    }
  } catch (error) {
    console.error('❌ Error in background anniversary check:', error);
  }
}

// ========== MESSAGE HANDLING ==========

self.addEventListener('message', function(event) {
  console.log('📨 [Service Worker] Message from client:', event.data);
  
  const { type, data } = event.data || {};
  
  switch (type) {
    case 'SCHEDULE_ANNIVERSARY_CHECK':
      console.log('⏰ Scheduling background anniversary check');
      scheduleBackgroundCheck();
      break;
      
    case 'SEND_NOTIFICATION':
      console.log('📤 Sending notification from client:', data);
      self.registration.showNotification(data.title || 'Port Arthur PD', {
        body: data.body || '',
        icon: data.icon || `${APP_PATH}icons/icon-192.png`,
        data: data.data || {}
      });
      break;
      
    case 'TEST_NOTIFICATION':
      console.log('🧪 Test notification requested');
      self.registration.showNotification('Port Arthur PD Test', {
        body: 'This is a test notification from the service worker',
        icon: `${APP_PATH}icons/icon-192.png`,
        tag: 'test-notification',
        requireInteraction: false,
        data: {
          type: 'test',
          timestamp: new Date().toISOString(),
          url: `${APP_PATH}#/dashboard`
        }
      });
      break;
      
    case 'REGISTER_BACKGROUND_SYNC':
      console.log('🔄 Registering background sync');
      if ('sync' in self.registration) {
        self.registration.sync.register('anniversary-check')
          .then(() => {
            console.log('✅ Background sync registered');
            event.source.postMessage({
              type: 'SYNC_REGISTERED',
              success: true
            });
          })
          .catch(err => {
            console.error('❌ Background sync failed:', err);
            event.source.postMessage({
              type: 'SYNC_REGISTERED',
              success: false,
              error: err.message
            });
          });
      }
      break;
  }
});

// ========== FETCH HANDLING ==========

self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip Chrome extensions
  if (event.request.url.startsWith('chrome-extension://')) return;
  
  // Only handle requests within our app scope
  if (!event.request.url.includes('/scheduler/')) return;
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version if found
        if (response) {
          console.log('📦 Serving from cache:', event.request.url);
          return response;
        }
        
        // Otherwise fetch from network
        return fetch(event.request)
          .then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Cache the successful response
            const responseToCache = response.clone();
            caches.open(CURRENT_CACHES.prefetch)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // If offline and not in cache, show offline page
            if (event.request.mode === 'navigate') {
              return caches.match(`${APP_PATH}index.html`);
            }
          });
      })
  );
});

// ========== HELPER FUNCTIONS ==========

function scheduleBackgroundCheck() {
  // Simple background check scheduler
  // Note: Service workers can be terminated, so this is not reliable
  // For production, use Background Sync API
  setInterval(() => {
    console.log('⏰ Scheduled background check running');
    checkAnniversariesInBackground();
  }, 6 * 60 * 60 * 1000); // Check every 6 hours as fallback
}

console.log('👮 Port Arthur PD Scheduler PWA Service Worker v3 loaded for path:', APP_PATH);
