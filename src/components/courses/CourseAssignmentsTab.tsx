import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, isPast, differenceInHours } from 'date-fns';
import {
  Plus, Trash2, Loader2, FileText, Upload, Clock, CheckCircle2,
  AlertCircle, Eye, MessageSquare, Paperclip, Calendar, Users
} from 'lucide-react';

interface CourseAssignmentsTabProps {
  courseId: string;
}

export function CourseAssignmentsTab({ courseId }: CourseAssignmentsTabProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Form state
  const [form, setForm] = useState({ title: '', instructions: '', due_date: '', file_name: '' });
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['course-assignments', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_assignments')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createAssignment = useMutation({
    mutationFn: async () => {
      let fileUrl: string | null = null;
      if (fileToUpload) {
        const path = `${courseId}/assignments/${Date.now()}_${fileToUpload.name}`;
        const { error: upErr } = await supabase.storage.from('course-materials').upload(path, fileToUpload);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('course-materials').getPublicUrl(path);
        fileUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('course_assignments').insert({
        course_id: courseId,
        title: form.title.trim(),
        instructions: form.instructions.trim() || null,
        due_date: form.due_date || null,
        file_url: fileUrl,
        file_name: fileToUpload?.name || form.file_name || null,
        created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-assignments', courseId] });
      setCreateOpen(false);
      setForm({ title: '', instructions: '', due_date: '', file_name: '' });
      setFileToUpload(null);
      toast({ title: 'Assignment created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('course_assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-assignments', courseId] });
      toast({ title: 'Assignment deleted' });
    },
  });

  const getStatusInfo = (a: any) => {
    if (!a.due_date) return { label: 'No deadline', color: 'bg-muted text-muted-foreground border-border' };
    const due = new Date(a.due_date);
    if (isPast(due)) return { label: 'Past due', color: 'bg-destructive/10 text-destructive border-destructive/20' };
    const hoursLeft = differenceInHours(due, new Date());
    if (hoursLeft <= 24) return { label: 'Due soon', color: 'bg-amber-500/10 text-amber-600 border-amber-200' };
    return { label: 'Active', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-1.5">
          <FileText className="h-4 w-4" /> Assignments ({assignments.length})
        </h3>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Create Assignment
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : assignments.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          No assignments yet. Create one for students to submit.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {assignments.map((a: any) => {
            const statusInfo = getStatusInfo(a);
            return (
              <Card key={a.id} className="shadow-sm hover:shadow transition-shadow cursor-pointer"
                onClick={() => setViewId(a.id)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <button onClick={e => { e.stopPropagation(); deleteAssignment.mutate(a.id); }}
                      className="p-1 text-muted-foreground hover:text-destructive shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {a.instructions && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{a.instructions}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={cn("text-[10px]", statusInfo.color)}>{statusInfo.label}</Badge>
                    {a.due_date && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Calendar className="h-3 w-3" /> {format(new Date(a.due_date), 'MMM d, yyyy h:mm a')}
                      </span>
                    )}
                    {a.file_url && (
                      <span className="text-[10px] text-primary flex items-center gap-0.5">
                        <Paperclip className="h-3 w-3" /> {a.file_name || 'Attachment'}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Assignment</DialogTitle>
            <DialogDescription>Post an assignment for enrolled students</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Assignment title" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Instructions</Label>
              <Textarea value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} rows={4} placeholder="Detailed instructions…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due Date</Label>
              <Input type="datetime-local" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Attachment (optional)</Label>
              <Input type="file" ref={fileRef} className="cursor-pointer"
                onChange={e => setFileToUpload(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createAssignment.mutate()} disabled={!form.title.trim() || createAssignment.isPending}>
              {createAssignment.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submissions Drawer */}
      {viewId && (
        <SubmissionsDrawer
          open={!!viewId}
          onOpenChange={() => setViewId(null)}
          assignmentId={viewId}
          courseId={courseId}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// SUBMISSIONS DRAWER
// ═══════════════════════════════════════════════════
function SubmissionsDrawer({ open, onOpenChange, assignmentId, courseId }: {
  open: boolean; onOpenChange: (v: boolean) => void; assignmentId: string; courseId: string;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [statusUpdate, setStatusUpdate] = useState<{ id: string; status: string } | null>(null);

  const { data: assignment } = useQuery({
    queryKey: ['assignment-detail', assignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['assignment-submissions', assignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_assignment_submissions')
        .select('*, profile:student_id(id, full_name, email)')
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: enrolledStudents = [] } = useQuery({
    queryKey: ['course-enrolled-assignments', courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('course_enrollments')
        .select('student_id, profile:student_id(id, full_name)')
        .eq('course_id', courseId)
        .eq('status', 'active');
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('course_assignment_submissions')
        .update({ status, graded_by: user?.id, graded_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignment-submissions', assignmentId] });
      setStatusUpdate(null);
      toast({ title: 'Status updated' });
    },
  });

  const saveFeedback = useMutation({
    mutationFn: async () => {
      if (!feedbackId) return;
      const { error } = await supabase.from('course_assignment_submissions')
        .update({ feedback: feedbackText.trim(), graded_by: user?.id, graded_at: new Date().toISOString() })
        .eq('id', feedbackId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignment-submissions', assignmentId] });
      setFeedbackId(null); setFeedbackText('');
      toast({ title: 'Feedback saved' });
    },
  });

  const submittedIds = new Set(submissions.map((s: any) => s.student_id));
  const missingStudents = enrolledStudents.filter((e: any) => !submittedIds.has(e.student_id));

  const statusColor = (s: string) => {
    if (s === 'graded') return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
    if (s === 'late') return 'bg-amber-500/10 text-amber-600 border-amber-200';
    if (s === 'missing') return 'bg-destructive/10 text-destructive border-destructive/20';
    return 'bg-blue-500/10 text-blue-600 border-blue-200';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{assignment?.title || 'Assignment'}</SheetTitle>
          <SheetDescription>
            {assignment?.due_date && `Due: ${format(new Date(assignment.due_date), 'MMM d, yyyy h:mm a')}`}
            {' • '}{submissions.length} submitted, {missingStudents.length} missing
          </SheetDescription>
        </SheetHeader>

        {assignment?.instructions && (
          <div className="mt-3 p-3 bg-muted/30 rounded-lg text-sm">{assignment.instructions}</div>
        )}

        <div className="mt-4 space-y-4">
          {/* Submissions */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Submissions ({submissions.length})</p>
            {isLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : submissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submissions yet.</p>
            ) : (
              <div className="space-y-2">
                {submissions.map((sub: any) => (
                  <Card key={sub.id}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{sub.profile?.full_name || 'Unknown'}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Submitted {format(new Date(sub.submitted_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Select value={sub.status} onValueChange={val => updateStatus.mutate({ id: sub.id, status: val })}>
                            <SelectTrigger className="h-7 w-28 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="submitted">Submitted</SelectItem>
                              <SelectItem value="late">Late</SelectItem>
                              <SelectItem value="graded">Graded</SelectItem>
                              <SelectItem value="missing">Missing</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {sub.response_text && (
                        <div className="text-xs bg-muted/30 p-2 rounded">{sub.response_text}</div>
                      )}
                      {sub.file_url && (
                        <a href={sub.file_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1">
                          <Paperclip className="h-3 w-3" /> {sub.file_name || 'Submitted file'}
                        </a>
                      )}

                      {sub.feedback && (
                        <div className="text-xs p-2 bg-primary/5 rounded border border-primary/10">
                          <span className="font-medium">Feedback:</span> {sub.feedback}
                        </div>
                      )}

                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                        onClick={() => { setFeedbackId(sub.id); setFeedbackText(sub.feedback || ''); }}>
                        <MessageSquare className="h-3 w-3" /> {sub.feedback ? 'Edit Feedback' : 'Add Feedback'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Missing Students */}
          {missingStudents.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Missing ({missingStudents.length})
              </p>
              <div className="space-y-1">
                {missingStudents.map((e: any) => (
                  <div key={e.student_id} className="flex items-center justify-between px-3 py-1.5 bg-destructive/5 rounded-md">
                    <span className="text-sm">{e.profile?.full_name || 'Unknown'}</span>
                    <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">Missing</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Feedback Dialog */}
        <Dialog open={!!feedbackId} onOpenChange={() => setFeedbackId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Teacher Feedback</DialogTitle>
              <DialogDescription>Leave feedback for the student</DialogDescription>
            </DialogHeader>
            <Textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)} rows={4} placeholder="Your feedback…" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setFeedbackId(null)}>Cancel</Button>
              <Button onClick={() => saveFeedback.mutate()} disabled={saveFeedback.isPending}>
                {saveFeedback.isPending ? 'Saving…' : 'Save Feedback'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
