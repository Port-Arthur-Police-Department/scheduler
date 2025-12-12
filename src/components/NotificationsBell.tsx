// components/NotificationsBell.tsx - UPDATED WITH CLEAR READ NOTIFICATIONS
import { useState } from "react";
import { Bell, Check, X, Clock, Trash2 } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const NotificationsBell = () => {
  // All hooks at top level
  const [open, setOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
  const { 
    inAppNotifications, 
    notificationsLoading, 
    unreadCount, 
    markAsRead, 
    markAllAsRead,
    isEnabled,
    requestPermission,
    userId 
  } = useNotifications(); 

  const handleBellClick = async () => {
    if (!isEnabled) {
      const granted = await requestPermission();
      if (!granted) {
        return;
      }
    }
    setOpen(!open);
  };

  const handleNotificationClick = (notificationId: string) => {
    markAsRead(notificationId);
    // You can add navigation logic here based on notification type
  };

  const handleClearReadNotifications = async () => {
    if (!userId) {
      toast.error("User not authenticated");
      return;
    }

    // Get count of read notifications before clearing
    const readNotifications = inAppNotifications?.filter(n => n.is_read) || [];
    
    if (readNotifications.length === 0) {
      toast.info("No read notifications to clear");
      return;
    }

    setIsClearing(true);
    
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId)
        .eq('is_read', true);

      if (error) {
        console.error('Error clearing read notifications:', error);
        toast.error("Failed to clear notifications");
      } else {
        toast.success(`Cleared ${readNotifications.length} read notification${readNotifications.length > 1 ? 's' : ''}`);
        
        // Force refetch of notifications
        window.location.reload(); // Simple refresh to update the list
      }
    } catch (error) {
      console.error('Error clearing notifications:', error);
      toast.error("Failed to clear notifications");
    } finally {
      setIsClearing(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'pto_request':
        return <Clock className="h-4 w-4" />;
      case 'pto_status':
        return <Check className="h-4 w-4" />;
      case 'manual_alert':
        return <Bell className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'pto_request':
        return "bg-blue-50 border-blue-200";
      case 'pto_status':
        return "bg-green-50 border-green-200";
      case 'manual_alert':
        return "bg-orange-50 border-orange-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  // Count read notifications
  const readCount = inAppNotifications?.filter(n => n.is_read).length || 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          onClick={handleBellClick}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => markAllAsRead()}
                className="text-xs"
              >
                Mark all as read
              </Button>
            )}
          </div>
        </div>
        
        <ScrollArea className="h-[400px]">
          {notificationsLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading notifications...
            </div>
          ) : !inAppNotifications || inAppNotifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="p-1">
              {inAppNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-3 border-b cursor-pointer transition-colors hover:bg-accent",
                    getNotificationColor(notification.type),
                    !notification.is_read && "font-medium"
                  )}
                  onClick={() => handleNotificationClick(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{notification.title}</p>
                        {!notification.is_read && (
                          <div className="h-2 w-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {/* Only show clear button if there are read notifications */}
        {readCount > 0 && (
          <div className="p-3 border-t">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full" 
              onClick={handleClearReadNotifications}
              disabled={isClearing}
            >
              {isClearing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600 mr-2" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Read Notifications ({readCount})
                </>
              )}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
