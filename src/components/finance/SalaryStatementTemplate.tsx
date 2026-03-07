import React from 'react';
import { format, parseISO } from 'date-fns';
import { AttachmentPreview } from '@/components/shared/FileUploadField';

interface StudentRow {
  studentName: string;
  dateFrom: string;
  dateTo: string;
  payoutRate: number;
  payoutType: string;
  eligibleDays: number;
  totalDays: number;
  calculatedAmount: number;
  editedAmount: number | null;
}

interface Adjustment {
  adjustment_type: string;
  amount: number;
  reason: string | null;
}

interface SalaryStatementTemplateProps {
  teacherName: string;
  teacherId: string;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  bankName?: string | null;
  bankAccountTitle?: string | null;
  bankAccountNumber?: string | null;
  bankIban?: string | null;
  monthLabel: string;
  invoiceNumber: string;
  students: StudentRow[];
  extraClassAmount: number;
  adjustments: Adjustment[];
  baseSalary: number;
  additions: number;
  deductions: number;
  netSalary: number;
  paymentDate?: string | null;
  paymentMethod?: string | null;
  receiptUrl?: string | null;
  orgName?: string;
  orgLogo?: string | null;
}

export function SalaryStatementTemplate({
  teacherName, teacherId, email, phone, location,
  bankName, bankAccountTitle, bankAccountNumber, bankIban,
  monthLabel, invoiceNumber, students, extraClassAmount,
  adjustments, baseSalary, additions, deductions, netSalary,
  paymentDate, paymentMethod, receiptUrl,
  orgName = 'Al-Quran Time Academy', orgLogo
}: SalaryStatementTemplateProps) {
  const adjustmentLabel = (type: string) => {
    switch (type) {
      case 'bonus': return 'Bonus';
      case 'allowance': return 'Allowance';
      case 'deduction': return 'Deduction';
      case 'expense': return 'Expense Reimbursement';
      default: return type;
    }
  };

  return (
    <div className="w-[794px] mx-auto bg-white text-gray-900 print:shadow-none" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="px-12 pt-10 pb-6 border-b-2 border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {orgLogo && <img src={orgLogo} alt="Logo" className="h-14 w-14 object-contain rounded" />}
            <div>
              <h1 className="text-xl font-bold text-gray-900">{orgName}</h1>
              <p className="text-xs text-gray-500 uppercase tracking-widest mt-0.5 font-semibold">Salary Statement</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-gray-900">{monthLabel}</p>
            <p className="text-xs text-gray-500">Ref: {invoiceNumber}</p>
          </div>
        </div>

        {/* Teacher Info */}
        <div className="mt-4 grid grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Teacher</p>
            <p className="text-base font-semibold">{teacherName}</p>
            <p className="text-xs text-gray-500">ID: {teacherId.substring(0, 8).toUpperCase()}</p>
            {email && <p className="text-xs text-gray-500">{email}</p>}
            {phone && <p className="text-xs text-gray-500">{phone}</p>}
            {location && <p className="text-xs text-gray-500">{location}</p>}
          </div>
          {(bankName || bankAccountNumber) && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Bank Details</p>
              {bankAccountTitle && <p className="text-xs"><span className="text-gray-500">Title:</span> {bankAccountTitle}</p>}
              {bankName && <p className="text-xs"><span className="text-gray-500">Bank:</span> {bankName}</p>}
              {bankAccountNumber && <p className="text-xs"><span className="text-gray-500">A/C #:</span> {bankAccountNumber}</p>}
              {bankIban && <p className="text-xs"><span className="text-gray-500">IBAN:</span> {bankIban}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Student Breakdown Table */}
      <div className="px-12 py-6">
        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-3">Breakdown</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Student</th>
              <th className="text-left py-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Period</th>
              <th className="text-right py-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Rate (PKR)</th>
              <th className="text-right py-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Calculated</th>
              <th className="text-right py-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Final</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, idx) => {
              const finalAmt = s.editedAmount ?? s.calculatedAmount;
              return (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-2.5">
                    <p className="font-medium">{s.studentName}</p>
                    <p className="text-[10px] text-gray-400 capitalize">{s.payoutType} • {s.eligibleDays}/{s.totalDays} days</p>
                  </td>
                  <td className="py-2.5 text-gray-600">{format(parseISO(s.dateFrom), 'dd MMM')} – {format(parseISO(s.dateTo), 'dd MMM')}</td>
                  <td className="py-2.5 text-right font-mono">{s.payoutRate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="py-2.5 text-right font-mono text-gray-500">{s.calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="py-2.5 text-right font-mono font-semibold">{finalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Adjustments */}
      {(extraClassAmount > 0 || adjustments.length > 0) && (
        <div className="px-12 pb-6">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-3">Adjustments & Extras</p>
          <div className="space-y-1">
            {extraClassAmount > 0 && (
              <div className="flex justify-between text-sm py-1.5 px-3 bg-emerald-50 rounded">
                <span>Extra Classes</span>
                <span className="font-mono font-semibold text-emerald-700">+PKR {extraClassAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            {adjustments.map((adj, idx) => (
              <div key={idx} className={`flex justify-between text-sm py-1.5 px-3 rounded ${adj.adjustment_type === 'deduction' ? 'bg-red-50' : 'bg-emerald-50'}`}>
                <div>
                  <span>{adjustmentLabel(adj.adjustment_type)}</span>
                  {adj.reason && <span className="text-xs text-gray-500 ml-2">({adj.reason})</span>}
                </div>
                <span className={`font-mono font-semibold ${adj.adjustment_type === 'deduction' ? 'text-red-700' : 'text-emerald-700'}`}>
                  {adj.adjustment_type === 'deduction' ? '-' : '+'}PKR {Number(adj.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="px-12 pb-6">
        <div className="bg-gray-50 rounded-lg p-5 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Base Salary</span>
            <span className="font-mono">PKR {baseSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          {additions > 0 && (
            <div className="flex justify-between text-sm text-emerald-700">
              <span>Additions</span>
              <span className="font-mono">+PKR {additions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {deductions > 0 && (
            <div className="flex justify-between text-sm text-red-700">
              <span>Deductions</span>
              <span className="font-mono">-PKR {deductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2 mt-2">
            <span>Net Salary</span>
            <span className="font-mono">PKR {netSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Payment & Proof */}
      {(paymentDate || paymentMethod || receiptUrl) && (
        <div className="px-12 pb-6">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Payment Details</p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {paymentDate && (
              <div><span className="text-gray-500">Date:</span> <span className="font-medium">{paymentDate}</span></div>
            )}
            {paymentMethod && (
              <div><span className="text-gray-500">Method:</span> <span className="font-medium">{paymentMethod}</span></div>
            )}
          </div>
          {receiptUrl && (
            <div className="mt-3 border border-gray-200 rounded-lg p-2 inline-block">
              {/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(receiptUrl) ? (
                <img src={receiptUrl} alt="Payment proof" className="max-h-32 rounded" />
              ) : (
                <AttachmentPreview url={receiptUrl} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Signatures */}
      <div className="px-12 pb-6">
        <div className="grid grid-cols-2 gap-12 mt-4">
          <div className="border-t border-gray-300 pt-2">
            <p className="text-xs text-gray-400">Prepared By</p>
          </div>
          <div className="border-t border-gray-300 pt-2">
            <p className="text-xs text-gray-400">Received By</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-12 py-4 border-t border-gray-200 text-center">
        <p className="text-[10px] text-gray-400">This is a system-generated salary statement.</p>
        <p className="text-[10px] text-gray-400">{orgName} • Generated on {format(new Date(), 'dd MMM yyyy')}</p>
      </div>
    </div>
  );
}
