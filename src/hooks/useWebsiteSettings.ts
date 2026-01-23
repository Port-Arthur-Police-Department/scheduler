// src/hooks/useWebsiteSettings.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_LAYOUT_SETTINGS } from "@/constants/pdfLayoutSettings";
import { DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_COLORS, DEFAULT_PTO_VISIBILITY } from "@/components/admin/WebsiteSettings";

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
            ...DEFAULT_NOTIFICATION_SETTINGS,
            color_settings: DEFAULT_COLORS,
            pto_type_visibility: DEFAULT_PTO_VISIBILITY,
            pdf_layout_settings: DEFAULT_LAYOUT_SETTINGS,
          };
        }
        throw error;
      }

      // Create a base object with all DEFAULT_NOTIFICATION_SETTINGS
      const baseSettings = { ...DEFAULT_NOTIFICATION_SETTINGS };
      
      // Merge database data on top of defaults
      const mergedData = {
        ...baseSettings,
        ...data,
        // Ensure nested objects are properly merged
        color_settings: { ...DEFAULT_COLORS, ...(data.color_settings || {}) },
        pto_type_visibility: { ...DEFAULT_PTO_VISIBILITY, ...(data.pto_type_visibility || {}) }
      };
      
      // Ensure pdf_layout_settings exists and has all defaults
      if (!mergedData.pdf_layout_settings) {
        mergedData.pdf_layout_settings = DEFAULT_LAYOUT_SETTINGS;
      } else {
        // Deep merge with defaults
        mergedData.pdf_layout_settings = {
          ...DEFAULT_LAYOUT_SETTINGS,
          ...mergedData.pdf_layout_settings,
          fontSizes: {
            ...DEFAULT_LAYOUT_SETTINGS.fontSizes,
            ...(mergedData.pdf_layout_settings.fontSizes || {})
          },
          sections: {
            ...DEFAULT_LAYOUT_SETTINGS.sections,
            ...(mergedData.pdf_layout_settings.sections || {})
          },
          tableSettings: {
            ...DEFAULT_LAYOUT_SETTINGS.tableSettings,
            ...(mergedData.pdf_layout_settings.tableSettings || {})
          },
          colorSettings: {
            ...DEFAULT_LAYOUT_SETTINGS.colorSettings,
            ...(mergedData.pdf_layout_settings.colorSettings || {})
          }
        };
      }
      
      return mergedData;
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
