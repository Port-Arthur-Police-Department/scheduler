const handleExportPDF = async () => {
  if (!dateRange?.from || !dateRange?.to) {
    toast.error("Please select a date range");
    return;
  }

  if (!selectedShiftId) {
    toast.error("Please select a shift");
    return;
  }

  try {
    toast.info("Generating PDF export...");
    
    const startDate = dateRange.from;
    const endDate = dateRange.to;
    
    const dates = eachDayOfInterval({ start: startDate, end: endDate }).map(date => 
      format(date, "yyyy-MM-dd")
    );

    // Fetch schedule data for the date range
    const scheduleDataResponse = await fetchScheduleDataForRange(startDate, endDate, dates);
    
    const shiftName = shiftTypes?.find(s => s.id === selectedShiftId)?.name || "Unknown Shift";
    
    // Use the appropriate export based on active view
    if (activeView === "weekly") {
      const result = await exportWeeklyPDF({
        startDate,
        endDate,
        shiftName,
        scheduleData: scheduleDataResponse.dailySchedules || [],
        viewType: "weekly",
        minimumStaffing: schedules?.minimumStaffing,
        selectedShiftId
      });

      if (result.success) {
        toast.success("Weekly PDF exported successfully");
        setExportDialogOpen(false);
      } else {
        toast.error("Failed to export weekly PDF");
      }
    } else {
      // For monthly view, we'll use the weekly PDF export but with monthly styling
      const result = await exportWeeklyPDF({
        startDate,
        endDate,
        shiftName,
        scheduleData: scheduleDataResponse.dailySchedules || [],
        viewType: "monthly",
        minimumStaffing: schedules?.minimumStaffing,
        selectedShiftId
      });

      if (result.success) {
        toast.success("Monthly PDF exported successfully");
        setExportDialogOpen(false);
      } else {
        toast.error("Failed to export monthly PDF");
      }
    }
  } catch (error) {
    console.error("Export error:", error);
    toast.error("Error generating PDF export");
  }
};
