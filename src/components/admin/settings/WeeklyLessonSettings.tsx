// src/components/admin/settings/WeeklyLessonSettings.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Edit2, BookOpen, Image as ImageIcon } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { useWeeklyLessonsList, useWeeklyLessonMutations, WeeklyLesson } from '@/hooks/useWeeklyLesson';
import { getWeekStartDateString, formatWeekRange, parseLocalDate } from '@/utils/weekUtils';
import { supabase } from '@/integrations/supabase/client';

export const WeeklyLessonSettings = () => {
  const { data: lessons = [], isLoading } = useWeeklyLessonsList();
  const { upsertLesson, deleteLesson } = useWeeklyLessonMutations();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [weekStartDate, setWeekStartDate] = useState(getWeekStartDateString());
  const [photoUrl, setPhotoUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleOpenCreate = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setWeekStartDate(getWeekStartDateString());
    setPhotoUrl('');
    setIsActive(true);
    setIsOpen(true);
  };

  const handleOpenEdit = (lesson: WeeklyLesson) => {
    setEditingId(lesson.id);
    setTitle(lesson.title);
    setContent(lesson.content);
    setWeekStartDate(lesson.week_start_date || getWeekStartDateString());
    setPhotoUrl(lesson.photo_url || '');
    setIsActive(lesson.is_active);
    setIsOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('lesson-photos')
        .upload(filePath, file);

      if (uploadError) {
        // If bucket doesn't exist, try fallback or throw error
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('lesson-photos')
        .getPublicUrl(filePath);

      setPhotoUrl(publicUrl);
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image. You can also paste an image URL directly.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error('Title and content are required');
      return;
    }

    try {
      // Get current user for author ID
      const { data: { user } } = await supabase.auth.getUser();

      await upsertLesson.mutateAsync({
        ...(editingId ? { id: editingId } : {}),
        title: title.trim(),
        content: content.trim(),
        week_start_date: weekStartDate,
        photo_url: photoUrl.trim() || null,
        is_active: isActive,
        created_by: user?.id,
      });

      toast.success(editingId ? 'Weekly lesson updated successfully' : 'Weekly lesson created successfully');
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving weekly lesson:', error);
      toast.error('Failed to save weekly lesson');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this weekly lesson?')) return;
    try {
      const lessonToDelete = lessons.find((l) => l.id === id);
      if (lessonToDelete?.photo_url) {
        const urlParts = lessonToDelete.photo_url.split('/lesson-photos/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          await supabase.storage.from('lesson-photos').remove([filePath]);
        }
      }

      await deleteLesson.mutateAsync(id);
      toast.success('Weekly lesson and associated photo deleted');
    } catch (error) {
      console.error('Error deleting lesson:', error);
      toast.error('Failed to delete lesson');
    }
  };

  const handleCleanupArchivedPhotos = async () => {
    if (!confirm('This will remove photo attachments from all archived (inactive) weekly lessons to free up storage. The lesson text will be preserved. Proceed?')) return;
    try {
      const archivedLessons = lessons.filter((l) => !l.is_active && l.photo_url);
      if (archivedLessons.length === 0) {
        toast.info('No photos found on archived lessons to clean up.');
        return;
      }

      let cleanedCount = 0;
      for (const lesson of archivedLessons) {
        if (lesson.photo_url) {
          const urlParts = lesson.photo_url.split('/lesson-photos/');
          if (urlParts.length > 1) {
            const filePath = urlParts[1];
            await supabase.storage.from('lesson-photos').remove([filePath]);
          }
          // Update lesson photo_url to null in DB
          await supabase
            .from('weekly_lessons')
            .update({ photo_url: null })
            .eq('id', lesson.id);
          cleanedCount++;
        }
      }

      toast.success(`Successfully cleaned up photos from ${cleanedCount} archived lesson(s).`);
      window.location.reload();
    } catch (error) {
      console.error('Error cleaning up archived photos:', error);
      toast.error('Failed to clean up archived photos');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading weekly lessons...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl flex items-center space-x-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span>Weekly Lesson Management</span>
          </CardTitle>
          <CardDescription>
            Create, edit, and manage weekly lessons, scriptures, and leadership thought posts for officers.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCleanupArchivedPhotos} title="Remove storage files from archived lessons to save space">
            Cleanup Archived Photos
          </Button>
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Weekly Lesson
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {lessons.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/20">
            No weekly lessons found. Click "New Weekly Lesson" to add one.
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lessons.map((lesson) => {
                  const weekRange = lesson.week_start_date
                    ? formatWeekRange(parseLocalDate(lesson.week_start_date))
                    : 'N/A';
                  const authorName = lesson.author
                    ? `${lesson.author.rank || ''} ${lesson.author.full_name || ''}`.trim()
                    : 'Admin';

                  return (
                    <TableRow key={lesson.id}>
                      <TableCell className="font-medium">{weekRange}</TableCell>
                      <TableCell>{lesson.title}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            lesson.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          {lesson.is_active ? 'Active' : 'Archived'}
                        </span>
                      </TableCell>
                      <TableCell>{authorName}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(lesson)}
                          title="Edit lesson"
                        >
                          <Edit2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(lesson.id)}
                          title="Delete lesson"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Edit Weekly Lesson' : 'Create Weekly Lesson'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSave} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Week 42: Courage and Integrity"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weekStart">Week Start Date (Sunday)</Label>
                  <Input
                    id="weekStart"
                    type="date"
                    value={weekStartDate}
                    onChange={(e) => setWeekStartDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Lesson Content / Scripture / Message</Label>
                <Textarea
                  id="content"
                  placeholder="Enter the weekly message, scripture, or leadership lesson..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="photo">Featured Image / Photo</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="photo"
                    placeholder="https://example.com/image.jpg or upload image"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                  />
                  <label className="cursor-pointer">
                    <Button type="button" variant="outline" disabled={uploadingImage} asChild>
                      <span>
                        {uploadingImage ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <ImageIcon className="h-4 w-4 mr-1" />
                        )}
                        Upload
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                </div>
                {photoUrl && (
                  <div className="mt-2 relative rounded-md overflow-hidden border h-36 bg-muted/30 flex items-center justify-center">
                    <img src={photoUrl} alt="Preview" className="h-full object-contain" />
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="active" className="cursor-pointer">
                  Active (Display as current weekly lesson)
                </Label>
              </div>

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={upsertLesson.isPending}>
                  {upsertLesson.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingId ? 'Save Changes' : 'Post Lesson'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
