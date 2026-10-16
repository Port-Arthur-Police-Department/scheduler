-- Shift Bidding Expansion: Add allowed_rank and recurring_days to shift_type_allowed_positions

ALTER TABLE shift_type_allowed_positions
  ADD COLUMN IF NOT EXISTS allowed_rank TEXT DEFAULT 'Any',
  ADD COLUMN IF NOT EXISTS recurring_days INTEGER[] DEFAULT '{}';
