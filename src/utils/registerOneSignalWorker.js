// src/utils/registerOneSignalWorker.js

/**
 * Manual service worker registration for OneSignal in GitHub Pages subdirectory
 * This addresses the 404 errors when OneSignal tries to register from root
 */

export const registerOneSignalWorker = async () => {
  console.log('🔧 [registerOneSignalWorker] Starting manual registration...');
  
  if (!('serviceWorker' in navigator)) {
    console.error('❌ Service Workers not supported');
    return false;
  }

  try {
    // Get current path info
    const isGithubPages = window.location.hostname.includes('github.io');
    const hasSchedulerPath = window.location.pathname.includes('/scheduler');
    const basePath = hasSchedulerPath ? '/scheduler' : '';
    
    console.log('📍 Path info:', { isGithubPages, hasSchedulerPath, basePath });

    // Clear any existing registrations first
    const registrations = await navigator.serviceWorker.getRegistrations();
    console.log(`📋 Found ${registrations.length} existing service workers`);
    
    for (const registration of registrations) {
      console.log(`🗑️ Unregistering: ${registration.scope}`);
      await registration.unregister();
    }

    // Try different service worker paths
    const workerPaths = [
      // Primary: subdirectory path for GitHub Pages
      `${basePath}/OneSignalSDKWorker.js`,
      `${basePath}/service-worker.js`,
      
      // Secondary: root paths (some browsers might require this)
      '/OneSignalSDKWorker.js',
      '/service-worker.js',
      
      // Fallback: full URLs
      `${window.location.origin}${basePath}/OneSignalSDKWorker.js`,
      `${window.location.origin}${basePath}/service-worker.js`
    ];

    const scopes = [
      `${basePath}/`,
      '/'
    ];

    let registrationSuccessful = false;
    
    // Try each combination of path and scope
    for (const workerPath of workerPaths) {
      for (const scope of scopes) {
        try {
          console.log(`🔄 Attempting registration: path=${workerPath}, scope=${scope}`);
          
          const registration = await navigator.serviceWorker.register(workerPath, {
            scope: scope,
            updateViaCache: 'none'
          });
          
          console.log(`✅ Successfully registered worker:`, {
            scope: registration.scope,
            scriptURL: registration.active?.scriptURL || 'Not active yet',
            workerPath
          });
          
          registrationSuccessful = true;
          
          // Set up update found handler
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  console.log('🔄 Service worker updated');
                }
              };
            }
          };
          
          break; // Stop trying combinations if successful
        } catch (error) {
          console.log(`❌ Failed with path=${workerPath}, scope=${scope}:`, error.message);
          // Continue to next combination
        }
      }
      
      if (registrationSuccessful) break;
    }

    if (!registrationSuccessful) {
      console.error('❌ All registration attempts failed');
      return false;
    }

    // Check if OneSignal is available and reconfigure it
    if (window.OneSignal && window.OneSignal.init) {
      console.log('⚙️ Reconfiguring OneSignal with correct paths...');
      
      try {
        window.OneSignal.init({
          appId: import.meta.env.VITE_ONESIGNAL_APP_ID || "3417d840-c226-40ba-92d6-a7590c31eef3",
          safari_web_id: "web.onesignal.auto.1d0d9a2a-074d-4411-b3af-2aed688566e1",
          serviceWorkerPath: `${basePath}/OneSignalSDKWorker.js`,
          serviceWorkerParam: { scope: `${basePath}/` },
          allowLocalhostAsSecureOrigin: true,
          autoResubscribe: true,
        });
        
        console.log('✅ OneSignal reconfigured successfully');
      } catch (initError) {
        console.error('❌ Failed to reconfigure OneSignal:', initError);
      }
    }

    return true;
    
  } catch (error) {
    console.error('❌ Error in registerOneSignalWorker:', error);
    return false;
  }
};

/**
 * Check if we have OneSignal 404 errors
 */
export const hasOneSignal404Errors = () => {
  try {
    // Check performance entries for 404 errors
    const resources = performance.getEntriesByType('resource');
    let has404 = false;
    
    resources.forEach(entry => {
      const resource = entry;
      const isOneSignalResource = resource.name.includes('OneSignal') || 
                                  resource.name.includes('service-worker') ||
                                  resource.name.includes('onesignal');
      
      // Check if it's a OneSignal-related resource and had an error
      if (isOneSignalResource) {
        console.log(`📊 Resource: ${resource.name}`, {
          transferSize: resource.transferSize,
          initiatorType: resource.initiatorType,
          duration: resource.duration,
          name: resource.name
        });
        
        // Indicators of 404 errors
        const is404 = resource.transferSize === 0 || 
                     resource.duration < 10 ||
                     (resource.duration > 0 && resource.transferSize === 0);
        
        if (is404) {
          console.error(`❌ Possible 404 for: ${resource.name}`);
          has404 = true;
        }
      }
    });
    
    return has404;
  } catch (error) {
    console.error("❌ Error checking for 404s:", error);
    return false;
  }
};

/**
 * Create a fallback service worker file in the public directory
 * This should be called during build time
 */
export const createFallbackServiceWorker = () => {
  const fallbackCode = `// Fallback service worker for OneSignal compatibility
console.log('[Service Worker] Fallback worker loaded for GitHub Pages');

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass through all fetches
  event.respondWith(fetch(event.request));
});

// Import OneSignal SDK if available
try {
  importScripts('https://cdn.onesignal.com/sdks/onesignal/v16-webSDK.sw.js');
  console.log('[Service Worker] OneSignal SDK imported successfully');
} catch (error) {
  console.log('[Service Worker] OneSignal SDK not available, running in fallback mode');
}`;

  return fallbackCode;
};

// Export a default object for convenience
export default {
  registerOneSignalWorker,
  hasOneSignal404Errors,
  createFallbackServiceWorker
};
