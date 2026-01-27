// src/hooks/useWebsiteSettings.ts - UPDATED VERSION
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
          .single();
        
        if (error) {
          // If no settings exist yet, return default values
          if (error.code === 'PGRST116') {
            return {
              enable_notifications: false,
              show_pto_balances: false,
              pto_balances_visible: false,
              pdf_layout_settings: DEFAULT_LAYOUT_SETTINGS,
              show_staffing_overview: true,
              show_pto_tab: true,
              enable_anniversary_alerts: false,
              enable_birthday_alerts: false,
              anniversary_alert_recipients: ["admin", "supervisor"],
              enable_events_dashboard: false,
              show_special_occasions_in_schedule: true, // Default to true
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
        
        // Ensure new fields have defaults if not present
        if (data.show_special_occasions_in_schedule === undefined) {
          data.show_special_occasions_in_schedule = true;
        }
        if (data.enable_events_dashboard === undefined) {
          data.enable_events_dashboard = false;
        }
        
        return data;
      } catch (error) {
        console.error('Error in useWebsiteSettings:', error);
        // Return default structure on error
        return {
          enable_notifications: false,
          show_pto_balances: false,
          pto_balances_visible: false,
          pdf_layout_settings: DEFAULT_LAYOUT_SETTINGS,
          show_staffing_overview: true,
          show_pto_tab: true,
          enable_anniversary_alerts: false,
          enable_birthday_alerts: false,
          anniversary_alert_recipients: ["admin", "supervisor"],
          enable_events_dashboard: false,
          show_special_occasions_in_schedule: true, // Default to true
        };
      }
    }
  });
};

export const useUpdateWebsiteSettings = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (settings: any) => {
      console.log('useUpdateWebsiteSettings: Saving settings with ID:', settings?.id);
      
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
