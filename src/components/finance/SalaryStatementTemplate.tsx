import React from 'react';
import { format, parseISO } from 'date-fns';
import logoDark from '@/assets/logo-dark.jpg';

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

interface RoleSalaryPrintRow {
  role: string;
  monthlyAmount: number;
  effectiveFrom: string;
  effectiveTo: string;
  activeDays: number;
  totalDays: number;
  proratedAmount: number;
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
  roleSalaries?: RoleSalaryPrintRow[];
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
  monthLabel, invoiceNumber, students, roleSalaries = [], extraClassAmount,
  adjustments, baseSalary, additions, deductions, netSalary,
  paymentDate, paymentMethod, receiptUrl,
  orgName = 'Al-Quran Time Academy', orgLogo
}: SalaryStatementTemplateProps) {
  const logoSrc = orgLogo || logoDark;

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
    <div style={{ width: 794, margin: '0 auto', background: '#fff', color: '#111827', fontFamily: "'Inter', 'Segoe UI', sans-serif", position: 'relative', overflow: 'hidden' }}>
      {/* Decorative top accent */}
      <div style={{ height: 6, background: 'linear-gradient(90deg, #0a192f 0%, #00a8e8 50%, #0a192f 100%)' }} />

      {/* Header */}
      <div style={{ padding: '28px 48px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img src={logoSrc} alt="Logo" style={{ height: 56, width: 56, objectFit: 'contain', borderRadius: 8 }} />
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0a192f', margin: 0, letterSpacing: '-0.02em' }}>{orgName}</h1>
            <p style={{ fontSize: 10, color: '#00a8e8', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, margin: '4px 0 0' }}>Salary Statement</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#0a192f', margin: 0 }}>{monthLabel}</p>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>Ref: {invoiceNumber}</p>
        </div>
      </div>

      {/* Divider */}
      <div style={{ margin: '0 48px', height: 1, background: 'linear-gradient(90deg, #e5e7eb, #d1d5db, #e5e7eb)' }} />

      {/* Teacher Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, padding: '20px 48px' }}>
        <div>
          <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#9ca3af', fontWeight: 700, marginBottom: 6 }}>Teacher</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#0a192f', margin: 0 }}>{teacherName}</p>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>ID: {teacherId.substring(0, 8).toUpperCase()}</p>
          {email && <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{email}</p>}
          {phone && <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{phone}</p>}
          {location && <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{location}</p>}
        </div>
        {(bankName || bankAccountNumber) && (
          <div>
            <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#9ca3af', fontWeight: 700, marginBottom: 6 }}>Bank Details</p>
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, border: '1px solid #e2e8f0' }}>
              {bankAccountTitle && <p style={{ fontSize: 12, margin: '0 0 3px' }}><span style={{ color: '#6b7280' }}>Title:</span> <strong>{bankAccountTitle}</strong></p>}
              {bankName && <p style={{ fontSize: 12, margin: '0 0 3px' }}><span style={{ color: '#6b7280' }}>Bank:</span> {bankName}</p>}
              {bankAccountNumber && <p style={{ fontSize: 12, margin: '0 0 3px' }}><span style={{ color: '#6b7280' }}>A/C #:</span> <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{bankAccountNumber}</strong></p>}
              {bankIban && <p style={{ fontSize: 12, margin: 0 }}><span style={{ color: '#6b7280' }}>IBAN:</span> <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{bankIban}</span></p>}
            </div>
          </div>
        )}
      </div>

      {/* Student Breakdown Table */}
      <div style={{ padding: '8px 48px 20px' }}>
        <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#9ca3af', fontWeight: 700, marginBottom: 10 }}>Breakdown</p>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #0a192f' }}>
              <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6b7280', fontWeight: 700 }}>Student</th>
              <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6b7280', fontWeight: 700 }}>Period</th>
              <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6b7280', fontWeight: 700 }}>Rate (PKR)</th>
              <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6b7280', fontWeight: 700 }}>Calculated</th>
              <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6b7280', fontWeight: 700 }}>Final</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, idx) => {
              const finalAmt = s.editedAmount ?? s.calculatedAmount;
              return (
                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 0' }}>
                    <p style={{ fontWeight: 600, margin: 0 }}>{s.studentName}</p>
                    <p style={{ fontSize: 10, color: '#9ca3af', margin: '1px 0 0', textTransform: 'capitalize' }}>{s.payoutType} • {s.eligibleDays}/{s.totalDays} days</p>
                  </td>
                  <td style={{ padding: '10px 0', color: '#6b7280' }}>
                    {format(parseISO(s.dateFrom), 'dd MMM')} – {format(parseISO(s.dateTo), 'dd MMM')}
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                    {s.payoutRate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: '#6b7280' }}>
                    {s.calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                    {finalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
            {/* Role-based salary rows */}
            {roleSalaries.map((rs, idx) => {
              const finalAmt = rs.editedAmount ?? rs.proratedAmount;
              return (
                <tr key={`role-${idx}`} style={{ borderBottom: '1px solid #f3f4f6', background: '#faf5ff' }}>
                  <td style={{ padding: '10px 0' }}>
                    <p style={{ fontWeight: 600, margin: 0 }}>Role: {rs.role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</p>
                    <p style={{ fontSize: 10, color: '#9ca3af', margin: '1px 0 0' }}>Flat • {rs.activeDays}/{rs.totalDays} days</p>
                  </td>
                  <td style={{ padding: '10px 0', color: '#6b7280' }}>
                    {format(parseISO(rs.effectiveFrom), 'dd MMM')} – {format(parseISO(rs.effectiveTo), 'dd MMM')}
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                    {rs.monthlyAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: '#6b7280' }}>
                    {rs.proratedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                    {finalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Adjustments */}
      {(extraClassAmount > 0 || adjustments.length > 0) && (
        <div style={{ padding: '0 48px 20px' }}>
          <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#9ca3af', fontWeight: 700, marginBottom: 8 }}>Adjustments & Extras</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {extraClassAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 14px', background: '#f0fdf4', borderRadius: 8 }}>
                <span>Extra Classes</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#166534' }}>+PKR {extraClassAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            {adjustments.map((adj, idx) => (
              <div key={idx} style={{
                display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 14px', borderRadius: 8,
                background: adj.adjustment_type === 'deduction' ? '#fef2f2' : '#f0fdf4'
              }}>
                <div>
                  <span>{adjustmentLabel(adj.adjustment_type)}</span>
                  {adj.reason && <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>({adj.reason})</span>}
                </div>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                  color: adj.adjustment_type === 'deduction' ? '#991b1b' : '#166534'
                }}>
                  {adj.adjustment_type === 'deduction' ? '-' : '+'}PKR {Number(adj.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div style={{ padding: '0 48px 24px' }}>
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
            <span style={{ color: '#6b7280' }}>Base Salary</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>PKR {baseSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          {additions > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#059669' }}>
              <span>Additions</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>+PKR {additions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {deductions > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#dc2626' }}>
              <span>Deductions</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>-PKR {deductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div style={{ borderTop: '2px solid #0a192f', paddingTop: 12, marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 800 }}>
            <span>Net Salary</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#0a192f' }}>PKR {netSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Payment & Proof */}
      {(paymentDate || paymentMethod || receiptUrl) && (
        <div style={{ padding: '0 48px 20px' }}>
          <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#9ca3af', fontWeight: 700, marginBottom: 8 }}>Payment Details</p>
          <div style={{ display: 'flex', gap: 32, fontSize: 13 }}>
            {paymentDate && (
              <div><span style={{ color: '#6b7280' }}>Date:</span> <strong>{paymentDate}</strong></div>
            )}
            {paymentMethod && (
              <div><span style={{ color: '#6b7280' }}>Method:</span> <strong>{paymentMethod}</strong></div>
            )}
          </div>
          {receiptUrl && /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(receiptUrl) && (
            <div style={{ marginTop: 10, border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, display: 'inline-block' }}>
              <img src={receiptUrl} alt="Payment proof" style={{ maxHeight: 120, borderRadius: 4 }} />
            </div>
          )}
        </div>
      )}

      {/* Signatures */}
      <div style={{ padding: '0 48px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, marginTop: 16 }}>
          <div style={{ borderTop: '1px solid #d1d5db', paddingTop: 8 }}>
            <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>Prepared By</p>
          </div>
          <div style={{ borderTop: '1px solid #d1d5db', paddingTop: 8 }}>
            <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>Received By</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '14px 48px', borderTop: '1px solid #e5e7eb', textAlign: 'center', background: '#fafbfc' }}>
        <p style={{ fontSize: 9, color: '#9ca3af', margin: 0 }}>This is a system-generated salary statement.</p>
        <p style={{ fontSize: 9, color: '#9ca3af', margin: '2px 0 0' }}>{orgName} • Generated on {format(new Date(), 'dd MMM yyyy')}</p>
      </div>

      {/* Decorative bottom accent */}
      <div style={{ height: 4, background: 'linear-gradient(90deg, #0a192f 0%, #00a8e8 50%, #0a192f 100%)' }} />
    </div>
  );
}
