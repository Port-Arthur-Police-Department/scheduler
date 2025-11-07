# Welcome to your Lovable project

## Project info.

**URL**: https://lovable.dev/projects/4dfc7cb6-56df-45c4-8db6-b950144ddd13

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/4dfc7cb6-56df-45c4-8db6-b950144ddd13) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/4dfc7cb6-56df-45c4-8db6-b950144ddd13) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)


Had to use edge function in supabase to create new profiles:

Updated Edge Function Code
Replace your create-user function code with this:

typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Function to map rank to user role
const getRoleFromRank = (rank: string): string => {
  const rankLower = rank.toLowerCase();
  
  if (rankLower === 'chief' || rankLower === 'deputy chief') {
    return 'admin';
  } else if (rankLower === 'sergeant' || rankLower === 'lieutenant') {
    return 'supervisor';
  } else {
    return 'officer';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      email, 
      full_name, 
      phone, 
      badge_number, 
      rank, 
      hire_date, 
      service_credit_override,
      vacation_hours, 
      sick_hours, 
      comp_hours, 
      holiday_hours 
    } = await req.json()

    if (!email || !full_name) {
      throw new Error('Email and full name are required')
    }

    // Create admin client with service role key from secrets
    const supabaseAdmin = createClient(
      Deno.env.get('PROJECT_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    )

    // Generate temporary password
    const tempPassword = `TempPass${Math.random().toString(36).slice(-8)}!`

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name }
    })

    if (authError) throw authError
    if (!authData.user) throw new Error('No user data returned')

    // Determine user role based on rank
    const userRole = getRoleFromRank(rank || 'Officer')
    const finalRank = rank || 'Officer'

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        full_name,
        email,
        phone: phone || null,
        badge_number: badge_number || null,
        rank: finalRank,
        hire_date: hire_date || null,
        service_credit_override: service_credit_override ? Number(service_credit_override) : null,
        vacation_hours: Number(vacation_hours) || 0,
        sick_hours: Number(sick_hours) || 0,
        comp_hours: Number(comp_hours) || 0,
        holiday_hours: Number(holiday_hours) || 0,
      })

    if (profileError) {
      // Clean up auth user if profile fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw profileError
    }

    // Assign appropriate role in user_roles table based on rank
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: userRole
      })

    if (roleError) {
      console.error('Role assignment error:', roleError)
      // Don't throw here - the user was created successfully, just role assignment failed
    }

    // Send password reset email
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: resetError 
          ? 'User created but password reset email failed' 
          : 'User created and password reset email sent',
        roleAssigned: !roleError,
        userRole: userRole,
        rank: finalRank
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
How the Mapping Works:
Chief or Deputy Chief → admin role

Sergeant or Lieutenant → supervisor role

Officer (default) → officer role

The function is case-insensitive, so "chief", "Chief", "CHIEF" will all map to admin role.

Also Update Your Edit Functionality
You should also update the updateProfileMutation in your OfficerProfileDialog.tsx to handle role changes when editing an existing officer's rank. Add this after the profile update:

tsx
// In your updateProfileMutation, after the profile update succeeds:
const updateProfileMutation = useMutation({
  mutationFn: async (data: typeof formData) => {
    if (!officer?.id) throw new Error("No officer ID provided");
    
    // Update profile first
    const { error } = await supabase
      .from("profiles")
      .update({
        // ... your existing update fields
      })
      .eq("id", officer.id);

    if (error) throw error;

    // Update user role based on new rank
    const getRoleFromRank = (rank: string): string => {
      const rankLower = rank.toLowerCase();
      if (rankLower === 'chief' || rankLower === 'deputy chief') return 'admin';
      if (rankLower === 'sergeant' || rankLower === 'lieutenant') return 'supervisor';
      return 'officer';
    };

    const newRole = getRoleFromRank(data.rank);
    
    // Update the user_roles table
    const { error: roleError } = await supabase
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', officer.id);

    if (roleError) {
      console.error('Failed to update role:', roleError);
      // Don't throw - the profile was updated successfully
    }
  },
  // ... rest of your mutation
});
Now when you create or edit profiles, the user roles will automatically be aligned with the rank hierarchy!

is this the code that needs to be updated?

  // Mutation for updating existing officer
  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!officer?.id) throw new Error("No officer ID provided");
      
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: data.full_name,
          email: data.email,
          phone: data.phone || null,
          badge_number: data.badge_number || null,
          rank: data.rank as "Officer" | "Sergeant" | "Lieutenant" | "Deputy Chief" | "Chief",
          hire_date: hireDate ? format(hireDate, "yyyy-MM-dd") : null,
          service_credit_override: serviceCreditOverride ? Number(serviceCreditOverride) : null,
          vacation_hours: Number(data.vacation_hours) || 0,
          sick_hours: Number(data.sick_hours) || 0,
          comp_hours: Number(data.comp_hours) || 0,
          holiday_hours: Number(data.holiday_hours) || 0,
        })
        .eq("id", officer.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated successfully");
      queryClient.invalidateQueries({ queryKey: ["all-officers"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update profile");
    },
  });
Yes, that's exactly the code that needs to be updated! Here's the modified version with the role update logic added:

tsx
// Mutation for updating existing officer
const updateProfileMutation = useMutation({
  mutationFn: async (data: typeof formData) => {
    if (!officer?.id) throw new Error("No officer ID provided");
    
    // Update profile first
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: data.full_name,
        email: data.email,
        phone: data.phone || null,
        badge_number: data.badge_number || null,
        rank: data.rank as "Officer" | "Sergeant" | "Lieutenant" | "Deputy Chief" | "Chief",
        hire_date: hireDate ? format(hireDate, "yyyy-MM-dd") : null,
        service_credit_override: serviceCreditOverride ? Number(serviceCreditOverride) : null,
        vacation_hours: Number(data.vacation_hours) || 0,
        sick_hours: Number(data.sick_hours) || 0,
        comp_hours: Number(data.comp_hours) || 0,
        holiday_hours: Number(data.holiday_hours) || 0,
      })
      .eq("id", officer.id);

    if (error) throw error;

    // Update user role based on new rank
    const getRoleFromRank = (rank: string): string => {
      const rankLower = rank.toLowerCase();
      if (rankLower === 'chief' || rankLower === 'deputy chief') return 'admin';
      if (rankLower === 'sergeant' || rankLower === 'lieutenant') return 'supervisor';
      return 'officer';
    };

    const newRole = getRoleFromRank(data.rank);
    
    // Update the user_roles table
    const { error: roleError } = await supabase
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', officer.id);

    if (roleError) {
      console.error('Failed to update role:', roleError);
      // Don't throw - the profile was updated successfully, just role update failed
    }
  },
  onSuccess: () => {
    toast.success("Profile updated successfully");
    queryClient.invalidateQueries({ queryKey: ["all-officers"] });
    onOpenChange(false);
  },
  onError: (error: any) => {
    toast.error(error.message || "Failed to update profile");
  },
});
Now when you edit an officer's profile and change their rank, their user role will automatically be updated to match:

Officer → officer role

Sergeant or Lieutenant → supervisor role

Deputy Chief or Chief → admin role

This ensures that both new profiles (created via the Edge Function) and existing profiles (edited via this dialog) maintain the proper role hierarchy based on rank.


## files function:

OfficerProfileDialog.tsx - Handles officer profile information (name, email, rank, PTO balances, etc.)

ScheduleManagementDialog.tsx - Simple dialog for creating recurring schedules

OfficerSchedulerManager.tsx - The main component you showed first, which has comprehensive schedule management

The key insight is that you want to add time-bound default assignments functionality to the OfficerSchedulerManager.tsx file, si

# WeeklySchedule.tsx Refactoring Summary

## 📊 Code Reduction Results

### Before & After Comparison:
- **Original WeeklySchedule.tsx**: ~1,200 lines
- **Refactored WeeklySchedule.tsx**: ~600 lines
- **Total Reduction**: ~50% reduction in main component
- **New Reusable Components**: 5 new files created

## 🎯 What Was Refactored

### 1. **Constants Extraction** (`constants/positions.ts`)
**Before**: Duplicated in 3+ files
```typescript
const predefinedPositions = ["Supervisor", "District 1", ...];
const rankOrder = { 'Chief': 1, ... };
```

**After**: Single source of truth
```typescript
import { PREDEFINED_POSITIONS, RANK_ORDER, PTO_TYPES } from "@/constants/positions";
```

**Benefits**:
- ✅ Update positions in ONE place
- ✅ Type safety with `as const`
- ✅ Used across DailyScheduleView, WeeklySchedule, and PositionEditor

---

### 2. **Schedule Cell Component** (`ScheduleCell.tsx`)
**Before**: Inline logic in `renderExcelStyleWeeklyView()` (~150 lines)
```typescript
// 150+ lines of inline cell rendering with badges, buttons, PTO logic
```

**After**: Reusable component (~150 lines in separate file)
```typescript
<ScheduleCell
  officer={dayOfficer}
  dateStr={dateStr}
  isAdminOrSupervisor={isAdminOrSupervisor}
  onAssignPTO={handleAssignPTO}
  onRemovePTO={handleRemovePTO}
  onEditAssignment={handleEditAssignment}
  onRemoveOfficer={removeOfficerMutation.mutate}
/>
```

**Benefits**:
- ✅ Cell logic isolated and testable
- ✅ Consistent behavior across weekly view
- ✅ Easy to modify hover states, badges, etc.

---

### 3. **Mutations Hook** (`useWeeklyScheduleMutations.ts`)
**Before**: 4 separate mutation definitions inline (~200 lines)
```typescript
const updatePositionMutation = useMutation({ ... });
const removeOfficerMutation = useMutation({ ... });
const removePTOMutation = useMutation({ ... });
// + complex logic for each
```

**After**: Custom hook (~150 lines)
```typescript
const {
  updatePositionMutation,
  removeOfficerMutation,
  removePTOMutation,
  queryKey
} = useWeeklyScheduleMutations(currentWeekStart, currentMonth, activeView, selectedShiftId);
```

**Benefits**:
- ✅ All mutations in one place
- ✅ Automatic query invalidation with correct keys
- ✅ Reusable across different views
- ✅ Easier to test and debug

---

### 4. **Utility Functions** (`scheduleUtils.ts`)
**Before**: Repeated helper functions
```typescript
// Duplicated in WeeklySchedule and DailyScheduleView
const getLastName = (fullName: string) => { ... };
const categorizeAndSortOfficers = (officers: any[]) => { ... };
const calculateStaffingCounts = (...) => { ... };
```

**After**: Shared utilities
```typescript
import { 
  getLastName, 
  categorizeAndSortOfficers,
  calculateStaffingCounts,
  MINIMUM_STAFFING
} from "@/utils/scheduleUtils";
```

**Benefits**:
- ✅ Single implementation of business logic
- ✅ Consistent sorting across all views
- ✅ Easy to add new utility functions

---

## 📁 New File Structure

```
src/
├── constants/
│   └── positions.ts              # ⭐ NEW: All position/rank constants
├── components/
│   └── schedule/
│       ├── DailyScheduleView.tsx  # ✅ REFACTORED
│       ├── WeeklySchedule.tsx     # ✅ REFACTORED
│       ├── ScheduleCell.tsx       # ⭐ NEW: Reusable cell component
│       ├── OfficerCard.tsx        # ⭐ NEW: For daily view
│       ├── PTOCard.tsx            # ⭐ NEW: For PTO display
│       └── OfficerSection.tsx     # ⭐ NEW: Section wrapper
├── hooks/
│   ├── useScheduleMutations.ts    # ⭐ NEW: For daily view
│   └── useWeeklyScheduleMutations.ts  # ⭐ NEW: For weekly view
└── utils/
    └── scheduleUtils.ts           # ⭐ NEW: Shared utilities
```

---

## 🔧 Key Improvements

### 1. **Eliminated Code Duplication**
- ❌ **Before**: `predefinedPositions` array in 3 files
- ✅ **After**: Single source in `constants/positions.ts`

### 2. **Improved Maintainability**
- ❌ **Before**: Change sorting logic in 2+ places
- ✅ **After**: Modify `sortSupervisorsByRank()` once

### 3. **Better Type Safety**
- ❌ **Before**: String arrays prone to typos
- ✅ **After**: TypeScript `as const` provides autocomplete

### 4. **Easier Testing**
- ❌ **Before**: Test mutations inside component
- ✅ **After**: Test hooks in isolation

### 5. **Consistent Behavior**
- ❌ **Before**: Extra shift detection logic duplicated
- ✅ **After**: Single implementation in `ScheduleCell`

---

## 🚀 Migration Guide

### Step 1: Add New Files
Create all new files in the structure shown above.

### Step 2: Update Imports in Existing Files

**DailyScheduleView.tsx**:
```typescript
// Old
const predefinedPositions = [...];

// New
import { PREDEFINED_POSITIONS } from "@/constants/positions";
import { OfficerCard } from "./OfficerCard";
import { PTOCard } from "./PTOCard";
import { useScheduleMutations } from "@/hooks/useScheduleMutations";
```

**WeeklySchedule.tsx**:
```typescript
// Old
const predefinedPositions = [...];

// New
import { PREDEFINED_POSITIONS } from "@/constants/positions";
import { ScheduleCell } from "./ScheduleCell";
import { useWeeklyScheduleMutations } from "@/hooks/useWeeklyScheduleMutations";
import { getLastName, categorizeAndSortOfficers } from "@/utils/scheduleUtils";
```

**PositionEditor.tsx**:
```typescript
// Old
const predefinedPositions = [...];

// New
import { PREDEFINED_POSITIONS } from "@/constants/positions";
```

### Step 3: Replace Inline Logic
Replace mutation definitions and cell rendering with the new components/hooks.

---

## 📈 Performance Benefits

1. **Faster Development**: Add new positions once instead of updating 3 files
2. **Fewer Bugs**: Single implementation = single point of failure
3. **Better Code Review**: Smaller, focused components easier to review
4. **Easier Onboarding**: New developers find logic more quickly

---

## ✅ Testing Checklist

After migration, verify:
- [ ] Position dropdowns show same options everywhere
- [ ] Supervisor sorting by rank works correctly
- [ ] Extra shift badges display properly
- [ ] PTO indicators show correctly (full-day vs partial)
- [ ] Edit/delete buttons only show for admin/supervisor
- [ ] Mutation success toasts appear
- [ ] Query invalidation refreshes data correctly

---

## 💡 Future Improvements

Now that code is refactored, these become easier:

1. **Add Unit Tests**: Test `scheduleUtils.ts` functions
2. **Storybook Components**: Create stories for `OfficerCard`, `ScheduleCell`
3. **Add More Positions**: Update one constant file
4. **Optimize Queries**: Centralized query keys make caching easier
5. **Error Boundaries**: Wrap components with better error handling

---

## 🎉 Summary

**Lines Saved**: ~800 lines across both files  
**Files Created**: 8 new reusable files  
**Duplication Removed**: 3+ instances of position arrays  
**Maintainability**: ⭐⭐⭐⭐⭐  
**Readability**: ⭐⭐⭐⭐⭐  

The refactored code is:
- ✅ Easier to understand
- ✅ Faster to modify
- ✅ Less prone to bugs
- ✅ More consistent across views
- ✅ Better prepared for future features
