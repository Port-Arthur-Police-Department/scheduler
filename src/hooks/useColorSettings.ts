// hooks/useColorSettings.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_COLORS = {
  pdf_supervisor_pto_bg: "255,255,200",
  pdf_supervisor_pto_border: "255,220,100",
  pdf_supervisor_pto_text: "139,69,19",
  pdf_officer_pto_bg: "240,255,240",
  pdf_officer_pto_border: "144,238,144",
  pdf_officer_pto_text: "0,100,0",
  pdf_sick_time_bg: "255,200,200",
  pdf_sick_time_border: "255,100,100",
  pdf_sick_time_text: "139,0,0",
  pdf_off_day_bg: "220,220,220",
  pdf_off_day_text: "100,100,100",
  weekly_supervisor_bg: "240,249,255",
  weekly_supervisor_text: "0,75,150",
  weekly_officer_bg: "240,255,240",
  weekly_officer_text: "0,100,0",
  weekly_ppo_bg: "255,250,240",
  weekly_ppo_text: "150,75,0",
  weekly_pto_bg: "144,238,144",
  weekly_pto_text: "0,100,0",
  weekly_sick_bg: "255,200,200",
  weekly_sick_text: "139,0,0",
  weekly_off_bg: "240,240,240",
  weekly_off_text: "100,100,100",
};

export const useColorSettings = () => {
  const { data: settings } = useQuery({
    queryKey: ['website-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('website_settings')
        .select('*')
        .single();

      if (error && error.code === 'PGRST116') {
        return { color_settings: DEFAULT_COLORS };
      }
      if (error) throw error;
      
      return data || { color_settings: DEFAULT_COLORS };
    },
  });

  const colors = settings?.color_settings || DEFAULT_COLORS;

  // Helper function to convert RGB string to array
  const getColorArray = (rgbString: string): [number, number, number] => {
    const parts = rgbString.split(',').map(part => parseInt(part.trim()));
    return [parts[0], parts[1], parts[2]] as [number, number, number];
  };

  return {
    colors,
    getColorArray,
    
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
      sickTime: {
        bg: getColorArray(colors.pdf_sick_time_bg),
        border: getColorArray(colors.pdf_sick_time_border),
        text: getColorArray(colors.pdf_sick_time_text),
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
      pto: {
        bg: `rgb(${colors.weekly_pto_bg})`,
        text: `rgb(${colors.weekly_pto_text})`,
      },
      sick: {
        bg: `rgb(${colors.weekly_sick_bg})`,
        text: `rgb(${colors.weekly_sick_text})`,
      },
      off: {
        bg: `rgb(${colors.weekly_off_bg})`,
        text: `rgb(${colors.weekly_off_text})`,
      }
    }
  };
};
