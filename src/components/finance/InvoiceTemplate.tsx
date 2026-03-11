import React from 'react';
import { format, parseISO } from 'date-fns';
import logoDark from '@/assets/logo-dark.jpg';

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
    case 'paid': return { label: 'PAID', bg: '#dcfce7', color: '#166534' };
    case 'partially_paid': return { label: 'PARTIAL', bg: '#fef3c7', color: '#92400e' };
    case 'overdue': return { label: 'OVERDUE', bg: '#fee2e2', color: '#991b1b' };
    case 'waived': return { label: 'WAIVED', bg: '#f3f4f6', color: '#4b5563' };
    case 'voided': return { label: 'VOIDED', bg: '#fef2f2', color: '#dc2626' };
    default: return { label: 'PENDING', bg: '#fff7ed', color: '#9a3412' };
  }
};

export function InvoiceTemplate({ invoice, invoiceNumber, orgName = 'Al-Quran Time Academy', orgLogo }: InvoiceTemplateProps) {
  const status = getStatusLabel(invoice.status);
  const outstanding = invoice.amount - invoice.amount_paid - invoice.forgiven_amount;
  const logoSrc = orgLogo || logoDark;

  return (
    <div style={{ width: 794, margin: '0 auto', background: '#fff', color: '#111827', fontFamily: "'Inter', 'Segoe UI', sans-serif", position: 'relative', overflow: 'hidden' }}>
      {/* Decorative top accent */}
      <div style={{ height: 6, background: 'linear-gradient(90deg, #0a192f 0%, #00a8e8 50%, #0a192f 100%)' }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '32px 48px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img src={logoSrc} alt="Logo" style={{ height: 56, width: 56, objectFit: 'contain', borderRadius: 8 }} />
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0a192f', margin: 0, letterSpacing: '-0.02em' }}>{orgName}</h1>
            <p style={{ fontSize: 10, color: '#00a8e8', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, margin: '4px 0 0' }}>Student Invoice</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: '#0a192f', margin: 0, letterSpacing: '-0.02em' }}>{invoiceNumber}</p>
          <span style={{
            display: 'inline-block', marginTop: 6, padding: '3px 14px',
            fontSize: 11, fontWeight: 700, borderRadius: 20,
            background: status.bg, color: status.color, letterSpacing: '0.05em'
          }}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ margin: '0 48px', height: 1, background: 'linear-gradient(90deg, #e5e7eb, #d1d5db, #e5e7eb)' }} />

      {/* Student & Invoice Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, padding: '24px 48px' }}>
        <div>
          <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#9ca3af', fontWeight: 700, marginBottom: 6 }}>Bill To</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#0a192f', margin: 0 }}>{invoice.student_name}</p>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>Student ID: {invoice.student_id.substring(0, 8).toUpperCase()}</p>
          {invoice.teacher_name && <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>Teacher: {invoice.teacher_name}</p>}
          {invoice.subjects && invoice.subjects.length > 0 && (
            <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>Subject(s): {invoice.subjects.join(', ')}</p>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#9ca3af', fontWeight: 700, marginBottom: 6 }}>Invoice Details</p>
          <p style={{ fontSize: 14, margin: 0 }}><span style={{ color: '#6b7280' }}>Billing Period:</span> <strong>{formatBillingMonth(invoice.billing_month)}</strong></p>
          {invoice.period_from && invoice.period_to && (
            <p style={{ fontSize: 11, color: '#00a8e8', fontWeight: 600, margin: '2px 0 0' }}>
              {format(parseISO(invoice.period_from), 'dd MMM yyyy')} – {format(parseISO(invoice.period_to), 'dd MMM yyyy')}
            </p>
          )}
          {invoice.due_date && <p style={{ fontSize: 13, margin: '4px 0 0' }}><span style={{ color: '#6b7280' }}>Due Date:</span> <strong>{format(parseISO(invoice.due_date), 'dd MMM yyyy')}</strong></p>}
        </div>
      </div>

      {/* Line Items Table */}
      <div style={{ padding: '0 48px 24px' }}>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #0a192f' }}>
              <th style={{ textAlign: 'left', padding: '10px 0', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#6b7280', fontWeight: 700 }}>Description</th>
              <th style={{ textAlign: 'center', padding: '10px 0', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#6b7280', fontWeight: 700 }}>Period</th>
              <th style={{ textAlign: 'right', padding: '10px 0', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#6b7280', fontWeight: 700 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '14px 0' }}>
                <p style={{ fontWeight: 600, margin: 0 }}>Monthly Tuition Fee</p>
                {invoice.subjects && invoice.subjects.length > 0 && (
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>{invoice.subjects.join(', ')}</p>
                )}
              </td>
              <td style={{ padding: '14px 0', textAlign: 'center', fontSize: 12, color: '#6b7280' }}>
                {formatBillingMonth(invoice.billing_month)}
              </td>
              <td style={{ padding: '14px 0', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 14 }}>
                {invoice.currency} {invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div style={{ padding: '0 48px 32px' }}>
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
            <span style={{ color: '#6b7280' }}>Subtotal</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{invoice.currency} {invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          {invoice.amount_paid > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#059669' }}>
              <span>Amount Paid</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>- {invoice.currency} {invoice.amount_paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {invoice.forgiven_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#6b7280' }}>
              <span>Waived / Forgiven</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>- {invoice.currency} {invoice.forgiven_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div style={{ borderTop: '2px solid #0a192f', paddingTop: 12, marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800 }}>
            <span>{outstanding < 0 ? 'Credit' : 'Balance Due'}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: outstanding < 0 ? '#059669' : '#0a192f' }}>
              {outstanding < 0 ? `−${invoice.currency} ${Math.abs(outstanding).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `${invoice.currency} ${outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            </span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.remark && (
        <div style={{ padding: '0 48px 24px' }}>
          <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#9ca3af', fontWeight: 700, marginBottom: 4 }}>Notes</p>
          <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{invoice.remark}</p>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '16px 48px', borderTop: '1px solid #e5e7eb', textAlign: 'center', background: '#fafbfc' }}>
        <p style={{ fontSize: 9, color: '#9ca3af', margin: 0 }}>This is a system-generated invoice. No signature required.</p>
        <p style={{ fontSize: 9, color: '#9ca3af', margin: '2px 0 0' }}>{orgName} • Generated on {format(new Date(), 'dd MMM yyyy')}</p>
      </div>

      {/* Decorative bottom accent */}
      <div style={{ height: 4, background: 'linear-gradient(90deg, #0a192f 0%, #00a8e8 50%, #0a192f 100%)' }} />
    </div>
  );
}
