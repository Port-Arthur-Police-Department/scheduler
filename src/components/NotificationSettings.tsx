import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Settings, CheckCircle, AlertCircle } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

export const NotificationSettings: React.FC = () => {
  const {
    isSupported,
    permission,
    isEnabled,
    requestPermission,
    testNotification,
    notificationService
  } = useNotifications();

  const [shiftReminders, setShiftReminders] = useState(true);
  const [scheduleUpdates, setScheduleUpdates] = useState(true);
  const [emergencyAlerts, setEmergencyAlerts] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    try {
      const granted = await requestPermission();
      if (granted) {
        testNotification();
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = () => {
    testNotification();
  };

  if (!isSupported) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Notifications Not Supported
          </CardTitle>
          <CardDescription>
            Your browser doesn't support notifications or service workers.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Notification Settings
        </CardTitle>
        <CardDescription>
          Manage your notification preferences for the PAPD Scheduler
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Permission Status */}
        {permission === 'default' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Enable Notifications</AlertTitle>
            <AlertDescription>
              Allow notifications to receive important updates about your schedule.
            </AlertDescription>
          </Alert>
        )}

        {permission === 'denied' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Notifications Blocked</AlertTitle>
            <AlertDescription>
              Notifications are blocked. Please enable them in your browser settings.
            </AlertDescription>
          </Alert>
        )}

        {permission === 'granted' && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Notifications Enabled</AlertTitle>
            <AlertDescription className="text-green-700">
              You're all set to receive notifications!
            </AlertDescription>
          </Alert>
        )}

        {/* Enable/Disable Button */}
        {permission !== 'granted' && (
          <Button
            onClick={handleEnableNotifications}
            disabled={isLoading}
            className="w-full"
            variant="default"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Enabling...
              </>
            ) : (
              <>
                <Bell className="h-4 w-4 mr-2" />
                Enable Notifications
              </>
            )}
          </Button>
        )}

        {/* Notification Preferences */}
        {isEnabled && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium">Notification Preferences</h3>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="font-medium">Shift Reminders</label>
                <p className="text-sm text-muted-foreground">
                  Get notified 30 minutes before your shift starts
                </p>
              </div>
              <Switch
                checked={shiftReminders}
                onCheckedChange={setShiftReminders}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="font-medium">Schedule Updates</label>
                <p className="text-sm text-muted-foreground">
                  Get notified when your schedule changes
                </p>
              </div>
              <Switch
                checked={scheduleUpdates}
                onCheckedChange={setScheduleUpdates}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="font-medium">Emergency Alerts</label>
                <p className="text-sm text-muted-foreground">
                  Important department-wide notifications
                </p>
              </div>
              <Switch
                checked={emergencyAlerts}
                onCheckedChange={setEmergencyAlerts}
              />
            </div>

            <Button
              onClick={handleTestNotification}
              variant="outline"
              className="w-full mt-4"
            >
              <Bell className="h-4 w-4 mr-2" />
              Test Notification
            </Button>
          </div>
        )}

        {/* PWA Info */}
        <div className="pt-4 border-t">
          <h3 className="font-medium mb-2">App Features</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Works offline when installed</li>
            <li>• Push notifications for schedule updates</li>
            <li>• Install as a desktop or mobile app</li>
            <li>• Background sync when connection is restored</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};