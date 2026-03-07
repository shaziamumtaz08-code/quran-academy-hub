import React from 'react';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface InvoiceTemplateProps {
  invoice: {
    id: string;
    student_name: string;
    student_id: string;
    billing_month: string;
    amount: number;
    currency: string;
    due_date: string | null;
    status: string;
    amount_paid: number;
    forgiven_amount: number;
    remark: string | null;
    subjects?: string[];
    teacher_name?: string;
    period_from?: string | null;
    period_to?: string | null;
  };
  invoiceNumber: string;
  orgName?: string;
  orgLogo?: string | null;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const formatBillingMonth = (bm: string) => {
  const [y, m] = bm.split('-');
  return `${MONTHS[parseInt(m, 10) - 1] || m} ${y}`;
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'paid': return { label: 'PAID', color: 'bg-emerald-100 text-emerald-800' };
    case 'partially_paid': return { label: 'PARTIAL', color: 'bg-amber-100 text-amber-800' };
    case 'overdue': return { label: 'OVERDUE', color: 'bg-red-100 text-red-800' };
    case 'waived': return { label: 'WAIVED', color: 'bg-gray-100 text-gray-600' };
    case 'voided': return { label: 'VOIDED', color: 'bg-red-50 text-red-600' };
    default: return { label: 'PENDING', color: 'bg-amber-50 text-amber-700' };
  }
};

export function InvoiceTemplate({ invoice, invoiceNumber, orgName = 'Al-Quran Time Academy', orgLogo }: InvoiceTemplateProps) {
  const status = getStatusLabel(invoice.status);
  const outstanding = Math.max(0, invoice.amount - invoice.amount_paid - invoice.forgiven_amount);

  return (
    <div className="w-[794px] mx-auto bg-white text-gray-900 print:shadow-none" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="flex items-start justify-between px-12 pt-10 pb-6 border-b-2 border-gray-200">
        <div className="flex items-center gap-4">
          {orgLogo && <img src={orgLogo} alt="Logo" className="h-14 w-14 object-contain rounded" />}
          <div>
            <h1 className="text-xl font-bold text-gray-900">{orgName}</h1>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-0.5">Student Invoice</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{invoiceNumber}</p>
          <span className={`inline-block mt-1 px-3 py-0.5 text-xs font-bold rounded-full ${status.color}`}>{status.label}</span>
        </div>
      </div>

      {/* Student & Invoice Details */}
      <div className="grid grid-cols-2 gap-8 px-12 py-6">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Bill To</p>
          <p className="text-base font-semibold">{invoice.student_name}</p>
          <p className="text-xs text-gray-500">Student ID: {invoice.student_id.substring(0, 8).toUpperCase()}</p>
          {invoice.teacher_name && <p className="text-xs text-gray-500 mt-0.5">Teacher: {invoice.teacher_name}</p>}
          {invoice.subjects && invoice.subjects.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">Subject(s): {invoice.subjects.join(', ')}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Invoice Details</p>
          <p className="text-sm"><span className="text-gray-500">Billing Period:</span> {formatBillingMonth(invoice.billing_month)}</p>
          {invoice.period_from && invoice.period_to && (
            <p className="text-xs text-gray-500">{format(parseISO(invoice.period_from), 'dd MMM yyyy')} – {format(parseISO(invoice.period_to), 'dd MMM yyyy')}</p>
          )}
          {invoice.due_date && <p className="text-sm"><span className="text-gray-500">Due Date:</span> {format(parseISO(invoice.due_date), 'dd MMM yyyy')}</p>}
        </div>
      </div>

      {/* Line Items Table */}
      <div className="px-12 pb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Description</th>
              <th className="text-right py-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-3">
                <p className="font-medium">Monthly Tuition Fee — {formatBillingMonth(invoice.billing_month)}</p>
                {invoice.subjects && invoice.subjects.length > 0 && (
                  <p className="text-xs text-gray-400">{invoice.subjects.join(', ')}</p>
                )}
              </td>
              <td className="py-3 text-right font-mono font-semibold">{invoice.currency} {invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="px-12 pb-8">
        <div className="bg-gray-50 rounded-lg p-5 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-mono">{invoice.currency} {invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          {invoice.amount_paid > 0 && (
            <div className="flex justify-between text-sm text-emerald-700">
              <span>Amount Paid</span>
              <span className="font-mono">- {invoice.currency} {invoice.amount_paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {invoice.forgiven_amount > 0 && (
            <div className="flex justify-between text-sm text-gray-500">
              <span>Waived / Forgiven</span>
              <span className="font-mono">- {invoice.currency} {invoice.forgiven_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2 mt-2">
            <span>Balance Due</span>
            <span className="font-mono">{invoice.currency} {outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.remark && (
        <div className="px-12 pb-6">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Notes</p>
          <p className="text-xs text-gray-600">{invoice.remark}</p>
        </div>
      )}

      {/* Footer */}
      <div className="px-12 py-4 border-t border-gray-200 text-center">
        <p className="text-[10px] text-gray-400">This is a system-generated invoice. No signature required.</p>
        <p className="text-[10px] text-gray-400">{orgName} • Generated on {format(new Date(), 'dd MMM yyyy')}</p>
      </div>
    </div>
  );
}
