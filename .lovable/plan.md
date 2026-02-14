

## Payment Entry Enhancements: Date Range, Payment Method & Family Bulk Payments

### Overview
Three upgrades to the "Record Payment" modal:
1. **Payment Period (Date Range)** -- Add "From" and "To" date fields so admins can record payments for partial periods (a few days) or multi-month lump sums.
2. **Payment Date** -- Add a date picker defaulting to today for when the money was actually received.
3. **Family Bulk Payment** -- Add a "Pay for Family" button on the invoice table that auto-selects all pending invoices for siblings (via `student_parent_links`), allowing one receipt upload to cover all children.

---

### 1. Payment Period Dates

**New fields in the payment modal:**
- **Period From**: Date picker, defaults to 1st of the invoice's billing month.
- **Period To**: Date picker, defaults to last day of the billing month.
- **Payment Date**: Date picker, defaults to today.

These are editable -- if a family pays for 3 months at once, the admin sets "Period From" to the start month and "Period To" to the end of the last month. For partial-month payments, they narrow the range to specific days.

### 2. Database Schema Changes

Add three columns to `payment_transactions`:
- `payment_date` (DATE, defaults to current date)
- `period_from` (DATE, nullable)
- `period_to` (DATE, nullable)

Also add `payment_method` (TEXT, nullable) to `payment_transactions` since it currently only exists on `fee_invoices`.

### 3. Payment Method Dropdown

Add a "Payment Method" dropdown to the modal with options:
- Bank Transfer
- Western Union
- Remitly
- Cash
- Other

This value gets stored in `payment_transactions.payment_method`.

### 4. Family Bulk Payment

**How it works:**
- Query `student_parent_links` to identify siblings (students sharing the same parent).
- In the invoice table toolbar, add a **"Pay Family"** button (or dropdown) that lets the admin pick a parent/family.
- Selecting a family auto-checks all pending invoices for that family's children.
- The existing bulk payment modal opens with all those invoices, single receipt upload covers all.

**Implementation approach:**
- Fetch `student_parent_links` data alongside invoices.
- Group students by `parent_id` to identify families.
- Add a "Family" filter/action near the existing bulk Record Payment button.
- When a family is selected, set `selectedIds` to all unpaid invoices for that family's students.

### 5. UI Layout of Updated Modal

```text
Record Payment
-------------------------------------------------
[Invoice list summary - existing]

Payment Period
[From: _01/02/2026_]  [To: _28/02/2026_]

Payment Details
[Payment Date: _14/02/2026_]  [Method: Bank Transfer v]
[Amount Received (GBP): ___]  [Realized (PKR): ___]

[Effective Rate display - existing]
[Shortfall section - existing]

[Proof of Payment upload - existing]
[Notes - existing]

[Cancel]  [Confirm Payment]
```

---

### Technical Details

**Files Modified:**
- `src/pages/Payments.tsx` -- Add date pickers, payment method dropdown, family grouping logic, and updated payForm state.

**Migration (new):**
- Add `payment_date`, `period_from`, `period_to`, and `payment_method` columns to `payment_transactions`.

**Updated `payForm` state:**
```typescript
const [payForm, setPayForm] = useState({
  amount_foreign: '',
  amount_local: '',
  resolution: 'full',
  notes: '',
  payment_date: new Date().toISOString().split('T')[0],
  period_from: '',   // auto-set from invoice billing_month
  period_to: '',     // auto-set from invoice billing_month
  payment_method: '',
});
```

**Family query:**
```typescript
const { data: parentLinks } = useQuery({
  queryKey: ['parent-links'],
  queryFn: async () => {
    const { data } = await supabase.from('student_parent_links').select('*');
    return data || [];
  },
});
```

**Family grouping logic:**
- Group `parentLinks` by `parent_id` to get families.
- Match against invoice `student_id` values to find all unpaid invoices per family.
- "Pay Family" action selects all matching invoices and opens the modal.

