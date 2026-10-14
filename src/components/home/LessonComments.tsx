// src/components/home/LessonComments.tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Trash2, User as UserIcon } from "lucide-react";
import { useLessonComments, useWeeklyLessonMutations } from "@/hooks/useWeeklyLesson";
import { toast } from "sonner";

interface LessonCommentsProps {
  lessonId?: string;
  currentOfficerId?: string;
  isAdminOrSupervisor?: boolean;
}

export const LessonComments = ({
  lessonId,
  currentOfficerId,
  isAdminOrSupervisor = false,
}: LessonCommentsProps) => {
  const [newComment, setNewComment] = useState("");
  const { data: comments = [], isLoading } = useLessonComments(lessonId);
  const { addComment, deleteComment } = useWeeklyLessonMutations();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonId) {
      toast.error("No active lesson selected");
      return;
    }
    if (!currentOfficerId) {
      toast.error("User profile not loaded. Please try again.");
      return;
    }
    if (!newComment.trim()) {
      toast.error("Comment cannot be empty");
      return;
    }

    try {
      await addComment.mutateAsync({
        lessonId,
        officerId: currentOfficerId,
        content: newComment.trim(),
      });
      setNewComment("");
      toast.success("Comment posted successfully");
    } catch (error) {
      console.error("Error posting comment:", error);
      toast.error("Failed to post comment");
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!lessonId) return;
    try {
      await deleteComment.mutateAsync({ commentId, lessonId });
      toast.success("Comment deleted");
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg font-semibold">
            Discussion Board ({comments.length})
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Add comment form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            placeholder="Share your thoughts, feedback, or encouragement..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={addComment.isPending || !newComment.trim()}
            >
              <Send className="h-4 w-4 mr-1.5" />
              {addComment.isPending ? "Posting..." : "Post Comment"}
            </Button>
          </div>
        </form>

        {/* Comments list */}
        <div className="space-y-4 pt-2">
          {isLoading ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm bg-muted/20 rounded-lg">
              No comments yet. Be the first to share your thoughts!
            </div>
          ) : (
            comments.map((comment) => {
              const officer = comment.officer;
              const authorName = officer
                ? `${officer.rank ? officer.rank + ' ' : ''}${officer.full_name || ''}`.trim()
                : 'Officer';
              const canDelete = isAdminOrSupervisor || comment.officer_id === currentOfficerId;

              return (
                <div
                  key={comment.id}
                  className="p-3.5 rounded-lg bg-muted/40 border space-y-1.5 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="bg-primary/10 p-1.5 rounded-full">
                        <UserIcon className="h-3 w-3 text-primary" />
                      </div>
                      <span className="font-semibold text-foreground">
                        {authorName}
                      </span>
                      {officer?.badge_number && (
                        <span className="text-xs text-muted-foreground">
                          (#{officer.badge_number})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-muted-foreground">
                        {comment.created_at
                          ? new Date(comment.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(comment.id)}
                          title="Delete comment"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-foreground/90 pl-7 whitespace-pre-line">
                    {comment.content}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};
