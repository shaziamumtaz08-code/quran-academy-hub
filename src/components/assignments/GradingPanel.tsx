import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Download, Check, Loader2, ChevronLeft, ChevronRight, FileText,
} from 'lucide-react';

interface GradingPanelProps {
  submissionId: string;
  submissionIds: string[]; // all submission IDs for navigation
  onGraded: () => void;
  onNavigate: (submissionId: string) => void;
}

export function GradingPanel({ submissionId, submissionIds, onGraded, onNavigate }: GradingPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [status, setStatus] = useState('graded');

  // Fetch full submission with joins
  const { data: submission, isLoading } = useQuery({
    queryKey: ['grading-submission', submissionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_assignment_submissions')
        .select('id, student_id, assignment_id, status, submitted_at, response_text, file_url, file_name, score, feedback, graded_at, graded_by')
        .eq('id', submissionId)
        .single();
      if (error) throw error;
      
      // Fetch student profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email, photo_url')
        .eq('id', data.student_id)
        .single();
      
      // Fetch assignment details
      const { data: assignment } = await supabase
        .from('course_assignments')
        .select('id, title, instructions, due_date, file_url, file_name')
        .eq('id', data.assignment_id)
        .single();

      return { ...data, profile, assignment };
    },
    enabled: !!submissionId,
  });

  // Sync local state when submission loads
  useEffect(() => {
    if (submission) {
      setScore(submission.score != null ? String(submission.score) : '');
      setFeedback(submission.feedback || '');
      setStatus(submission.status === 'submitted' ? 'graded' : submission.status);
    }
  }, [submission]);

  const gradeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('course_assignment_submissions')
        .update({
          score: score ? Number(score) : null,
          feedback: feedback || null,
          status,
          graded_by: user!.id,
          graded_at: new Date().toISOString(),
        })
        .eq('id', submissionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Grade saved');
      queryClient.invalidateQueries({ queryKey: ['teacher-all-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['grading-submission'] });
      onGraded();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Navigation
  const currentIndex = submissionIds.indexOf(submissionId);
  const prevId = currentIndex > 0 ? submissionIds[currentIndex - 1] : null;
  const nextId = currentIndex < submissionIds.length - 1 ? submissionIds[currentIndex + 1] : null;

  const statusBadgeColor = (s: string) => {
    switch (s) {
      case 'graded': return 'bg-emerald-500 text-white';
      case 'submitted': return 'bg-amber-500 text-white';
      case 'needs_revision': return 'border-orange-500 text-orange-600';
      default: return '';
    }
  };

  const presetScores = [25, 50, 75, 90, 100];

  if (isLoading) {
    return (
      <div className="space-y-4 mt-4">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }

  if (!submission) {
    return <p className="text-sm text-muted-foreground mt-4">Submission not found.</p>;
  }

  const initials = (submission.profile?.full_name || 'S').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="mt-4 space-y-5 pb-4">
      {/* ─── HEADER ─── */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{submission.profile?.full_name || 'Student'}</p>
          <p className="text-xs text-muted-foreground truncate">{submission.assignment?.title}</p>
          {submission.submitted_at && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Submitted {format(new Date(submission.submitted_at), 'MMM d, yyyy · h:mm a')}
            </p>
          )}
        </div>
        <Badge className={cn('text-[10px] shrink-0', statusBadgeColor(submission.status))}>
          {submission.status}
        </Badge>
      </div>

      {/* ─── SUBMISSION SECTION ─── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Submission</p>
        {submission.response_text ? (
          <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap">
            {submission.response_text}
          </div>
        ) : null}
        {submission.file_url ? (
          <Button variant="outline" size="sm" onClick={() => window.open(submission.file_url!, '_blank')}>
            <Download className="h-4 w-4 mr-1" /> {submission.file_name || 'Download Submission'}
          </Button>
        ) : null}
        {!submission.response_text && !submission.file_url && (
          <p className="text-sm text-muted-foreground italic">No content submitted</p>
        )}
      </div>

      {/* ─── REFERENCE SECTION ─── */}
      <Accordion type="single" collapsible>
        <AccordionItem value="instructions" className="border rounded-lg px-3">
          <AccordionTrigger className="text-xs font-medium py-2">
            <span className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Assignment Instructions
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-sm pb-3">
            {submission.assignment?.instructions ? (
              <div className="whitespace-pre-wrap">{submission.assignment.instructions}</div>
            ) : (
              <p className="text-muted-foreground italic">No instructions provided</p>
            )}
            {submission.assignment?.due_date && (
              <p className="text-xs text-muted-foreground mt-2">
                Due: {format(new Date(submission.assignment.due_date), 'MMM d, yyyy')}
              </p>
            )}
            {submission.assignment?.file_url && (
              <Button variant="link" size="sm" className="mt-1 p-0 h-auto text-xs" onClick={() => window.open(submission.assignment!.file_url!, '_blank')}>
                <Download className="h-3 w-3 mr-1" /> Download Assignment File
              </Button>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* ─── GRADING SECTION ─── */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grading</p>
        
        {/* Score */}
        <div>
          <Label className="text-xs">Score</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={e => setScore(e.target.value)}
              className="w-24"
              placeholder="0-100"
            />
            {score && <span className="text-sm text-muted-foreground">({score}%)</span>}
          </div>
        </div>

        {/* Quick-pick */}
        <div className="flex gap-1.5 flex-wrap">
          {presetScores.map(ps => (
            <Button
              key={ps}
              size="sm"
              variant={score === String(ps) ? 'default' : 'outline'}
              className="text-xs h-7 px-3"
              onClick={() => setScore(String(ps))}
            >
              {ps}
            </Button>
          ))}
        </div>

        {/* Feedback */}
        <div>
          <Label className="text-xs">Feedback</Label>
          <Textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            rows={3}
            placeholder="Write feedback for the student..."
            className="mt-1"
          />
        </div>

        {/* Status */}
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="graded">Graded — Assignment complete</SelectItem>
              <SelectItem value="needs_revision">Needs Revision — Return to student</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Save */}
        <Button className="w-full" onClick={() => gradeMutation.mutate()} disabled={gradeMutation.isPending}>
          {gradeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
          Save Grade
        </Button>
      </div>

      {/* ─── NAVIGATION ─── */}
      {submissionIds.length > 1 && (
        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            size="sm"
            variant="ghost"
            disabled={!prevId}
            onClick={() => prevId && onNavigate(prevId)}
            className="text-xs"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous Student
          </Button>
          <span className="text-[10px] text-muted-foreground">
            {currentIndex + 1} / {submissionIds.length}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={!nextId}
            onClick={() => nextId && onNavigate(nextId)}
            className="text-xs"
          >
            Next Student <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
