import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2Off, CalendarX2, Receipt, Wallet, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import CloseBillingPlanDialog from './CloseBillingPlanDialog';

type Severity = 'error' | 'info';

interface Finding {
  key: string;
  severity: Severity;
  icon: React.ElementType;
  title: string;
  hint: string;
  rows: { id: string; label: string; detail: string; plan?: any }[];
}

export default function BillingLifecyclePanel() {
  const { activeBranch, activeDivision } = useDivision();
  const branchId = activeBranch?.id || null;
  const divisionId = activeDivision?.id || null;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [closingPlan, setClosingPlan] = useState<any | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['billing-lifecycle-plans', branchId, divisionId],
    queryFn: async () => {
      let q = supabase
        .from('student_billing_plans')
        .select(`id, student_id, assignment_id, net_recurring_fee, currency, is_active, created_at,
                 effective_from, lifecycle_status, billing_close_date, close_reason,
                 profiles!student_billing_plans_student_id_fkey(full_name),
                 assignment:student_teacher_assignments!student_billing_plans_assignment_id_fkey(id, status, effective_to_date, status_effective_date)`)
        .order('created_at', { ascending: false });
      if (branchId) q = q.eq('branch_id', branchId);
      if (divisionId) q = q.eq('division_id', divisionId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!branchId,
  });

  const { data: credits = [] } = useQuery({
    queryKey: ['billing-credits', branchId, divisionId],
    queryFn: async () => {
      let q = supabase
        .from('billing_credits')
        .select('id, student_id, amount, currency, kind, status, reason, created_at, profiles:student_id(full_name)')
        .order('created_at', { ascending: false });
      if (divisionId) q = q.eq('division_id', divisionId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!branchId,
  });

  const { data: overdueInvoices = [] } = useQuery({
    queryKey: ['billing-beyond-close', plans.map(p => p.id).join(',')],
    queryFn: async () => {
      const closed = plans.filter(p => p.billing_close_date);
      if (closed.length === 0) return [];
      const { data, error } = await supabase
        .from('fee_invoices')
        .select('id, plan_id, billing_month, amount, currency, status')
        .in('plan_id', closed.map(p => p.id))
        .is('voided_at', null)
        .neq('status', 'voided');
      if (error) throw error;
      return (data || []).filter((i: any) => {
        const plan = closed.find(p => p.id === i.plan_id);
        return plan && i.billing_month > String(plan.billing_close_date).slice(0, 7);
      });
    },
    enabled: plans.some(p => p.billing_close_date),
  });

  const confirmCredit = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'applied' | 'refunded' | 'cancelled' }) => {
      const { error } = await supabase
        .from('billing_credits')
        .update({ status, confirmed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-credits'] });
      toast({ title: 'Credit updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const findings: Finding[] = useMemo(() => {
    const live = plans.filter(p => ['open', 'pending_closure'].includes(p.lifecycle_status));

    const unlinked = live.filter(p => !p.assignment_id);
    const endedOpen = plans.filter(p => p.lifecycle_status === 'pending_closure');
    const suspended = plans.filter(p => p.lifecycle_status === 'suspended');
    const pendingCredits = credits.filter(c => c.status === 'pending');

    const out: Finding[] = [];

    if (endedOpen.length) out.push({
      key: 'pending_closure', severity: 'error', icon: CalendarX2,
      title: `${endedOpen.length} billing plan${endedOpen.length === 1 ? '' : 's'} awaiting close-out`,
      hint: 'The assignment has ended but billing is still open. Review and close each one.',
      rows: endedOpen.map(p => ({
        id: p.id,
        label: p.profiles?.full_name || 'Unknown',
        detail: `${p.currency} ${Number(p.net_recurring_fee).toLocaleString()} · suggested close ${p.billing_close_date || '—'}`,
        plan: p,
      })),
    });

    if (unlinked.length) out.push({
      key: 'unlinked', severity: 'error', icon: Link2Off,
      title: `${unlinked.length} live plan${unlinked.length === 1 ? '' : 's'} not linked to an assignment`,
      hint: 'These could not be matched automatically — link them from the plan so lifecycle rules apply.',
      rows: unlinked.map(p => ({
        id: p.id,
        label: p.profiles?.full_name || 'Unknown',
        detail: `${p.currency} ${Number(p.net_recurring_fee).toLocaleString()} · created ${String(p.created_at).slice(0, 10)}`,
      })),
    });

    if (overdueInvoices.length) out.push({
      key: 'beyond_close', severity: 'error', icon: Receipt,
      title: `${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? '' : 's'} billed beyond the billing close date`,
      hint: 'These invoices sit after the plan was closed and should be reviewed or cancelled.',
      rows: overdueInvoices.map((i: any) => ({
        id: i.id,
        label: plans.find(p => p.id === i.plan_id)?.profiles?.full_name || 'Unknown',
        detail: `${i.billing_month} · ${i.currency} ${Number(i.amount).toLocaleString()} · ${i.status}`,
      })),
    });

    if (pendingCredits.length) out.push({
      key: 'credits', severity: 'error', icon: Wallet,
      title: `${pendingCredits.length} credit/refund${pendingCredits.length === 1 ? '' : 's'} pending`,
      hint: 'A family paid more than was earned. Confirm the refund or apply the credit.',
      rows: pendingCredits.map(c => ({
        id: c.id,
        label: c.profiles?.full_name || 'Unknown',
        detail: `${c.currency} ${Number(c.amount).toLocaleString()} · ${c.kind}`,
      })),
    });

    if (suspended.length) out.push({
      key: 'suspended', severity: 'info', icon: CheckCircle2,
      title: `${suspended.length} plan${suspended.length === 1 ? '' : 's'} intentionally suspended`,
      hint: 'Billing is paused on purpose (waiver/scholarship). Not an error.',
      rows: suspended.map(p => ({
        id: p.id,
        label: p.profiles?.full_name || 'Unknown',
        detail: p.close_reason || 'No reason recorded',
      })),
    });

    return out;
  }, [plans, credits, overdueInvoices]);

  if (isLoading) return null;

  const errors = findings.filter(f => f.severity === 'error');
  if (findings.length === 0) return null;

  return (
    <div className="space-y-3 mb-4">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="font-medium text-foreground">Billing lifecycle reconciliation</span>
        <span className={`inline-flex items-center gap-1.5 ${errors.length ? 'text-red-700' : 'text-emerald-700'}`}>
          <span className={`h-2 w-2 rounded-full ${errors.length ? 'bg-red-500' : 'bg-emerald-500'}`} />
          {errors.length} item{errors.length === 1 ? '' : 's'} need attention
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {findings.map(f => {
          const isOpen = open.has(f.key);
          const Icon = f.icon;
          const tone = f.severity === 'error'
            ? 'border-red-300 bg-red-50/50'
            : 'border-border bg-muted/30';
          return (
            <div key={f.key} className={`rounded-xl border p-3 ${tone}`}>
              <div className="flex items-start gap-2.5">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${f.severity === 'error' ? 'text-red-600' : 'text-muted-foreground'}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">{f.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{f.hint}</div>
                  <Button
                    variant="ghost" size="sm" className="h-7 px-2 text-xs mt-1 -ml-2"
                    onClick={() => setOpen(prev => {
                      const n = new Set(prev);
                      n.has(f.key) ? n.delete(f.key) : n.add(f.key);
                      return n;
                    })}
                  >
                    {isOpen ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
                    {isOpen ? 'Hide' : `Show ${f.rows.length}`}
                  </Button>
                  {isOpen && (
                    <div className="mt-1 space-y-1.5">
                      {f.rows.map(r => (
                        <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-background/70 border px-2.5 py-1.5">
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate">{r.label}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{r.detail}</div>
                          </div>
                          {f.key === 'pending_closure' && (
                            <Button size="sm" className="h-7 text-xs shrink-0" onClick={() => setClosingPlan(r.plan)}>
                              Review &amp; Close
                            </Button>
                          )}
                          {f.key === 'credits' && (
                            <div className="flex gap-1 shrink-0">
                              <Button size="sm" variant="outline" className="h-7 text-xs"
                                onClick={() => confirmCredit.mutate({ id: r.id, status: 'applied' })}>Apply</Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs"
                                onClick={() => confirmCredit.mutate({ id: r.id, status: 'refunded' })}>Refunded</Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {f.severity === 'info' && <Badge variant="secondary" className="text-[10px] shrink-0">Intentional</Badge>}
              </div>
            </div>
          );
        })}
      </div>

      <CloseBillingPlanDialog plan={closingPlan} onOpenChange={(o) => !o && setClosingPlan(null)} />
    </div>
  );
}
