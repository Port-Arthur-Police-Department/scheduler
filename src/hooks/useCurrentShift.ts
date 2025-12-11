import { supabase } from "@/integrations/supabase/client";

export const useCurrentShift = (officerId: string) => {
  const getCurrentShift = async () => {
    const { data, error } = await supabase
      .rpc('get_current_officer_shift', {
        officer_id_param: officerId
      });

    if (error) {
      console.error('Error getting current shift:', error);
      return null;
    }

    return data && data[0] ? {
      id: data[0].shift_type_id,
      name: data[0].shift_name,
      start_date: data[0].start_date,
      end_date: data[0].end_date
    } : null;
  };

  return { getCurrentShift };
};
