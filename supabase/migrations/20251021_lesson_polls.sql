-- Add poll support to weekly_lessons and create lesson_poll_votes table

ALTER TABLE weekly_lessons
ADD COLUMN IF NOT EXISTS poll_question TEXT,
ADD COLUMN IF NOT EXISTS poll_options JSONB;

-- Create lesson_poll_votes table
CREATE TABLE IF NOT EXISTS lesson_poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID REFERENCES weekly_lessons(id) ON DELETE CASCADE NOT NULL,
    officer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    option_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_officer_lesson_vote UNIQUE (lesson_id, officer_id)
);

-- Enable RLS
ALTER TABLE lesson_poll_votes ENABLE ROW LEVEL SECURITY;

-- Policies for lesson_poll_votes
CREATE POLICY "Everyone can view lesson poll votes" ON lesson_poll_votes
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can vote on polls" ON lesson_poll_votes
    FOR INSERT WITH CHECK (auth.uid() = officer_id);

CREATE POLICY "Users can update their own votes" ON lesson_poll_votes
    FOR UPDATE USING (auth.uid() = officer_id);

CREATE POLICY "Users can delete their own votes or admins can delete any" ON lesson_poll_votes
    FOR DELETE USING (
        auth.uid() = officer_id
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'supervisor')
        )
    );
