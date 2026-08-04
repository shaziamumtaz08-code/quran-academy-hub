import { InvoiceTemplate } from '@/components/finance/InvoiceTemplate';

export default function InvoicePreview() {
  return (
    <InvoiceTemplate
      invoice={{
        id: 'preview-id',
        student_name: 'Aairah Sample',
        student_id: '00000000-0000-0000-0000-000000000000',
        billing_month: '2026-04',
        amount: 12000,
        currency: 'PKR',
        due_date: '2026-04-10',
        status: 'pending',
        amount_paid: 0,
        forgiven_amount: 0,
        remark: null,
      }}
      invoiceNumber="INV-202604-AAA"
      orgName="Al-Quran Time Academy"
      paymentAccounts={[
        {
          account_type: 'easypaisa' as any,
          display_label: 'Easypaisa',
          account_title: 'Shazia Mumtaz',
          account_number: '0300 8245111',
          currency: 'PKR',
          is_active: true,
        },
        {
          account_type: 'jazzcash' as any,
          display_label: 'JazzCash',
          account_title: 'Shazia Mumtaz',
          account_number: '0300 8245111',
          currency: 'PKR',
          is_active: true,
        },
        {
          account_type: 'bank_local' as any,
          bank_name: 'Meezan Bank Ltd.',
          display_label: 'Meezan Bank',
          account_title: 'Shazia Mumtaz',
          account_number: '9923 0102 664443',
          iban: 'PK34MEZN0099230102664443',
          bank_branch: 'Shahrah-e-Quaideen Branch, Karachi',
          currency: 'PKR',
          is_active: true,
        },
      ]}
    />
  );
}
