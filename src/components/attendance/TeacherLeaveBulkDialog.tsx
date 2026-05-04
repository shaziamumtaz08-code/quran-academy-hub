import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const TEACHER_LEAVE_REASONS = [
  { value: 'sick', label: 'Sick' },
  { value: 'personal', label: 'Personal' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'family', label: 'Family Matter' },
  { value: 'travel', label: 'Travel' },
  { value: 'medical', label: 'Medical Appointment' },
  { value: 'other', label: 'Other' },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  divisionId: string | null;
}

export function TeacherLeaveBulkDialog({ open, onOpenChange, divisionId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [teacherId, setTeacherId] = useState('');
  const [from, setFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reasonCategory, setReasonCategory] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [leaveType, setLeaveType] = useState<'paid' | 'unpaid'>('unpaid');

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-for-leave'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'teacher');
      const ids = [...new Set((roles || []).map((r: any) => r.user_id))];
      if (!ids.length) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids)
        .order('full_name');
      return data || [];
    },
    enabled: open,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Missing user');
      if (!teacherId) throw new Error('Select teacher');
      if (new Date(to) < new Date(from)) throw new Error('End date before start date');
      const reason = reasonCategory === 'other' ? reasonText : (TEACHER_LEAVE_REASONS.find(r => r.value === reasonCategory)?.label || reasonCategory);
      const { error } = await supabase.from('leave_events' as any).insert({
        teacher_id: teacherId,
        leave_type: leaveType,
        start_date: from,
        end_date: to,
        reason: reason || null,
        status: 'approved',
        approved_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Teacher leave saved', description: `From ${from} to ${to}` });
      qc.invalidateQueries({ queryKey: ['leave_events'] });
      qc.invalidateQueries({ queryKey: ['missing-attendance'] });
      onOpenChange(false);
      setTeacherId(''); setReasonCategory(''); setReasonText('');
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="font-serif text-foreground">Teacher Leave (bulk)</DialogTitle>
          <DialogDescription>Mark a teacher on leave for a date range — sessions will be excluded from missing.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">Teacher *</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
              <SelectContent>
                {teachers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-foreground">From *</Label>
              <Input type="date" value={from} onChange={e => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">To *</Label>
              <Input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Leave Type</Label>
            <Select value={leaveType} onValueChange={v => setLeaveType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Reason *</Label>
            <Select value={reasonCategory} onValueChange={setReasonCategory}>
              <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
              <SelectContent>
                {TEACHER_LEAVE_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {reasonCategory === 'other' && (
            <div className="space-y-2">
              <Label className="text-foreground">Specify *</Label>
              <Textarea value={reasonText} onChange={e => setReasonText(e.target.value)} />
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1" disabled={!teacherId || !reasonCategory || (reasonCategory === 'other' && !reasonText.trim()) || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving...' : 'Save Leave'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
