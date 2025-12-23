export const testOneSignal = () => {
  console.log('🔍 Testing OneSignal configuration...');
  
  // Check if OneSignal is loaded
  if (typeof window.OneSignalDeferred === 'undefined') {
    console.error('❌ OneSignalDeferred not loaded. Check script loading.');
    return false;
  }
  
  console.log('✅ OneSignal scripts loaded');
  
  // Check service worker API support
  if (!('serviceWorker' in navigator)) {
    console.error('❌ Service Workers not supported');
    return false;
  }
  
  console.log('✅ Service Workers supported');
  
  // Check current URL
  console.log('📍 Current URL:', window.location.href);
  console.log('📍 Current pathname:', window.location.pathname);
  
  // Try to check service worker registration
  navigator.serviceWorker.getRegistrations().then(registrations => {
    console.log('🔧 Active Service Workers:', registrations.length);
    registrations.forEach(reg => {
      console.log(`  - ${reg.scope}`);
    });
    
    // Check for OneSignal worker
    const onesignalWorker = registrations.find(reg => 
      reg.scope.includes('OneSignal') || reg.active?.scriptURL?.includes('OneSignal')
    );
    
    if (onesignalWorker) {
      console.log('✅ OneSignal Service Worker found!');
      console.log(`  Scope: ${onesignalWorker.scope}`);
    } else {
      console.log('⚠️ No OneSignal Service Worker found');
    }
  });
  
  return true;
};

// Debug function to check environment
export const checkEnvironment = () => {
  console.log('🌍 Environment check:');
  console.log('  - Hostname:', window.location.hostname);
  console.log('  - Protocol:', window.location.protocol);
  console.log('  - HTTPS:', window.location.protocol === 'https:');
  console.log('  - App ID in env:', import.meta.env.VITE_ONESIGNAL_APP_ID?.substring(0, 10) + '...');
  console.log('  - Base URL:', import.meta.env.VITE_APP_URL);
};
