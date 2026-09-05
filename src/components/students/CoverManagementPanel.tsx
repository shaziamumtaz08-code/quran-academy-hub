import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { withAssignmentPayouts } from '@/lib/assignmentPayouts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { HeartHandshake, X, CalendarPlus, Loader2 } from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Props {
  originalAssignmentId: string;
}

type CoverRow = {
  id: string;
  teacher_id: string;
  temp_start_date: string | null;
  temp_end_date: string | null;
  payout_amount: number | null;
  salary_linked: boolean | null;
  status: string;
  status_change_reason: string | null;
  profiles: { full_name: string } | null;
};

export function CoverManagementPanel({ originalAssignmentId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [extendFor, setExtendFor] = useState<CoverRow | null>(null);
  const [newEnd, setNewEnd] = useState('');

  const { data: covers = [], isLoading } = useQuery({
    queryKey: ['active-covers', originalAssignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_teacher_assignments')
        .select('id, teacher_id, temp_start_date, temp_end_date, status, status_change_reason, profiles!student_teacher_assignments_teacher_id_fkey(full_name)')
        .eq('original_assignment_id', originalAssignmentId)
        .eq('is_temporary', true)
        .eq('status', 'active')
        .order('temp_start_date', { ascending: false });
      if (error) throw error;
      return (await withAssignmentPayouts(((data || []) as any[]))) as unknown as CoverRow[];
    },
  });

  const closeNow = useMutation({
    mutationFn: async (coverId: string) => {
      const { error } = await (supabase as any).rpc('close_paid_leave_cover', {
        _cover_assignment_id: coverId,
        _manual: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Cover closed', description: 'Schedule restored to original teacher.' });
      qc.invalidateQueries({ queryKey: ['active-covers', originalAssignmentId] });
      qc.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
      qc.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const extend = useMutation({
    mutationFn: async () => {
      if (!extendFor) return;
      const { error } = await (supabase as any).rpc('extend_paid_leave_cover', {
        _cover_assignment_id: extendFor.id,
        _new_temp_end_date: newEnd,
        _reason: 'Extended via admin panel',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Cover extended', description: 'New temporary row created from the day after the old end date.' });
      qc.invalidateQueries({ queryKey: ['active-covers', originalAssignmentId] });
      qc.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
      setExtendFor(null);
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  if (isLoading || covers.length === 0) return null;

  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50/40 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-rose-900">
        <HeartHandshake className="h-4 w-4" />
        Active Cover{covers.length > 1 ? 's' : ''}
      </div>
      {covers.map((c) => (
        <div key={c.id} className="rounded-md border border-rose-200/70 bg-white px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs">
            <div className="font-medium text-foreground">{c.profiles?.full_name || 'Cover teacher'}</div>
            <div className="text-muted-foreground">
              {c.temp_start_date && format(parseISO(c.temp_start_date), 'dd MMM')} – {c.temp_end_date && format(parseISO(c.temp_end_date), 'dd MMM yyyy')}
              {' · PKR '}{Number(c.payout_amount || 0).toFixed(0)}
            </div>
            {c.salary_linked === false && (
              <Badge variant="outline" className="text-[9px] mt-1 border-amber-300 text-amber-700 bg-amber-50">
                Excluded from payroll
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => {
                setExtendFor(c);
                setNewEnd(format(addDays(c.temp_end_date ? parseISO(c.temp_end_date) : new Date(), 7), 'yyyy-MM-dd'));
              }}
            >
              <CalendarPlus className="h-3 w-3" /> Extend
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 text-rose-700 border-rose-300 hover:bg-rose-100"
              onClick={() => {
                if (confirm('Close this cover now and restore the original teacher\'s schedule?')) closeNow.mutate(c.id);
              }}
              disabled={closeNow.isPending}
            >
              <X className="h-3 w-3" /> Close now
            </Button>
          </div>
        </div>
      ))}

      <Dialog open={!!extendFor} onOpenChange={(o) => !o && setExtendFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Extend cover</DialogTitle>
            <DialogDescription>
              Current end date: <span className="font-medium">{extendFor?.temp_end_date && format(parseISO(extendFor.temp_end_date), 'dd MMM yyyy')}</span>.
              A new temporary row will be opened from the day after.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>New end date</Label>
            <Input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendFor(null)}>Cancel</Button>
            <Button
              onClick={() => extend.mutate()}
              disabled={!newEnd || extend.isPending || (extendFor?.temp_end_date ? newEnd <= extendFor.temp_end_date : false)}
            >
              {extend.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Extend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
