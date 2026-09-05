import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Loader2, Share2 } from 'lucide-react';
import { listAssignmentsForStudent, submitSyncedToAssignment } from '@/lib/syncedSubmissions';
import type { UserResource } from '@/lib/myResources';

export type SyncedSource =
  | { kind: 'resource'; resource: UserResource }
  | { kind: 'content'; content: 'qaida' | 'mushaf'; title: string; state?: Record<string, any> }
  | { kind: 'doc'; docId: string; title: string; type?: string | null };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string;
  source: SyncedSource | null;
  /** Live classroom state worth keeping with the submission (page, baab, …). */
  syncedState?: Record<string, any>;
  origin?: 'vcr' | 'my_resources';
  onSubmitted?: (submissionId: string) => void;
}

/**
 * Hand the shared working object in as an assignment submission. The student's
 * own copy is left exactly as it is — the assignment gets its own linked copy.
 */
export function SubmitToAssignmentDialog({
  open, onOpenChange, studentId, source, syncedState, origin = 'vcr', onSubmitted,
}: Props) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignmentId, setAssignmentId] = useState<string>('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !studentId) return;
    setLoading(true);
    void listAssignmentsForStudent(studentId)
      .then((rows) => setAssignments(rows))
      .catch((e: any) => toast({ title: 'Could not load your assignments', description: e?.message, variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [open, studentId]);

  const submit = async () => {
    if (!assignmentId || !source) return;
    setSaving(true);
    try {
      const { submission } = await submitSyncedToAssignment({
        assignmentId, studentId, source, syncedState, origin, note: note.trim() || null,
      });
      toast({ title: 'Handed in', description: 'Your teacher has been told and can now mark it.' });
      onSubmitted?.(submission.id);
      onOpenChange(false);
      setNote('');
    } catch (e: any) {
      toast({ title: 'Could not hand this in', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Submit to assignment
          </DialogTitle>
          <DialogDescription>
            This hands in a synced copy of what you are working on. Your own copy stays private and unchanged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Assignment</Label>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your assignments…
              </div>
            ) : assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">You have no open assignments right now.</p>
            ) : (
              <Select value={assignmentId} onValueChange={setAssignmentId}>
                <SelectTrigger><SelectValue placeholder="Choose an assignment" /></SelectTrigger>
                <SelectContent>
                  {assignments.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.title}{a.course?.name ? ` · ${a.course.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Note for your teacher (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Anything you want to say about this work" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={!assignmentId || !source || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit synced copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
