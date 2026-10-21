-- Add unique partial index to prevent multiple officers from selecting the same position in the same bidding round
CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_bidding_queue_unique_position
ON shift_bidding_queue (round_id, selected_shift_type_id, selected_position_name)
WHERE selected_shift_type_id IS NOT NULL AND selected_position_name IS NOT NULL;
