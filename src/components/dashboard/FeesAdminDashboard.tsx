import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useDivision } from '@/contexts/DivisionContext';
import { useExchangeRates } from '@/hooks/useExchangeRates';

import { DashboardShell } from './shared/DashboardShell';
import { QuickActionsGrid } from './shared/QuickActionsGrid';
import { StatsRowCompact } from './shared/StatsRowCompact';

const FEES_ADMIN_TABS = [
  { id: 'home', icon: '🏠', label: 'Home', path: '/dashboard' },
  { id: 'pending', icon: '⏳', label: 'Pending', path: '/payments' },
  { id: 'received', icon: '✅', label: 'Received', path: '/payments' },
  { id: 'reports', icon: '📊', label: 'Reports', path: '/reports' },
];

export function FeesAdminDashboard() {
  const navigate = useNavigate();
  const { activeDivision } = useDivision();
  const divisionId = activeDivision?.id;

  const { data: stats, isLoading } = useQuery({
    queryKey: ['fees-admin-dashboard', divisionId],
    queryFn: async () => {
      const currentMonth = format(new Date(), 'yyyy-MM');
      let query = supabase.from('fee_invoices').select('id, amount, amount_paid, status, student_id, currency');
      query = query.eq('billing_month', currentMonth);
      if (divisionId) query = query.eq('division_id', divisionId);
      const { data: fees } = await query;

      const invoices = fees || [];
      const invoiceIds = invoices.map(f => f.id);
      
      // Get median exchange rates per currency (last 5 transactions for resilience)
      const { data: rateTxns } = await supabase
        .from('payment_transactions')
        .select('currency_foreign, effective_rate, created_at')
        .not('effective_rate', 'is', null)
        .neq('currency_foreign', 'PKR')
        .gt('effective_rate', 0)
        .order('created_at', { ascending: false });
      const grouped: Record<string, number[]> = {};
      (rateTxns || []).forEach((tx: any) => {
        const cur = tx.currency_foreign;
        if (!grouped[cur]) grouped[cur] = [];
        if (grouped[cur].length < 5) grouped[cur].push(Number(tx.effective_rate));
      });
      const latestRates: Record<string, number> = {};
      Object.entries(grouped).forEach(([cur, vals]) => {
        vals.sort((a, b) => a - b);
        const mid = Math.floor(vals.length / 2);
        latestRates[cur] = vals.length % 2 === 0 ? (vals[mid - 1] + vals[mid]) / 2 : vals[mid];
      });

      // Guardrail: derive collected from payment_transactions ledger (in PKR via amount_local)
      let collectedPKR = 0;
      if (invoiceIds.length > 0) {
        const { data: txns } = await supabase
          .from('payment_transactions')
          .select('invoice_id, amount_local')
          .in('invoice_id', invoiceIds);
        collectedPKR = (txns || []).reduce((s: number, t: any) => s + Number(t.amount_local || 0), 0);
      }

      // Expected in PKR: PKR invoices use amount directly, FCY use latest rate
      const expectedPKR = invoices.reduce((s, f: any) => {
        if (f.currency === 'PKR') return s + Number(f.amount);
        const rate = latestRates[f.currency] || 0;
        return s + (Number(f.amount) * rate);
      }, 0);
      const pendingPKR = expectedPKR - collectedPKR;
      const overdue = invoices.filter(f => f.status === 'overdue');

      return { expected: Math.round(expectedPKR), collected: Math.round(collectedPKR), pending: Math.round(pendingPKR), overdueCount: overdue.length };
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-12 bg-primary md:hidden" />
        <div className="p-4 space-y-3 max-w-[680px] mx-auto pt-16">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    );
  }

  const quickActions = [
    { icon: '💳', label: 'Record Payment', bg: 'bg-teal/10', textColor: 'text-teal', border: 'border-teal/15', onClick: () => navigate('/payments') },
    { icon: '📢', label: 'Bulk Reminder', bg: 'bg-gold/10', textColor: 'text-gold', border: 'border-gold/15', onClick: () => navigate('/hub') },
    { icon: '📊', label: 'Report', bg: 'bg-sky/10', textColor: 'text-sky', border: 'border-sky/15', onClick: () => navigate('/reports') },
    { icon: '⚙️', label: 'Fee Setup', bg: 'bg-primary/10', textColor: 'text-primary', border: 'border-primary/15', onClick: () => navigate('/finance-setup') },
  ];

  const leftContent = (
    <>
      {/* This Month Summary */}
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: 'Expected', value: stats?.expected?.toLocaleString() || '0', color: 'text-foreground' },
          { label: 'Collected', value: stats?.collected?.toLocaleString() || '0', color: 'text-teal' },
          { label: 'Pending', value: stats?.pending?.toLocaleString() || '0', color: 'text-gold' },
          { label: 'Overdue', value: stats?.overdueCount || 0, color: 'text-destructive' },
        ].map((item) => (
          <div key={item.label} className="bg-card rounded-2xl border border-border p-3.5 shadow-card text-center">
            <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
            <p className="text-[10px] text-muted-foreground font-bold">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Overdue Alert */}
      {(stats?.overdueCount || 0) > 0 && (
        <div className="bg-card rounded-2xl border border-destructive/20 p-3.5 shadow-card">
          <p className="text-[13px] font-extrabold text-foreground">🚨 Overdue Invoices</p>
          <p className="text-[11px] text-muted-foreground">{stats?.overdueCount} invoices overdue</p>
          <button
            onClick={() => navigate('/payments')}
            className="mt-2 bg-destructive/10 text-destructive border border-destructive/15 rounded-xl px-3 py-1.5 font-bold text-xs"
          >
            View Overdue →
          </button>
        </div>
      )}
    </>
  );

  const rightContent = (
    <>
      <QuickActionsGrid actions={quickActions} />
      <StatsRowCompact
        title={`📈 Fees — ${format(new Date(), 'MMMM')}`}
        stats={[
          { value: stats?.expected?.toLocaleString() || '0', label: 'Expected', sub: 'Total', color: 'text-foreground' },
          { value: stats?.collected?.toLocaleString() || '0', label: 'Collected', sub: 'Received', color: 'text-teal' },
          { value: stats?.overdueCount || 0, label: 'Overdue', sub: 'Invoices', color: 'text-destructive' },
        ]}
      />
    </>
  );

  return (
    <DashboardShell tabs={FEES_ADMIN_TABS} leftContent={leftContent} rightContent={rightContent} brandLabel="AQA" />
  );
}
