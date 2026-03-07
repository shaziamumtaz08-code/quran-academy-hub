import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { InvoiceTemplate } from '@/components/finance/InvoiceTemplate';
import { ReceiptTemplate } from '@/components/finance/ReceiptTemplate';
import { DocumentActions } from '@/components/finance/DocumentActions';

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
          profiles!fee_invoices_student_id_fkey(full_name)
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

  // Auto-print after load
  useEffect(() => {
    if (invoice && !loadingInvoice) {
      const timer = setTimeout(() => window.print(), 800);
      return () => clearTimeout(timer);
    }
  }, [invoice, loadingInvoice]);

  if (loadingInvoice) {
    return <div style={{ width: '794px', margin: '0 auto', padding: '40px', textAlign: 'center' }}><p>Loading...</p></div>;
  }
  if (!invoice) {
    return <div style={{ width: '794px', margin: '0 auto', padding: '40px', textAlign: 'center' }}><p>Invoice not found.</p></div>;
  }

  const invoiceNumber = `INV-${invoice.billing_month.replace('-', '')}-${(invoice as any).profiles?.full_name?.substring(0, 3).toUpperCase() || 'XXX'}`;
  const receiptNumber = `RCT-${invoice.billing_month.replace('-', '')}-${(invoice as any).profiles?.full_name?.substring(0, 3).toUpperCase() || 'XXX'}`;

  if (mode === 'receipt' && transactions.length > 0) {
    return (
      <div id="print-root" style={{ margin: '0 auto' }}>
        <div className="print:hidden flex items-center justify-end px-4 py-2 gap-2">
          <DocumentActions onPrint={() => window.print()} onDownload={() => window.print()} />
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
      <div className="print:hidden flex items-center justify-end px-4 py-2 gap-2">
        <DocumentActions onPrint={() => window.print()} onDownload={() => window.print()} />
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
        }}
        invoiceNumber={invoiceNumber}
        orgName={org?.name}
        orgLogo={org?.logo_url}
      />
    </div>
  );
}
