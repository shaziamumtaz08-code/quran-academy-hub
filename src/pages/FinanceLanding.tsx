import React, { Suspense, lazy, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
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
  const [searchParams] = useSearchParams();
  const requested = searchParams.get('view');
  const activeView = views.some((item) => item.value === requested) ? requested! : null;

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
    <PageShell title="Finance" description="Revenue, invoices, payouts, and finance operations.">
      <div className="min-h-[420px] animate-fade-in">{contentMap[activeView]}</div>
    </PageShell>
  );
}
