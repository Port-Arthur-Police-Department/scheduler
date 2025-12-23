import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { alertNotifier } from '@/utils/alertNotifier';
import { useQueryClient } from '@tanstack/react-query';

export const useAutoAlerts = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to new vacancies
    const vacancySubscription = supabase
      .channel('vacancy-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vacancies', // Adjust table name as needed
        },
        (payload) => {
          console.log('New vacancy detected:', payload);
          alertNotifier.sendVacancyAlert(
            `New vacancy: ${payload.new.position} - ${payload.new.shift}`
          );
        }
      )
      .subscribe();

    // Subscribe to PTO requests
    const ptoSubscription = supabase
      .channel('pto-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pto_requests', // Adjust table name as needed
        },
        async (payload) => {
          console.log('New PTO request detected:', payload);
          
          // Get officer name
          const { data: officer } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', payload.new.officer_id)
            .single();

          const officerName = officer?.full_name || 'An officer';
          
          alertNotifier.sendPTOStatusAlert(
            payload.new.officer_id,
            'pending',
            `${officerName} submitted a ${payload.new.pto_type} request for ${new Date(payload.new.start_date).toLocaleDateString()}`
          );
        }
      )
      .subscribe();

    // Subscribe to schedule changes
    const scheduleSubscription = supabase
      .channel('schedule-alerts')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'schedules', // Adjust table name as needed
        },
        (payload) => {
          console.log('Schedule change detected:', payload);
          
          // Check if this is a significant change that warrants an alert
          const oldData = payload.old;
          const newData = payload.new;
          
          // Compare key fields that matter to officers
          const significantChanges = [
            'shift_id',
            'assignment',
            'status',
            'date'
          ].some(field => oldData[field] !== newData[field]);

          if (significantChanges) {
            alertNotifier.sendAlertToUsers(
              [newData.officer_id],
              'Schedule Updated',
              'Your schedule has been updated. Please check your weekly schedule.',
              'info'
            );
          }
        }
      )
      .subscribe();

    return () => {
      vacancySubscription.unsubscribe();
      ptoSubscription.unsubscribe();
      scheduleSubscription.unsubscribe();
    };
  }, [queryClient]);
};
