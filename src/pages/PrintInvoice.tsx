import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { InvoiceTemplate } from '@/components/finance/InvoiceTemplate';
import { ReceiptTemplate } from '@/components/finance/ReceiptTemplate';
import { Button } from '@/components/ui/button';
import { Printer, Download, ArrowLeft } from 'lucide-react';
import logoDark from '@/assets/logo-dark.jpg';

export default function PrintInvoice() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'invoice'; // 'invoice' | 'receipt'

  const { data: invoice, isLoading: loadingInvoice } = useQuery({
    queryKey: ['print-invoice', invoiceId],
    queryFn: async () => {
      if (!invoiceId) throw new Error('No invoice ID');
      const { data, error } = await supabase
        .from('fee_invoices')
        .select(`
          id, student_id, amount, currency, billing_month, due_date, status,
          amount_paid, forgiven_amount, remark, payment_method, period_from, period_to,
          profiles!fee_invoices_student_id_fkey(full_name),
          student_teacher_assignments!fee_invoices_assignment_id_fkey(
            subjects!student_teacher_assignments_subject_id_fkey(name),
            profiles!student_teacher_assignments_teacher_id_fkey(full_name)
          )
        `)
        .eq('id', invoiceId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!invoiceId,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['print-invoice-txns', invoiceId],
    queryFn: async () => {
      const { data } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('invoice_id', invoiceId!)
        .order('created_at');
      return data || [];
    },
    enabled: !!invoiceId && mode === 'receipt',
  });

  const { data: org } = useQuery({
    queryKey: ['org-for-print'],
    queryFn: async () => {
      const { data } = await supabase.from('organizations').select('name, logo_url').limit(1).single();
      return data;
    },
  });

  if (loadingInvoice) {
    return <div style={{ width: '794px', margin: '0 auto', padding: '40px', textAlign: 'center' }}><p>Loading...</p></div>;
  }
  if (!invoice) {
    return <div style={{ width: '794px', margin: '0 auto', padding: '40px', textAlign: 'center' }}><p>Invoice not found.</p></div>;
  }

  const invoiceNumber = `INV-${invoice.billing_month.replace('-', '')}-${(invoice as any).profiles?.full_name?.substring(0, 3).toUpperCase() || 'XXX'}`;
  const receiptNumber = `RCT-${invoice.billing_month.replace('-', '')}-${(invoice as any).profiles?.full_name?.substring(0, 3).toUpperCase() || 'XXX'}`;

  const assignment = (invoice as any).student_teacher_assignments;
  const subjectName = assignment?.subjects?.name;
  const teacherName = assignment?.profiles?.full_name;

  if (mode === 'receipt' && transactions.length > 0) {
    return (
      <div id="print-root" style={{ margin: '0 auto' }}>
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
        <ReceiptTemplate
          receiptNumber={receiptNumber}
          studentName={(invoice as any).profiles?.full_name || 'Unknown'}
          invoiceRef={invoiceNumber}
          invoiceAmount={Number(invoice.amount)}
          invoiceCurrency={invoice.currency}
          billingMonth={invoice.billing_month}
          transactions={transactions.map((tx: any) => ({
            ...tx,
            amount_foreign: Number(tx.amount_foreign),
            amount_local: Number(tx.amount_local),
          }))}
          orgName={org?.name}
          orgLogo={org?.logo_url}
        />
      </div>
    );
  }

  return (
    <div id="print-root" style={{ margin: '0 auto' }}>
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
      <InvoiceTemplate
        invoice={{
          id: invoice.id,
          student_name: (invoice as any).profiles?.full_name || 'Unknown',
          student_id: invoice.student_id,
          billing_month: invoice.billing_month,
          amount: Number(invoice.amount),
          currency: invoice.currency,
          due_date: invoice.due_date,
          status: invoice.status,
          amount_paid: Number(invoice.amount_paid),
          forgiven_amount: Number(invoice.forgiven_amount),
          remark: invoice.remark,
          period_from: (invoice as any).period_from,
          period_to: (invoice as any).period_to,
          subjects: subjectName ? [subjectName] : undefined,
          teacher_name: teacherName || undefined,
        }}
        invoiceNumber={invoiceNumber}
        orgName={org?.name}
        orgLogo={org?.logo_url}
      />
    </div>
  );
}
