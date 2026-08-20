import { lazyWithRetry } from "@/lib/lazyRetry";
import React, { Suspense, lazy, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
import { Skeleton } from '@/components/ui/skeleton';
import { useDivision } from '@/contexts/DivisionContext';

const Payments = lazyWithRetry(() => import('./Payments'));
const SalaryEngine = lazyWithRetry(() => import('./SalaryEngine'));
const Expenses = lazyWithRetry(() => import('./Expenses'));
const CashAdvances = lazyWithRetry(() => import('./CashAdvances'));
const FinanceSetup = lazyWithRetry(() => import('./FinanceSetup'));
const TeacherPayouts = lazyWithRetry(() => import('./TeacherPayouts'));
const StaffSalarySetup = lazyWithRetry(() => import('./StaffSalarySetup'));
const GroupAcademyFinance = lazyWithRetry(() => import('./GroupAcademyFinance'));

const Loading = () => <div className="py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

const views = [
  { label: 'Invoices', value: 'invoices' },
  { label: 'Payments', value: 'payments' },
  { label: 'Fee Plans', value: 'fee-plans' },
  { label: 'Staff Salary Setup', value: 'staff-salary-setup' },
  { label: 'Salaries', value: 'salaries' },
  { label: 'Expenses', value: 'expenses' },
  { label: 'Cash Advances', value: 'cash-advances' },
  { label: 'Payouts', value: 'payouts' },
  { label: 'Setup', value: 'setup' },
] as const;

// Views that source from 1:1 billing (fee_invoices + assignments + fee_packages).
// For Group Academy divisions these are replaced with a course-based aggregate.
const ONE_TO_ONE_BILLING_VIEWS = new Set(['invoices', 'payments', 'fee-plans']);

export default function FinanceLanding() {
  const [searchParams] = useSearchParams();
  const { activeModelType } = useDivision();
  const requested = searchParams.get('view');
  const activeView = views.some((item) => item.value === requested) ? requested! : null;
  const isGroup = activeModelType === 'group';

  const contentMap: Record<string, React.ReactNode> = useMemo(() => {
    const invoicesView = isGroup
      ? <Suspense fallback={<Loading />}><GroupAcademyFinance /></Suspense>
      : <Suspense fallback={<Loading />}><Payments /></Suspense>;
    return {
      invoices: invoicesView,
      payments: invoicesView,
      'fee-plans': invoicesView,
      'staff-salary-setup': <Suspense fallback={<Loading />}><StaffSalarySetup /></Suspense>,
      salaries: <Suspense fallback={<Loading />}><SalaryEngine /></Suspense>,
      expenses: <Suspense fallback={<Loading />}><Expenses /></Suspense>,
      'cash-advances': <Suspense fallback={<Loading />}><CashAdvances /></Suspense>,
      payouts: <Suspense fallback={<Loading />}><TeacherPayouts /></Suspense>,
      setup: <Suspense fallback={<Loading />}><FinanceSetup /></Suspense>,
    };
  }, [isGroup]);

  if (!activeView) return <Navigate to="/finance?view=invoices" replace />;

  const description = isGroup && ONE_TO_ONE_BILLING_VIEWS.has(activeView)
    ? 'Course-based billing across this Group Academy division.'
    : 'Revenue, invoices, payouts, and finance operations.';

  return (
    <PageShell title="Finance" description={description}>
      <div className="min-h-[420px] animate-fade-in">{contentMap[activeView]}</div>
    </PageShell>
  );
}
