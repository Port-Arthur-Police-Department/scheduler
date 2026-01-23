import { checkAnniversariesAndBirthdays } from './anniversaryChecker';

// Run once per day at 8:00 AM
export const setupScheduledTasks = () => {
  const now = new Date();
  const targetTime = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    8, 0, 0 // 8:00 AM
  );
  
  // If it's already past 8:00 AM today, schedule for tomorrow
  if (now > targetTime) {
    targetTime.setDate(targetTime.getDate() + 1);
  }
  
  const delay = targetTime.getTime() - now.getTime();
  
  setTimeout(() => {
    // Run the check
    checkAnniversariesAndBirthdays();
    
    // Schedule next check for 24 hours later
    setInterval(checkAnniversariesAndBirthdays, 24 * 60 * 60 * 1000);
  }, delay);
  
  console.log(`📅 Scheduled anniversary check for ${targetTime.toLocaleString()}`);
};

// Alternatively, use a simpler approach for testing
export const setupDailyCheck = () => {
  // Check immediately on load (for testing)
  checkAnniversariesAndBirthdays();
  
  // Then check every 24 hours
  setInterval(checkAnniversariesAndBirthdays, 24 * 60 * 60 * 1000);
};
