import React, { Suspense, lazy, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { LandingPageShell, LandingCard } from '@/components/layout/LandingPageShell';
import { CreditCard, Wallet, Receipt, Banknote, Settings, GraduationCap } from 'lucide-react';
import { format } from 'date-fns';
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
  const currentMonth = format(new Date(), 'yyyy-MM');

  const { data: counts, isLoading } = useQuery({
    queryKey: ['finance-landing-counts', activeDivision?.id],
    queryFn: async () => {
      const sb = supabase as any;
      const feesRes = await sb.from('fee_invoices').select('amount, amount_paid, status').eq('billing_month', currentMonth);
      const salaryRes = await sb.from('salary_payouts').select('net_salary, status').eq('month', currentMonth);
      const expensesRes = await sb.from('expenses').select('amount').gte('expense_date', `${currentMonth}-01`);
      const advancesRes = await sb.from('cash_advances').select('remaining_balance, status');

      const fees = feesRes.data || [];
      const pending = fees.filter(f => f.status !== 'paid' && f.status !== 'waived')
        .reduce((s, f) => s + Math.max(0, Number(f.amount) - Number(f.amount_paid)), 0);

      const salaries = salaryRes.data || [];
      const salaryDue = salaries.filter(s => s.status !== 'paid')
        .reduce((s, p) => s + Number(p.net_salary), 0);

      const expTotal = (expensesRes.data || []).reduce((s, e) => s + Number(e.amount), 0);
      const activeAdvances = (advancesRes.data || []).filter(a => a.status === 'active');
      const advOutstanding = activeAdvances.reduce((s, a) => s + Number(a.remaining_balance), 0);

      return { pending, salaryDue, expTotal, advOutstanding };
    },
  });

  const fmt = (n: number | undefined) => n !== undefined ? `₨${(n / 1000).toFixed(0)}k` : undefined;

  const cards: LandingCard[] = [
    { id: 'fees', title: 'Student Fees', subtitle: 'Pending this month', count: fmt(counts?.pending), countLoading: isLoading, icon: <CreditCard className="h-5 w-5" />, color: 'bg-primary' },
    { id: 'salaries', title: 'Salaries', subtitle: 'Due this month', count: fmt(counts?.salaryDue), countLoading: isLoading, icon: <Wallet className="h-5 w-5" />, color: 'bg-emerald-500' },
    { id: 'expenses', title: 'Expenses', subtitle: 'Month total', count: fmt(counts?.expTotal), countLoading: isLoading, icon: <Receipt className="h-5 w-5" />, color: 'bg-amber-500' },
    { id: 'advances', title: 'Cash Advances', subtitle: 'Outstanding', count: fmt(counts?.advOutstanding), countLoading: isLoading, icon: <Banknote className="h-5 w-5" />, color: 'bg-rose-500' },
    { id: 'setup', title: 'Finance Setup', subtitle: 'Plans & config', count: '⚙️', countLoading: false, icon: <Settings className="h-5 w-5" />, color: 'bg-muted' },
  ];

  const contentMap = useMemo(() => ({
    'fees': <Suspense fallback={<Loading />}><Payments /></Suspense>,
    'salaries': <Suspense fallback={<Loading />}><SalaryEngine /></Suspense>,
    'expenses': <Suspense fallback={<Loading />}><Expenses /></Suspense>,
    'advances': <Suspense fallback={<Loading />}><CashAdvances /></Suspense>,
    'setup': <Suspense fallback={<Loading />}><FinanceSetup /></Suspense>,
  }), []);

  return (
    <LandingPageShell
      title="Finance"
      subtitle="Fees, salaries, expenses, and financial configuration"
      cards={cards}
      contentMap={contentMap}
      defaultCard="fees"
    />
  );
}
