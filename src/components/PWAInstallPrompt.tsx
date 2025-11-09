import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Monitor } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallCard, setShowInstallCard] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if app is already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                      (window.navigator as any).standalone ||
                      document.referrer.includes('android-app://');
    
    setIsStandalone(standalone);
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));

    // Handle beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallCard(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if we should show install prompt (after 3 visits or 30 seconds)
    const visits = parseInt(localStorage.getItem('appVisits') || '0');
    const showPrompt = visits >= 3 || (Date.now() - parseInt(localStorage.getItem('firstVisit') || '0')) > 30000;
    
    if (!standalone && showPrompt && !localStorage.getItem('installPromptDismissed')) {
      const timer = setTimeout(() => {
        setShowInstallCard(true);
      }, 5000); // Show after 5 seconds
      
      return () => clearTimeout(timer);
    }

    // Update visit count
    localStorage.setItem('appVisits', (visits + 1).toString());
    if (!localStorage.getItem('firstVisit')) {
      localStorage.setItem('firstVisit', Date.now().toString());
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          console.log('User accepted the install prompt');
          setShowInstallCard(false);
          localStorage.setItem('installPromptDismissed', 'true');
        }
        
        setDeferredPrompt(null);
      } catch (error) {
        console.error('Install prompt failed:', error);
      }
    } else {
      // For iOS Safari - show instructions
      showIOSInstructions();
    }
  };

  const handleDismiss = () => {
    setShowInstallCard(false);
    localStorage.setItem('installPromptDismissed', 'true');
  };

  const showIOSInstructions = () => {
    alert('To install this app on iOS:\\n\\n1. Tap the share button (square with arrow up)\\n2. Scroll down and tap "Add to Home Screen"\\n3. Tap "Add" in the top right');
  };

  if (isStandalone || !showInstallCard) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom">
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Download className="h-5 w-5" />
              Install PAPD Scheduler
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Get the best experience with our mobile app
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-3">
          <Alert>
            <AlertDescription className="text-sm">
              <div className="flex items-start gap-2">
                {isIOS ? (
                  <Smartphone className="h-4 w-4 mt-0.5 flex-shrink-0" />
                ) : (
                  <Monitor className="h-4 w-4 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  {isIOS ? (
                    <>
                      <strong>iOS Users:</strong> Tap the share button and select "Add to Home Screen"
                    </>
                  ) : (
                    <>
                      <strong>Android/Desktop Users:</strong> Install this app for the best experience
                    </>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button
              onClick={handleInstallClick}
              className="flex-1"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              {isIOS ? 'Show Instructions' : 'Install App'}
            </Button>
            <Button
              variant="outline"
              onClick={handleDismiss}
              size="sm"
            >
              Maybe Later
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            Install to get:
            <span className="mx-1">•</span>Offline access
            <span className="mx-1">•</span>Push notifications
            <span className="mx-1">•</span>Faster loading
          </div>
        </CardContent>
      </Card>
    </div>
  );
};