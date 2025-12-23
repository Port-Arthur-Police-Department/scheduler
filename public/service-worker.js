// Main service worker for the scheduler app
console.log('[Service Worker] Police Department Scheduler loaded');

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(clients.claim());
});

// Import OneSignal SDK
try {
  importScripts('https://cdn.onesignal.com/sdks/onesignal/v16-webSDK.sw.js');
  console.log('[Service Worker] OneSignal SDK imported');
} catch (error) {
  console.error('[Service Worker] Failed to import OneSignal SDK:', error);
}
