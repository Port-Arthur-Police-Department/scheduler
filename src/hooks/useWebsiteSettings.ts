// src/hooks/useWebsiteSettings.ts - REVERT TO ORIGINAL
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_LAYOUT_SETTINGS } from "@/constants/pdfLayoutSettings";

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
            pto_balances_visible: false,
            pdf_layout_settings: DEFAULT_LAYOUT_SETTINGS
          };
        }
        throw error;
      }

      // Ensure pdf_layout_settings exists and has all required fields
      if (!data.pdf_layout_settings) {
        data.pdf_layout_settings = DEFAULT_LAYOUT_SETTINGS;
      } else {
        // Merge with defaults to ensure all properties exist
        data.pdf_layout_settings = {
          ...DEFAULT_LAYOUT_SETTINGS,
          ...data.pdf_layout_settings,
          fontSizes: {
            ...DEFAULT_LAYOUT_SETTINGS.fontSizes,
            ...data.pdf_layout_settings.fontSizes
          },
          sections: {
            ...DEFAULT_LAYOUT_SETTINGS.sections,
            ...data.pdf_layout_settings.sections
          },
          tableSettings: {
            ...DEFAULT_LAYOUT_SETTINGS.tableSettings,
            ...data.pdf_layout_settings.tableSettings
          },
          colorSettings: {
            ...DEFAULT_LAYOUT_SETTINGS.colorSettings,
            ...data.pdf_layout_settings.colorSettings
          }
        };
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
