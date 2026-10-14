-- Drop existing tables if re-running migration
DROP TABLE IF EXISTS lesson_comments CASCADE;
DROP TABLE IF EXISTS weekly_lessons CASCADE;

-- Create weekly_lessons table
CREATE TABLE weekly_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    photo_url TEXT,
    week_start_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create lesson_comments table
CREATE TABLE lesson_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID REFERENCES weekly_lessons(id) ON DELETE CASCADE NOT NULL,
    officer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE weekly_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_comments ENABLE ROW LEVEL SECURITY;

-- Policies for weekly_lessons
CREATE POLICY "Everyone can view weekly lessons" ON weekly_lessons
    FOR SELECT USING (true);

CREATE POLICY "Admins and supervisors can manage weekly lessons" ON weekly_lessons
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'supervisor')
        )
    );

-- Policies for lesson_comments
CREATE POLICY "Everyone can view lesson comments" ON lesson_comments
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create lesson comments" ON lesson_comments
    FOR INSERT WITH CHECK (auth.uid() = officer_id);

CREATE POLICY "Users can delete their own comments or admins can delete any" ON lesson_comments
    FOR DELETE USING (
        auth.uid() = officer_id
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'supervisor')
        )
    );

-- Storage bucket for lesson photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-photos', 'lesson-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Lesson photos are publicly accessible" ON storage.objects
    FOR SELECT USING (bucket_id = 'lesson-photos');

CREATE POLICY "Admins can upload lesson photos" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'lesson-photos'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'supervisor')
        )
    );

CREATE POLICY "Admins can update lesson photos" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'lesson-photos'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'supervisor')
        )
    );

CREATE POLICY "Admins can delete lesson photos" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'lesson-photos'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'supervisor')
        )
    );
