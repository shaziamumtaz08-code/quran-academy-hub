

# Fix: Salary Partial Payment — Separate Dialog + Date Tracking

## Problem
1. The "Partially Paid" button currently just expands inline fields instead of opening a proper dialog
2. Partial payments do NOT store a `paid_at` date (only full payments do — line 561 of SalaryEngine.tsx)
3. The salary statement template has no way to show partial payment dates

## Changes

### 1. Store partial payment date in `salary_payouts` (SalaryEngine.tsx)
- In the `markPaid` mutation (line 554-568), when `type === 'partial'`, set `paid_at` to the current timestamp regardless of whether it reaches full payment. Currently `paid_at` is only set when `finalStatus === 'paid'`.
- In the `topUpPayment` mutation (line 604-611), also always update `paid_at` to capture the latest payment activity date.

### 2. Convert inline partial payment fields to a Dialog (SalarySheetDialog.tsx)
- Replace the `showPartialInput` inline expansion (lines 672-707) with a separate `Dialog` component
- The dialog will contain:
  - Amount field (PKR) with balance preview
  - Payment date picker (defaults to today, editable)
  - Notes/reason textarea
  - File upload for receipt/proof
  - Confirm button
- The "Partially Paid" button (line 667) will open this dialog instead of toggling inline content

### 3. Pass payment date through the chain
- Update `onMarkPaid` prop signature to accept an optional `paymentDate` parameter
- Pass the selected date from the dialog through to the SalaryEngine mutation
- Store it in `paid_at` on the `salary_payouts` record

### 4. Reflect partial payment date on salary statement
- In `PrintSalary.tsx` (line 100): currently `paymentDate` is derived from `payout.paid_at` — this will now be populated for partial payments too, so the statement will automatically show the date
- The existing `SalaryStatementTemplate` already renders `paymentDate` when present (line 287), so no template changes needed

### Files Modified
| File | Change |
|---|---|
| `src/pages/SalaryEngine.tsx` | Set `paid_at` for partial payments; accept `paymentDate` param |
| `src/components/salary/SalarySheetDialog.tsx` | Replace inline partial fields with a Dialog; add date picker; pass date to parent |

No database changes needed — `paid_at` column already exists on `salary_payouts`.

