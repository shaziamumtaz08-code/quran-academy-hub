import { OrgPaymentAccount, ACCOUNT_TYPE_LABELS, PaymentAccountType } from './types';

interface Props {
  accounts: Array<Partial<OrgPaymentAccount>>;
  studentAccountSnapshot?: any;
}

const WALLET_TYPES: PaymentAccountType[] = ['easypaisa', 'jazzcash', 'sadapay', 'nayapay'];

const NAVY = '#0a192f';
const MONO = "'JetBrains Mono', ui-monospace, monospace";

function BankIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4 8 4v14" />
      <path d="M9 21v-6h6v6" />
      <path d="M10 9h4" />
      <path d="M10 13h4" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" />
      <path d="M16 12h.01" />
      <path d="M18 12h.01" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function AccountNumber({ value, label }: { value: string; label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
      <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: '#0f172a', letterSpacing: '0.04em' }}>
        {value}
      </span>
      <button
        type="button"
        aria-label={`Copy ${label || 'account number'}`}
        className="print:hidden"
        onClick={() => navigator.clipboard.writeText(value.replace(/\s/g, ''))}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          borderRadius: 6,
          border: '1px solid #e2e8f0',
          background: '#fff',
          color: '#64748b',
          cursor: 'pointer',
        }}
      >
        <CopyIcon />
      </button>
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
  const currency = active[0]?.currency || 'PKR';

  return (
    <div style={{ padding: '28px 48px 32px', background: '#f4f7fb', borderTop: '1px solid #e2e8f0' }}>
      {/* Section heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: '#fff', border: '1px solid #e2e8f0' }}>
          <BankIcon />
        </div>
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: NAVY, fontWeight: 800 }}>
          Payment Methods — {currency}
        </span>
        <span style={{ flex: 1, height: 1, background: 'linear-gradient(to right, #cbd5e1, transparent)' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Bank accounts */}
        {banks.map((a, i) => (
          <div
            key={`b-${i}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              padding: '16px 18px',
              borderRadius: 12,
              background: '#fff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: '#f1f5f9', flexShrink: 0 }}>
              <BankIcon />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <p style={{ fontSize: 12.5, fontWeight: 800, color: NAVY, margin: 0, letterSpacing: '0.01em' }}>
                  {a.bank_name || a.display_label || ACCOUNT_TYPE_LABELS[a.account_type as PaymentAccountType]}
                </p>
                {a.currency ? (
                  <span style={{ fontSize: 8.5, fontWeight: 700, color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 999, padding: '2px 8px', letterSpacing: '0.1em' }}>
                    {a.currency}
                  </span>
                ) : null}
              </div>
              <div style={{ marginTop: 6 }}>
                {a.account_title && (
                  <p style={{ fontSize: 10.5, color: '#64748b', margin: '0 0 4px', fontWeight: 600 }}>
                    {a.account_title}
                    {a.bank_branch ? ` · ${a.bank_branch}` : ''}
                  </p>
                )}
                {a.account_number && <AccountNumber value={a.account_number} label="account number" />}
                {a.iban && (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 8.5, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase' }}>IBAN</span>
                    <AccountNumber value={a.iban} label="IBAN" />
                  </div>
                )}
                {a.bank_swift && (
                  <p style={{ fontSize: 10, color: '#64748b', margin: '6px 0 0', fontFamily: MONO, letterSpacing: '0.02em' }}>
                    SWIFT: {a.bank_swift}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Mobile wallets */}
        {wallets.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: wallets.length > 1 ? 'repeat(2, 1fr)' : '1fr',
              gap: 12,
            }}
          >
            {wallets.map((a, i) => (
              <div
                key={`w-${i}`}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: '14px 16px',
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <WalletIcon />
                  <p style={{ fontSize: 11, fontWeight: 800, color: NAVY, margin: 0, letterSpacing: '0.01em' }}>
                    {a.display_label || ACCOUNT_TYPE_LABELS[a.account_type as PaymentAccountType]}
                  </p>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: MONO, margin: '0 0 3px', letterSpacing: '0.03em' }}>
                  {a.account_number || a.iban || '—'}
                </p>
                <p style={{ fontSize: 10, color: '#64748b', margin: 0, fontWeight: 600 }}>{a.account_title}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reference note */}
      <p style={{ fontSize: 9.5, color: '#64748b', margin: '16px 2px 0', lineHeight: 1.5, fontWeight: 500 }}>
        Please quote the invoice number as the payment reference and share the transfer receipt with the academy office.
      </p>

      {studentAccountSnapshot && (
        <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10 }}>
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
