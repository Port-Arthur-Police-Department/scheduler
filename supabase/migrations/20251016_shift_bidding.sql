-- Shift Bidding Feature Tables Migration

-- 1. Shift Bidding Rounds table
CREATE TABLE IF NOT EXISTS shift_bidding_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  division TEXT NOT NULL CHECK (division IN ('FOD', 'CID', 'Admin')),
  status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'paused', 'completed')),
  current_turn_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Shift Bidding Queue table
CREATE TABLE IF NOT EXISTS shift_bidding_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES shift_bidding_rounds(id) ON DELETE CASCADE,
  officer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'skipped')),
  selected_shift_type_id UUID REFERENCES shift_types(id),
  selected_position_name TEXT,
  selected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Shift Type Allowed Positions table (for admin configuration per shift)
CREATE TABLE IF NOT EXISTS shift_type_allowed_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_type_id UUID NOT NULL REFERENCES shift_types(id) ON DELETE CASCADE,
  position_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shift_type_id, position_name)
);

-- Enable RLS on new tables
ALTER TABLE shift_bidding_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_bidding_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_type_allowed_positions ENABLE ROW LEVEL SECURITY;

-- Policies for shift_bidding_rounds
CREATE POLICY "Enable read access for all authenticated users on shift_bidding_rounds"
  ON shift_bidding_rounds FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert/update/delete for admins/supervisors on shift_bidding_rounds"
  ON shift_bidding_rounds FOR ALL TO authenticated USING (true);

-- Policies for shift_bidding_queue
CREATE POLICY "Enable read access for all authenticated users on shift_bidding_queue"
  ON shift_bidding_queue FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert/update/delete for admins/supervisors on shift_bidding_queue"
  ON shift_bidding_queue FOR ALL TO authenticated USING (true);

-- Policies for shift_type_allowed_positions
CREATE POLICY "Enable read access for all authenticated users on shift_type_allowed_positions"
  ON shift_type_allowed_positions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable write for admins/supervisors on shift_type_allowed_positions"
  ON shift_type_allowed_positions FOR ALL TO authenticated USING (true);
