import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Clock, AlertTriangle, Download, Receipt, Calendar, User, ArrowRight } from 'lucide-react';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const formatBM = (bm: string) => { const [y,m] = bm.split('-'); return `${MONTHS[parseInt(m,10)-1] || m} ${y}`; };
const shortBM = (bm: string) => { const [y,m] = bm.split('-'); return `${MONTHS[parseInt(m,10)-1]?.slice(0,3) || m} ${y.slice(2)}`; };

interface InvoiceLite {
  id: string;
  student_id: string;
  amount: number;
  currency: string;
  billing_month: string;
  due_date: string | null;
  status: string;
  amount_paid: number;
  forgiven_amount: number;
  period_from: string | null;
  period_to: string | null;
  paid_at?: string | null;
  profiles: { full_name: string } | null;
}

const currentBillingMonth = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
};

interface Props {
  invoices: InvoiceLite[];
  isLoading: boolean;
  ledgerPaidMap: Record<string, number>;
  getRate: (currency: string) => number;
  isParentView: boolean;
  parentLinks?: { student_id: string; parent_id: string }[];
  currentUserId?: string;
}

const statusDot = (status: string) => {
  switch (status) {
    case 'paid': return 'bg-emerald-500';
    case 'partially_paid': return 'bg-amber-500';
    case 'overdue': return 'bg-rose-500';
    case 'waived': return 'bg-muted-foreground';
    case 'future': return 'bg-transparent border border-muted-foreground/40';
    case 'pending': return 'bg-slate-400';
    default: return 'bg-muted';
  }
};

const statusLabel = (s: string) => ({
  paid: 'Paid', partially_paid: 'Partial', overdue: 'Overdue',
  waived: 'Waived', adjusted: 'Adjusted', pending: 'Pending',
}[s] || s);

const statusBadgeClass = (s: string) => {
  switch (s) {
    case 'paid': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'partially_paid': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'overdue': return 'bg-rose-100 text-rose-800 border-rose-200';
    case 'waived': return 'bg-muted text-muted-foreground border-border';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

export function StudentFeePortal({
  invoices, isLoading, ledgerPaidMap, getRate, isParentView,
}: Props) {
  const children = useMemo(() => {
    const map = new Map<string, string>();
    invoices.forEach(i => {
      if (i.profiles?.full_name) map.set(i.student_id, i.profiles.full_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [invoices]);

  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  React.useEffect(() => {
    if (isParentView && !selectedChildId && children.length > 0) {
      setSelectedChildId(children[0].id);
    }
  }, [isParentView, children, selectedChildId]);

  const studentInvoices = useMemo(() => {
    if (isParentView && selectedChildId) {
      return invoices.filter(i => i.student_id === selectedChildId);
    }
    return invoices;
  }, [invoices, isParentView, selectedChildId]);

  const focusedStudentId = isParentView
    ? selectedChildId
    : (studentInvoices[0]?.student_id || null);

  // Fetch teacher + subject (single fetch, latest active assignment)
  const { data: teacherInfo } = useQuery({
    queryKey: ['student-portal-teacher', focusedStudentId],
    queryFn: async () => {
      if (!focusedStudentId) return null;
      const { data: asgn } = await supabase
        .from('student_teacher_assignments')
        .select('teacher_id, subject_id')
        .eq('student_id', focusedStudentId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!asgn) return null;
      const [{ data: teacher }, { data: subject }] = await Promise.all([
        asgn.teacher_id ? supabase.from('profiles').select('full_name').eq('id', asgn.teacher_id).maybeSingle() : Promise.resolve({ data: null }),
        asgn.subject_id ? supabase.from('subjects').select('name').eq('id', asgn.subject_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      return {
        teacherName: teacher?.full_name || null,
        subjectName: subject?.name || null,
      };
    },
    enabled: !!focusedStudentId,
  });

  // Fetch payment transactions
  const invoiceIds = useMemo(() => studentInvoices.map(i => i.id), [studentInvoices]);
  const { data: transactionsRaw = [] } = useQuery({
    queryKey: ['student-portal-txns', invoiceIds.sort().join(',')],
    queryFn: async () => {
      if (invoiceIds.length === 0) return [];
      const { data } = await supabase
        .from('payment_transactions')
        .select('*')
        .in('invoice_id', invoiceIds)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: invoiceIds.length > 0,
  });

  // Dedupe by (payment_date | amount | currency | billing_month) — same student paying same amount on same day = one entry
  const transactions = useMemo(() => {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const tx of transactionsRaw as any[]) {
      const inv = studentInvoices.find(i => i.id === tx.invoice_id);
      const key = `${tx.payment_date}|${tx.amount_foreign}|${tx.currency_foreign}|${inv?.billing_month || tx.invoice_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tx);
    }
    return out;
  }, [transactionsRaw, studentInvoices]);

  const cbm = currentBillingMonth();

  const outstanding = useMemo(() => {
    const today = startOfDay(new Date());
    let totalDue = 0;
    let currency = 'PKR';
    let hasOverdue = false;
    let earliestDue: string | null = null;
    studentInvoices.forEach(inv => {
      if (inv.billing_month > cbm) return;
      if (!['pending', 'overdue', 'partially_paid'].includes(inv.status)) return;
      const paid = ledgerPaidMap[inv.id] || 0;
      const forgiven = Number(inv.forgiven_amount || 0);
      const remaining = Math.max(0, Number(inv.amount) - paid - forgiven);
      if (remaining > 0.01) {
        totalDue += remaining;
        currency = inv.currency;
        if (inv.due_date && isBefore(parseISO(inv.due_date), today)) hasOverdue = true;
        if (!earliestDue || (inv.due_date && inv.due_date < earliestDue)) earliestDue = inv.due_date;
      }
    });
    return { totalDue, currency, hasOverdue, earliestDue };
  }, [studentInvoices, ledgerPaidMap, cbm]);

  const monthsStrip = useMemo(() => {
    const today = startOfDay(new Date());
    const monthSet = new Set<string>(studentInvoices.map(i => i.billing_month));
    monthSet.add(cbm);
    const months = Array.from(monthSet).sort();
    return months.map(bm => {
      const invs = studentInvoices.filter(x => x.billing_month === bm);
      if (invs.length === 0) return { bm, status: 'none' as const };
      const allPaid = invs.every(i => i.status === 'paid' || i.status === 'waived');
      if (allPaid) return { bm, status: 'paid' as const };
      const anyOverdue = invs.some(i =>
        ['pending', 'overdue', 'partially_paid'].includes(i.status) &&
        i.due_date && isBefore(parseISO(i.due_date), today)
      );
      if (anyOverdue) return { bm, status: 'overdue' as const };
      const anyPartial = invs.some(i => i.status === 'partially_paid');
      if (anyPartial) return { bm, status: 'partially_paid' as const };
      if (bm > cbm) return { bm, status: 'future' as const };
      return { bm, status: 'pending' as const };
    });
  }, [studentInvoices, cbm]);

  const [activeMonth, setActiveMonth] = useState<string>(cbm);

  const stripRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!stripRef.current) return;
    const el = stripRef.current.querySelector(`[data-bm="${cbm}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [cbm, monthsStrip.length]);

  const activeInvoice = useMemo(
    () => studentInvoices.find(i => i.billing_month === activeMonth) || null,
    [studentInvoices, activeMonth]
  );

  const [showAllTxns, setShowAllTxns] = useState(false);
  const visibleTxns = showAllTxns ? transactions : transactions.slice(0, 12);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <Receipt className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No invoices yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Your monthly invoice will appear here once generated by the academy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {isParentView && children.length > 0 && (
        <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Viewing fees for:</span>
          <Select value={selectedChildId || ''} onValueChange={setSelectedChildId}>
            <SelectTrigger className="h-9 w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {children.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* HERO BALANCE CARD */}
      <div
        className="relative overflow-hidden rounded-2xl p-5 md:p-7 text-white shadow-xl"
        style={{ background: 'linear-gradient(135deg, hsl(216 70% 11%), hsl(216 60% 20%))' }}
      >
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />
        <div className="relative grid grid-cols-2 gap-4 md:gap-6">
          {/* LEFT — balance */}
          <div className="min-w-0">
            <p className="text-[10px] md:text-xs uppercase tracking-widest text-white/60 mb-1.5">Fee Balance</p>
            {outstanding.totalDue > 0.01 ? (
              <h2 className="text-2xl md:text-4xl font-bold tabular-nums leading-tight">
                {outstanding.currency} {outstanding.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
            ) : (
              <h2 className="text-2xl md:text-4xl font-bold tabular-nums leading-tight">PKR 0.00</h2>
            )}
            <div className="mt-2">
              {outstanding.totalDue > 0.01 ? (
                outstanding.hasOverdue ? (
                  <Badge className="bg-rose-500/90 text-white border-0 hover:bg-rose-500/90 gap-1 text-[10px]">
                    <AlertTriangle className="h-3 w-3" /> OVERDUE
                  </Badge>
                ) : (
                  <Badge className="bg-amber-400/90 text-amber-950 border-0 hover:bg-amber-400/90 gap-1 text-[10px]">
                    <Clock className="h-3 w-3" /> DUE SOON
                  </Badge>
                )
              ) : (
                <Badge className="bg-emerald-500/90 text-white border-0 hover:bg-emerald-500/90 gap-1 text-[10px]">
                  <CheckCircle2 className="h-3 w-3" /> ALL CLEAR
                </Badge>
              )}
            </div>
            {(teacherInfo?.teacherName || teacherInfo?.subjectName) && (
              <p className="mt-2.5 text-[11px] md:text-xs text-white/70 truncate">
                {teacherInfo.subjectName}{teacherInfo.subjectName && teacherInfo.teacherName ? ' · ' : ''}{teacherInfo.teacherName}
              </p>
            )}
          </div>

          {/* RIGHT — next due + current month */}
          <div className="min-w-0 flex flex-col items-end text-right">
            <p className="text-[10px] md:text-xs uppercase tracking-widest text-white/60 mb-1.5">Next Due</p>
            {outstanding.earliestDue ? (
              <p className="text-base md:text-lg font-semibold leading-tight">
                {format(parseISO(outstanding.earliestDue), 'dd MMM yyyy')}
              </p>
            ) : (
              <p className="text-base md:text-lg font-semibold leading-tight text-white/80">—</p>
            )}
            <p className="mt-2 text-[10px] text-white/50 uppercase tracking-wider">Current Month</p>
            <p className="text-xs md:text-sm font-medium">{shortBM(cbm)}</p>
            {activeInvoice && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-white hover:bg-white/10 hover:text-white border border-white/20 gap-2 h-8 text-xs"
                onClick={() => window.open(`/finance/print/invoice/${activeInvoice.id}`, '_blank')}
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* MONTH PILL TOGGLE — small outlined */}
      <div ref={stripRef} className="overflow-x-auto scrollbar-hide -mx-1 px-1">
        <div className="flex gap-1.5 min-w-max">
          {monthsStrip.map(m => {
            const isActive = m.bm === activeMonth;
            const exists = m.status !== 'none';
            return (
              <button
                key={m.bm}
                data-bm={m.bm}
                onClick={() => exists && setActiveMonth(m.bm)}
                disabled={!exists}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs whitespace-nowrap transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent border-border text-foreground hover:bg-muted',
                  !exists && 'opacity-40 cursor-not-allowed'
                )}
              >
                {exists && <span className={cn('h-1.5 w-1.5 rounded-full', statusDot(m.status))} />}
                <span className="font-medium">{shortBM(m.bm)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* INVOICE CARD — clean 2-col grid */}
      {activeInvoice ? (() => {
        const isFuture = activeInvoice.billing_month > cbm;
        return (
          <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h3 className="text-base font-semibold">{formatBM(activeInvoice.billing_month)} Invoice</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">#{activeInvoice.id.slice(0, 8).toUpperCase()}</p>
              </div>
              {isFuture ? (
                <Badge className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 border-blue-200">Upcoming</Badge>
              ) : (
                <Badge className={cn('text-[10px] px-2 py-0.5', statusBadgeClass(activeInvoice.status))}>
                  {statusLabel(activeInvoice.status)}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="text-xs text-muted-foreground">Description</div>
              <div className="text-sm font-semibold text-right">Monthly Tuition Fee</div>

              {activeInvoice.period_from && activeInvoice.period_to && (
                <>
                  <div className="text-xs text-muted-foreground">Period</div>
                  <div className="text-sm font-semibold text-right">
                    {format(parseISO(activeInvoice.period_from), 'dd MMM')} – {format(parseISO(activeInvoice.period_to), 'dd MMM yyyy')}
                  </div>
                </>
              )}

              <div className="text-xs text-muted-foreground">Amount</div>
              <div className="text-right">
                <div className="text-sm font-bold tabular-nums">
                  {activeInvoice.currency} {Number(activeInvoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                {activeInvoice.currency !== 'PKR' && (
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    ≈ PKR {(Number(activeInvoice.amount) * (getRate(activeInvoice.currency) || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                )}
              </div>

              {activeInvoice.due_date && (
                <>
                  <div className="text-xs text-muted-foreground">Due Date</div>
                  <div className="text-sm font-semibold text-right">{format(parseISO(activeInvoice.due_date), 'dd MMM yyyy')}</div>
                </>
              )}

              {(activeInvoice.status === 'paid' || activeInvoice.status === 'partially_paid') && activeInvoice.paid_at && (
                <>
                  <div className="text-xs text-muted-foreground">Paid On</div>
                  <div className="text-sm font-semibold text-right">{format(parseISO(activeInvoice.paid_at), 'dd MMM yyyy')}</div>
                </>
              )}
            </div>

            {activeInvoice.status === 'partially_paid' && (() => {
              const paid = ledgerPaidMap[activeInvoice.id] || 0;
              const total = Number(activeInvoice.amount);
              const remaining = Math.max(0, total - paid);
              const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
              return (
                <div className="mt-4 pt-3 border-t border-border/50">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground">{activeInvoice.currency} {paid.toLocaleString(undefined, { minimumFractionDigits: 2 })} paid</span>
                    <span className="font-medium">of {activeInvoice.currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs font-semibold text-amber-700 mt-1.5">
                    Remaining: {activeInvoice.currency} {remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              );
            })()}

            <div className="mt-4 pt-3 border-t border-border/50 flex justify-end">
              <button
                onClick={() => window.open(`/finance/print/invoice/${activeInvoice.id}`, '_blank')}
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
              >
                Open Invoice <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        );
      })() : (
        <div className="bg-card rounded-2xl border border-dashed border-border p-8 text-center">
          <Calendar className="h-7 w-7 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No invoice for {formatBM(activeMonth)}</p>
        </div>
      )}

      {/* PAYMENT HISTORY */}
      <div>
        <h3 className="text-base font-semibold mb-3">Payment History</h3>
        {transactions.length === 0 ? (
          <div className="bg-card rounded-xl border border-dashed border-border p-6 text-center">
            <Receipt className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No payments recorded yet</p>
          </div>
        ) : (
          <div className="relative pl-5">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
            <div className="space-y-2.5">
              {visibleTxns.map((tx: any) => {
                const inv = studentInvoices.find(i => i.id === tx.invoice_id);
                const isPartial = inv?.status === 'partially_paid';
                return (
                  <div key={tx.id} className="relative">
                    <div className={cn(
                      'absolute -left-[18px] top-3 h-3 w-3 rounded-full ring-4 ring-background',
                      isPartial ? 'bg-amber-500' : 'bg-emerald-500'
                    )} />
                    <div className="bg-card rounded-lg border border-border px-3.5 py-2.5 hover:shadow-sm transition-shadow">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 flex-wrap text-sm min-w-0">
                          <span className="font-medium tabular-nums whitespace-nowrap">
                            {tx.payment_date ? format(parseISO(tx.payment_date), 'dd MMM yyyy') : '—'}
                          </span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="font-bold tabular-nums whitespace-nowrap">
                            {tx.currency_foreign} {Number(tx.amount_foreign).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                          {tx.payment_method && (
                            <>
                              <span className="text-muted-foreground/40">·</span>
                              <span className="text-xs text-muted-foreground">{tx.payment_method}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {!showAllTxns && transactions.length > 12 && (
              <button
                onClick={() => setShowAllTxns(true)}
                className="mt-3 text-xs text-primary hover:underline ml-1"
              >
                Load more ({transactions.length - 12} more)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
