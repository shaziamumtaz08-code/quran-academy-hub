import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileUploadField } from '@/components/shared/FileUploadField';
import { CheckCircle2, Clock, AlertTriangle, Download, Receipt, Calendar, User, ArrowRight, Upload, Paperclip, X } from 'lucide-react';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useKidContext } from '@/contexts/KidContext';
import { useToast } from '@/hooks/use-toast';


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
  is_archived?: boolean | null;
  superseded_by_invoice_id?: string | null;
  archive_reason?: string | null;
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
  const { activeKidId } = useKidContext();

  // Parents always view a single child at a time — the child is chosen via
  // the top ActingAsBanner switcher (or by entering through "Login to Child's
  // Account"). No per-page duplicate switcher; this mirrors the actual student
  // view exactly.
  const selectedChildId = isParentView ? activeKidId : null;

  const studentInvoices = useMemo(() => {
    const base = (isParentView && selectedChildId)
      ? invoices.filter(i => i.student_id === selectedChildId)
      : invoices;
    // Students/parents never see archived (superseded) invoices — only the active revised one
    return base.filter(i => !i.is_archived);
  }, [invoices, isParentView, selectedChildId]);


  // IDs of invoices that *replaced* an older one (i.e. revisions). Computed from archived
  // siblings the admin view exposes; for students RLS may hide them and the set is just empty.
  const revisedIds = useMemo(() => {
    const s = new Set<string>();
    invoices.forEach(i => {
      if (i.is_archived && i.superseded_by_invoice_id) s.add(i.superseded_by_invoice_id);
    });
    return s;
  }, [invoices]);

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

  const displayDueDate = useMemo(() => {
    const openInvoices = studentInvoices
      .filter(inv => ['pending', 'overdue', 'partially_paid'].includes(inv.status))
      .filter(inv => {
        const paid = ledgerPaidMap[inv.id] || 0;
        const forgiven = Number(inv.forgiven_amount || 0);
        return Math.max(0, Number(inv.amount) - paid - forgiven) > 0.01;
      })
      .sort((a, b) => (a.due_date || `${a.billing_month}-10`).localeCompare(b.due_date || `${b.billing_month}-10`));
    const latestInvoice = [...studentInvoices]
      .sort((a, b) => (b.billing_month || '').localeCompare(a.billing_month || '') || (b.due_date || '').localeCompare(a.due_date || ''))[0];
    const candidate = openInvoices[0] || latestInvoice;
    return candidate?.due_date || (candidate?.billing_month ? `${candidate.billing_month}-10` : null);
  }, [studentInvoices, ledgerPaidMap]);

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
      {/* Sibling switcher lives in the top ActingAsBanner — no duplicate here. */}


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
            {displayDueDate ? (
              <p className="text-base md:text-lg font-semibold leading-tight">
                {format(parseISO(displayDueDate), 'dd MMM yyyy')}
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

      {/* PAYMENT HISTORY — one row per month (invoice + payment combined) */}
      {(() => {
        const today = startOfDay(new Date());
        // Group invoices by billing_month
        const byMonth = new Map<string, typeof studentInvoices>();
        studentInvoices
          .filter(inv => inv.billing_month <= cbm)
          .forEach(inv => {
            const arr = byMonth.get(inv.billing_month) || [];
            arr.push(inv);
            byMonth.set(inv.billing_month, arr);
          });
        const rows = Array.from(byMonth.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([bm, invs]) => {
            const totalAmount = invs.reduce((s, i) => s + Number(i.amount || 0), 0);
            const totalPaid = invs.reduce((s, i) => s + (ledgerPaidMap[i.id] || 0), 0);
            const totalForgiven = invs.reduce((s, i) => s + Number(i.forgiven_amount || 0), 0);
            const remaining = Math.max(0, totalAmount - totalPaid - totalForgiven);
            const currency = invs[0]?.currency || 'PKR';
            const dueDates = invs.map(i => i.due_date).filter(Boolean) as string[];
            const earliestDue = dueDates.sort()[0] || null;
            const monthTxns = (transactions as any[])
              .filter(t => invs.some(i => i.id === t.invoice_id))
              .sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));
            const lastPaidDate = monthTxns[0]?.payment_date || null;
            const allPaid = invs.every(i => i.status === 'paid' || i.status === 'waived');
            const anyPartial = invs.some(i => i.status === 'partially_paid') || (totalPaid > 0 && remaining > 0.01);
            const anyOverdue = !allPaid && earliestDue && isBefore(parseISO(earliestDue), today);
            const effectiveStatus =
              allPaid ? 'paid'
              : anyPartial ? 'partially_paid'
              : anyOverdue ? 'overdue'
              : 'pending';
            const primaryInvoice = invs[0];
            return { bm, invs, totalAmount, totalPaid, remaining, currency, earliestDue, lastPaidDate, effectiveStatus, primaryInvoice };
          });
        const visible = showAllTxns ? rows : rows.slice(0, 12);

        return (
          <div>
            <h3 className="text-base font-semibold mb-3">Payment History</h3>
            {rows.length === 0 ? (
              <div className="bg-card rounded-xl border border-dashed border-border p-6 text-center">
                <Receipt className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No invoices yet</p>
              </div>
            ) : (
              <div className="relative pl-5">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                <div className="space-y-2.5">
                  {visible.map(({ bm, totalAmount, totalPaid, remaining, currency, earliestDue, lastPaidDate, effectiveStatus, primaryInvoice }) => (
                    <div key={bm} className="relative">
                      <div className={cn(
                        'absolute -left-[18px] top-3.5 h-3 w-3 rounded-full ring-4 ring-background',
                        statusDot(effectiveStatus)
                      )} />
                      <div className="bg-card rounded-lg border border-border px-3.5 py-2.5 hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold truncate">{formatBM(bm)}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                              <span className="font-medium tabular-nums text-foreground/80">
                                Fee {currency} {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                              {earliestDue && (
                                <span><span className="text-muted-foreground/40">·</span> Due {format(parseISO(earliestDue), 'dd MMM yyyy')}</span>
                              )}
                              {totalPaid > 0 && (
                                <span className="text-emerald-700">
                                  <span className="text-muted-foreground/40">·</span> Paid {currency} {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  {lastPaidDate && <> on {format(parseISO(lastPaidDate), 'dd MMM yyyy')}</>}
                                </span>
                              )}
                              {remaining > 0.01 && effectiveStatus !== 'paid' && (
                                <span className="text-rose-700">
                                  <span className="text-muted-foreground/40">·</span> Balance {currency} {remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <div className="flex items-center gap-1">
                              {primaryInvoice && revisedIds.has(primaryInvoice.id) && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-violet-300 text-violet-700 bg-violet-50">
                                  Revised
                                </Badge>
                              )}
                              <Badge className={cn('text-[10px] px-2 py-0.5', statusBadgeClass(effectiveStatus))}>
                                {statusLabel(effectiveStatus)}
                              </Badge>
                            </div>
                            {primaryInvoice && (
                              <button
                                onClick={() => window.open(`/finance/print/invoice/${primaryInvoice.id}`, '_blank')}
                                className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5 font-medium"
                              >
                                Invoice <ArrowRight className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {!showAllTxns && rows.length > 12 && (
                  <button
                    onClick={() => setShowAllTxns(true)}
                    className="mt-3 text-xs text-primary hover:underline ml-1"
                  >
                    Load more ({rows.length - 12} more)
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
