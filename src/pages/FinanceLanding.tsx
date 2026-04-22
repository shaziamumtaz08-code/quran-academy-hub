import React, { Suspense, lazy, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { HubPageShell } from '@/components/layout/HubPageShell';
import { Skeleton } from '@/components/ui/skeleton';

const Payments = lazy(() => import('./Payments'));
const SalaryEngine = lazy(() => import('./SalaryEngine'));
const Expenses = lazy(() => import('./Expenses'));
const CashAdvances = lazy(() => import('./CashAdvances'));
const FinanceSetup = lazy(() => import('./FinanceSetup'));
const TeacherPayouts = lazy(() => import('./TeacherPayouts'));

const Loading = () => <div className="py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

export default function FinanceLanding() {
  const { activeDivision } = useDivision();
  const divisionId = activeDivision?.id || null;
  const isOneToOne = activeDivision?.model_type === 'one_to_one';
  const currentMonth = format(new Date(), 'yyyy-MM');

  const { data: counts, isLoading } = useQuery({
    queryKey: ['finance-landing-kpis', divisionId, currentMonth],
    queryFn: async () => {
      const sb = supabase as any;
      let invoiceQuery = sb
        .from('fee_invoices')
        .select('amount, amount_paid, status, division_id')
        .eq('billing_month', currentMonth);

      if (divisionId) {
        invoiceQuery = invoiceQuery.eq('division_id', divisionId);
      }

      const { data: invoices } = await invoiceQuery;
      const rows = invoices || [];

      const revenue = rows.reduce((sum: number, row: any) => sum + Number(row.amount_paid || 0), 0);
      const outstanding = rows.reduce((sum: number, row: any) => sum + Math.max(0, Number(row.amount || 0) - Number(row.amount_paid || 0)), 0);
      const paid = rows.filter((row: any) => row.status === 'paid').length;
      const overdue = rows.filter((row: any) => row.status === 'overdue').length;

      return { revenue, outstanding, paid, overdue };
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
    'finance-setup': <Suspense fallback={<Loading />}><FinanceSetup /></Suspense>,
  }), []);

  const tabs = [
    { label: 'Invoices', value: 'invoices' },
    { label: 'Payments', value: 'payments' },
    { label: 'Fee Plans', value: 'fee-plans' },
    ...(isOneToOne ? [{ label: 'Salaries', value: 'salaries' }] : []),
    { label: 'Expenses', value: 'expenses' },
    ...(isOneToOne ? [{ label: 'Cash Advances', value: 'cash-advances' }] : []),
    ...(!isOneToOne ? [{ label: 'Payouts', value: 'payouts' }] : []),
    { label: 'Finance Setup', value: 'finance-setup' },
  ];

  return (
    <HubPageShell
      title="Finance"
      subtitle={isOneToOne ? 'Revenue, outstanding invoices, salaries, and finance operations' : 'Revenue, invoices, payouts, and finance operations'}
      kpis={[
        { label: 'Revenue (month)', value: formatCurrency(counts?.revenue), tone: 'success', loading: isLoading },
        { label: 'Outstanding', value: formatCurrency(counts?.outstanding), tone: counts && counts.outstanding > 0 ? 'warning' : 'default', loading: isLoading },
        { label: 'Invoices Paid', value: counts?.paid, loading: isLoading },
        { label: 'Invoices Overdue', value: counts?.overdue, tone: 'danger', loading: isLoading },
      ]}
      tabs={tabs}
      defaultTab="invoices"
      content={contentMap}
    />
  );
}
