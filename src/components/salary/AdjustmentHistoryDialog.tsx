import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AdjustmentHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salaryMonth: string;
  teacherId?: string | null;
}

export function AdjustmentHistoryDialog({ open, onOpenChange, salaryMonth, teacherId }: AdjustmentHistoryDialogProps) {
  const { data: adjustments = [] } = useQuery({
    queryKey: ['adjustment-history', salaryMonth, teacherId],
    queryFn: async () => {
      let query = supabase
        .from('salary_adjustments')
        .select('*, profiles!salary_adjustments_created_by_fkey(full_name)')
        .eq('salary_month', salaryMonth)
        .order('created_at', { ascending: false });
      if (teacherId) query = query.eq('teacher_id', teacherId);
      const { data } = await query;
      return data || [];
    },
    enabled: open,
  });

  const { data: staffProfiles = [] } = useQuery({
    queryKey: ['adj-history-profiles', adjustments.map((a: any) => a.teacher_id)],
    queryFn: async () => {
      const ids = [...new Set(adjustments.map((a: any) => a.teacher_id))];
      if (!ids.length) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      return data || [];
    },
    enabled: adjustments.length > 0,
  });

  const profileMap = new Map(staffProfiles.map((p: any) => [p.id, p.full_name]));

  const typeColor = (type: string) => {
    if (type === 'deduction') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Adjustment History</DialogTitle>
          <DialogDescription>{salaryMonth} {teacherId ? '' : '— All Staff'}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                {!teacherId && <TableHead>Staff</TableHead>}
                <TableHead>Type</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustments.length === 0 && (
                <TableRow><TableCell colSpan={teacherId ? 6 : 7} className="text-center py-8 text-muted-foreground">No adjustments found</TableCell></TableRow>
              )}
              {adjustments.map((adj: any) => (
                <TableRow key={adj.id}>
                  <TableCell className="text-xs">{format(parseISO(adj.created_at), 'dd MMM yyyy HH:mm')}</TableCell>
                  {!teacherId && <TableCell className="text-sm">{profileMap.get(adj.teacher_id) || 'Unknown'}</TableCell>}
                  <TableCell>
                    <Badge className={`text-[10px] ${typeColor(adj.adjustment_type)}`}>
                      {adj.adjustment_type}
                    </Badge>
                    {adj.is_bulk && <Badge variant="outline" className="text-[9px] ml-1">Bulk</Badge>}
                  </TableCell>
                  <TableCell className="text-xs capitalize">{adj.adjustment_mode || 'flat'}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-medium">
                    {adj.adjustment_mode === 'percentage'
                      ? `${adj.percentage_value}% → PKR ${Number(adj.resolved_amount || adj.amount).toFixed(2)}`
                      : `PKR ${Number(adj.amount).toFixed(2)}`
                    }
                  </TableCell>
                  <TableCell className="text-xs max-w-[150px] truncate">{adj.reason || '—'}</TableCell>
                  <TableCell className="text-xs">{(adj as any).profiles?.full_name || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
