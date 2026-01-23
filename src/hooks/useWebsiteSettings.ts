// In your query function in WebsiteSettings.tsx, update the merging logic:
const { data: settings, isLoading } = useQuery({
  queryKey: ['website-settings'],
  queryFn: async () => {
    console.log('Fetching website settings...');
    
    const { data, error } = await supabase
      .from('website_settings')
      .select('*')
      .single();

    if (error) {
      console.log('Error fetching settings:', error);
      
      if (error.code === 'PGRST116') {
        console.log('No settings found, creating default...');
        const { data: newSettings, error: createError } = await supabase
          .from('website_settings')
          .insert({
            ...DEFAULT_NOTIFICATION_SETTINGS,
            color_settings: DEFAULT_COLORS,
            pto_type_visibility: DEFAULT_PTO_VISIBILITY,
            pdf_layout_settings: DEFAULT_LAYOUT_SETTINGS
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating default settings:', createError);
          throw createError;
        }
        
        return newSettings;
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
    
    // Specifically handle anniversary_alert_recipients if it doesn't exist
    if (!mergedData.anniversary_alert_recipients) {
      mergedData.anniversary_alert_recipients = DEFAULT_NOTIFICATION_SETTINGS.anniversary_alert_recipients;
    }
    
    return mergedData;
  },
  retry: 1,
});
