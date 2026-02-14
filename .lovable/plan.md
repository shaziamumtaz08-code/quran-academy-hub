
## Add "Edit Payment" Feature to Invoice Management

Allow admins to correct wrong payment entries directly instead of reversing and re-entering. Every edit is fully audit-trailed.

### How It Works

1. A new **"Edit Payment"** option appears in the Manage dropdown for invoices with status `paid` or `partially_paid`
2. Clicking it opens a modal pre-filled with the existing payment transaction data
3. Admin corrects the fields (amount, date, channel, notes) and provides a mandatory **reason**
4. The system updates the `payment_transactions` record AND recalculates the invoice's `amount_paid` and `status`
5. An adjustment record is logged with old vs new values

### What the Admin Can Edit

- Amount received (foreign)
- Amount received (local / PKR)
- Payment date
- Payment method/channel
- Notes
- Mandatory correction reason (for audit trail)

### Workflow

```text
Manage (...) -> Edit Payment
   |
   v
Modal: Pre-filled with current payment data
   |
   v
Admin corrects fields + enters reason
   |
   v
System:
  1. Logs adjustment (old values -> new values + reason)
  2. Updates payment_transactions row
  3. Recalculates invoice amount_paid & status
  4. Refreshes table
```

### Technical Details

**File:** `src/pages/Payments.tsx`

**State changes:**
- Add `editPaymentData` state to hold the selected payment transaction for editing
- Add a modal triggered by the new dropdown item

**New dropdown item (inside Manage column, lines ~960-963):**
- Add "Edit Payment" menu item visible when invoice status is `paid` or `partially_paid`
- On click: fetch the payment transaction(s) for that invoice from `payment_transactions`, populate the edit modal

**Edit Payment Modal:**
- Fields: Amount Foreign, Amount Local, Payment Date, Payment Method, Notes
- Mandatory "Reason for correction" textarea
- Save button triggers:
  1. `createAdjustment()` with action_type `edit_payment`, logging previous and new payment values
  2. Update the `payment_transactions` row with new values
  3. Recalculate invoice `amount_paid` (sum of all transactions for that invoice) and update status accordingly

**Invoice recalculation logic after edit:**
- Query all `payment_transactions` for the invoice
- Sum `amount_foreign` to get new `amount_paid`
- If `amount_paid >= invoice.amount` -> status = `paid`
- If `amount_paid > 0 but < amount` -> status = `partially_paid`
- If `amount_paid == 0` -> status = `pending`
- Update `fee_invoices` with recalculated values

**No database schema changes needed.** The `payment_transactions` table already supports updates, and `invoice_adjustments` already handles audit logging.
