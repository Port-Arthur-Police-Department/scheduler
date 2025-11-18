// src/hooks/useColorSettings.ts - UPDATED WITH PTO TYPE COLORS
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_COLORS = {
  // PDF Export Colors
  pdf_supervisor_pto_bg: "255,255,200",
  pdf_supervisor_pto_border: "255,220,100", 
  pdf_supervisor_pto_text: "139,69,19",
  
  pdf_officer_pto_bg: "240,255,240",
  pdf_officer_pto_border: "144,238,144",
  pdf_officer_pto_text: "0,100,0",
  
  // NEW: Different PTO type colors
  pdf_vacation_bg: "173,216,230",
  pdf_vacation_border: "100,149,237",
  pdf_vacation_text: "0,0,139",
  
  pdf_sick_bg: "255,200,200",
  pdf_sick_border: "255,100,100",
  pdf_sick_text: "139,0,0",
  
  pdf_holiday_bg: "255,218,185",
  pdf_holiday_border: "255,165,0",
  pdf_holiday_text: "165,42,42",
  
  pdf_comp_bg: "221,160,221",
  pdf_comp_border: "186,85,211",
  pdf_comp_text: "128,0,128",
  
  pdf_off_day_bg: "220,220,220",
  pdf_off_day_text: "100,100,100",
  
  // Weekly Schedule Colors
  weekly_supervisor_bg: "255,255,255",
  weekly_supervisor_text: "0,0,0",
  
  weekly_officer_bg: "255,255,255", 
  weekly_officer_text: "0,0,0",
  
  weekly_ppo_bg: "255,250,240",
  weekly_ppo_text: "150,75,0",
  
  // NEW: Weekly PTO type colors
  weekly_vacation_bg: "173,216,230",
  weekly_vacation_text: "0,0,139",
  
  weekly_sick_bg: "255,200,200",
  weekly_sick_text: "139,0,0",
  
  weekly_holiday_bg: "255,218,185",
  weekly_holiday_text: "165,42,42",
  
  weekly_comp_bg: "221,160,221",
  weekly_comp_text: "128,0,128",
  
  weekly_pto_bg: "144,238,144",
  weekly_pto_text: "0,100,0",
  
  weekly_off_bg: "240,240,240",
  weekly_off_text: "100,100,100",
};

export const useColorSettings = () => {
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['website-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('website_settings')
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { color_settings: DEFAULT_COLORS };
        }
        console.error('Error fetching color settings:', error);
        return { color_settings: DEFAULT_COLORS };
      }

      const colorSettings = data?.color_settings ? { ...DEFAULT_COLORS, ...data.color_settings } : DEFAULT_COLORS;
      
      return { ...data, color_settings: colorSettings };
    },
    retry: 1,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const colors = settings?.color_settings || DEFAULT_COLORS;

  const getColorArray = (rgbString: string): [number, number, number] => {
    try {
      const parts = rgbString.split(',').map(part => parseInt(part.trim()));
      if (parts.length === 3 && parts.every(part => !isNaN(part))) {
        return [parts[0], parts[1], parts[2]] as [number, number, number];
      }
      return [255, 255, 255];
    } catch (error) {
      return [255, 255, 255];
    }
  };

  return {
    colors,
    getColorArray,
    isLoading,
    error,
    
    // PDF Colors
    pdf: {
      supervisorPTO: {
        bg: getColorArray(colors.pdf_supervisor_pto_bg),
        border: getColorArray(colors.pdf_supervisor_pto_border),
        text: getColorArray(colors.pdf_supervisor_pto_text),
      },
      officerPTO: {
        bg: getColorArray(colors.pdf_officer_pto_bg),
        border: getColorArray(colors.pdf_officer_pto_border),
        text: getColorArray(colors.pdf_officer_pto_text),
      },
      vacation: {
        bg: getColorArray(colors.pdf_vacation_bg),
        border: getColorArray(colors.pdf_vacation_border),
        text: getColorArray(colors.pdf_vacation_text),
      },
      sick: {
        bg: getColorArray(colors.pdf_sick_bg),
        border: getColorArray(colors.pdf_sick_border),
        text: getColorArray(colors.pdf_sick_text),
      },
      holiday: {
        bg: getColorArray(colors.pdf_holiday_bg),
        border: getColorArray(colors.pdf_holiday_border),
        text: getColorArray(colors.pdf_holiday_text),
      },
      comp: {
        bg: getColorArray(colors.pdf_comp_bg),
        border: getColorArray(colors.pdf_comp_border),
        text: getColorArray(colors.pdf_comp_text),
      },
      offDay: {
        bg: getColorArray(colors.pdf_off_day_bg),
        text: getColorArray(colors.pdf_off_day_text),
      }
    },
    
    // Weekly Schedule Colors
    weekly: {
      supervisor: {
        bg: `rgb(${colors.weekly_supervisor_bg})`,
        text: `rgb(${colors.weekly_supervisor_text})`,
      },
      officer: {
        bg: `rgb(${colors.weekly_officer_bg})`,
        text: `rgb(${colors.weekly_officer_text})`,
      },
      ppo: {
        bg: `rgb(${colors.weekly_ppo_bg})`,
        text: `rgb(${colors.weekly_ppo_text})`,
      },
      vacation: {
        bg: `rgb(${colors.weekly_vacation_bg})`,
        text: `rgb(${colors.weekly_vacation_text})`,
      },
      sick: {
        bg: `rgb(${colors.weekly_sick_bg})`,
        text: `rgb(${colors.weekly_sick_text})`,
      },
      holiday: {
        bg: `rgb(${colors.weekly_holiday_bg})`,
        text: `rgb(${colors.weekly_holiday_text})`,
      },
      comp: {
        bg: `rgb(${colors.weekly_comp_bg})`,
        text: `rgb(${colors.weekly_comp_text})`,
      },
      pto: {
        bg: `rgb(${colors.weekly_pto_bg})`,
        text: `rgb(${colors.weekly_pto_text})`,
      },
      off: {
        bg: `rgb(${colors.weekly_off_bg})`,
        text: `rgb(${colors.weekly_off_text})`,
      }
    }
  };
};
