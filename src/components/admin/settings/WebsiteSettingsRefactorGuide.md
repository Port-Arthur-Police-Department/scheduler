# WebsiteSettings Refactoring Guide

## 📁 New Folder Structure

```
src/
└── components/
    └── admin/
        ├── WebsiteSettings.tsx (main component - already created)
        ├── PasswordResetManager.tsx (keep existing)
        └── settings/ (NEW FOLDER)
            ├── colorUtils.ts (utility functions - already created)
            ├── ColorPicker.tsx (reusable component - already created)
            ├── NotificationSettings.tsx (already created)
            ├── PTOSettings.tsx (already created)
            ├── PTOVisibilitySettings.tsx (already created)
            ├── ScheduleColorSettings.tsx (already created)
            ├── ColorCustomizationSettings.tsx (create below)
            ├── AuditLogViewer.tsx (create below)
            ├── ManualAlertSender.tsx (create below)
            └── SettingsInstructions.tsx (create below)
```

## 📝 Remaining Components to Create

### 1. ColorCustomizationSettings.tsx
Located at: `src/components/admin/settings/ColorCustomizationSettings.tsx`

This component handles PDF export and weekly schedule color customization with grouped color pickers for different sections.

**Key Features:**
- PDF Export Colors (Supervisor PTO, Officer PTO, Sick Time, Off Days)
- Weekly Schedule Colors (Supervisor, Officer, PPO, PTO rows)
- PTO Type Colors (Vacation, Sick, Holiday, Comp Time)
- Reset to defaults button

### 2. AuditLogViewer.tsx
Located at: `src/components/admin/settings/AuditLogViewer.tsx`

This component displays and exports system audit logs.

**Key Features:**
- Date range filtering with calendar picker
- Action type, user, and table name filters
- Search functionality
- Export to PDF functionality
- Real-time log display with pagination

### 3. ManualAlertSender.tsx
Located at: `src/components/admin/settings/ManualAlertSender.tsx`

This component handles manual alert creation and sending.

**Key Features:**
- Schedule filtering (Active Period vs Day of Week)
- Shift selection with real-time active shift highlighting
- Officer count display
- Send method selection (In-App Only vs All Methods)
- Message composition with preview
- Integration with notification system

### 4. SettingsInstructions.tsx
Located at: `src/components/admin/settings/SettingsInstructions.tsx`

A simple card component that explains how each setting works.

## 🔧 Implementation Steps

### Step 1: Create the Settings Folder
```bash
mkdir -p src/components/admin/settings
```

### Step 2: Move Existing Files
The files I've already created in artifacts should be placed in:
- `src/components/admin/WebsiteSettings.tsx`
- `src/components/admin/settings/colorUtils.ts`
- `src/components/admin/settings/ColorPicker.tsx`
- `src/components/admin/settings/NotificationSettings.tsx`
- `src/components/admin/settings/PTOSettings.tsx`
- `src/components/admin/settings/PTOVisibilitySettings.tsx`
- `src/components/admin/settings/ScheduleColorSettings.tsx`

### Step 3: Create Remaining Components

I'll provide the code for the remaining components below. Each is modular and imports only what it needs.

## 🎯 Benefits of This Refactoring

1. **Better Organization**: Each setting type has its own file
2. **Easier Maintenance**: Changes to one section don't affect others
3. **Improved Testability**: Each component can be tested independently
4. **Better Performance**: Code splitting potential for faster load times
5. **Clearer Dependencies**: Easier to see what each component needs
6. **Reusable Components**: ColorPicker and utility functions can be used elsewhere
7. **Reduced Complexity**: Main file is now ~200 lines instead of 1000+

## 📊 Component Size Comparison

**Before Refactoring:**
- WebsiteSettings.tsx: ~1000 lines

**After Refactoring:**
- WebsiteSettings.tsx: ~200 lines (main orchestrator)
- NotificationSettings.tsx: ~180 lines
- PTOSettings.tsx: ~40 lines
- PTOVisibilitySettings.tsx: ~90 lines
- ScheduleColorSettings.tsx: ~140 lines
- ColorCustomizationSettings.tsx: ~200 lines
- AuditLogViewer.tsx: ~250 lines
- ManualAlertSender.tsx: ~350 lines
- SettingsInstructions.tsx: ~80 lines
- ColorPicker.tsx: ~25 lines
- colorUtils.ts: ~50 lines

**Total: ~1605 lines across 11 files** (vs 1000 lines in 1 file)

The slight increase in total lines is due to:
- Clearer separation of concerns
- More descriptive component names
- Import statements in each file
- Better comments and documentation

## 🚀 Next Steps

1. Create the `settings` folder
2. Move the files I've created into their proper locations
3. Create the remaining 4 components (code provided in next artifacts)
4. Test each component independently
5. Test the integrated system
6. Update any imports in other files that reference WebsiteSettings

## ⚠️ Important Notes

- Keep `PasswordResetManager.tsx` in the admin folder (not in settings)
- The main `WebsiteSettings.tsx` handles all state management and mutations
- Child components receive props and call callbacks - they don't manage state
- All color conversions use the shared `colorUtils.ts` file
- The `ColorPicker` component is reusable across all color settings
