import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Trash2, Loader2, Search, AlertTriangle, RotateCcw, ArrowUpDown, Eye, Sparkles, CalendarCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { trackActivity } from '@/lib/activityLogger';
import RevisePlanDialog from './RevisePlanDialog';
import CloseBillingPlanDialog from './CloseBillingPlanDialog';
import { LIFECYCLE_LABELS, type PlanLifecycleStatus } from '@/lib/billingCloseOut';
import { cn } from '@/lib/utils';

const LIFECYCLE_STYLES: Record<PlanLifecycleStatus, string> = {
  open: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pending_closure: 'bg-amber-100 text-amber-800 border-amber-200',
  closed: 'bg-muted text-muted-foreground border-border',
  suspended: 'bg-sky-100 text-sky-700 border-sky-200',
  superseded: 'bg-red-100 text-red-700 border-red-200',
};

interface BillingPlan {
  id: string;
  student_id: string;
  base_package_id: string | null;
  session_duration: number;
  net_recurring_fee: number;
  currency: string;
  flat_discount: number;
  duration_surcharge: number;
  is_active: boolean;
  created_at: string;
  effective_from?: string | null;
  superseded_by?: string | null;
  superseded_at?: string | null;
  change_reason?: string | null;
  lifecycle_status?: PlanLifecycleStatus;
  billing_close_date?: string | null;
  close_reason?: string | null;
  assignment?: { id: string; status: string; effective_to_date: string | null; status_effective_date: string | null } | null;
  profiles: { full_name: string } | null;
  fee_packages: { name: string; amount: number } | null;
}

export default function BillingPlansTable({ onEditPlan, onViewPlan }: { onEditPlan?: (plan: BillingPlan) => void; onViewPlan?: (plan: BillingPlan) => void }) {
  const { activeBranch, activeDivision } = useDivision();
  const branchId = activeBranch?.id || null;
  const divisionId = activeDivision?.id || null;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [studentFilter, setStudentFilter] = useState<string>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [revisePlan, setRevisePlan] = useState<BillingPlan | null>(null);
  const [closingPlan, setClosingPlan] = useState<BillingPlan | null>(null);
  const [archiveView, setArchiveView] = useState<'active' | 'archived'>('active');
  const [sortCol, setSortCol] = useState<'student' | 'duration' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [togglePlan, setTogglePlan] = useState<{ plan: BillingPlan; is_active: boolean } | null>(null);
  const [toggleReason, setToggleReason] = useState('');

  const toggleSort = (col: 'student' | 'duration') => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['billing-plans-list', branchId, divisionId],
    queryFn: async () => {
      let q = supabase
        .from('student_billing_plans')
        .select(`
          id, student_id, base_package_id, session_duration, net_recurring_fee,
          currency, flat_discount, duration_surcharge, is_active, created_at,
          effective_from, superseded_by, superseded_at, change_reason,
          lifecycle_status, billing_close_date, close_reason,
          profiles!student_billing_plans_student_id_fkey(full_name),
          fee_packages!student_billing_plans_base_package_id_fkey(name, amount),
          assignment:student_teacher_assignments!student_billing_plans_assignment_id_fkey(id, status, effective_to_date, status_effective_date)
        `)
        .order('created_at', { ascending: false });
      if (branchId) q = q.eq('branch_id', branchId);
      if (divisionId) q = q.eq('division_id', divisionId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as BillingPlan[];
    },
    enabled: !!branchId,
  });

  const currencies = useMemo(() => [...new Set(plans.map(p => p.currency))].sort(), [plans]);
  const students = useMemo(() => {
    const map = new Map<string, string>();
    plans.forEach(p => { if (p.profiles?.full_name) map.set(p.student_id, p.profiles.full_name); });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [plans]);

  const isArchivedPlan = (p: any) => !!p.superseded_by || p.lifecycle_status === 'closed';

  const filtered = useMemo(() => {
    let result = plans.filter(p => archiveView === 'archived' ? isArchivedPlan(p) : !isArchivedPlan(p));
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(p =>
        p.profiles?.full_name?.toLowerCase().includes(s) ||
        p.fee_packages?.name?.toLowerCase().includes(s)
      );
    }
    if (currencyFilter !== 'all') result = result.filter(p => p.currency === currencyFilter);
    if (studentFilter !== 'all') result = result.filter(p => p.student_id === studentFilter);
    if (sortCol === 'student') {
      result = [...result].sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        return dir * (a.profiles?.full_name || '').localeCompare(b.profiles?.full_name || '');
      });
    } else if (sortCol === 'duration') {
      result = [...result].sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        return dir * (a.session_duration - b.session_duration);
      });
    }
    return result;
  }, [plans, archiveView, search, currencyFilter, studentFilter, sortCol, sortDir]);

  const activePlanCount = useMemo(() => plans.filter(p => !isArchivedPlan(p)).length, [plans]);
  const archivedPlanCount = useMemo(() => plans.filter(p => isArchivedPlan(p)).length, [plans]);
  const hasActiveFilters = search || currencyFilter !== 'all' || studentFilter !== 'all';

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active, reason }: { id: string; is_active: boolean; reason: string }) => {
      const { error } = await supabase
        .from('student_billing_plans')
        .update({ is_active, change_reason: reason } as any)
        .eq('id', id);
      if (error) throw error;
      return { id, is_active };
    },
    onSuccess: ({ id, is_active }) => {
      queryClient.invalidateQueries({ queryKey: ['billing-plans'] });
      queryClient.invalidateQueries({ queryKey: ['billing-plans-list'] });
      trackActivity({ action: 'billing_plan_updated', entityType: 'billing_plan', entityId: id, details: { toggled_active: is_active } });
      setTogglePlan(null);
      setToggleReason('');
      toast({ title: is_active ? 'Plan activated' : 'Plan paused' });
    },
    onError: (e: any) => toast({ title: 'Could not update plan', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete linked pending invoices first
      await supabase.from('fee_invoices').delete().eq('plan_id', id).eq('status', 'pending' as any);
      // Unlink non-pending invoices so the plan can be removed
      await supabase.from('fee_invoices').update({ plan_id: null }).eq('plan_id', id);
      const { error } = await supabase.from('student_billing_plans').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['billing-plans'] });
      queryClient.invalidateQueries({ queryKey: ['billing-plans-list'] });
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      toast({ title: 'Billing plan deleted' });
      trackActivity({ action: 'billing_plan_deleted', entityType: 'billing_plan', entityId: id });
      setDeleteConfirmId(null);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by student or package..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={studentFilter} onValueChange={setStudentFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Students" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Students</SelectItem>
            {students.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="All Currencies" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Currencies</SelectItem>
            {currencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="outline" size="icon" onClick={() => { setSearch(''); setCurrencyFilter('all'); setStudentFilter('all'); }} title="Reset Filters">
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
        <div className="flex items-center gap-1 rounded-xl border bg-background/80 px-1 py-1 shadow-sm">
          <Button type="button" size="sm" variant={archiveView === 'active' ? 'default' : 'ghost'} className="h-7 text-xs" onClick={() => setArchiveView('active')}>
            Active <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{activePlanCount}</Badge>
          </Button>
          <Button type="button" size="sm" variant={archiveView === 'archived' ? 'destructive' : 'ghost'} className="h-7 text-xs" onClick={() => setArchiveView('archived')}>
            Archived <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{archivedPlanCount}</Badge>
          </Button>
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} plan(s)</span>
      </div>

      {archiveView === 'archived' && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          Showing archived billing plans: closed plans (student left / assignment ended) and superseded revisions. These are read-only audit records.
        </div>
      )}

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="font-medium">No billing plans found</p>
            <p className="text-sm">Use "Set Up Student Fee" to create billing plans</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><Button variant="ghost" size="sm" className="gap-1 -ml-2 h-8 font-medium" onClick={() => toggleSort('student')}>Student <ArrowUpDown className="h-3 w-3" /></Button></TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Lifecycle</TableHead>
                <TableHead className="text-center"><Button variant="ghost" size="sm" className="gap-1 h-8 font-medium" onClick={() => toggleSort('duration')}>Duration <ArrowUpDown className="h-3 w-3" /></Button></TableHead>
                <TableHead className="text-right">Net Fee</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead>Effective From</TableHead>
                <TableHead>{archiveView === 'archived' ? 'Archived On' : 'Created'}</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(plan => (
                <TableRow key={plan.id} className={cn(plan.superseded_by && 'bg-red-50/45 opacity-90')}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      {plan.profiles?.full_name || '—'}
                      {plan.superseded_by && <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">ARCHIVED</Badge>}
                    </span>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{plan.fee_packages?.name || '—'}</Badge></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-[10px]', LIFECYCLE_STYLES[(plan.lifecycle_status || 'open') as PlanLifecycleStatus])}>
                      {LIFECYCLE_LABELS[(plan.lifecycle_status || 'open') as PlanLifecycleStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{plan.session_duration} min</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{Number(plan.net_recurring_fee).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="secondary">{plan.currency}</Badge></TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {Number(plan.flat_discount) > 0 ? Number(plan.flat_discount).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={plan.is_active} disabled={isArchivedPlan(plan)} onCheckedChange={checked => { setToggleReason(''); setTogglePlan({ plan, is_active: checked }); }} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {plan.effective_from ? new Date(plan.effective_from).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date((archiveView === 'archived' && plan.superseded_at) ? plan.superseded_at : plan.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {plan.lifecycle_status === 'pending_closure' && (
                        <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => setClosingPlan(plan)}>
                          <CalendarCheck className="h-3.5 w-3.5" /> Review &amp; Close
                        </Button>
                      )}
                      {onViewPlan && (
                        <Button variant="ghost" size="icon" onClick={() => onViewPlan(plan)} title="View"><Eye className="h-4 w-4" /></Button>
                      )}
                      {!plan.superseded_by && <Button variant="ghost" size="icon" onClick={() => setRevisePlan(plan)} title="Revise rate (insert new history row)">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </Button>}
                      {onEditPlan && !plan.superseded_by && (
                        <Button variant="ghost" size="icon" onClick={() => onEditPlan(plan)} title="Edit (legacy)"><Pencil className="h-4 w-4" /></Button>
                      )}
                      {!plan.superseded_by && <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirmId(plan.id)} title="Delete"><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Confirmation */}
      <Dialog open={!!togglePlan} onOpenChange={o => { if (!o) { setTogglePlan(null); setToggleReason(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{togglePlan?.is_active ? 'Activate billing plan' : 'Pause billing plan'}</DialogTitle>
            <DialogDescription>
              Billing plan changes are financial records — a reason is stored in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="toggle-reason">Reason for change</Label>
            <Textarea
              id="toggle-reason"
              value={toggleReason}
              onChange={e => setToggleReason(e.target.value)}
              placeholder="e.g. Student paused classes for Ramadan"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTogglePlan(null); setToggleReason(''); }}>Cancel</Button>
            <Button
              disabled={toggleReason.trim().length < 4 || toggleMutation.isPending}
              onClick={() => togglePlan && toggleMutation.mutate({ id: togglePlan.plan.id, is_active: togglePlan.is_active, reason: toggleReason.trim() })}
            >
              Save change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" /> Delete Billing Plan</DialogTitle>
            <DialogDescription>This will permanently delete this billing plan and any linked pending invoices. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {revisePlan && (
        <RevisePlanDialog
          open={!!revisePlan}
          onOpenChange={(o) => !o && setRevisePlan(null)}
          plan={revisePlan as any}
        />
      )}

      <CloseBillingPlanDialog plan={closingPlan} onOpenChange={(o) => !o && setClosingPlan(null)} />
    </div>
  );
}
