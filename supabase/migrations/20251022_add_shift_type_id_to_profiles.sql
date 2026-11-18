-- Add shift_type_id to profiles table for default shift assignment
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shift_type_id UUID REFERENCES shift_types(id) ON DELETE SET NULL;
