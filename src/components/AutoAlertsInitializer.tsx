import { useAutoAlerts } from '@/hooks/useAutoAlerts';

export const AutoAlertsInitializer = () => {
  useAutoAlerts();
  return null; // This component doesn't render anything
};
