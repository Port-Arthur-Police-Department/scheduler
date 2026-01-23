// src/hooks/useWebsiteSettings.ts - FIXED VERSION
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
            pdf_layout_settings: DEFAULT_LAYOUT_SETTINGS,
            // Add new fields with defaults
            enable_anniversary_alerts: false,
            enable_birthday_alerts: false,
            anniversary_alert_recipients: ["admin", "supervisor"],
            // IMPORTANT: These should be true by default
            show_staffing_overview: true,
            show_pto_tab: true,
            // Other defaults
            enable_mass_alert_sending: true,
            enable_vacancy_alerts: true,
            enable_pto_request_notifications: true,
            enable_pto_status_notifications: true,
            enable_supervisor_pto_notifications: true,
            enable_schedule_change_notifications: true,
            show_vacancy_alert_buttons: true,
          };
        }
        throw error;
      }

      // CRITICAL FIX: Don't merge with defaults that override saved false values
      // Just ensure pdf_layout_settings has defaults
      if (!data.pdf_layout_settings) {
        data.pdf_layout_settings = DEFAULT_LAYOUT_SETTINGS;
      } else {
        // Only merge nested objects within pdf_layout_settings
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
      
      // Ensure color_settings and pto_type_visibility are objects
      if (!data.color_settings) {
        data.color_settings = {};
      }
      if (!data.pto_type_visibility) {
        data.pto_type_visibility = {};
      }
      
      // Ensure array fields exist
      if (!data.anniversary_alert_recipients) {
        data.anniversary_alert_recipients = ["admin", "supervisor"];
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
