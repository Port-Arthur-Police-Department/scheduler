import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Clock } from "lucide-react";
import { TimeOffRequestDialog } from "./TimeOffRequestDialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { useWebsiteSettings } from "@/hooks/useWebsiteSettings"; // Add this import
import { Alert, AlertDescription } from "@/components/ui/alert"; // Add this import

interface TimeOffRequestsProps {
  userId: string;
  isAdminOrSupervisor: boolean;
}

export const TimeOffRequests = ({ userId, isAdminOrSupervisor }: TimeOffRequestsProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  
  // Add website settings hook
  const { data: settings } = useWebsiteSettings();

  // ... rest of your existing code remains the same until the return statement ...

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Time Off Requests
            </CardTitle>
            <CardDescription>
              {isAdminOrSupervisor ? "Manage all time off requests" : "View and submit your time off requests"}
            </CardDescription>
          </div>
          {!isAdminOrSupervisor && (
            <Button onClick={() => setDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          )}
        </div>
        
        {/* Add PTO status indicator */}
        {!isAdminOrSupervisor && !settings?.show_pto_balances && (
          <Alert className="mt-4 bg-blue-50 border-blue-200">
            <Clock className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              PTO balances are currently managed as indefinite. All time off requests are allowed.
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>
      
      {/* ... rest of your existing CardContent remains the same ... */}
    </Card>
  );
};
