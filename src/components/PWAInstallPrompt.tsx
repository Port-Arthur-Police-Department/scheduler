// src/components/PWAInstallPrompt.tsx
import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const checkIfInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isInWebAppiOS = (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone || isInWebAppiOS);
    };

    checkIfInstalled();

    // Handle beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
      console.log('📱 PWA install prompt available');
    };

    // Handle app installed event
    const handleAppInstalled = () => {
      setIsInstallable(false);
      setIsInstalled(true);
      console.log('✅ PWA installed successfully');
    };

    // Check PWA criteria
    const checkPWAEligibility = () => {
      // Check if PWA criteria are met
      const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
      const hasServiceWorker = 'serviceWorker' in navigator;
      const hasManifest = document.querySelector('link[rel="manifest"]') !== null;
      
      console.log('📱 PWA Eligibility Check:', {
        isSecure,
        hasServiceWorker,
        hasManifest,
        displayMode: window.matchMedia('(display-mode: standalone)').matches
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    // Run eligibility check after load
    setTimeout(checkPWAEligibility, 2000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // In your PWAInstallPrompt component, update the install click handler:
const handleInstallClick = async () => {
  const deferredPrompt = (window as any).deferredPrompt;
  if (!deferredPrompt) return;

  // Show the install prompt
  deferredPrompt.prompt();
  
  // Wait for the user to respond to the prompt
  const { outcome } = await deferredPrompt.userChoice;
  
  if (outcome === 'accepted') {
    console.log('✅ User accepted the PWA install');
    // Handle successful installation
  } else {
    console.log('❌ User dismissed the PWA install');
  }
  
  // Clear the saved prompt
  (window as any).deferredPrompt = null;
};

  const handleCheckServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log('🔍 Service Worker Status:', {
        count: registrations.length,
        registrations: registrations.map(r => ({
          scope: r.scope,
          active: !!r.active
        }))
      });
      
      // Force update service worker
      registrations.forEach(reg => {
        reg.update();
      });
    }
  };

  // Don't show if already installed or not installable
  if (isInstalled || !isInstallable) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
      color: 'white',
      padding: '16px',
      borderRadius: '12px',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
      zIndex: 1000,
      maxWidth: '320px',
      animation: 'slideInUp 0.3s ease-out'
    }}>
      <style>
        {`
          @keyframes slideInUp {
            from {
              transform: translateY(100%);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}
      </style>
      
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: '12px',
          fontSize: '20px'
        }}>
          📱
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
            Install Police Scheduler
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', opacity: 0.9 }}>
            Access quickly from your home screen
          </p>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
        <button
          onClick={handleInstallClick}
          style={{
            flex: 1,
            background: 'white',
            color: '#1e40af',
            border: 'none',
            padding: '10px',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          Install App
        </button>
        
        <button
          onClick={() => setIsInstallable(false)}
          style={{
            background: 'transparent',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '10px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Later
        </button>
      </div>
      
      {/* Debug button for development */}
      {import.meta.env.DEV && (
        <button
          onClick={handleCheckServiceWorker}
          style={{
            marginTop: '10px',
            background: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            border: '1px dashed rgba(255, 255, 255, 0.3)',
            padding: '6px',
            borderRadius: '6px',
            fontSize: '11px',
            cursor: 'pointer',
            width: '100%'
          }}
        >
          Debug Service Worker
        </button>
      )}
    </div>
  );
};
