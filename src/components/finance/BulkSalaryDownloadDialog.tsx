import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Download, FileText, Loader2 } from 'lucide-react';

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthLabel(m: string) {
  const [y, mm] = m.split('-').map(Number);
  return `${MONTH_LABELS[(mm || 1) - 1]} ${y}`;
}

function monthOptions() {
  const now = new Date();
  const out: string[] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkSalaryDownloadDialog({ open, onOpenChange }: Props) {
  const months = useMemo(monthOptions, []);
  const now = new Date();
  const [fromMonth, setFromMonth] = useState(`${now.getFullYear()}-01`);
  const [toMonth, setToMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [teacherId, setTeacherId] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['bulk-salary-sheets', fromMonth, toMonth],
    queryFn: async () => {
      const lo = fromMonth <= toMonth ? fromMonth : toMonth;
      const hi = fromMonth <= toMonth ? toMonth : fromMonth;
      const { data: payouts, error } = await supabase
        .from('salary_payouts')
        .select('id, teacher_id, salary_month, net_salary, status, is_archived, is_revised')
        .gte('salary_month', lo)
        .lte('salary_month', hi)
        .or('is_archived.is.null,is_archived.eq.false')
        .order('salary_month', { ascending: true });
      if (error) throw error;
      const ids = Array.from(new Set((payouts || []).map((p: any) => p.teacher_id)));
      const { data: profiles } = ids.length
        ? await supabase.from('profiles').select('id, full_name').in('id', ids)
        : { data: [] as any[] };
      const nameById = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
      return (payouts || []).map((p: any) => ({ ...p, teacherName: nameById.get(p.teacher_id) || 'Unknown' }));
    },
    enabled: open,
  });

  const teachers = useMemo(() => {
    const map = new Map<string, string>();
    (data || []).forEach((p: any) => map.set(p.teacher_id, p.teacherName));
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const rows = useMemo(
    () => (data || []).filter((p: any) => teacherId === 'all' || p.teacher_id === teacherId),
    [data, teacherId],
  );

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const allSelected = rows.length > 0 && rows.every((r: any) => selected.has(r.id));
  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) rows.forEach((r: any) => next.delete(r.id));
      else rows.forEach((r: any) => next.add(r.id));
      return next;
    });
  };

  const selectedIds = rows.filter((r: any) => selected.has(r.id)).map((r: any) => r.id);

  const openCombined = () => {
    if (!selectedIds.length) return;
    window.open(`/finance/print/salary-bulk?payouts=${selectedIds.join(',')}`, '_blank');
  };
  const openSeparate = () => {
    selectedIds.forEach(id => window.open(`/finance/print/salary/${id}`, '_blank'));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Download salary sheets</DialogTitle>
          <DialogDescription>
            Pick a period and staff member, tick the sheets, then download them as one combined branded PDF or as separate sheets.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">From month</Label>
            <Select value={fromMonth} onValueChange={setFromMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">To month</Label>
            <Select value={toMonth} onValueChange={setToMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Staff member</Label>
            <Select value={teacherId} onValueChange={(v) => { setTeacherId(v); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border border-border rounded-md">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40">
            <div className="flex items-center gap-2">
              <Checkbox id="bulk-salary-all" checked={allSelected} onCheckedChange={toggleAll} />
              <Label htmlFor="bulk-salary-all" className="text-xs cursor-pointer">Select all</Label>
            </div>
            <span className="text-xs text-muted-foreground">{selectedIds.length} of {rows.length} selected</span>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-border">
            {isLoading && (
              <div className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading sheets...
              </div>
            )}
            {!isLoading && rows.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No saved salary sheets for this period.</div>
            )}
            {rows.map((r: any) => (
              <label key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
                <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                <span className="flex-1 font-medium">{r.teacherName}</span>
                <span className="text-muted-foreground">{monthLabel(r.salary_month)}</span>
                <span className="tabular-nums w-24 text-right">PKR {Number(r.net_salary || 0).toLocaleString()}</span>
                {r.is_revised && <Badge variant="outline" className="text-[10px]">REVISED</Badge>}
              </label>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={openSeparate} disabled={!selectedIds.length}>
            <FileText className="h-4 w-4 mr-1" /> Separate sheets
          </Button>
          <Button onClick={openCombined} disabled={!selectedIds.length}>
            <Download className="h-4 w-4 mr-1" /> Combined PDF ({selectedIds.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
