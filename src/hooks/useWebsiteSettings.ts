// src/hooks/useWebsiteSettings.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useWebsiteSettings = () => {
  return useQuery({
    queryKey: ['website-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('website_settings')
        .select('*')
        .single();
      
      if (error) {
        // If no settings exist yet, return default values
        if (error.code === 'PGRST116') {
          return {
            enable_notifications: false,
            show_pto_balances: false,
            pto_balances_visible: false
          };
        }
        throw error;
      }
      return data;
    }
  });
};

export const useUpdateWebsiteSettings = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (settings: any) => {
      const { data, error } = await supabase
        .from('website_settings')
        .upsert(settings)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website-settings'] });
    }
  });
};
