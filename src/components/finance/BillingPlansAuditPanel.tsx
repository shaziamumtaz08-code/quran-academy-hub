import React, { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertTriangle, UserX, ChevronDown, ChevronUp, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { trackActivity } from '@/lib/activityLogger';

interface PlanRow {
  id: string;
  student_id: string;
  base_package_id: string | null;
  assignment_id: string | null;
  session_duration: number;
  duration_surcharge: number;
  flat_discount: number;
  net_recurring_fee: number;
  currency: string;
  is_active: boolean;
  lifecycle_status?: string;
  branch_id: string | null;
  division_id: string | null;
  global_discount_id: string | null;
  manual_discount_reason: string | null;
  created_at: string;
  profiles: { full_name: string; registration_id: string | null } | null;
  assignment?: { id: string; status: string; effective_from_date: string | null; effective_to_date: string | null } | null;
}

interface InvoiceRow {
  id: string;
  plan_id: string | null;
  student_id: string;
  amount: number;
  amount_paid: number | null;
  currency: string;
  billing_month: string;
  due_date: string;
  status: string;
  period_from: string | null;
  period_to: string | null;
  branch_id: string | null;
  division_id: string | null;
}

interface UnbilledStudent {
  assignment_id: string;
  student_id: string;
  full_name: string;
  registration_id: string | null;
  teacher_name: string;
  subject_name: string;
  active_since: string;
}

interface Props {
  onSetupForStudent: (studentId: string, assignmentId?: string) => void;
}

export default function BillingPlansAuditPanel({ onSetupForStudent }: Props) {
  const { activeBranch, activeDivision } = useDivision();
  const branchId = activeBranch?.id || null;
  const divisionId = activeDivision?.id || null;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [unbilledOpen, setUnbilledOpen] = useState(false);
  const undoCacheRef = useRef<Map<string, { plan: PlanRow; invoices: InvoiceRow[]; timer: any }>>(new Map());

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['billing-plans-list', branchId, divisionId],
    queryFn: async () => {
      let q = supabase
        .from('student_billing_plans')
        .select(`id, student_id, base_package_id, assignment_id, session_duration, duration_surcharge, flat_discount,
                 net_recurring_fee, currency, is_active, lifecycle_status, branch_id, division_id, global_discount_id, manual_discount_reason, created_at,
                 profiles!student_billing_plans_student_id_fkey(full_name, registration_id),
                 assignment:student_teacher_assignments!student_billing_plans_assignment_id_fkey(id, status, effective_from_date, effective_to_date)`)
        .order('created_at', { ascending: false });
      if (branchId) q = q.eq('branch_id', branchId);
      if (divisionId) q = q.eq('division_id', divisionId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as PlanRow[];
    },
    enabled: !!branchId,
  });

  const { data: unbilled = [] } = useQuery({
    queryKey: ['unbilled-students-audit', branchId, divisionId, plans.length],
    queryFn: async () => {
      let q = supabase
        .from('student_teacher_assignments')
        .select(`id, student_id, created_at, status,
                 student:profiles!student_teacher_assignments_student_id_fkey(full_name, registration_id, archived_at),
                 teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name),
                 subjects(name)`)
        .eq('status', 'active');
      if (divisionId) q = q.eq('division_id', divisionId);
      const { data, error } = await q;
      if (error) throw error;

      // Billing is per ASSIGNMENT, not per student. A student with two active
      // assignments needs two plans. Legacy plans with no assignment link are
      // credited against one of that student's assignments so they are not
      // double-flagged.
      const livePlans = plans.filter(p => p.is_active && (p as any).lifecycle_status !== 'closed');
      const billedAssignmentIds = new Set(livePlans.filter(p => p.assignment_id).map(p => p.assignment_id as string));
      const unlinkedCredits = new Map<string, number>();
      livePlans.filter(p => !p.assignment_id).forEach(p => {
        unlinkedCredits.set(p.student_id, (unlinkedCredits.get(p.student_id) || 0) + 1);
      });

      const out: UnbilledStudent[] = [];
      (data || []).forEach((a: any) => {
        if (a.student?.archived_at) return;
        if (billedAssignmentIds.has(a.id)) return;
        const credit = unlinkedCredits.get(a.student_id) || 0;
        if (credit > 0) {
          unlinkedCredits.set(a.student_id, credit - 1);
          return;
        }
        out.push({
          assignment_id: a.id,
          student_id: a.student_id,
          full_name: a.student?.full_name || 'Unknown',
          registration_id: a.student?.registration_id || null,
          teacher_name: a.teacher?.full_name || '—',
          subject_name: a.subjects?.name || '—',
          active_since: a.created_at,
        });
      });
      return out.sort((x, y) => x.full_name.localeCompare(y.full_name) || x.subject_name.localeCompare(y.subject_name));
    },
    enabled: !!branchId,
  });


  const { duplicateGroups, activeCount } = useMemo(() => {
    // A student may legitimately have MULTIPLE plans — one per class/assignment.
    // A true duplicate is two live plans billing the SAME assignment (or two
    // legacy plans with no assignment link at all). Plans tied to on_hold /
    // completed / left assignments are historical records and are never flagged.
    const isStillBilling = (p: PlanRow) => {
      const status = p.assignment?.status;
      if (!p.assignment_id || !status) return p.is_active;
      return status === 'active' && p.is_active;
    };

    // Key on the assignment so different classes never collide.
    const byKey = new Map<string, PlanRow[]>();
    plans.forEach(p => {
      if (!isStillBilling(p)) return;
      const key = `${p.student_id}::${p.assignment_id || 'unlinked'}`;
      const arr = byKey.get(key) || [];
      arr.push(p);
      byKey.set(key, arr);
    });
    const groups: { student_id: string; full_name: string; rows: (PlanRow & { isKeeper: boolean })[] }[] = [];
    byKey.forEach(rows => {
      if (rows.length <= 1) return;
      const sorted = [...rows].sort((a, b) => {
        const aActive = a.is_active ? 1 : 0;
        const bActive = b.is_active ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        if (Number(b.net_recurring_fee) !== Number(a.net_recurring_fee))
          return Number(b.net_recurring_fee) - Number(a.net_recurring_fee);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      const keeperId = sorted[0].id;
      groups.push({
        student_id: rows[0].student_id,
        full_name: rows[0].profiles?.full_name || 'Unknown',
        rows: rows
          .map(r => ({ ...r, isKeeper: r.id === keeperId }))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      });
    });
    groups.sort((a, b) => a.full_name.localeCompare(b.full_name));
    return { duplicateGroups: groups, activeCount: plans.filter(p => p.is_active).length };
  }, [plans]);


  const allDupPlanIds = duplicateGroups.flatMap(g => g.rows.map(r => r.id));
  const { data: invoiceCounts = {} } = useQuery({
    queryKey: ['plan-invoice-counts', allDupPlanIds.join(',')],
    queryFn: async () => {
      if (allDupPlanIds.length === 0) return {};
      const { data, error } = await supabase
        .from('fee_invoices')
        .select('plan_id, status')
        .is('voided_at', null)
        .in('plan_id', allDupPlanIds);
      if (error) throw error;
      const map: Record<string, { total: number; pending: number }> = {};
      (data || []).forEach((r: any) => {
        if (!r.plan_id) return;
        if (!map[r.plan_id]) map[r.plan_id] = { total: 0, pending: 0 };
        map[r.plan_id].total += 1;
        if (r.status === 'pending') map[r.plan_id].pending += 1;
      });
      return map;
    },
    enabled: allDupPlanIds.length > 0,
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ plan, studentName }: { plan: PlanRow; studentName: string }) => {
      const { data: pendingInvs } = await supabase
        .from('fee_invoices')
        .select('*')
        .eq('plan_id', plan.id)
        .eq('status', 'pending' as any);

      const delInvErr = await supabase
        .from('fee_invoices')
        .delete()
        .eq('plan_id', plan.id)
        .eq('status', 'pending' as any);
      if (delInvErr.error) throw delInvErr.error;

      await supabase.from('fee_invoices').update({ plan_id: null }).eq('plan_id', plan.id);

      const { error } = await supabase.from('student_billing_plans').delete().eq('id', plan.id);
      if (error) throw error;

      return { plan, studentName, invoices: (pendingInvs || []) as unknown as InvoiceRow[] };
    },
    onSuccess: ({ plan, studentName, invoices }) => {
      queryClient.invalidateQueries({ queryKey: ['billing-plans'] });
      queryClient.invalidateQueries({ queryKey: ['billing-plans-list'] });
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['plan-invoice-counts'] });
      setConfirmDelete(null);
      trackActivity({ action: 'billing_plan_deleted', entityType: 'billing_plan', entityId: plan.id, details: { reason: 'duplicate_cleanup', invoices_deleted: invoices.length } });

      const timer = setTimeout(() => undoCacheRef.current.delete(plan.id), 10000);
      undoCacheRef.current.set(plan.id, { plan, invoices, timer });

      toast({
        title: `Duplicate plan for ${studentName} removed`,
        description: `${invoices.length} pending invoice(s) deleted. Undo available for 10s.`,
        action: (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleUndo(plan.id, studentName)}
          >
            Undo
          </Button>
        ) as any,
        duration: 10000,
      });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleUndo = async (planId: string, studentName: string) => {
    const cached = undoCacheRef.current.get(planId);
    if (!cached) {
      toast({ title: 'Undo expired', variant: 'destructive' });
      return;
    }
    clearTimeout(cached.timer);
    const { plan, invoices } = cached;
    const { error: pErr } = await supabase.from('student_billing_plans').insert({
      id: plan.id,
      student_id: plan.student_id,
      base_package_id: plan.base_package_id,
      assignment_id: plan.assignment_id,
      session_duration: plan.session_duration,
      duration_surcharge: plan.duration_surcharge,
      flat_discount: plan.flat_discount,
      net_recurring_fee: plan.net_recurring_fee,
      currency: plan.currency,
      is_active: plan.is_active,
      branch_id: plan.branch_id,
      division_id: plan.division_id,
      global_discount_id: plan.global_discount_id,
      manual_discount_reason: plan.manual_discount_reason,
      created_at: plan.created_at,
    } as any);
    if (pErr) {
      toast({ title: 'Undo failed', description: pErr.message, variant: 'destructive' });
      return;
    }
    if (invoices.length > 0) {
      await supabase.from('fee_invoices').insert(invoices as any);
    }
    undoCacheRef.current.delete(planId);
    queryClient.invalidateQueries({ queryKey: ['billing-plans-list'] });
    queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
    queryClient.invalidateQueries({ queryKey: ['plan-invoice-counts'] });
    toast({ title: `Undo: Restored duplicate plan for ${studentName}` });
  };

  if (plansLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (duplicateGroups.length === 0 && unbilled.length === 0) {
    return (
      <div className="flex items-center gap-3 mb-4">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> {activeCount} Active Plan{activeCount === 1 ? '' : 's'}
        </span>
      </div>
    );
  }

  const dupRef = (id: string) => `dup-card-${id}`;

  return (
    <div className="space-y-4 mb-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> {activeCount} Active Plan{activeCount === 1 ? '' : 's'}
        </span>
        {duplicateGroups.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs text-red-700">
            <span className="h-2 w-2 rounded-full bg-red-500" /> {duplicateGroups.length} Duplicate Issue{duplicateGroups.length === 1 ? '' : 's'}
          </span>
        )}
        {unbilled.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> {unbilled.length} Unbilled Assignment{unbilled.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {duplicateGroups.length > 0 && (
        <div className="rounded-lg p-4 bg-red-100 text-red-700 border-l-4 border-red-500 flex justify-between items-start gap-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-red-600" />
            <div>
              <div className="font-bold">{duplicateGroups.length} student{duplicateGroups.length === 1 ? '' : 's'} have duplicate billing plans</div>
              <div className="text-sm text-red-700/80 mt-0.5">Two live plans are billing the same class. Multiple plans across different classes are fine — only same-class overlaps are shown here.</div>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-200 shrink-0"
            onClick={() => {
              const first = duplicateGroups[0];
              if (first) document.getElementById(dupRef(first.student_id))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            Review Duplicates
          </Button>
        </div>
      )}

      {unbilled.length > 0 && (
        <div className="rounded-lg p-4 bg-amber-100 text-amber-700 border-l-4 border-amber-500 flex justify-between items-start gap-4">
          <div className="flex gap-3">
            <UserX className="h-5 w-5 mt-0.5 shrink-0 text-amber-600" />
            <div>
              <div className="font-bold">{unbilled.length} active assignment{unbilled.length === 1 ? '' : 's'} have no billing plan</div>
              <div className="text-sm text-amber-700/80 mt-0.5">Billing is per assignment — a student with two active classes needs two plans.</div>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-200 shrink-0"
            onClick={() => setUnbilledOpen(true)}
          >
            Review Unbilled
          </Button>
        </div>
      )}

      {duplicateGroups.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {duplicateGroups.map(group => {
            const isOpen = expanded.has(group.student_id);
            return (
              <div
                key={group.student_id}
                id={dupRef(group.student_id)}
                className="rounded-lg border-2 border-dashed border-red-400 bg-red-50/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-foreground">{group.full_name}</div>
                    <div className="text-xs text-muted-foreground">{group.rows[0].profiles?.registration_id || '—'}</div>
                  </div>
                  <Badge className="bg-red-600 hover:bg-red-600 text-white text-[10px]">
                    {group.rows.length} PLANS — DUPLICATES DETECTED
                  </Badge>
                </div>
                <div className="mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      setExpanded(prev => {
                        const n = new Set(prev);
                        if (n.has(group.student_id)) n.delete(group.student_id); else n.add(group.student_id);
                        return n;
                      });
                    }}
                  >
                    {isOpen ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
                    {isOpen ? 'Hide plans' : 'Show plans'}
                  </Button>
                </div>
                <div
                  className="overflow-hidden transition-[max-height] duration-300"
                  style={{ maxHeight: isOpen ? '800px' : '0px' }}
                >
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-muted-foreground">
                        <tr className="border-b">
                          <th className="text-left py-1.5 pr-2 font-medium">Created</th>
                          <th className="text-right py-1.5 px-2 font-medium">Amount</th>
                          <th className="text-left py-1.5 px-2 font-medium">Cur</th>
                          <th className="text-center py-1.5 px-2 font-medium">Min</th>
                          <th className="text-center py-1.5 px-2 font-medium">Inv</th>
                          <th className="text-left py-1.5 px-2 font-medium">Status</th>
                          <th className="text-right py-1.5 pl-2 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map(row => {
                          const counts = (invoiceCounts as any)[row.id] || { total: 0, pending: 0 };
                          const showConfirm = confirmDelete === row.id;
                          return (
                            <React.Fragment key={row.id}>
                              <tr className="border-b last:border-0">
                                <td className="py-1.5 pr-2 text-muted-foreground">{new Date(row.created_at).toLocaleDateString()}</td>
                                <td className="py-1.5 px-2 text-right font-mono">{Number(row.net_recurring_fee).toLocaleString()}</td>
                                <td className="py-1.5 px-2">{row.currency}</td>
                                <td className="py-1.5 px-2 text-center">{row.session_duration}</td>
                                <td className="py-1.5 px-2 text-center">
                                  <span title={`${counts.pending} pending of ${counts.total}`}>{counts.total}</span>
                                </td>
                                <td className="py-1.5 px-2">
                                  {row.isKeeper ? (
                                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] gap-1">
                                      <CheckCircle2 className="h-3 w-3" /> Keep
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-red-600 hover:bg-red-600 text-white text-[10px]">Duplicate</Badge>
                                  )}
                                </td>
                                <td className="py-1.5 pl-2 text-right">
                                  {!row.isKeeper && !showConfirm && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-[11px] border-red-300 text-red-700 hover:bg-red-50"
                                      onClick={() => setConfirmDelete(row.id)}
                                    >
                                      Delete
                                    </Button>
                                  )}
                                </td>
                              </tr>
                              {showConfirm && (
                                <tr>
                                  <td colSpan={7} className="py-2">
                                    <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-800">
                                      <div className="mb-2">
                                        Delete this plan and its <strong>{counts.pending}</strong> pending invoice{counts.pending === 1 ? '' : 's'}? Paid invoices will not be affected.
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          className="h-7 bg-red-600 hover:bg-red-700 text-white text-[11px]"
                                          disabled={deleteMutation.isPending}
                                          onClick={() => deleteMutation.mutate({ plan: row, studentName: group.full_name })}
                                        >
                                          {deleteMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                                          Yes, Delete
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 text-[11px]"
                                          onClick={() => setConfirmDelete(null)}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={unbilledOpen} onOpenChange={setUnbilledOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Assignments without a billing plan
              <Badge variant="secondary">{unbilled.length}</Badge>
            </DialogTitle>
            <DialogDescription>
              Billing follows the assignment: a student needs one plan per active assignment (class).
              Set the fee for each one to start generating invoices.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {unbilled.map(s => {
              const initials = s.full_name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
              return (
                <div key={s.assignment_id} className="rounded-xl border bg-card p-3 flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-semibold shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{s.full_name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{s.registration_id || '—'}</div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">{s.teacher_name} · {s.subject_name}</div>
                    <div className="text-[11px] text-muted-foreground">Active since {new Date(s.active_since).toLocaleDateString()}</div>
                    <Button
                      size="sm"
                      className="h-7 mt-2 text-xs"
                      onClick={() => {
                        setUnbilledOpen(false);
                        onSetupForStudent(s.student_id);
                      }}
                    >
                      Set Up Plan
                    </Button>
                  </div>
                </div>
              );
            })}
            {unbilled.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center sm:col-span-2">Every active assignment has a billing plan.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
