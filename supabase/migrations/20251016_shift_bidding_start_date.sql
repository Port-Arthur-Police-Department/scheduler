-- Add start_date to shift_bidding_rounds table
ALTER TABLE shift_bidding_rounds
  ADD COLUMN IF NOT EXISTS start_date TEXT DEFAULT TO_CHAR(NOW(), 'YYYY-01-01');
