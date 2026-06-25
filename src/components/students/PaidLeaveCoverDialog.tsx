import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, HeartHandshake, Info } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalAssignmentId: string;
  originalTeacherName: string;
  studentName: string;
}

export function PaidLeaveCoverDialog({
  open,
  onOpenChange,
  originalAssignmentId,
  originalTeacherName,
  studentName,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [replacementId, setReplacementId] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 14), 'yyyy-MM-dd'));
  const [payout, setPayout] = useState<string>('0');
  const [salaryLinked, setSalaryLinked] = useState(true);
  const [reason, setReason] = useState('Paid leave cover');

  useEffect(() => {
    if (open) {
      setReplacementId('');
      setStartDate(format(new Date(), 'yyyy-MM-dd'));
      setEndDate(format(addDays(new Date(), 14), 'yyyy-MM-dd'));
      setPayout('0');
      setSalaryLinked(true);
      setReason('Paid leave cover');
    }
  }, [open]);

  const { data: teachers = [] } = useQuery({
    queryKey: ['cover-teachers-list'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'teacher');
      const ids = (roles || []).map((r) => r.user_id);
      if (!ids.length) return [] as { id: string; full_name: string }[];
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

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc('create_paid_leave_cover', {
        _original_assignment_id: originalAssignmentId,
        _replacement_teacher_id: replacementId,
        _temp_start_date: startDate,
        _temp_end_date: endDate,
        _payout_amount: Number(payout),
        _salary_linked: salaryLinked,
        _reason: reason || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Paid Leave Cover created',
        description: `${data?.snapshots_taken ?? 0} schedule row(s) reassigned. Original teacher remains on payroll.`,
      });
      qc.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
      qc.invalidateQueries({ queryKey: ['schedules'] });
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: 'Could not create cover', description: e.message, variant: 'destructive' }),
  });

  const valid = replacementId && startDate && endDate && new Date(endDate) >= new Date(startDate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-rose-500" />
            Paid Leave Cover
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium">{originalTeacherName}</span> stays on payroll uninterrupted.
            A replacement covers <span className="font-medium">{studentName}</span> for a fixed period at a fixed rate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Replacement teacher</Label>
            <Select value={replacementId} onValueChange={setReplacementId}>
              <SelectTrigger><SelectValue placeholder="Choose teacher…" /></SelectTrigger>
              <SelectContent>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>End date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1">
              <Label>Replacement payout</Label>
              <Input type="number" step="0.01" value={payout} onChange={(e) => setPayout(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <Label className="text-sm">Linked to salary sheet</Label>
                <p className="text-xs text-muted-foreground">Off = excluded row on payroll</p>
              </div>
              <Switch checked={salaryLinked} onCheckedChange={setSalaryLinked} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Reason / note</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs space-y-1">
              <div>• Schedule, lessons & student linkage move to the replacement for the cover period.</div>
              <div>• Original teacher's payout is untouched.</div>
              <div>• On the end date the schedule auto-restores. You can also "Close cover now" early, or "Extend" — which inserts a new temp row instead of editing this one.</div>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!valid || create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create cover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
