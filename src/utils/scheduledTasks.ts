import { checkAnniversariesAndBirthdays } from './anniversaryChecker';
import { backgroundTaskManager } from './backgroundTaskManager';

export const setupScheduledTasks = () => {
  const now = new Date();
  const targetTime = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    8, 0, 0 // 8:00 AM
  );
  
  if (now > targetTime) {
    targetTime.setDate(targetTime.getDate() + 1);
  }
  
  const delay = targetTime.getTime() - now.getTime();
  
  setTimeout(() => {
    // Run check
    checkAnniversariesAndBirthdays();
    
    // Schedule next check
    setInterval(checkAnniversariesAndBirthdays, 24 * 60 * 60 * 1000);
  }, delay);
  
  console.log(`📅 Scheduled anniversary check for ${targetTime.toLocaleString()}`);
};

export const setupDailyCheck = () => {
  console.log('📅 Setting up daily checks');
  
  // Check immediately on load
  checkAnniversariesAndBirthdays();
  
  // Then check every 24 hours
  const dailyCheckInterval = setInterval(checkAnniversariesAndBirthdays, 24 * 60 * 60 * 1000);
  
  // Return cleanup function
  return () => {
    clearInterval(dailyCheckInterval);
  };
};

// New function specifically for PWA background
export const setupPWABackgroundTasks = () => {
  console.log('📱 Setting up PWA background tasks');
  
  // Try to register for periodic background sync
  if ('periodicSync' in (navigator as any)) {
    (navigator as any).periodicSync.register('anniversary-sync', {
      minInterval: 24 * 60 * 60 * 1000, // 24 hours minimum
    }).then(() => {
      console.log('✅ Periodic background sync registered');
    }).catch(err => {
      console.warn('⚠️ Periodic background sync not supported:', err);
    });
  }
  
  // Use background fetch for iOS
  if ('backgroundFetch' in (navigator as any)) {
    (navigator as any).backgroundFetch.fetch('anniversary-fetch', ['/api/anniversary-check'], {
      title: 'Police Department Anniversary Check',
      downloadTotal: 1024, // 1KB
    }).then(backgroundFetch => {
      console.log('✅ Background fetch registered:', backgroundFetch.id);
    }).catch(err => {
      console.warn('⚠️ Background fetch not available:', err);
    });
  }
};
