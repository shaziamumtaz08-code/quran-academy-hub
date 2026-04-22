import React, { Suspense, lazy, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Navigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { Skeleton } from '@/components/ui/skeleton';

const Payments = lazy(() => import('./Payments'));
const SalaryEngine = lazy(() => import('./SalaryEngine'));
const Expenses = lazy(() => import('./Expenses'));
const CashAdvances = lazy(() => import('./CashAdvances'));
const FinanceSetup = lazy(() => import('./FinanceSetup'));
const TeacherPayouts = lazy(() => import('./TeacherPayouts'));

const Loading = () => <div className="py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

const views = [
  { label: 'Invoices', value: 'invoices' },
  { label: 'Payments', value: 'payments' },
  { label: 'Fee Plans', value: 'fee-plans' },
  { label: 'Salaries', value: 'salaries' },
  { label: 'Expenses', value: 'expenses' },
  { label: 'Cash Advances', value: 'cash-advances' },
  { label: 'Payouts', value: 'payouts' },
  { label: 'Setup', value: 'setup' },
] as const;

export default function FinanceLanding() {
  const { activeDivision } = useDivision();
  const [searchParams, setSearchParams] = useSearchParams();
  const divisionId = activeDivision?.id || null;
  const currentMonth = format(new Date(), 'yyyy-MM');
  const requested = searchParams.get('view');
  const activeView = views.some((item) => item.value === requested) ? requested! : null;

  const { data: counts, isLoading } = useQuery({
    queryKey: ['finance-landing-kpis', divisionId, currentMonth],
    queryFn: async () => {
      const sb = supabase as any;
      let invoiceQuery = sb.from('fee_invoices').select('amount, amount_paid, status, division_id').eq('billing_month', currentMonth);
      if (divisionId) invoiceQuery = invoiceQuery.eq('division_id', divisionId);
      const { data: invoices } = await invoiceQuery;
      const rows = invoices || [];
      return {
        revenue: rows.reduce((sum: number, row: any) => sum + Number(row.amount_paid || 0), 0),
        outstanding: rows.reduce((sum: number, row: any) => sum + Math.max(0, Number(row.amount || 0) - Number(row.amount_paid || 0)), 0),
        paid: rows.filter((row: any) => row.status === 'paid').length,
        overdue: rows.filter((row: any) => row.status === 'overdue').length,
      };
    },
  });

  const formatCurrency = (value: number | undefined) => `₨${Number(value || 0).toLocaleString()}`;

  const contentMap: Record<string, React.ReactNode> = useMemo(() => ({
    invoices: <Suspense fallback={<Loading />}><Payments /></Suspense>,
    payments: <Suspense fallback={<Loading />}><Payments /></Suspense>,
    'fee-plans': <Suspense fallback={<Loading />}><FinanceSetup /></Suspense>,
    salaries: <Suspense fallback={<Loading />}><SalaryEngine /></Suspense>,
    expenses: <Suspense fallback={<Loading />}><Expenses /></Suspense>,
    'cash-advances': <Suspense fallback={<Loading />}><CashAdvances /></Suspense>,
    payouts: <Suspense fallback={<Loading />}><TeacherPayouts /></Suspense>,
    setup: <Suspense fallback={<Loading />}><FinanceSetup /></Suspense>,
  }), []);

  if (!activeView) return <Navigate to="/finance?view=invoices" replace />;

  return (
    <div className="space-y-5 animate-fade-in">
      <header>
        <h1 className="text-2xl font-serif font-bold text-foreground">Finance</h1>
        <p className="mt-1 text-sm text-muted-foreground">Revenue, invoices, payouts, and finance operations.</p>
      </header>
      <div className="min-h-[420px]">{contentMap[activeView]}</div>
    </div>
  );
}
