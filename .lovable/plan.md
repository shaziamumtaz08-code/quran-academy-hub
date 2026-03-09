

# Implementation Plan: Partial Payment Support for Salary Engine

## Database Migration
Add two columns to `salary_payouts`:
```sql
ALTER TABLE salary_payouts 
ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS partial_notes text;
```

## Code Changes

### 1. `src/pages/SalaryEngine.tsx`

**Update `markPaid` mutation (lines 425-452):**
- Accept `amountPaid` parameter
- For `type: 'partial'`: set `status: 'partially_paid'`, `amount_paid: amountPaid`, `partial_notes: reason`
- For `type: 'full'`: set `status: 'paid'`, `amount_paid: net_salary`
- Auto-promote to `paid` if `amountPaid >= net_salary`

**Add `topUpPayment` mutation:**
- Fetches current `amount_paid`, adds new amount
- If total >= `net_salary`, auto-promote to `paid`
- Stores cumulative `amount_paid`

**Update `getStatusBadge` (line 577):**
- Add `partially_paid` → amber badge showing "Partial" with balance info

**Update `SalarySheetDialog` props (lines 789-823):**
- Pass `existingAmountPaid`, `onTopUp`, `isPartiallyPaid` props

**Update table action buttons (lines 740-770):**
- Show "Mark Fully Paid" button for `partially_paid` status
- Allow Lock only from `paid` (not `partially_paid`)

### 2. `src/components/salary/SalarySheetDialog.tsx`

**Update interface (line 99):**
- Add `amountPaid` to `onMarkPaid` signature: `onMarkPaid: (type, reason?, invoiceNumber?, receiptUrls?, amountPaid?) => void`
- Add `onTopUp?: (amount: number, notes: string, receiptUrls: string[]) => void`
- Add `existingAmountPaid?: number`, `isPartiallyPaid?: boolean`

**Replace partial payment section (lines 757-778):**
Current: Only asks for reason text.
New: Show amount input + auto-calculated balance + notes + confirm button.

```text
┌─────────────────────────────────────────┐
│ Amount Paying:  [________] PKR          │
│ Balance Remaining: PKR 7,000.00         │
│ Notes: [________________________]       │
│ [Confirm Partial Payment]               │
└─────────────────────────────────────────┘
```

**Add "Partially Paid" state UI (after line 656):**
When `status === 'partially_paid'`:
- Show amber "Partially Paid" indicator with amount paid / net salary
- Balance remaining display
- "Top Up Payment" button → opens amount input for additional payment
- "Mark Fully Paid" button → sets remaining balance as paid
- Proofs editable (same as paid state)
- Revert available

**Update `canEditProofs` (line 239):**
```typescript
const canEditProofs = (isPaid || isPartiallyPaid) && !isLocked && !isTeacherView;
```

### 3. Status Permission Summary

| Status | Save | Mark Paid | Top Up | Lock | Proofs | Revert |
|--------|------|-----------|--------|------|--------|--------|
| Draft/Confirmed | Yes | Yes | No | No | Yes | Yes |
| Partially Paid | No | Yes (fully) | Yes | No | Yes | Yes |
| Paid | No | No | No | Yes | Yes | Yes |
| Locked | No | No | No | No | No | Yes |

