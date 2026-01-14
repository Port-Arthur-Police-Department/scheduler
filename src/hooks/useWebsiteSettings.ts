// src/hooks/useWebsiteSettings.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ADD THIS: Default layout settings constant
export const DEFAULT_LAYOUT_SETTINGS = {
  fontSizes: {
    header: 10,
    sectionTitle: 9,
    tableHeader: 7,
    tableContent: 7,
    footer: 7
  },
  sections: {
    showSupervisors: true,
    showOfficers: true,
    showSpecialAssignments: true,
    showPTO: true,
    showStaffingSummary: true
  },
  tableSettings: {
    rowHeight: 8,
    cellPadding: 3,
    showRowStriping: true,
    compactMode: false
  },
  colorSettings: {
    primaryColor: "41,128,185",
    secondaryColor: "52,152,219",
    accentColor: "155,89,182",
    headerBgColor: "41,128,185",
    headerTextColor: "255,255,255",
    evenRowColor: "255,255,255",
    oddRowColor: "248,249,250"
  }
};

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
            pdf_layout_settings: DEFAULT_LAYOUT_SETTINGS // ADD THIS
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
