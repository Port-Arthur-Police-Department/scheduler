// src/components/home/WeeklyLesson.tsx
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Calendar, User, Award } from "lucide-react";
import { WeeklyLesson as WeeklyLessonType } from "@/hooks/useWeeklyLesson";
import { formatWeekRange, parseLocalDate } from "@/utils/weekUtils";

interface WeeklyLessonProps {
  lesson: WeeklyLessonType | null;
  isLoading?: boolean;
}

export const WeeklyLesson = ({ lesson, isLoading }: WeeklyLessonProps) => {
  if (isLoading) {
    return (
      <Card className="shadow-md">
        <CardContent className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-muted-foreground">Loading weekly lesson...</span>
        </CardContent>
      </Card>
    );
  }

  if (!lesson) {
    return (
      <Card className="shadow-md">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-2">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Weekly Lesson & Encouragement</CardTitle>
          <CardDescription>No weekly lesson has been posted for this week yet.</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-6 text-muted-foreground text-sm">
          Check back soon for the latest weekly message, scripture, or leadership thought.
        </CardContent>
      </Card>
    );
  }

  const weekRangeText = lesson.week_start_date
    ? formatWeekRange(parseLocalDate(lesson.week_start_date))
    : '';

  const authorName = lesson.author
    ? `${lesson.author.rank ? lesson.author.rank + ' ' : ''}${lesson.author.full_name || ''}`.trim()
    : 'Department Administration';

  return (
    <Card className="shadow-md overflow-hidden border-primary/20">
      <CardHeader className="bg-primary/5 pb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex items-center space-x-2">
            <div className="bg-primary/10 p-2 rounded-lg">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">{lesson.title}</CardTitle>
              {weekRangeText && (
                <div className="flex items-center text-xs text-muted-foreground mt-1">
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  Week of {weekRangeText}
                </div>
              )}
            </div>
          </div>
          <Badge variant="outline" className="w-fit bg-background">
            Weekly Focus
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {lesson.photo_url && (
          <div className="rounded-lg overflow-hidden border max-h-[400px] bg-muted/30 flex justify-center">
            <img
              src={lesson.photo_url}
              alt={lesson.title}
              className="object-contain max-h-[400px] w-full"
            />
          </div>
        )}

        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line text-foreground/90 leading-relaxed">
          {lesson.content}
        </div>

        <div className="border-t pt-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-1.5">
            <User className="h-3.5 w-3.5" />
            <span>Posted by <strong className="text-foreground">{authorName}</strong></span>
            {lesson.author?.badge_number && (
              <span>(Badge #{lesson.author.badge_number})</span>
            )}
          </div>
          {lesson.created_at && (
            <div>
              {new Date(lesson.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
