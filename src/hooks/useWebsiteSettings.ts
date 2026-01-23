// src/hooks/useWebsiteSettings.ts - SIMPLIFIED
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_LAYOUT_SETTINGS } from "@/constants/pdfLayoutSettings";
import { DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_COLORS, DEFAULT_PTO_VISIBILITY } from "@/components/admin/WebsiteSettings";

export const useWebsiteSettings = () => {
  return useQuery({
    queryKey: ['website-settings'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('website_settings')
          .select('*')
          .single();
        
        if (error) {
          // If no settings exist, return defaults
          if (error.code === 'PGRST116') {
            return {
              ...DEFAULT_NOTIFICATION_SETTINGS,
              color_settings: DEFAULT_COLORS,
              pto_type_visibility: DEFAULT_PTO_VISIBILITY,
              pdf_layout_settings: DEFAULT_LAYOUT_SETTINGS,
            };
          }
          throw error;
        }
        
        // Merge with defaults for any missing fields
        return {
          ...DEFAULT_NOTIFICATION_SETTINGS,
          ...DEFAULT_COLORS,
          ...DEFAULT_PTO_VISIBILITY,
          ...data,
          color_settings: { ...DEFAULT_COLORS, ...(data.color_settings || {}) },
          pto_type_visibility: { ...DEFAULT_PTO_VISIBILITY, ...(data.pto_type_visibility || {}) },
          pdf_layout_settings: { 
            ...DEFAULT_LAYOUT_SETTINGS, 
            ...(data.pdf_layout_settings || {}) 
          },
        };
      } catch (error) {
        console.error('Error fetching website settings:', error);
        // Return defaults on error
        return {
          ...DEFAULT_NOTIFICATION_SETTINGS,
          color_settings: DEFAULT_COLORS,
          pto_type_visibility: DEFAULT_PTO_VISIBILITY,
          pdf_layout_settings: DEFAULT_LAYOUT_SETTINGS,
        };
      }
    },
    retry: 2,
  });
};

export const useUpdateWebsiteSettings = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (settings: any) => {
      console.log('Saving settings to database:', settings);
      
      const { data, error } = await supabase
        .from('website_settings')
        .upsert({
          ...settings,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      return data;
    },
    onSuccess: (data) => {
      console.log('Settings saved successfully:', data);
      queryClient.setQueryData(['website-settings'], data);
      queryClient.invalidateQueries({ queryKey: ['website-settings'] });
    },
    onError: (error) => {
      console.error('Error saving settings:', error);
    }
  });
};
