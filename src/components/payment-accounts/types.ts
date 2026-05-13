export type PaymentAccountType =
  | 'bank_local'
  | 'bank_international'
  | 'easypaisa'
  | 'jazzcash'
  | 'sadapay'
  | 'nayapay'
  | 'wise'
  | 'payoneer'
  | 'crypto'
  | 'other';

export type PaymentAccountPurpose = 'inward' | 'outward' | 'both';

export interface ProfilePaymentAccount {
  id: string;
  profile_id: string;
  account_type: PaymentAccountType;
  account_title: string;
  account_number: string | null;
  iban: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_swift: string | null;
  currency: string;
  is_primary: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgPaymentAccount {
  id: string;
  org_id: string | null;
  branch_id: string | null;
  account_type: PaymentAccountType;
  purpose: PaymentAccountPurpose;
  account_title: string;
  account_number: string | null;
  iban: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_swift: string | null;
  currency: string;
  display_label: string;
  sort_order: number;
  is_active: boolean;
  notes: string | null;
}

export const ACCOUNT_TYPE_LABELS: Record<PaymentAccountType, string> = {
  bank_local: 'Bank (Local)',
  bank_international: 'Bank (International)',
  easypaisa: 'EasyPaisa',
  jazzcash: 'JazzCash',
  sadapay: 'SadaPay',
  nayapay: 'NayaPay',
  wise: 'Wise',
  payoneer: 'Payoneer',
  crypto: 'Crypto Wallet',
  other: 'Other',
};

export const ACCOUNT_TYPE_GROUPS: Record<PaymentAccountType, 'bank_pkr' | 'bank_fcy' | 'wallet' | 'international' | 'other'> = {
  bank_local: 'bank_pkr',
  bank_international: 'bank_fcy',
  easypaisa: 'wallet',
  jazzcash: 'wallet',
  sadapay: 'wallet',
  nayapay: 'wallet',
  wise: 'international',
  payoneer: 'international',
  crypto: 'other',
  other: 'other',
};

export function maskAccountNumber(num: string | null | undefined): string {
  if (!num) return '—';
  const s = num.replace(/\s/g, '');
  if (s.length <= 6) return s;
  return `${s.slice(0, 3)}${'•'.repeat(Math.max(4, s.length - 6))}${s.slice(-3)}`;
}
