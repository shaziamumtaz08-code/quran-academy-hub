
# Plan: Synchronize Edit Invoice with Record Payment Form + Multi-Month Payment UX

## Problem Summary

1. **Edit Invoice form is missing fields** that the Record Payment form has: Realized (PKR), exchange rate display, Proof of Payment upload, and shortfall/resolution handling.
2. **Multi-month payments** require clarity: if a student pays 40 AUD covering Dec (10) + Jan (30), can the system auto-split it?

---

## Part 1: Make Edit Invoice Form Identical to Record Payment

The Edit Invoice dialog will be restructured to match Record Payment field-for-field:

| Section | Record Payment | Edit Invoice (Current) | Action |
|---|---|---|---|
| Invoice summary bar | Student name + expected | Missing | **Add** |
| Payment Period (From/To) | Yes | Yes | Keep |
| Payment Date / Paid At | Yes | Yes | Keep (label: "Paid At") |
| Receiving Channel | Yes | Yes | Keep |
| Amount (currency) | Yes | Yes | Keep |
| Realized (PKR) | Yes | **Missing** | **Add** |
| Exchange Rate display | Yes | **Missing** | **Add** |
| Shortfall + Resolution | Yes | **Missing** | **Add** (auto-calculated) |
| Proof of Payment upload | Yes | **Missing** | **Add** |
| Notes / Remark | Yes | Yes | Keep |
| Amount Paid | N/A (auto) | Yes | Keep (admin override) |
| Forgiven Amount | N/A (auto) | Yes | Keep (admin override) |
| Currency | N/A (from invoice) | Yes | Keep |
| Billing Month | N/A (from invoice) | Yes | Keep |
| Status | N/A (auto) | Yes | Keep |
| Due Date | N/A | Yes | Keep |

The Edit Invoice dialog will have the same visual layout and sections as Record Payment, plus the extra admin-only fields (Status, Due Date, Currency, Billing Month, Forgiven Amount) below a separator labeled "Admin Overrides".

---

## Part 2: Multi-Month Payment Strategy

### Current mechanism
- The system is **invoice-based**: each month generates a separate invoice per student.
- The bulk "Record Payment" (cart pattern) already supports selecting multiple invoices and paying them with a single receipt.
- The payment is **allocated sequentially** to each selected invoice (oldest first), with shortfall handling for any remainder.

### The easier solution (recommended)
Rather than building complex date-range-to-invoice auto-splitting, the **existing cart system already solves this**:

1. Admin selects invoices for Dec 2025 and Jan 2026 using checkboxes.
2. Clicks "Record Payment" -- both invoices appear in the summary.
3. Enters 40 AUD total, one receipt screenshot, one receiving channel.
4. System auto-allocates: 10 AUD to Dec (outstanding), 30 AUD to Jan (outstanding).
5. Both invoices update. Single receipt is linked to both transactions.

**No new development needed** for this flow -- it already works. The From/To date range in the payment form captures the coverage period for reference, but the allocation is driven by the invoice amounts, not dates.

### What WILL be improved
- Add a **helper tooltip/info text** on the Record Payment dialog explaining: "Selected invoices are paid in order. Amount is allocated starting from the first invoice."
- Ensure the **Edit Payment** form (on `payment_transactions`) also mirrors the Record Payment layout for consistency.

---

## Technical Changes

### File: `src/pages/Payments.tsx`

1. **Add state for receipt file in edit mode** -- reuse `receiptInputRef` or add a second ref.

2. **Add `amount_local` (Realized PKR) field to `editInvoiceData` state** and persist it. This will require either:
   - Storing realized amount on the invoice itself (new column), OR
   - Looking up from `payment_transactions` and allowing override.
   
   Since `payment_transactions` already tracks `amount_local`, the Edit Invoice form will add a display-only "Realized (PKR)" field that shows the sum from linked transactions, plus an editable override field.

3. **Restructure the Edit Invoice dialog** to follow Record Payment's visual order:
   - Top: Student name + invoice summary bar
   - Billing Month + Status row
   - Payment Period section (From / To)
   - Separator
   - Payment Details section (Paid At + Receiving Channel)
   - Amount row: Amount (currency) + Realized (PKR)
   - Exchange rate auto-calculated display
   - Amount Paid + Forgiven Amount row
   - Currency + Due Date row
   - Proof of Payment upload area
   - Remark / Notes textarea

4. **Receipt upload in edit mode**: Allow uploading a new receipt that updates the latest `payment_transaction.receipt_url` for this invoice.

5. **Add info text** to Record Payment dialog: "Amounts are allocated across selected invoices in order."

### Database
- No new columns needed. The `fee_invoices` table already has `period_from`, `period_to`, `payment_method`, `paid_at`. The realized amount lives in `payment_transactions.amount_local`.

### No changes needed for multi-month payments
- The existing cart/bulk payment system handles this correctly already. The plan is to add UX guidance text only.
