import React from 'react';
import { format, parseISO } from 'date-fns';
import { AttachmentPreview } from '@/components/shared/FileUploadField';

interface Transaction {
  id: string;
  amount_foreign: number;
  amount_local: number;
  currency_foreign: string;
  currency_local: string;
  effective_rate: number | null;
  payment_date: string | null;
  payment_method: string | null;
  receipt_url: string | null;
  notes: string | null;
  resolution_type: string;
  period_from: string | null;
  period_to: string | null;
}

interface ReceiptTemplateProps {
  receiptNumber: string;
  studentName: string;
  invoiceRef: string;
  invoiceAmount: number;
  invoiceCurrency: string;
  billingMonth: string;
  transactions: Transaction[];
  orgName?: string;
  orgLogo?: string | null;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const formatBillingMonth = (bm: string) => {
  const [y, m] = bm.split('-');
  return `${MONTHS[parseInt(m, 10) - 1] || m} ${y}`;
};

export function ReceiptTemplate({
  receiptNumber, studentName, invoiceRef, invoiceAmount, invoiceCurrency,
  billingMonth, transactions, orgName = 'Al-Quran Time Academy', orgLogo
}: ReceiptTemplateProps) {
  const totalPaid = transactions.reduce((s, t) => s + t.amount_foreign, 0);

  return (
    <div className="w-[794px] mx-auto bg-white text-gray-900 print:shadow-none" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="flex items-start justify-between px-12 pt-10 pb-6 border-b-2 border-emerald-200">
        <div className="flex items-center gap-4">
          {orgLogo && <img src={orgLogo} alt="Logo" className="h-14 w-14 object-contain rounded" />}
          <div>
            <h1 className="text-xl font-bold text-gray-900">{orgName}</h1>
            <p className="text-xs text-emerald-600 uppercase tracking-widest mt-0.5 font-semibold">Payment Receipt</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{receiptNumber}</p>
          <span className="inline-block mt-1 px-3 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">RECEIVED</span>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-8 px-12 py-6">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Received From</p>
          <p className="text-base font-semibold">{studentName}</p>
          <p className="text-xs text-gray-500 mt-0.5">Invoice Ref: {invoiceRef}</p>
          <p className="text-xs text-gray-500">Billing Period: {formatBillingMonth(billingMonth)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Invoice Amount</p>
          <p className="text-lg font-bold font-mono">{invoiceCurrency} {invoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Transaction Details */}
      {(() => {
        const isPKR = invoiceCurrency === 'PKR' || transactions.every(tx => tx.currency_foreign === 'PKR');
        return (
          <div className="px-12 pb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Date</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Channel</th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Amount</th>
                  {!isPKR && <th className="text-right py-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Realised (PKR)</th>}
                  {!isPKR && <th className="text-right py-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Rate</th>}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, idx) => (
                  <tr key={tx.id || idx} className="border-b border-gray-100">
                    <td className="py-3">{tx.payment_date ? format(parseISO(tx.payment_date), 'dd MMM yyyy') : '—'}</td>
                    <td className="py-3">{tx.payment_method || '—'}</td>
                    <td className="py-3 text-right font-mono font-semibold">{tx.currency_foreign} {tx.amount_foreign.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    {!isPKR && <td className="py-3 text-right font-mono">{tx.amount_local > 0 ? `PKR ${tx.amount_local.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}</td>}
                    {!isPKR && <td className="py-3 text-right font-mono text-gray-500">{tx.effective_rate ? `${Number(tx.effective_rate).toFixed(2)}` : '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Total */}
      <div className="px-12 pb-6">
        <div className="bg-emerald-50 rounded-lg p-5">
          <div className="flex justify-between text-base font-bold">
            <span>Total Received</span>
            <span className="font-mono">{transactions[0]?.currency_foreign || invoiceCurrency} {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Proof Attachments */}
      {transactions.some(tx => tx.receipt_url) && (
        <div className="px-12 pb-6">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Proof of Payment</p>
          <div className="flex flex-wrap gap-3">
            {transactions.filter(tx => tx.receipt_url).map((tx, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-2">
                {/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(tx.receipt_url!) ? (
                  <img src={tx.receipt_url!} alt="Receipt proof" className="max-h-32 rounded" />
                ) : (
                  <AttachmentPreview url={tx.receipt_url} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {transactions.some(tx => tx.notes) && (
        <div className="px-12 pb-6">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Notes</p>
          {transactions.filter(tx => tx.notes).map((tx, idx) => (
            <p key={idx} className="text-xs text-gray-600">{tx.notes}</p>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="px-12 py-4 border-t border-gray-200 text-center">
        <p className="text-[10px] text-gray-400">This is a system-generated receipt. No signature required.</p>
        <p className="text-[10px] text-gray-400">{orgName} • Generated on {format(new Date(), 'dd MMM yyyy')}</p>
      </div>
    </div>
  );
}
