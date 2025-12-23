// Manual service worker registration for GitHub Pages subdirectory
export const registerOneSignalWorker = () => {
  if (!('serviceWorker' in navigator)) {
    console.error('❌ Service Workers not supported');
    return false;
  }

  const isGithubPages = window.location.hostname.includes('github.io');
  const currentPath = window.location.pathname;
  
  console.log('🔧 Manual Service Worker Registration:', {
    isGithubPages,
    currentPath,
    hostname: window.location.hostname
  });

  // Try multiple service worker paths
  const workerPaths = [
    '/scheduler/OneSignalSDKWorker.js',
    '/OneSignalSDKWorker.js',
    'OneSignalSDKWorker.js'
  ];

  const scopes = [
    '/scheduler/',
    '/'
  ];

  const attemptRegistration = async (path, scope) => {
    try {
      console.log(`🔄 Attempting to register: ${path} with scope: ${scope}`);
      
      const registration = await navigator.serviceWorker.register(path, {
        scope: scope,
        updateViaCache: 'none'
      });
      
      console.log(`✅ Service Worker registered:`, {
        scope: registration.scope,
        state: registration.active?.state,
        scriptURL: registration.active?.scriptURL
      });
      
      return registration;
    } catch (error) {
      console.error(`❌ Failed to register ${path}:`, error.message);
      return null;
    }
  };

  // Try all combinations
  const attempts = [];
  for (const path of workerPaths) {
    for (const scope of scopes) {
      attempts.push(attemptRegistration(path, scope));
    }
  }

  return Promise.any(attempts).then(registration => {
    if (registration) {
      console.log('🎉 Service Worker successfully registered!');
      
      // Store for debugging
      window.oneSignalRegistration = registration;
      
      // Dispatch event for OneSignal
      window.dispatchEvent(new CustomEvent('onesignal-worker-registered', {
        detail: { registration }
      }));
      
      return registration;
    }
    
    console.error('❌ All registration attempts failed');
    return null;
  }).catch(error => {
    console.error('❌ All registration attempts failed:', error);
    return null;
  });
};

// Add to window for debugging
window.registerOneSignalWorker = registerOneSignalWorker;
