import { OrgPaymentAccount, ACCOUNT_TYPE_LABELS, PaymentAccountType } from './types';

interface Props {
  accounts: Array<Partial<OrgPaymentAccount>>;
  studentAccountSnapshot?: any;
}

const WALLET_TYPES: PaymentAccountType[] = ['easypaisa', 'jazzcash', 'sadapay', 'nayapay'];

const NAVY = '#0a192f';
const MONO = "'JetBrains Mono', ui-monospace, monospace";

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '3px 0' }}>
      <span style={{ fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, width: 62, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: 11, color: '#1e293b', fontWeight: mono ? 700 : 600, fontFamily: mono ? MONO : undefined, letterSpacing: mono ? '0.02em' : undefined }}>
        {value}
      </span>
    </div>
  );
}

/**
 * Payment Instructions block appended to the invoice.
 * Bank accounts get a detailed card; mobile wallets are shown as compact tiles.
 */
export function InvoicePaymentInstructions({ accounts, studentAccountSnapshot }: Props) {
  const active = (accounts || []).filter(a => a.is_active !== false);
  if (active.length === 0 && !studentAccountSnapshot) return null;

  const wallets = active.filter(a => WALLET_TYPES.includes(a.account_type as PaymentAccountType));
  const banks = active.filter(a => !WALLET_TYPES.includes(a.account_type as PaymentAccountType));

  return (
    <div style={{ padding: '0 48px 28px' }}>
      {/* Section heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.18em', color: NAVY, fontWeight: 800 }}>
          How to Pay
        </span>
        <span style={{ flex: 1, height: 1, background: 'linear-gradient(to right, #cbd5e1, transparent)' }} />
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        {/* Bank accounts */}
        {banks.map((a, i) => (
          <div
            key={`b-${i}`}
            style={{
              display: 'flex',
              gap: 16,
              padding: '14px 16px',
              borderTop: i === 0 ? 'none' : '1px solid #eef2f7',
              background: '#fff',
            }}
          >
            <div style={{ width: 3, borderRadius: 3, background: NAVY, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11.5, fontWeight: 800, color: NAVY, margin: '0 0 6px', letterSpacing: '0.01em' }}>
                {a.bank_name || a.display_label || ACCOUNT_TYPE_LABELS[a.account_type as PaymentAccountType]}
                {a.currency ? (
                  <span style={{ marginLeft: 8, fontSize: 8.5, fontWeight: 700, color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 999, padding: '1px 7px', letterSpacing: '0.1em' }}>
                    {a.currency}
                  </span>
                ) : null}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 20 }}>
                <div>
                  {a.account_title && <Row label="Title" value={a.account_title} />}
                  {a.account_number && <Row label="Account" value={a.account_number} mono />}
                  {a.bank_branch && <Row label="Branch" value={a.bank_branch} />}
                </div>
                <div>
                  {a.iban && <Row label="IBAN" value={a.iban} mono />}
                  {a.bank_swift && <Row label="SWIFT" value={a.bank_swift} mono />}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Mobile wallets */}
        {wallets.length > 0 && (
          <div style={{ background: '#f8fafc', borderTop: banks.length ? '1px solid #eef2f7' : 'none', padding: '12px 16px' }}>
            <p style={{ fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#94a3b8', fontWeight: 700, margin: '0 0 8px' }}>
              Mobile Wallets
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: wallets.length > 1 ? '1fr 1fr' : '1fr', gap: 10 }}>
              {wallets.map((a, i) => (
                <div key={`w-${i}`} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 9, padding: '9px 12px' }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: NAVY, margin: 0, letterSpacing: '0.02em' }}>
                    {a.display_label || ACCOUNT_TYPE_LABELS[a.account_type as PaymentAccountType]}
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: MONO, margin: '3px 0 1px', letterSpacing: '0.03em' }}>
                    {a.account_number || a.iban || '—'}
                  </p>
                  <p style={{ fontSize: 9.5, color: '#64748b', margin: 0 }}>{a.account_title}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reference note */}
      <p style={{ fontSize: 9, color: '#94a3b8', margin: '8px 2px 0', lineHeight: 1.5 }}>
        Please quote the invoice number as the payment reference and share the transfer receipt with the academy office.
      </p>

      {studentAccountSnapshot && (
        <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 9 }}>
          <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 3, background: '#f59e0b' }} />
          <div>
            <p style={{ fontSize: 8.5, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>
              Student Account — refunds only
            </p>
            <p style={{ fontSize: 10.5, color: '#78350f', margin: '3px 0 0', fontWeight: 600 }}>
              {studentAccountSnapshot.account_title}
              {studentAccountSnapshot.account_number ? ` · ${studentAccountSnapshot.account_number}` : ''}
              {studentAccountSnapshot.bank_name ? ` · ${studentAccountSnapshot.bank_name}` : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
