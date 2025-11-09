import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download } from 'lucide-react';
import { toast } from 'sonner';

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      // Show the install prompt
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast.success('PAPD Scheduler installed successfully!');
    } else {
      toast.info('You can always install the app later from your browser menu.');
    }
    
    // Clear the saved prompt since it can't be used again
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setDeferredPrompt(null);
    setShowPrompt(false);
    toast.info('You can install the app later from your browser menu.');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm bg-card border border-border rounded-lg shadow-lg p-4 z-50 animate-in slide-in-from-bottom-5">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-sm">Install PAPD Scheduler</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Install this app for a better experience. It works offline and loads faster.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="h-6 w-6 p-0"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex gap-2 mt-3">
        <Button
          onClick={handleInstall}
          size="sm"
          className="flex-1"
        >
          <Download className="h-4 w-4 mr-2" />
          Install
        </Button>
        <Button
          variant="outline"
          onClick={handleDismiss}
          size="sm"
        >
          Later
        </Button>
      </div>
    </div>
  );
}