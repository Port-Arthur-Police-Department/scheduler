// src/hooks/useWeeklyLesson.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getWeekStartDateString } from '@/utils/weekUtils';

export interface WeeklyLesson {
  id: string;
  title: string;
  content: string;
  photo_url?: string;
  week_start_date: string;
  is_active: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  author?: {
    full_name?: string;
    badge_number?: string;
    rank?: string;
    avatar_url?: string;
  };
}

export interface LessonComment {
  id: string;
  lesson_id: string;
  officer_id: string;
  content: string;
  created_at: string;
  officer?: {
    full_name?: string;
    badge_number?: string;
    rank?: string;
    avatar_url?: string;
  };
}

export const useWeeklyLesson = (weekStartDate?: string) => {
  const targetDate = weekStartDate || getWeekStartDateString();

  return useQuery({
    queryKey: ['weekly-lesson', targetDate],
    queryFn: async () => {
      // First try to find lesson for exact week_start_date
      const { data, error } = await supabase
        .from('weekly_lessons')
        .select(`
          *,
          author:created_by(full_name, badge_number, rank, avatar_url)
        `)
        .eq('week_start_date', targetDate)
        .maybeSingle();

      if (error) {
        console.error('Error fetching weekly lesson:', error);
        throw error;
      }

      if (data) return data as WeeklyLesson;

      // If none found for target date, fetch latest active lesson
      const { data: activeData, error: activeError } = await supabase
        .from('weekly_lessons')
        .select(`
          *,
          author:created_by(full_name, badge_number, rank)
        `)
        .eq('is_active', true)
        .order('week_start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeError) {
        console.error('Error fetching active weekly lesson:', activeError);
      }

      return (activeData || null) as WeeklyLesson | null;
    },
  });
};

export const useWeeklyLessonsList = () => {
  return useQuery({
    queryKey: ['weekly-lessons-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_lessons')
        .select(`
          *,
          author:created_by(full_name, badge_number, rank, avatar_url)
        `)
        .order('week_start_date', { ascending: false });

      if (error) throw error;
      return (data || []) as WeeklyLesson[];
    },
  });
};

export const useLessonComments = (lessonId?: string) => {
  return useQuery({
    queryKey: ['lesson-comments', lessonId],
    enabled: !!lessonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lesson_comments')
        .select(`
          *,
          officer:officer_id(full_name, badge_number, rank, avatar_url)
        `)
        .eq('lesson_id', lessonId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as LessonComment[];
    },
  });
};

export const useWeeklyLessonMutations = () => {
  const queryClient = useQueryClient();

  const upsertLesson = useMutation({
    mutationFn: async (lessonData: Partial<WeeklyLesson>) => {
      const { data, error } = await supabase
        .from('weekly_lessons')
        .upsert(lessonData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-lesson'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-lessons-list'] });
    },
  });

  const deleteLesson = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('weekly_lessons')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-lesson'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-lessons-list'] });
    },
  });

  const addComment = useMutation({
    mutationFn: async ({ lessonId, officerId, content }: { lessonId: string; officerId: string; content: string }) => {
      const { data, error } = await supabase
        .from('lesson_comments')
        .insert({
          lesson_id: lessonId,
          officer_id: officerId,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lesson-comments', variables.lessonId] });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async ({ commentId, lessonId }: { commentId: string; lessonId: string }) => {
      const { error } = await supabase
        .from('lesson_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      return lessonId;
    },
    onSuccess: (lessonId) => {
      queryClient.invalidateQueries({ queryKey: ['lesson-comments', lessonId] });
    },
  });

  return {
    upsertLesson,
    deleteLesson,
    addComment,
    deleteComment,
  };
};
