import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SalaryStatementTemplate } from '@/components/finance/SalaryStatementTemplate';
import { Button } from '@/components/ui/button';
import { Printer, Download, ArrowLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import logoDark from '@/assets/logo-dark.jpg';
import { fetchSensitiveByUserIds } from '@/lib/sensitiveProfile';

export default function PrintSalaryBulk() {
  const [searchParams] = useSearchParams();
  const payoutIds = (searchParams.get('payouts') || '').split(',').map(s => s.trim()).filter(Boolean);

  useEffect(() => {
    document.body.classList.add('salary-document-print');
    return () => document.body.classList.remove('salary-document-print');
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['print-salary-bulk', payoutIds.join(',')],
    queryFn: async () => {
      const { data: payouts, error } = await supabase
        .from('salary_payouts')
        .select('*, recipient_account_snapshot, payment_channel')
        .in('id', payoutIds);
      if (error) throw error;
      const ordered = payoutIds
        .map(id => (payouts || []).find((p: any) => p.id === id))
        .filter(Boolean) as any[];

      const teacherIds = Array.from(new Set(ordered.map((p: any) => p.teacher_id)));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, country, city')
        .in('id', teacherIds);
      const sensitive = await fetchSensitiveByUserIds(
        teacherIds,
        'user_id, whatsapp_number, bank_name, bank_account_title, bank_account_number, bank_iban',
      );
      const profileById = new Map(
        (profiles || []).map((p: any) => [p.id, { ...p, ...(sensitive.get(p.id) ?? {}) }]),
      );

      const { data: accounts } = await supabase
        .from('profile_payment_accounts')
        .select('*')
        .in('profile_id', teacherIds)
        .eq('is_active', true)
        .eq('is_primary', true);
      const accountByProfile = new Map((accounts || []).map((a: any) => [a.profile_id, a]));

      const months = Array.from(new Set(ordered.map((p: any) => p.salary_month)));
      const { data: adjustments } = await supabase
        .from('salary_adjustments')
        .select('*')
        .in('salary_month', months)
        .in('teacher_id', teacherIds);

      const { data: org } = await supabase.from('organizations').select('name, logo_url').limit(1).single();

      return { payouts: ordered, profileById, accountByProfile, adjustments: adjustments || [], org };
    },
    enabled: payoutIds.length > 0,
  });

  if (payoutIds.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center' }}><p>No salary sheets selected.</p></div>;
  }

  if (isLoading || !data) {
    return <div style={{ width: '794px', margin: '0 auto', padding: '40px', textAlign: 'center' }}><p>Loading salary statements...</p></div>;
  }

  const { payouts, profileById, accountByProfile, adjustments, org } = data;

  return (
    <div id="print-root" className="salary-print-document" style={{ margin: '0 auto' }}>
      <div className="print:hidden flex items-center justify-between px-4 py-3 bg-muted/50 border-b max-w-[794px] mx-auto">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => window.close()}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <div className="text-xs text-muted-foreground">{payouts.length} salary sheet{payouts.length === 1 ? '' : 's'}</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
            <Download className="h-3.5 w-3.5" /> Download PDF
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </div>
      </div>

      {payouts.map((payout: any, index: number) => {
        const profile: any = profileById.get(payout.teacher_id) || {};
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
        const invoiceNumber = payout.invoice_number
          || `SAL-${payout.salary_month.replace('-', '')}-${profile?.full_name?.substring(0, 3).toUpperCase() || 'XXX'}`;

        const snap: any = payout.recipient_account_snapshot;
        const account = snap || accountByProfile.get(payout.teacher_id);
        const channel = payout.payment_channel || account?.account_type;

        const rowAdjustments = adjustments.filter(
          (a: any) => a.teacher_id === payout.teacher_id && a.salary_month === payout.salary_month,
        );

        return (
          <div
            key={payout.id}
            style={{
              breakAfter: index < payouts.length - 1 ? 'page' : 'auto',
              pageBreakAfter: index < payouts.length - 1 ? 'always' : 'auto',
              position: 'relative',
            }}
          >
            {payout.is_revised && (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  transform: 'rotate(-28deg)',
                  fontSize: 96, fontWeight: 900, letterSpacing: 6,
                  color: 'rgba(16,185,129,0.18)',
                  border: '8px solid rgba(16,185,129,0.22)',
                  padding: '18px 48px', borderRadius: 12, whiteSpace: 'nowrap',
                }}>REVISED</div>
              </div>
            )}
            <SalaryStatementTemplate
              teacherName={profile?.full_name || 'Unknown'}
              teacherId={payout.teacher_id}
              email={profile?.email}
              phone={profile?.whatsapp_number}
              location={[profile?.city, profile?.country].filter(Boolean).join(', ') || null}
              bankName={account?.bank_name || profile?.bank_name}
              bankAccountTitle={account?.account_title || profile?.bank_account_title}
              bankAccountNumber={account?.account_number || profile?.bank_account_number}
              bankIban={account?.iban || profile?.bank_iban}
              monthLabel={monthLabel}
              invoiceNumber={invoiceNumber}
              students={students}
              roleSalaries={roleSalaries}
              extraClassAmount={Number(payout.extra_class_amount)}
              adjustments={rowAdjustments.map((a: any) => ({
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
          </div>
        );
      })}
    </div>
  );
}
