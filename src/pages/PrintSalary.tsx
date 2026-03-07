import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SalaryStatementTemplate } from '@/components/finance/SalaryStatementTemplate';
import { DocumentActions } from '@/components/finance/DocumentActions';
import { format, parseISO, endOfMonth, eachDayOfInterval } from 'date-fns';

export default function PrintSalary() {
  const { payoutId } = useParams<{ payoutId: string }>();

  const { data: payout, isLoading } = useQuery({
    queryKey: ['print-salary', payoutId],
    queryFn: async () => {
      if (!payoutId) throw new Error('No payout ID');
      const { data, error } = await supabase
        .from('salary_payouts')
        .select('*')
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
        .select('id, full_name, email, whatsapp_number, country, city, bank_name, bank_account_title, bank_account_number, bank_iban')
        .eq('id', payout!.teacher_id)
        .single();
      return data;
    },
    enabled: !!payout?.teacher_id,
  });

  const { data: org } = useQuery({
    queryKey: ['org-for-salary-print'],
    queryFn: async () => {
      const { data } = await supabase.from('organizations').select('name, logo_url').limit(1).single();
      return data;
    },
  });

  // Auto-print
  useEffect(() => {
    if (payout && teacherProfile && !isLoading) {
      const timer = setTimeout(() => window.print(), 800);
      return () => clearTimeout(timer);
    }
  }, [payout, teacherProfile, isLoading]);

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

  const [y, m] = payout.salary_month.split('-').map(Number);
  const monthLabel = new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  const invoiceNumber = payout.invoice_number || `SAL-${payout.salary_month.replace('-', '')}-${teacherProfile?.full_name?.substring(0, 3).toUpperCase() || 'XXX'}`;

  return (
    <div id="print-root" style={{ margin: '0 auto' }}>
      <div className="print:hidden flex items-center justify-end px-4 py-2 gap-2">
        <DocumentActions onPrint={() => window.print()} onDownload={() => window.print()} />
      </div>
      <SalaryStatementTemplate
        teacherName={teacherProfile?.full_name || 'Unknown'}
        teacherId={payout.teacher_id}
        email={teacherProfile?.email}
        phone={teacherProfile?.whatsapp_number}
        location={[teacherProfile?.city, teacherProfile?.country].filter(Boolean).join(', ') || null}
        bankName={teacherProfile?.bank_name}
        bankAccountTitle={teacherProfile?.bank_account_title}
        bankAccountNumber={teacherProfile?.bank_account_number}
        bankIban={teacherProfile?.bank_iban}
        monthLabel={monthLabel}
        invoiceNumber={invoiceNumber}
        students={students}
        extraClassAmount={Number(payout.extra_class_amount)}
        adjustments={[]}
        baseSalary={Number(payout.base_salary)}
        additions={Number(payout.extra_class_amount) + Number(payout.adjustment_amount)}
        deductions={Number(payout.deductions)}
        netSalary={Number(payout.net_salary)}
        paymentDate={payout.paid_at ? format(parseISO(payout.paid_at), 'dd MMM yyyy') : null}
        paymentMethod={payout.payment_method}
        receiptUrl={payout.receipt_url}
        orgName={org?.name}
        orgLogo={org?.logo_url}
      />
    </div>
  );
}
