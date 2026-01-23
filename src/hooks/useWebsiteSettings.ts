// src/hooks/useWebsiteSettings.ts - FIXED VERSION
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_LAYOUT_SETTINGS } from "@/constants/pdfLayoutSettings";

export const useWebsiteSettings = () => {
  return useQuery({
    queryKey: ['website-settings'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('website_settings')
          .select('*')
          .limit(1)
          .maybeSingle(); // Use maybeSingle instead of single
        
        if (error) {
          console.error('Error fetching website settings:', error);
          throw error;
        }
        
        // If no settings exist, return null
        if (!data) {
          return null;
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
      } catch (error) {
        console.error('Error in useWebsiteSettings:', error);
        // Return a default structure on error
        return {
          enable_notifications: false,
          show_pto_balances: false,
          pto_balances_visible: false,
          pdf_layout_settings: DEFAULT_LAYOUT_SETTINGS,
          show_pto_tab: true,
          show_staffing_overview: true,
        };
      }
    }
  });
};

export const useUpdateWebsiteSettings = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (settings: any) => {
      console.log('Updating settings:', settings);
      
      const { data, error } = await supabase
        .from('website_settings')
        .upsert(settings, {
          onConflict: 'id'
        })
        .select()
        .single();
      
      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website-settings'] });
    }
  });
};
