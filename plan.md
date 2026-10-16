# Plan: Division Field & Shift Position Availability for Bidding

## Context & Objectives
1. **Division Column**: Add a `division` column (`'FOD'`, `'CID'`, `'Admin'`) to the `profiles` table and integrate it into the `OfficerProfileDialog` component so administrators can assign officers to divisions. Shift bidding will later be filtered by division.
2. **Shift Position Availability**: Provide a way for administrators in the profile/shift admin settings to outline what positions are available for each shift type to pick from during shift bidding.

---

## Proposed Changes

### 1. Database Schema Migration
- Create a migration to add `division text` (with a check constraint or default) to the `profiles` table.
- Create a `shift_type_allowed_positions` table linking `shift_type_id` and `position_id` (or `position_name`), so admins can specify available positions for each shift type.

### 2. TypeScript Types & UI Updates (`OfficerProfileDialog.tsx`)
- Update TypeScript types for profiles to include `division?: string | null`.
- Add a Division selector (`FOD`, `CID`, `Admin`) in `OfficerProfileDialog.tsx` under the Basic Info tab.

### 3. Shift Position Availability Configuration
- Create a new settings component or extend `WebsiteSettings.tsx` / `ScheduleManagementDialog.tsx` to allow administrators to configure which positions are available for each shift type.

---

## Verification Plan
- Verify database migration applies cleanly.
- Test updating an officer's division in `OfficerProfileDialog`.
- Verify shift position availability configuration saves correctly.
