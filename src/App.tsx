// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { useIsMobile } from "./hooks/use-mobile";
import { UserProvider } from "@/contexts/UserContext";
import { QueryClientProvider } from "@/providers/QueryClientProvider";
import { useEffect, useState } from "react";
import { X, Download, Bell, Smartphone, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { backgroundTaskManager } from '@/utils/backgroundTaskManager';
import { setupDailyCheck } from '@/utils/scheduledTasks';

declare global {
  interface Window {
    deferredPrompt: any;
  }
}

// Helper function for VAPID key conversion (you'll need to generate and add your VAPID public key)
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const App = () => {
  const isMobile = useIsMobile();
  const [notificationStatus, setNotificationStatus] = useState<{
    permission: NotificationPermission;
    subscribed: boolean;
  }>({
    permission: 'default',
    subscribed: false
  });
  const [pwaStatus, setPwaStatus] = useState({
    isInstallable: false,
    isInstalled: false,
    serviceWorkerActive: false,
    hasManifest: false,
    deferredPrompt: null as any
  });
  const [showStatusPanel, setShowStatusPanel] = useState(true);
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null);
  const [showNotificationBanner, setShowNotificationBanner] = useState(false);
  const [subscriptionMessage, setSubscriptionMessage] = useState<string>('');
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [serviceWorkerRegistration, setServiceWorkerRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);

  // Save push subscription to database
  const savePushSubscription = async (subscription: PushSubscription) => {
    if (!currentUserId) return;

    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          subscription: JSON.stringify(subscription),
          user_id: currentUserId,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('❌ Failed to save push subscription:', error);
      } else {
        console.log('✅ Push subscription saved to database');
      }
    } catch (error) {
      console.error('❌ Error saving push subscription:', error);
    }
  };

  // Register for push notifications
  const registerForPushNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('❌ Push notifications not supported');
      return null;
    }

    try {
      // Check notification permission
      let permission = Notification.permission;
      
      if (permission === 'default') {
        console.log('🔔 Requesting notification permission...');
        permission = await Notification.requestPermission();
        setNotificationStatus(prev => ({ ...prev, permission }));
      }
      
      if (permission !== 'granted') {
        console.log('❌ Notification permission not granted:', permission);
        return null;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      setServiceWorkerRegistration(registration);

      // Check if already subscribed
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('✅ Already subscribed to push notifications');
        setPushSubscription(existingSubscription);
        await savePushSubscription(existingSubscription);
        return registration;
      }

      // Subscribe to push notifications (requires VAPID public key)
      // TODO: Replace with your actual VAPID public key
      const vapidPublicKey = 'YOUR_VAPID_PUBLIC_KEY_HERE'; // Generate this: web-push generate-vapid-keys
      
      // For development/testing without VAPID key, we'll skip subscription
      // but still show that we're ready for notifications
      if (!vapidPublicKey || vapidPublicKey === 'YOUR_VAPID_PUBLIC_KEY_HERE') {
        console.log('⚠️ VAPID key not configured. Push notifications will work only when app is open.');
        setNotificationStatus(prev => ({ ...prev, subscribed: true }));
        return registration;
      }

      try {
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });

        console.log('✅ Push subscription created:', subscription);
        setPushSubscription(subscription);
        setNotificationStatus(prev => ({ ...prev, subscribed: true }));
        await savePushSubscription(subscription);
        
        return registration;
      } catch (subscriptionError) {
        console.error('❌ Push subscription failed:', subscriptionError);
        // Fallback to service worker notifications without push
        setNotificationStatus(prev => ({ ...prev, subscribed: true }));
        return registration;
      }

    } catch (error) {
      console.error('❌ Push registration failed:', error);
      return null;
    }
  };

  // Initialize background tasks for PWA
  const initializeBackgroundTasks = async () => {
    if (pwaStatus.serviceWorkerActive && userLoggedIn) {
      console.log('🔄 Initializing background tasks for PWA');
      
      try {
        // Initialize background task manager
        await backgroundTaskManager.initialize();
        
        // Set up regular daily check for in-app notifications
        setupDailyCheck();
        
        // Register for background sync if available
        if (serviceWorkerRegistration && 'sync' in serviceWorkerRegistration) {
          try {
            await serviceWorkerRegistration.sync.register('anniversary-check');
            console.log('✅ Background sync registered');
          } catch (syncError) {
            console.warn('⚠️ Background sync not available:', syncError);
          }
        }
        
        // Send test notification for verification (development only)
        if (import.meta.env.DEV) {
          setTimeout(() => {
            if (serviceWorkerRegistration) {
              serviceWorkerRegistration.showNotification('PAPD Scheduler', {
                body: 'Background tasks are now active',
                icon: '/scheduler/icons/icon-192.png',
                tag: 'background-test',
                requireInteraction: false,
                data: {
                  type: 'test',
                  timestamp: new Date().toISOString(),
                  url: '/scheduler/#/dashboard'
                }
              }).then(() => {
                console.log('✅ Test notification sent');
              });
            }
          }, 3000);
        }
      } catch (error) {
        console.error('❌ Failed to initialize background tasks:', error);
      }
    }
  };

  // Auto-hide status panel after 10 seconds if everything is ready
  useEffect(() => {
    if (notificationStatus.permission === 'granted' && pwaStatus.serviceWorkerActive) {
      const timer = setTimeout(() => {
        setShowStatusPanel(false);
      }, 10000);
      
      setAutoHideTimer(timer);
      
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [notificationStatus.permission, pwaStatus.serviceWorkerActive]);

  // Check authentication status and manage PWA prompt
  useEffect(() => {
    const checkAuthAndManagePrompt = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const isAuthenticated = !!session;
      const userId = session?.user?.id || null;
      
      setUserLoggedIn(isAuthenticated);
      setCurrentUserId(userId);
      
      if (isAuthenticated && userId) {
        // Check if user has dismissed the prompt before
        const hasDismissedPrompt = localStorage.getItem(`pwa_prompt_dismissed_${userId}`);
        const hasSeenPromptThisSession = sessionStorage.getItem(`pwa_prompt_shown_${userId}`);
        
        // Only show if PWA is installable, not installed, not dismissed, and not shown this session
        if (pwaStatus.isInstallable && 
            !pwaStatus.isInstalled && 
            !hasDismissedPrompt && 
            !hasSeenPromptThisSession &&
            pwaStatus.serviceWorkerActive) {
          
          // Small delay to ensure user sees they're logged in first
          setTimeout(() => {
            setShowInstallPrompt(true);
            // Mark as shown for this session
            sessionStorage.setItem(`pwa_prompt_shown_${userId}`, 'true');
          }, 1500);
          
        } else {
          setShowInstallPrompt(false);
        }
        
        // Initialize background tasks for authenticated users
        initializeBackgroundTasks();
        
        // Register for push notifications
        if (pwaStatus.serviceWorkerActive) {
          registerForPushNotifications();
        }
      } else {
        // User is not logged in, hide the prompt
        setShowInstallPrompt(false);
      }
    };
    
    checkAuthAndManagePrompt();
  }, [pwaStatus.isInstallable, pwaStatus.isInstalled, pwaStatus.serviceWorkerActive]);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, 'User ID:', session?.user?.id);
        
        if (event === 'SIGNED_OUT') {
          // Clear session storage when user logs out
          const userId = session?.user?.id;
          if (userId) {
            sessionStorage.removeItem(`pwa_prompt_shown_${userId}`);
          }
          setCurrentUserId(null);
          setUserLoggedIn(false);
          setPushSubscription(null);
          setServiceWorkerRegistration(null);
          
          // Clean up background tasks
          backgroundTaskManager.destroy();
        } else if (event === 'SIGNED_IN') {
          // User just logged in
          console.log('User signed in, initializing PWA features');
          const userId = session?.user?.id;
          setCurrentUserId(userId);
          setUserLoggedIn(true);
          
          // Small delay to ensure other initialization is complete
          setTimeout(() => {
            if (pwaStatus.serviceWorkerActive) {
              initializeBackgroundTasks();
              registerForPushNotifications();
            }
          }, 1000);
        } else if (event === 'INITIAL_SESSION') {
          // Handle initial session
          const userId = session?.user?.id;
          setCurrentUserId(userId);
          setUserLoggedIn(!!session);
        }
        
        // Invalidate queries when user changes
        // (queryClient would need to be available here, you might need to lift it up)
      }
    );
    
    return () => {
      subscription.unsubscribe();
      // Clean up background tasks on unmount
      backgroundTaskManager.destroy();
    };
  }, []);

  // Enhanced PWA Status Check and Service Worker Registration
  useEffect(() => {
    console.log('📱 Initializing PWA functionality...');
    
    const checkPWAStatus = () => {
      // Check if installed
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isInWebAppiOS = (window.navigator as any).standalone === true;
      const isInstalled = isStandalone || isInWebAppiOS;
      
      // Check manifest
      const hasManifest = document.querySelector('link[rel="manifest"]') !== null;
      
      // Check service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(registration => {
          const serviceWorkerActive = !!registration?.active;
          
          setPwaStatus(prev => ({
            ...prev,
            isInstalled,
            serviceWorkerActive,
            hasManifest
          }));
          
          // If service worker is active, store the registration
          if (registration) {
            setServiceWorkerRegistration(registration);
          }
        });
      } else {
        setPwaStatus(prev => ({
          ...prev,
          isInstalled,
          hasManifest
        }));
      }
    };
    
    // Handle PWA install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      console.log('🎯 PWA install prompt event fired!');
      e.preventDefault();
      
      // Save the event for later use
      const deferredPrompt = e;
      setPwaStatus(prev => ({ 
        ...prev, 
        isInstallable: true,
        deferredPrompt
      }));
      
      // Also save to window for backup
      window.deferredPrompt = e;
      
      console.log('PWA is installable, will show prompt after login if not dismissed');
    };
    
    const handleAppInstalled = () => {
      console.log('✅ PWA installed successfully');
      setPwaStatus(prev => ({ 
        ...prev, 
        isInstallable: false, 
        isInstalled: true
      }));
      setShowInstallPrompt(false);
      window.deferredPrompt = null;
      
      toast.success("Police Scheduler installed successfully!");
      
      // Initialize background tasks after installation
      if (userLoggedIn) {
        initializeBackgroundTasks();
      }
    };
    
    // Register service workers for PWA
    const registerServiceWorkers = async () => {
      if (!('serviceWorker' in navigator)) {
        console.log('❌ Service Workers not supported');
        return;
      }
      
      try {
        // Try to register service worker for PWA
        try {
          const registration = await navigator.serviceWorker.register(
            '/scheduler/service-worker.js',
            { 
              scope: '/scheduler/',
              updateViaCache: 'none'
            }
          );
          console.log('✅ PWA Service Worker registered:', registration.scope);
          setServiceWorkerRegistration(registration);
          
          if (registration.active) {
            setPwaStatus(prev => ({ ...prev, serviceWorkerActive: true }));
          }
          
          // Listen for service worker messages
          navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('📨 Message from service worker:', event.data);
            
            if (event.data && event.data.type === 'SERVICE_WORKER_READY') {
              console.log('✅ Service worker ready:', event.data.message);
              setPwaStatus(prev => ({ ...prev, serviceWorkerActive: true }));
            }
          });
          
        } catch (error) {
          console.error('❌ PWA service worker registration failed:', error);
        }
        
      } catch (error) {
        console.error('❌ Service worker registration failed:', error);
      }
    };
    
    // Set up event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    // Initial checks
    checkPWAStatus();
    registerServiceWorkers();
    
    // Periodic checks
    const interval = setInterval(checkPWAStatus, 5000);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearInterval(interval);
    };
  }, []);

  // Browser Notification Initialization
  useEffect(() => {
    console.log('🔔 Setting up browser notifications...');
    
    const initializeNotifications = async () => {
      // Check browser permission
      const browserPermission = Notification.permission;
      console.log('🔔 Browser notification permission:', browserPermission);
      
      // Update state
      setNotificationStatus(prev => ({
        ...prev,
        permission: browserPermission
      }));
      
      // Check if user has already subscribed (stored in database)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('notification_subscribed')
          .eq('id', session.user.id)
          .single();
          
        if (profile?.notification_subscribed && browserPermission === 'granted') {
          setNotificationStatus(prev => ({
            ...prev,
            subscribed: true
          }));
          setShowNotificationBanner(false);
        } else if (browserPermission === 'default') {
          // Show banner if permission hasn't been requested yet
          setShowNotificationBanner(true);
        }
      }
    };
    
    initializeNotifications();
  }, []);

  // Trigger subscription prompt for browser notifications
  const triggerSubscriptionPrompt = async () => {
    console.log('🎯 Requesting browser notification permission...');
    
    // Show loading message
    setSubscriptionMessage('🔄 Requesting notification permission...');
    
    try {
      // Request browser permission
      const browserPermission = await Notification.requestPermission();
      console.log('Browser permission result:', browserPermission);
      
      if (browserPermission === 'granted') {
        // Browser permission granted
        setSubscriptionMessage('✅ Browser notifications enabled!');
        
        // Update state
        setNotificationStatus(prev => ({
          ...prev,
          permission: 'granted',
          subscribed: true
        }));
        
        // Store in database
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          await supabase
            .from('profiles')
            .update({ 
              notification_subscribed: true,
              notification_subscribed_at: new Date().toISOString(),
              notification_provider: 'browser'
            })
            .eq('id', session.user.id);
        }
        
        setShowNotificationBanner(false);
        
        // Register for push notifications if service worker is active
        if (pwaStatus.serviceWorkerActive) {
          await registerForPushNotifications();
        }
        
        // Show success message
        toast.success("Notifications enabled! You'll receive shift alerts.");
        
      } else if (browserPermission === 'denied') {
        setSubscriptionMessage('❌ Notifications blocked in browser settings');
        setNotificationStatus(prev => ({ ...prev, permission: 'denied' }));
        toast.error("Notifications blocked. Please enable them in browser settings.");
      } else {
        setSubscriptionMessage('❌ Notification permission not granted');
        setNotificationStatus(prev => ({ ...prev, permission: 'default' }));
      }
      
    } catch (error) {
      console.error('❌ Error requesting permission:', error);
      setSubscriptionMessage('❌ Failed to request permission');
      toast.error("Failed to enable notifications. Please try again.");
    }
    
    // Clear message after 3 seconds
    setTimeout(() => {
      setSubscriptionMessage('');
    }, 3000);
  };

  // Test notification function using service worker
  const testNotification = async () => {
    // Check permission first
    if (Notification.permission !== 'granted') {
      toast.error('You need to enable notifications first.');
      await triggerSubscriptionPrompt();
      return;
    }
    
    try {
      if (serviceWorkerRegistration) {
        // Use service worker for notification
        await serviceWorkerRegistration.showNotification('Port Arthur PD Test', {
          body: 'This is a test notification from the Police Department Scheduler',
          icon: '/scheduler/icons/icon-192.png',
          badge: '/scheduler/icons/badge-96.png',
          tag: 'test-notification',
          requireInteraction: false,
          data: {
            type: 'test',
            timestamp: new Date().toISOString(),
            url: '/scheduler/#/dashboard'
          }
        });
        
        toast.success("Test notification sent!");
      } else if ('Notification' in window && Notification.permission === 'granted') {
        // Fallback to browser notifications
        const notification = new Notification('Port Arthur PD Test', {
          body: 'This is a test notification from the Police Department Scheduler',
          icon: '/scheduler/icons/icon-192.png',
          tag: 'test-notification'
        });
        
        notification.onclick = () => {
          window.focus();
        };
        
        toast.success("Test notification sent via browser!");
      } else {
        toast.error("Notifications not available. Please enable them.");
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error("Failed to send test notification");
    }
  };

  // Send test push notification through service worker
  const testPushNotification = async () => {
    if (!serviceWorkerRegistration) {
      toast.error("Service worker not ready. Please refresh the page.");
      return;
    }
    
    try {
      // Send message to service worker to show test notification
      if (serviceWorkerRegistration.active) {
        serviceWorkerRegistration.active.postMessage({
          type: 'TEST_NOTIFICATION'
        });
        toast.success("Test push notification requested!");
      }
    } catch (error) {
      console.error('Error sending test push notification:', error);
      toast.error("Failed to send test push notification");
    }
  };

  // PWA install function
  const installPWA = async () => {
    console.log('📲 Attempting PWA installation...');
    
    // Check if already installed
    if (pwaStatus.isInstalled) {
      toast.info("App is already installed!");
      return;
    }
    
    // Check for deferred prompt
    const deferredPrompt = pwaStatus.deferredPrompt || window.deferredPrompt;
    
    if (deferredPrompt) {
      try {
        console.log('🔄 Showing installation prompt...');
        deferredPrompt.prompt();
        
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`✅ User choice: ${outcome}`);
        
        if (outcome === 'accepted') {
          console.log('🎉 User accepted PWA installation');
          toast.success("Police Scheduler is installing...");
        } else {
          console.log('❌ User dismissed PWA installation');
          // User chose "Not Now" - store dismissal preference
          if (currentUserId) {
            localStorage.setItem(`pwa_prompt_dismissed_${currentUserId}`, 'true');
          }
          toast.info("Installation canceled. You can install later from settings.");
        }
        
        // Clear the prompt and hide our custom prompt
        setPwaStatus(prev => ({ ...prev, deferredPrompt: null }));
        setShowInstallPrompt(false);
        window.deferredPrompt = null;
        
      } catch (error) {
        console.error('❌ Error during PWA installation:', error);
        showManualInstallInstructions();
      }
    } else {
      showManualInstallInstructions();
    }
  };

  // Handle dismissing the PWA prompt
  const handleDismissPrompt = async () => {
    if (currentUserId) {
      // Store dismissal preference for this user
      localStorage.setItem(`pwa_prompt_dismissed_${currentUserId}`, 'true');
    }
    
    setShowInstallPrompt(false);
    toast.info("You can install the app later from Settings.");
  };

  // Function to re-enable PWA prompt from settings
  const enablePwaPromptAgain = async () => {
    if (currentUserId) {
      localStorage.removeItem(`pwa_prompt_dismissed_${currentUserId}`);
      sessionStorage.removeItem(`pwa_prompt_shown_${currentUserId}`);
      toast.success("PWA install prompt will appear after your next login or page refresh.");
      
      // If PWA is installable, show prompt immediately
      if (pwaStatus.isInstallable && !pwaStatus.isInstalled) {
        setTimeout(() => {
          setShowInstallPrompt(true);
        }, 1000);
      }
    } else {
      toast.error("You need to be logged in to change this setting.");
    }
  };

  const showManualInstallInstructions = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    let message = '';
    let title = 'Install Police Scheduler';
    
    if (isIOS) {
      message = '1. Tap the Share button (⎋) at the bottom\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" in the top right';
    } else if (isAndroid) {
      message = '1. Tap the menu (⋮) in your browser\n2. Tap "Install app" or "Add to Home screen"\n3. Confirm the installation';
    } else {
      message = '1. Click the menu (⋮) in your browser\n2. Look for "Install Police Scheduler"\n3. Click to install';
      title = 'Install App';
    }
    
    toast(
      <div className="space-y-2">
        <div className="font-semibold">{title}</div>
        <div className="text-sm whitespace-pre-line">{message}</div>
      </div>,
      { duration: 10000 }
    );
  };

  const handleClosePanel = () => {
    setShowStatusPanel(false);
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
    }
  };

  const handleShowPanel = () => {
    setShowStatusPanel(true);
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
    }
    const newTimer = setTimeout(() => {
      setShowStatusPanel(false);
    }, 10000);
    setAutoHideTimer(newTimer);
  };

  // Only show in development mode
  const shouldShowPanel = import.meta.env.DEV && showStatusPanel;

  return (
    <QueryClientProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <UserProvider>
            
            {/* Subscription Status Message */}
            {subscriptionMessage && (
              <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md animate-slide-down">
                <div className={`p-4 rounded-lg shadow-lg ${
                  subscriptionMessage.includes('✅') 
                    ? 'bg-green-100 border border-green-300 text-green-800' 
                    : subscriptionMessage.includes('❌')
                    ? 'bg-red-100 border border-red-300 text-red-800'
                    : 'bg-blue-100 border border-blue-300 text-blue-800'
                }`}>
                  <div className="flex items-center gap-2">
                    {subscriptionMessage.includes('✅') && <CheckCircle className="h-5 w-5" />}
                    <span className="font-medium">{subscriptionMessage}</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Notification Subscription Banner */}
            {showNotificationBanner && !notificationStatus.subscribed && Notification.permission === 'default' && (
              <div className="fixed top-0 left-0 right-0 z-40 bg-blue-600 text-white p-4 shadow-lg">
                <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Bell className="h-6 w-6" />
                    <div>
                      <h3 className="font-bold">Police Department Notifications</h3>
                      <p className="text-sm opacity-90">Required for all officers to receive shift alerts and emergency notifications</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={triggerSubscriptionPrompt}
                      className="bg-white text-blue-600 hover:bg-gray-100 font-semibold"
                    >
                      Enable Notifications
                    </Button>
                    <Button
                      onClick={() => setShowNotificationBanner(false)}
                      variant="outline"
                      className="text-white border-white hover:bg-blue-700"
                    >
                      Not Now
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Custom PWA Install Prompt - Shows only after login */}
            {showInstallPrompt && userLoggedIn && pwaStatus.isInstallable && !pwaStatus.isInstalled && (
              <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-slide-up">
                <div className="bg-white rounded-lg shadow-xl border border-blue-200 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Smartphone className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">Install Police Scheduler</h3>
                        <p className="text-sm text-gray-600">Get quick access to your shifts - Recommended for all officers</p>
                      </div>
                    </div>
                    <button
                      onClick={handleDismissPrompt}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <span>Works offline when network is unavailable</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <span>Push notifications for shift changes</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <span>Quick access from home screen like an app</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <span>Background anniversary & birthday alerts</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={installPWA}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Install App
                    </Button>
                    <Button
                      onClick={handleDismissPrompt}
                      variant="outline"
                      className="flex-1"
                    >
                      Not Now
                    </Button>
                  </div>
                  
                  <p className="text-xs text-gray-500 mt-3">
                    For all 129+ officers • Secure HTTPS connection • Department approved
                  </p>
                </div>
              </div>
            )}
            
            {/* Status Indicator Panel */}
            {shouldShowPanel ? (
              <div style={{
                position: 'fixed',
                top: showNotificationBanner ? 80 : 10,
                right: 10,
                background: '#1e293b',
                color: 'white',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12px',
                zIndex: 9999,
                maxWidth: '280px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                border: '1px solid #334155',
                animation: 'slideInRight 0.3s ease-out'
              }}>
                <style>
                  {`
                    @keyframes slideInRight {
                      from {
                        transform: translateX(100%);
                        opacity: 0;
                      }
                      to {
                        transform: translateX(0);
                        opacity: 1;
                      }
                    }
                    @keyframes slide-up {
                      from {
                        transform: translateY(100%);
                        opacity: 0;
                      }
                      to {
                        transform: translateY(0);
                        opacity: 1;
                      }
                    }
                    @keyframes slide-down {
                      from {
                        transform: translateY(-100%);
                        opacity: 0;
                      }
                      to {
                        transform: translateY(0);
                        opacity: 1;
                      }
                    }
                    .animate-slide-up {
                      animation: slide-up 0.3s ease-out;
                    }
                    .animate-slide-down {
                      animation: slide-down 0.3s ease-out;
                    }
                  `}
                </style>
                
                {/* Close Button */}
                <button
                  onClick={handleClosePanel}
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}
                >
                  <X size={14} />
                </button>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', marginRight: '16px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: notificationStatus.permission === 'granted' ? '#10b981' : '#f59e0b'
                  }} />
                  <strong>Notifications:</strong> {notificationStatus.subscribed ? '✅ Enabled' : '❌ Disabled'}
                </div>
                
                <div style={{ marginBottom: '8px' }}>
                  <strong>Browser Permission:</strong> {Notification.permission}
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: pwaStatus.serviceWorkerActive ? '#10b981' : '#ef4444'
                  }} />
                  <strong>PWA:</strong> {pwaStatus.isInstalled ? '✅ Installed' : pwaStatus.serviceWorkerActive ? '📱 Ready' : '🔧 Setting up...'}
                </div>
                
                <div style={{ marginBottom: '8px' }}>
                  <strong>User Logged In:</strong> {userLoggedIn ? '✅ Yes' : '❌ No'}
                </div>
                
                <div style={{ marginBottom: '12px' }}>
                  <strong>Service Worker:</strong> {serviceWorkerRegistration ? '✅ Active' : '❌ Not Ready'}
                </div>
                
                <div style={{ marginBottom: '12px' }}>
                  <strong>Prompt Status:</strong> {showInstallPrompt ? '🟡 Showing' : '⚫ Hidden'}
                </div>
                
                {/* Action buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button
                    onClick={triggerSubscriptionPrompt}
                    style={{
                      background: notificationStatus.subscribed ? '#10b981' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      width: '100%',
                      fontWeight: 'bold'
                    }}
                  >
                    {notificationStatus.subscribed ? '✅ Notifications Enabled' : '🔔 Enable Notifications'}
                  </button>
                  
                  <button
                    onClick={testNotification}
                    style={{
                      background: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                    disabled={Notification.permission !== 'granted'}
                  >
                    Test Browser Notification
                  </button>
                  
                  <button
                    onClick={testPushNotification}
                    style={{
                      background: '#ec4899',
                      color: 'white',
                      border: 'none',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                    disabled={!serviceWorkerRegistration}
                  >
                    Test Push Notification
                  </button>
                  
                  {pwaStatus.isInstallable && !pwaStatus.isInstalled && (
                    <button
