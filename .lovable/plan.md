

## Problem Analysis

There are two related issues:

1. **Realised Amount field shows for PKR invoices**: When the invoice currency is already PKR, the "Realised (PKR)" column in the table and the "Realised (PKR)" input in both the Record Payment and Edit Invoice dialogs are meaningless — there's no foreign exchange happening. For PKR invoices, `amount_foreign` and `amount_local` should be identical.

2. **Overpayment / Underpayment tracking**: Students sometimes pay more or less than the invoice amount. The system needs to show a **Balance** column that reflects credit (overpayment) or outstanding (underpayment), and the invoice/receipt templates should reflect this.

## Plan

### 1. Conditionally hide "Realised (PKR)" when currency is PKR

**Invoice Table** (lines ~1328, 1352-1356 in `Payments.tsx`):
- Hide the "Realised (PKR)" column header and cell when all visible invoices are PKR, OR show it conditionally per-row (dash for PKR rows).
- Simpler approach: always show the column but for PKR invoices display "—" (already happens if amount_local equals amount_foreign and we skip it). Better: hide column entirely if all invoices in view are PKR.

**Record Payment Modal** (line ~1820):
- When `bulkCurrency === 'PKR'`, hide the "Realized (PKR)" input and the exchange rate indicator. Auto-set `amount_local = amount_foreign` silently in the mutation.

**Edit Invoice Modal** (line ~1992):
- When `editInvoiceData.currency === 'PKR'`, hide the "Realized (PKR)" input and exchange rate row. Auto-set `amount_local = amount_foreign` in the save logic.

### 2. Add Balance column to show overpayment/underpayment

**Invoice Table**:
- Add a "Balance" column after "Paid" that shows: `invoice.amount - ledgerPaid - forgiven`. Positive = outstanding, negative = credit/overpayment.
- Color: red for outstanding, green for credit.

**InvoiceTemplate** (`src/components/finance/InvoiceTemplate.tsx`):
- Already shows "Balance Due" — enhance to show "Credit" label when balance is negative (overpayment).

**ReceiptTemplate** (`src/components/finance/ReceiptTemplate.tsx`):
- Add a balance/credit line in the summary section.

### 3. Auto-set amount_local for PKR payments in mutation logic

In `bulkPayMutation` (line ~831): already has `inv.currency === 'PKR' ? allocated : ...` — this is correct. Ensure the same logic applies in edit payment save.

### Files to modify:
- `src/pages/Payments.tsx` — hide realised field for PKR, add balance column
- `src/components/finance/InvoiceTemplate.tsx` — show credit for overpayment
- `src/components/finance/ReceiptTemplate.tsx` — conditionally hide realised for PKR, show balance

