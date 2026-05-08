import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Clock, AlertTriangle, ExternalLink, Download, Receipt, Calendar, User, FileText } from 'lucide-react';
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
  paid: 'Paid', partially_paid: 'Partially Paid', overdue: 'Overdue',
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
  invoices, isLoading, ledgerPaidMap, getRate, isParentView, parentLinks = [], currentUserId,
}: Props) {
  // For parents: derive children list from invoices
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

  // Filter invoices to selected student (parent) or all (student—RLS already scopes)
  const studentInvoices = useMemo(() => {
    if (isParentView && selectedChildId) {
      return invoices.filter(i => i.student_id === selectedChildId);
    }
    return invoices;
  }, [invoices, isParentView, selectedChildId]);

  // Get student id for transactions
  const focusedStudentId = isParentView
    ? selectedChildId
    : (studentInvoices[0]?.student_id || null);

  // Fetch payment transactions for this student's invoices
  const invoiceIds = useMemo(() => studentInvoices.map(i => i.id), [studentInvoices]);
  const { data: transactions = [] } = useQuery({
    queryKey: ['student-portal-txns', invoiceIds.join(',')],
    queryFn: async () => {
      if (invoiceIds.length === 0) return [];
      const { data } = await supabase
        .from('payment_transactions')
        .select('*')
        .in('invoice_id', invoiceIds)
        .order('payment_date', { ascending: false });
      return data || [];
    },
    enabled: invoiceIds.length > 0,
  });

  const cbm = currentBillingMonth();

  // Compute outstanding balance (only current/past unpaid)
  const outstanding = useMemo(() => {
    const today = startOfDay(new Date());
    let totalDue = 0;
    let currency = 'PKR';
    let hasOverdue = false;
    let earliestDue: string | null = null;
    studentInvoices.forEach(inv => {
      if (inv.billing_month > cbm) return; // exclude future
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

  // Month strip — derive dynamically from invoices, always include current month
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

  // Auto-scroll to current month on load
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

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  // Empty state
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
    <div className="space-y-6 animate-fade-in">
      {/* Parent: Child selector */}
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
        className="relative overflow-hidden rounded-2xl p-6 md:p-8 text-white shadow-xl"
        style={{ background: 'linear-gradient(135deg, hsl(216 70% 11%), hsl(216 60% 20%))' }}
      >
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />
        <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-widest text-white/60 mb-2">Your Fee Balance</p>
            {outstanding.totalDue > 0.01 ? (
              <>
                <h2 className="text-4xl md:text-5xl font-bold tabular-nums">
                  {outstanding.currency} {outstanding.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
                <div className="flex items-center gap-2 mt-3">
                  {outstanding.hasOverdue ? (
                    <Badge className="bg-rose-500/90 text-white border-0 hover:bg-rose-500/90 gap-1">
                      <AlertTriangle className="h-3 w-3" /> OVERDUE
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-400/90 text-amber-950 border-0 hover:bg-amber-400/90 gap-1">
                      <Clock className="h-3 w-3" /> DUE
                    </Badge>
                  )}
                  {outstanding.earliestDue && (
                    <span className="text-sm text-white/70">
                      Pay by {format(parseISO(outstanding.earliestDue), 'dd MMM yyyy')}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-4xl md:text-5xl font-bold tabular-nums">PKR 0.00</h2>
                <div className="flex items-center gap-2 mt-3">
                  <Badge className="bg-emerald-500/90 text-white border-0 hover:bg-emerald-500/90 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> ALL CLEAR
                  </Badge>
                  <span className="text-sm text-white/70">No outstanding balance</span>
                </div>
              </>
            )}
          </div>
          <div className="flex flex-row md:flex-col items-end gap-3 shrink-0">
            <div className="text-right">
              <p className="text-xs text-white/50 uppercase tracking-wider">Current Month</p>
              <p className="text-sm font-semibold">{shortBM(`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`)}</p>
            </div>
            {activeInvoice && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 hover:text-white border border-white/20 gap-2"
                onClick={() => window.open(`/finance/print/invoice/${activeInvoice.id}`, '_blank')}
              >
                <Download className="h-4 w-4" />
                Download Invoice
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* MONTH HISTORY STRIP */}
      <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
        <div className="flex gap-2 min-w-max">
          {monthsStrip.map(m => {
            const isActive = m.bm === activeMonth;
            const exists = m.status !== 'none';
            return (
              <button
                key={m.bm}
                onClick={() => exists && setActiveMonth(m.bm)}
                disabled={!exists}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-full border text-sm whitespace-nowrap transition-all',
                  isActive ? 'bg-primary text-primary-foreground border-primary shadow-md' : 'bg-card border-border hover:bg-muted',
                  !exists && 'opacity-40 cursor-not-allowed'
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', exists ? statusDot(m.status) : 'bg-muted')} />
                <span className="font-medium">{shortBM(m.bm)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CURRENT MONTH DETAIL CARD */}
      {activeInvoice ? (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h3 className="text-lg font-semibold">{formatBM(activeInvoice.billing_month)} Invoice</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Invoice #{activeInvoice.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <Badge className={cn('text-xs px-3 py-1', statusBadgeClass(activeInvoice.status))}>
              {statusLabel(activeInvoice.status)}
            </Badge>
          </div>

          <div className="space-y-3 divide-y divide-border/50">
            <Row label="Description" value="Monthly Tuition Fee" />
            {activeInvoice.period_from && activeInvoice.period_to && (
              <Row
                label="Period"
                value={`${format(parseISO(activeInvoice.period_from), 'dd MMM')} – ${format(parseISO(activeInvoice.period_to), 'dd MMM yyyy')}`}
              />
            )}
            <Row
              label="Amount"
              value={
                <div className="text-right">
                  <p className="font-bold tabular-nums">
                    {activeInvoice.currency} {Number(activeInvoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  {activeInvoice.currency !== 'PKR' && (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      ≈ PKR {(Number(activeInvoice.amount) * (getRate(activeInvoice.currency) || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  )}
                </div>
              }
            />
            {activeInvoice.due_date && (
              <Row label="Due Date" value={format(parseISO(activeInvoice.due_date), 'dd MMM yyyy')} />
            )}
          </div>

          {/* Progress bar for partial */}
          {activeInvoice.status === 'partially_paid' && (() => {
            const paid = ledgerPaidMap[activeInvoice.id] || 0;
            const total = Number(activeInvoice.amount);
            const remaining = Math.max(0, total - paid);
            const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
            return (
              <div className="mt-5 pt-4 border-t border-border/50">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">
                    {activeInvoice.currency} {paid.toLocaleString(undefined, { minimumFractionDigits: 2 })} paid
                  </span>
                  <span className="font-medium">
                    of {activeInvoice.currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-sm font-semibold text-amber-700 mt-2">
                  Remaining: {activeInvoice.currency} {remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            );
          })()}

          <div className="mt-5 pt-4 border-t border-border/50 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => window.open(`/finance/print/invoice/${activeInvoice.id}`, '_blank')}
            >
              <FileText className="h-4 w-4" /> View Full Invoice
              <ExternalLink className="h-3 w-3 opacity-60" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-dashed border-border p-10 text-center">
          <Calendar className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No invoice for {formatBM(activeMonth)}</p>
        </div>
      )}

      {/* PAYMENT HISTORY TIMELINE */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Payment History</h3>
        {transactions.length === 0 ? (
          <div className="bg-card rounded-xl border border-dashed border-border p-8 text-center">
            <Receipt className="h-7 w-7 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No payments recorded yet</p>
          </div>
        ) : (
          <div className="relative pl-6">
            <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
            <div className="space-y-5">
              {visibleTxns.map((tx: any, idx: number) => {
                const inv = studentInvoices.find(i => i.id === tx.invoice_id);
                const isPartial = inv?.status === 'partially_paid';
                return (
                  <div key={tx.id} className="relative">
                    <div className={cn(
                      'absolute -left-[22px] top-1.5 h-4 w-4 rounded-full ring-4 ring-background',
                      isPartial ? 'bg-amber-500' : 'bg-emerald-500'
                    )} />
                    <div className="bg-card rounded-xl border border-border p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">
                            {tx.payment_date ? format(parseISO(tx.payment_date), 'dd MMM yyyy') : '—'}
                          </p>
                          <p className="text-base font-bold tabular-nums mt-0.5">
                            {tx.currency_foreign} {Number(tx.amount_foreign).toLocaleString(undefined, { minimumFractionDigits: 2 })} received
                          </p>
                          {tx.amount_local > 0 && tx.currency_foreign !== 'PKR' && (
                            <p className="text-xs text-muted-foreground tabular-nums">
                              ≈ PKR {Number(tx.amount_local).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                          )}
                          {inv && (
                            <p className="text-xs text-muted-foreground mt-1">
                              For {formatBM(inv.billing_month)} invoice
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {tx.payment_method && (
                            <Badge variant="outline" className="text-xs">{tx.payment_method}</Badge>
                          )}
                          {tx.receipt_url && (
                            <a
                              href={tx.receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              View Receipt <ExternalLink className="h-3 w-3" />
                            </a>
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
                className="mt-4 text-sm text-primary hover:underline ml-2"
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
