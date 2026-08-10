import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SalaryStatementTemplate } from '@/components/finance/SalaryStatementTemplate';
import { Button } from '@/components/ui/button';
import { Printer, Download, ArrowLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import logoDark from '@/assets/logo-dark.jpg';
import { fetchSensitiveByUserIds } from '@/lib/sensitiveProfile';

export default function PrintSalary() {
  const { payoutId } = useParams<{ payoutId: string }>();

  useEffect(() => {
    document.body.classList.add('salary-document-print');
    return () => document.body.classList.remove('salary-document-print');
  }, []);

  const { data: payout, isLoading } = useQuery({
    queryKey: ['print-salary', payoutId],
    queryFn: async () => {
      if (!payoutId) throw new Error('No payout ID');
      const { data, error } = await supabase
        .from('salary_payouts')
        .select('*, recipient_account_snapshot, payment_channel')
        .eq('id', payoutId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!payoutId,
  });

  const { data: teacherProfile } = useQuery({
    queryKey: ['print-salary-teacher', payout?.teacher_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, country, city')
        .eq('id', payout!.teacher_id)
        .single();
      if (!data) return null;
      const sensitive = await fetchSensitiveByUserIds(
        [payout!.teacher_id],
        'user_id, whatsapp_number, bank_name, bank_account_title, bank_account_number, bank_iban',
      );
      const extra = sensitive.get(payout!.teacher_id);
      return {
        ...(data as any),
        whatsapp_number: extra?.whatsapp_number ?? null,
        bank_name: extra?.bank_name ?? null,
        bank_account_title: extra?.bank_account_title ?? null,
        bank_account_number: extra?.bank_account_number ?? null,
        bank_iban: extra?.bank_iban ?? null,
      };
    },
    enabled: !!payout?.teacher_id,
  });

  // Live primary payment account (used only when payout has no snapshot)
  const { data: livePrimaryAccount } = useQuery({
    queryKey: ['print-salary-primary-account', payout?.teacher_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profile_payment_accounts')
        .select('*')
        .eq('profile_id', payout!.teacher_id)
        .eq('is_active', true)
        .eq('is_primary', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!payout?.teacher_id && !(payout as any)?.recipient_account_snapshot,
  });

  const { data: org } = useQuery({
    queryKey: ['org-for-salary-print'],
    queryFn: async () => {
      const { data } = await supabase.from('organizations').select('name, logo_url').limit(1).single();
      return data;
    },
  });

  const { data: adjustments = [] } = useQuery({
    queryKey: ['print-salary-adjustments', payout?.salary_month, payout?.teacher_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('salary_adjustments')
        .select('*')
        .eq('salary_month', payout!.salary_month)
        .eq('teacher_id', payout!.teacher_id);
      return data || [];
    },
    enabled: !!payout?.salary_month && !!payout?.teacher_id,
  });

  if (isLoading || !payout) {
    return <div style={{ width: '794px', margin: '0 auto', padding: '40px', textAlign: 'center' }}><p>Loading salary statement...</p></div>;
  }

  const calcJson = payout.calculation_json as any;
  const students = (calcJson?.students || []).map((s: any) => ({
    studentName: s.studentName || 'Unknown',
    dateFrom: s.dateFrom || payout.salary_month + '-01',
    dateTo: s.dateTo || payout.salary_month + '-28',
    payoutRate: s.payoutRate || 0,
    payoutType: s.payoutType || 'monthly',
    eligibleDays: s.eligibleDays || 0,
    totalDays: s.totalDays || 0,
    calculatedAmount: s.calculatedAmount || 0,
    editedAmount: s.editedAmount ?? null,
  }));
  const roleSalaries = (calcJson?.roleSalaries || []).map((r: any) => ({
    role: r.role || 'unknown',
    monthlyAmount: r.monthlyAmount || 0,
    effectiveFrom: r.effectiveFrom || payout.salary_month + '-01',
    effectiveTo: r.effectiveTo || payout.salary_month + '-28',
    activeDays: r.activeDays || 0,
    totalDays: r.totalDays || 0,
    proratedAmount: r.proratedAmount || 0,
    editedAmount: r.editedAmount ?? null,
  }));

  const [y, m] = payout.salary_month.split('-').map(Number);
  const monthLabel = new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  const invoiceNumber = payout.invoice_number || `SAL-${payout.salary_month.replace('-', '')}-${teacherProfile?.full_name?.substring(0, 3).toUpperCase() || 'XXX'}`;

  const isArchived = (payout as any).is_archived === true;
  const isRevised = (payout as any).is_revised === true;
  const watermarkText = isArchived ? 'VOID — SUPERSEDED' : (isRevised ? 'REVISED' : null);

  return (
    <div id="print-root" style={{ margin: '0 auto', position: 'relative' }}>
      {watermarkText && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            transform: 'rotate(-28deg)',
            fontSize: 96, fontWeight: 900, letterSpacing: 6,
            color: isArchived ? 'rgba(220,38,38,0.18)' : 'rgba(16,185,129,0.18)',
            border: `8px solid ${isArchived ? 'rgba(220,38,38,0.22)' : 'rgba(16,185,129,0.22)'}`,
            padding: '18px 48px', borderRadius: 12, whiteSpace: 'nowrap',
          }}>{watermarkText}</div>
        </div>
      )}

      <div className="print:hidden flex items-center justify-between px-4 py-3 bg-muted/50 border-b max-w-[794px] mx-auto">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => window.close()}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
            <Download className="h-3.5 w-3.5" /> Download PDF
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </div>
      </div>
      {(() => {
        const snap: any = (payout as any).recipient_account_snapshot;
        const live: any = livePrimaryAccount;
        const account = snap || live;
        const accountAtPayment = !!snap && !!payout.paid_at;
        const channel = (payout as any).payment_channel || account?.account_type;
        return (
          <SalaryStatementTemplate
            teacherName={teacherProfile?.full_name || 'Unknown'}
            teacherId={payout.teacher_id}
            email={teacherProfile?.email}
            phone={teacherProfile?.whatsapp_number}
            location={[teacherProfile?.city, teacherProfile?.country].filter(Boolean).join(', ') || null}
            bankName={account?.bank_name || teacherProfile?.bank_name}
            bankAccountTitle={account?.account_title || teacherProfile?.bank_account_title}
            bankAccountNumber={account?.account_number || teacherProfile?.bank_account_number}
            bankIban={account?.iban || teacherProfile?.bank_iban}
            monthLabel={monthLabel}
            invoiceNumber={invoiceNumber}
            students={students}
            roleSalaries={roleSalaries}
            extraClassAmount={Number(payout.extra_class_amount)}
            adjustments={adjustments.map((a: any) => ({
              adjustment_type: a.adjustment_type,
              adjustment_mode: a.adjustment_mode || 'flat',
              amount: Number(a.amount),
              percentage_value: a.percentage_value,
              resolved_amount: a.resolved_amount,
              reason: a.reason,
            }))}
            baseSalary={Number(payout.base_salary)}
            additions={Number(payout.extra_class_amount) + Number(payout.adjustment_amount)}
            deductions={Number(payout.deductions)}
            netSalary={Number(payout.net_salary)}
            paymentDate={payout.paid_at ? format(parseISO(payout.paid_at), 'dd MMM yyyy') : null}
            paymentMethod={channel || payout.payment_method}
            receiptUrl={payout.receipt_url}
            orgName={org?.name}
            orgLogo={org?.logo_url || logoDark}
          />
        );
      })()}
      {(payout as any).recipient_account_snapshot && payout.paid_at && (
        <div style={{ width: 794, margin: '0 auto', padding: '0 48px 16px', fontSize: 10, color: '#92400e', fontStyle: 'italic' }}>
          * Account details shown reflect the recipient account at time of payment ({format(parseISO(payout.paid_at), 'dd MMM yyyy')}).
        </div>
      )}
    </div>
  );
}
