// src/components/admin/settings/SettingsInstructions.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const SettingsInstructions = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">How These Settings Work</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div>
          <strong>Mass Alert System:</strong> Controls the entire vacancy alert system including 
          "Create Manual Alert" and "Create All Alerts" buttons. When disabled, users cannot 
          send mass alerts or receive responses from them.
        </div>
        <div>
          <strong>Vacancy Alert Subscription Buttons:</strong> When disabled, users cannot 
          subscribe to vacancy alerts. Requires Mass Alert System to be enabled.
        </div>
        <div>
          <strong>Automated Notifications:</strong> Master switch for all automated notification 
          features (PTO requests, schedule changes, etc.). When disabled, no automated 
          notifications will be sent regardless of individual settings.
        </div>
        <div>
          <strong>Vacancy Alert Notifications:</strong> When enabled, automatically sends 
          notifications to subscribed users when vacancies occur. Requires Automated Notifications 
          to be enabled.
        </div>
        <div>
          <strong>PTO Request Notifications:</strong> Supervisors and administrators will receive 
          in-app notifications when officers submit new time off requests.
        </div>
        <div>
          <strong>PTO Status Notifications:</strong> Officers will receive in-app notifications 
          when their time off requests are approved or denied.
        </div>
        <div>
          <strong>Schedule Change Notifications:</strong> Users will be notified when their 
          schedule is modified by supervisors or administrators.
        </div>
        <div>
          <strong>Show Staffing Overview:</strong> When enabled, admin and supervisor users 
          will see the Staffing Overview section on their dashboard showing current shift 
          staffing levels. When disabled, this section is hidden.
        </div>
        <div>
          <strong>PTO Balances:</strong> When disabled, all PTO balance tracking is turned off. 
          Staff will have indefinite time off availability, and balance calculations are suspended.
        </div>
        <div>
          <strong>PTO Type Visibility:</strong> Control which types of PTO are displayed in the 
          monthly calendar view. This does not affect PTO assignment or balance tracking.
        </div>
        <div>
          <strong>Color Customization:</strong> Changes to colors will affect both PDF exports and 
          the weekly schedule display. Changes are saved automatically.
        </div>
      </CardContent>
    </Card>
  );
};
