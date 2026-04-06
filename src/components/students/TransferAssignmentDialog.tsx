import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, UserCheck, Loader2, AlertTriangle, Calendar } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface TransferAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  currentTeacherId: string;
  currentTeacherName: string;
  assignmentId: string;
}

export function TransferAssignmentDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  currentTeacherId,
  currentTeacherName,
  assignmentId,
}: TransferAssignmentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [transferType, setTransferType] = useState<'permanent' | 'substitute'>('permanent');
  const [newTeacherId, setNewTeacherId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [substituteEndDate, setSubstituteEndDate] = useState('');
  const [reason, setReason] = useState('');

  // Fetch all teachers except current
  const { data: teachers = [] } = useQuery({
    queryKey: ['transfer-teachers-list'],
    queryFn: async () => {
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'teacher');
      if (!roleRows?.length) return [];
      const ids = roleRows.map(r => r.user_id).filter(id => id !== currentTeacherId);
      if (!ids.length) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids)
        .is('archived_at', null)
        .order('full_name');
      return data || [];
    },
    enabled: open,
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      const sb = supabase as any;

      if (transferType === 'permanent') {
        // 1. Mark old assignment as completed
        await sb
          .from('student_teacher_assignments')
          .update({
            status: 'completed',
            effective_to_date: effectiveDate,
            status_effective_date: effectiveDate,
          })
          .eq('id', assignmentId);

        // 2. Log to assignment_history
        await sb
          .from('assignment_history')
          .update({ ended_at: new Date().toISOString(), reason: reason || 'Permanent transfer' })
          .eq('assignment_id', assignmentId)
          .eq('teacher_id', currentTeacherId)
          .is('ended_at', null);

        // 3. Get old assignment details for the new one
        const { data: oldAssign } = await sb
          .from('student_teacher_assignments')
          .select('subject_id, branch_id, division_id, duration_minutes, payout_amount, payout_type, fee_package_id, requires_schedule, requires_planning, requires_attendance')
          .eq('id', assignmentId)
          .single();

        // 4. Create new assignment for new teacher
        const { data: newAssign } = await sb
          .from('student_teacher_assignments')
          .insert({
            student_id: studentId,
            teacher_id: newTeacherId,
            subject_id: oldAssign.subject_id,
            branch_id: oldAssign.branch_id,
            division_id: oldAssign.division_id,
            duration_minutes: oldAssign.duration_minutes,
            payout_amount: oldAssign.payout_amount,
            payout_type: oldAssign.payout_type,
            fee_package_id: oldAssign.fee_package_id,
            status: 'active',
            effective_from_date: effectiveDate,
            transfer_type: 'permanent',
            requires_schedule: oldAssign.requires_schedule,
            requires_planning: oldAssign.requires_planning,
            requires_attendance: oldAssign.requires_attendance,
          })
          .select('id')
          .single();

        // 5. Log new assignment history
        if (newAssign) {
          await sb.from('assignment_history').insert({
            assignment_id: newAssign.id,
            student_id: studentId,
            teacher_id: newTeacherId,
            subject_id: oldAssign.subject_id,
            started_at: new Date().toISOString(),
            reason: reason || 'Permanent transfer from ' + currentTeacherName,
          });
        }
      } else {
        // SUBSTITUTE flow
        // 1. Pause the original assignment
        await sb
          .from('student_teacher_assignments')
          .update({
            status: 'paused',
            status_effective_date: effectiveDate,
          })
          .eq('id', assignmentId);

        // 2. Get old assignment details
        const { data: oldAssign } = await sb
          .from('student_teacher_assignments')
          .select('subject_id, branch_id, division_id, duration_minutes, payout_amount, payout_type, fee_package_id, requires_schedule, requires_planning, requires_attendance')
          .eq('id', assignmentId)
          .single();

        // 3. Create substitute assignment linked to parent
        const { data: subAssign } = await sb
          .from('student_teacher_assignments')
          .insert({
            student_id: studentId,
            teacher_id: newTeacherId,
            subject_id: oldAssign.subject_id,
            branch_id: oldAssign.branch_id,
            division_id: oldAssign.division_id,
            duration_minutes: oldAssign.duration_minutes,
            payout_amount: oldAssign.payout_amount,
            payout_type: oldAssign.payout_type,
            fee_package_id: oldAssign.fee_package_id,
            status: 'active',
            effective_from_date: effectiveDate,
            effective_to_date: substituteEndDate || null,
            transfer_type: 'substitute',
            parent_assignment_id: assignmentId,
            substitute_end_date: substituteEndDate || null,
            requires_schedule: oldAssign.requires_schedule,
            requires_planning: oldAssign.requires_planning,
            requires_attendance: oldAssign.requires_attendance,
          })
          .select('id')
          .single();

        // 4. Log history
        if (subAssign) {
          await sb.from('assignment_history').insert({
            assignment_id: subAssign.id,
            student_id: studentId,
            teacher_id: newTeacherId,
            subject_id: oldAssign.subject_id,
            started_at: new Date().toISOString(),
            reason: reason || `Temporary substitute until ${substituteEndDate || 'TBD'}`,
          });
        }
      }
    },
    onSuccess: () => {
      toast({
        title: transferType === 'permanent' ? 'Student Transferred' : 'Substitute Assigned',
        description: transferType === 'permanent'
          ? `${studentName} has been permanently transferred. Previous teacher's records are preserved.`
          : `${studentName} has a temporary substitute. Original assignment is paused and will resume after the substitute period.`,
      });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['salary'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: 'Transfer Failed', description: err.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setTransferType('permanent');
    setNewTeacherId('');
    setEffectiveDate(format(new Date(), 'yyyy-MM-dd'));
    setSubstituteEndDate('');
    setReason('');
  };

  const canSubmit = newTeacherId && effectiveDate && (transferType === 'permanent' || substituteEndDate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Transfer / Substitute
          </DialogTitle>
          <DialogDescription>
            Reassign <strong>{studentName}</strong> from <strong>{currentTeacherName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Transfer Type */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Transfer Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTransferType('permanent')}
                className={`rounded-xl border-2 p-3 text-left transition-all ${
                  transferType === 'permanent'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <p className="text-sm font-bold">Permanent</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Old assignment closes. New teacher takes over fully.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setTransferType('substitute')}
                className={`rounded-xl border-2 p-3 text-left transition-all ${
                  transferType === 'substitute'
                    ? 'border-amber-500 bg-amber-500/5'
                    : 'border-border hover:border-amber-500/40'
                }`}
              >
                <p className="text-sm font-bold">Temporary</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Original teacher paused. Resumes after substitute period.
                </p>
              </button>
            </div>
          </div>

          {/* New Teacher */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">New Teacher</Label>
            <Select value={newTeacherId} onValueChange={setNewTeacherId}>
              <SelectTrigger>
                <SelectValue placeholder="Select teacher..." />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Effective Date */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Effective From</Label>
            <Input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>

          {/* Substitute End Date */}
          {transferType === 'substitute' && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Substitute Until</Label>
              <Input
                type="date"
                value={substituteEndDate}
                onChange={(e) => setSubstituteEndDate(e.target.value)}
                min={effectiveDate}
              />
              <p className="text-[11px] text-muted-foreground">
                Original teacher's assignment will auto-resume after this date.
              </p>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Teacher on leave, permanent reassignment..."
              rows={2}
            />
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-700 dark:text-amber-400">
              {transferType === 'permanent' ? (
                <>All attendance, lesson history, and salary records under {currentTeacherName} are <strong>preserved</strong>. The old assignment will be marked as completed.</>
              ) : (
                <>{currentTeacherName}'s assignment will be <strong>paused</strong> (not deleted). When the substitute period ends, you can reactivate it from the assignments page.</>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => transferMutation.mutate()}
            disabled={!canSubmit || transferMutation.isPending}
            className={transferType === 'substitute' ? 'bg-amber-500 hover:bg-amber-600' : ''}
          >
            {transferMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {transferType === 'permanent' ? 'Transfer Permanently' : 'Assign Substitute'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
