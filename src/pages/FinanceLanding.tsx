import React, { Suspense, lazy, useMemo, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
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

// Map URL ?section= values to card IDs
const SECTION_TO_CARD: Record<string, string> = {
  'fees': 'fees',
  'payments': 'fees',
  'salaries': 'salaries',
  'expenses': 'expenses',
  'advances': 'advances',
  'fee-setup': 'setup',
  'setup': 'setup',
  'teacher-payouts': 'payouts',
  'payouts': 'payouts',
  'invoices': 'fees', // invoices are inside the Payments/fees view
};

export default function FinanceLanding() {
  const { activeDivision } = useDivision();
  const isOneToOne = activeDivision?.model_type === 'one_to_one';
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [searchParams] = useSearchParams();

  // Determine initial card from URL ?section= param
  const sectionParam = searchParams.get('section');
  const initialCard = (sectionParam && SECTION_TO_CARD[sectionParam]) || 'fees';

  const divisionId = activeDivision?.id || null;

  const { data: counts, isLoading } = useQuery({
    queryKey: ['finance-landing-counts', divisionId],
    queryFn: async () => {
      const sb = supabase as any;
      let feesQuery = sb.from('fee_invoices').select('amount, amount_paid, status').eq('billing_month', currentMonth);
      if (divisionId) feesQuery = feesQuery.eq('division_id', divisionId);
      const feesRes = await feesQuery;

      let salaryQuery = sb.from('salary_payouts').select('net_salary, status, teacher_id').eq('salary_month', currentMonth);
      const salaryRes = await salaryQuery;

      let expQuery = sb.from('expenses').select('amount').gte('expense_date', `${currentMonth}-01`);
      if (divisionId) expQuery = expQuery.eq('division_id', divisionId);
      const expensesRes = await expQuery;

      let advQuery = sb.from('cash_advances').select('remaining_balance, status');
      if (divisionId) advQuery = advQuery.eq('division_id', divisionId);
      const advancesRes = await advQuery;

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
    ...(isOneToOne ? [
      { id: 'salaries', title: 'Salaries', subtitle: 'Due this month', count: fmt(counts?.salaryDue), countLoading: isLoading, icon: <Wallet className="h-5 w-5" />, color: 'bg-emerald-500' },
    ] : []),
    { id: 'expenses', title: 'Expenses', subtitle: 'Month total', count: fmt(counts?.expTotal), countLoading: isLoading, icon: <Receipt className="h-5 w-5" />, color: 'bg-amber-500' },
    ...(isOneToOne ? [
      { id: 'advances', title: 'Cash Advances', subtitle: 'Outstanding', count: fmt(counts?.advOutstanding), countLoading: isLoading, icon: <Banknote className="h-5 w-5" />, color: 'bg-rose-500' },
    ] : []),
    { id: 'setup', title: 'Finance Setup', subtitle: 'Plans & config', count: '⚙️', countLoading: false, icon: <Settings className="h-5 w-5" />, color: 'bg-muted' },
    ...(!isOneToOne ? [
      { id: 'payouts', title: 'Teacher Payouts', subtitle: 'Course staff pay', count: '🎓', countLoading: false, icon: <GraduationCap className="h-5 w-5" />, color: 'bg-violet-500' },
    ] : []),
  ];

  const contentMap = useMemo(() => ({
    'fees': <Suspense fallback={<Loading />}><Payments /></Suspense>,
    'salaries': <Suspense fallback={<Loading />}><SalaryEngine /></Suspense>,
    'expenses': <Suspense fallback={<Loading />}><Expenses /></Suspense>,
    'advances': <Suspense fallback={<Loading />}><CashAdvances /></Suspense>,
    'setup': <Suspense fallback={<Loading />}><FinanceSetup /></Suspense>,
    'payouts': <Suspense fallback={<Loading />}><TeacherPayouts /></Suspense>,
  }), []);

  return (
    <LandingPageShell
      title="Finance"
      subtitle={isOneToOne ? "Fees, salaries, expenses, and financial configuration" : "Course fees, expenses, and financial configuration"}
      cards={cards}
      contentMap={contentMap}
      defaultCard={initialCard}
    />
  );
}
