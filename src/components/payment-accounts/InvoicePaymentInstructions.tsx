import { OrgPaymentAccount, ACCOUNT_TYPE_LABELS, PaymentAccountType } from './types';

interface Props {
  accounts: Array<Partial<OrgPaymentAccount>>;
  studentAccountSnapshot?: any;
}

/**
 * Renders the "Payment Instructions" section appended to the invoice template.
 * Designed to render inline within the existing InvoiceTemplate styling system.
 */
export function InvoicePaymentInstructions({ accounts, studentAccountSnapshot }: Props) {
  const active = (accounts || []).filter(a => a.is_active !== false);
  if (active.length === 0 && !studentAccountSnapshot) return null;

  // group by currency
  const byCurrency = active.reduce<Record<string, Array<Partial<OrgPaymentAccount>>>>((acc, a) => {
    const c = a.currency || 'PKR';
    (acc[c] ||= []).push(a);
    return acc;
  }, {});

  return (
    <div style={{ padding: '0 48px 24px' }}>
      <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#9ca3af', fontWeight: 700, marginBottom: 8 }}>
        Payment Instructions
      </p>
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
        {Object.entries(byCurrency).map(([currency, list]) => (
          <div key={currency} style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#0a192f', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              {currency} payments
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: list.length > 1 ? '1fr 1fr' : '1fr', gap: 10 }}>
              {list.map((a, i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#0a192f', margin: 0 }}>{a.display_label || ACCOUNT_TYPE_LABELS[a.account_type as PaymentAccountType]}</p>
                  <table style={{ width: '100%', fontSize: 11, marginTop: 4 }}>
                    <tbody>
                      <tr><td style={{ color: '#6b7280', paddingRight: 8 }}>Title</td><td style={{ fontWeight: 600 }}>{a.account_title}</td></tr>
                      {a.bank_name && <tr><td style={{ color: '#6b7280' }}>Bank</td><td>{a.bank_name}{a.bank_branch ? ` (${a.bank_branch})` : ''}</td></tr>}
                      {a.account_number && <tr><td style={{ color: '#6b7280' }}>Account</td><td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{a.account_number}</td></tr>}
                      {a.iban && <tr><td style={{ color: '#6b7280' }}>IBAN</td><td style={{ fontFamily: "'JetBrains Mono', monospace" }}>{a.iban}</td></tr>}
                      {a.bank_swift && <tr><td style={{ color: '#6b7280' }}>SWIFT</td><td style={{ fontFamily: "'JetBrains Mono', monospace" }}>{a.bank_swift}</td></tr>}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {studentAccountSnapshot && (
        <div style={{ marginTop: 10, padding: 10, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
            Student Account (for refund use only)
          </p>
          <p style={{ fontSize: 11, color: '#78350f', margin: '4px 0 0' }}>
            {studentAccountSnapshot.account_title}
            {studentAccountSnapshot.account_number ? ` · ${studentAccountSnapshot.account_number}` : ''}
            {studentAccountSnapshot.bank_name ? ` · ${studentAccountSnapshot.bank_name}` : ''}
          </p>
        </div>
      )}
    </div>
  );
}
