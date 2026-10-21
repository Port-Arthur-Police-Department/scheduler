// src/components/home/WeeklyLesson.tsx
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Calendar, User, Award, BarChart2 } from "lucide-react";
import { WeeklyLesson as WeeklyLessonType, useLessonVotes, useWeeklyLessonMutations } from "@/hooks/useWeeklyLesson";
import { formatWeekRange, parseLocalDate } from "@/utils/weekUtils";
import { renderMarkdown } from "@/utils/markdownUtils";
import { toast } from "sonner";

interface WeeklyLessonProps {
  lesson: WeeklyLessonType | null;
  isLoading?: boolean;
  currentOfficerId?: string;
}

export const WeeklyLesson = ({ lesson, isLoading, currentOfficerId }: WeeklyLessonProps) => {
  const { data: votes = [] } = useLessonVotes(lesson?.id);
  const { voteOnPoll } = useWeeklyLessonMutations();

  const userVote = votes.find(v => v.officer_id === currentOfficerId);
  const totalVotes = votes.length;

  const handleVote = async (optionIndex: number) => {
    if (!lesson?.id || !currentOfficerId) {
      toast.error("Please ensure you are logged in to vote.");
      return;
    }
    try {
      await voteOnPoll.mutateAsync({
        lessonId: lesson.id,
        officerId: currentOfficerId,
        optionIndex,
      });
      toast.success("Vote recorded successfully!");
    } catch (error) {
      console.error("Error voting on poll:", error);
      toast.error("Failed to record vote");
    }
  };
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

        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 leading-relaxed">
          {renderMarkdown(lesson.content)}
        </div>

        {lesson.poll_question && lesson.poll_options && lesson.poll_options.length > 0 && (
          <div className="mt-6 border rounded-xl p-5 bg-card/50 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-base flex items-center gap-2 text-foreground">
                <BarChart2 className="h-4 w-4 text-primary" />
                {lesson.poll_question}
              </h4>
              <Badge variant="secondary" className="text-xs">
                {totalVotes} {totalVotes === 1 ? 'Vote' : 'Votes'}
              </Badge>
            </div>

            <div className="space-y-3 pt-2">
              {lesson.poll_options.map((option, idx) => {
                const optionVotesCount = votes.filter(v => v.option_index === idx).length;
                const percentage = totalVotes > 0 ? Math.round((optionVotesCount / totalVotes) * 100) : 0;
                const isSelected = userVote?.option_index === idx;

                return (
                  <div
                    key={idx}
                    onClick={() => handleVote(idx)}
                    className={`relative overflow-hidden rounded-lg border p-3.5 transition-all cursor-pointer hover:border-primary/50 ${
                      isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'bg-background'
                    }`}
                  >
                    {/* Background percentage bar */}
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-primary/10 transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                    <div className="relative flex items-center justify-between z-10">
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold ${
                          isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 text-muted-foreground'
                        }`}>
                          {isSelected ? '✓' : idx + 1}
                        </div>
                        <span className="font-medium text-sm text-foreground">{option}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
                        <span>{optionVotesCount} {optionVotesCount === 1 ? 'vote' : 'votes'}</span>
                        <span className="w-10 text-right text-primary font-bold">{percentage}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {userVote && (
              <div className="text-xs text-muted-foreground text-center pt-1">
                Your vote has been recorded. Click another option to change your vote.
              </div>
            )}
          </div>
        )}

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
