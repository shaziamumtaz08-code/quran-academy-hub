

# Payment Module Enhancements

## Summary
Four targeted improvements to the Fee Management page to support full receipt viewing, comprehensive editing, voided invoice recovery, realized amount visibility, and streamlined family payments.

---

## 1. View Full Payment Receipt Details (for Paid Invoices)

**Problem:** Clicking on a paid invoice shows no details about the payment transaction (amount received, date, channel, receipt proof, forex details).

**Solution:** Add a "View Receipt" option in the dropdown menu for paid/partially-paid invoices. This opens a read-only dialog showing:
- Student name, billing month, invoice amount
- Payment date, receiving channel, amount received (foreign + local/PKR)
- Effective exchange rate
- Receipt/proof image or PDF (clickable link using the existing `AttachmentPreview` component from `FileUploadField.tsx`)
- Notes

**Technical:** Query `payment_transactions` by `invoice_id` and display all linked transactions in a clean summary card.

---

## 2. Full Edit Capability on Invoices

**Problem:** The "Edit Amount" menu only allows editing amount, due date, and billing month. Users need to edit all invoice fields including currency, remark, status, and amount_paid.

**Solution:** Expand the Edit Invoice dialog to include:
- Amount (existing)
- Currency (new dropdown)
- Due Date (existing)
- Billing Month (existing)
- Remark/Notes (new textarea)
- Status (new dropdown -- all statuses)
- Amount Paid (new number input)

All changes continue to go through the existing audit trail via `createAdjustment()`. The dropdown menu item label changes from "Edit Amount" to "Edit Invoice".

---

## 3. Restore Voided Invoices to Pending

**Problem:** Voided invoices cannot be edited or restored. Users voided invoices due to data entry errors (because insufficient edit fields were available), and now need to bring them back.

**Solution:** For voided invoices, show the action dropdown menu (currently hidden) with two options:
- **Restore to Pending** -- sets status back to `pending`, resets `amount_paid` to 0. Requires a reason (audit-trailed).
- **Edit Invoice** -- same full edit dialog as above.

**Technical:** Remove the `isVoided` guard that hides the dropdown. Add a `restore_to_pending` case to `invoiceActionMutation`. The voided row checkbox remains disabled (cannot be selected for payment).

---

## 4. Realised Amount Column in Invoice Table

**Problem:** The table does not show the PKR-realized amount, which is critical for multi-currency operations.

**Solution:** Add a "Realised (PKR)" column after the "Paid" column. For each invoice, fetch the sum of `amount_local` from `payment_transactions` grouped by `invoice_id`.

**Technical:** Extend the invoice query with a secondary lookup. Since joining `payment_transactions` aggregate from the invoice query is complex, use a separate lightweight query that fetches `invoice_id` + `SUM(amount_local)` for all invoices in the current view. Store in a map keyed by invoice_id for O(1) lookup during render.

---

## 5. Family Payment (Already Exists -- Visibility Fix)

**Problem:** User asks "how to record in one go where a family fee is submitted."

**Current State:** The "Pay Family..." dropdown already exists (line 870) and groups invoices by parent via `student_parent_links`. It auto-selects all pending invoices for that family's children.

**Solution:** No code change needed for the core feature. However, the dropdown only appears when `familyGroups.length > 0` (families with unpaid invoices). If the user is filtering by "Paid" status (as shown in the screenshot), no families with unpaid invoices are visible, so the dropdown hides. This is correct behavior -- switching to "All Status" or "Pending" will reveal the family payment option.

A small UX improvement: add a tooltip or helper text near the filters explaining the "Pay Family" feature availability.

---

## Technical Details

### Files Modified
- **`src/pages/Payments.tsx`** -- All changes are in this single file:
  - New "View Receipt" dialog with transaction details and attachment preview
  - Expanded edit invoice form (currency, remark, status, amount_paid fields)
  - Remove voided-row dropdown guard; add `restore_to_pending` action
  - New `payment_transactions` aggregate query for realized amounts
  - New "Realised" table column

### Database
- No schema changes required. All data already exists in `payment_transactions` and `fee_invoices` tables.

### Audit Trail
- All edits and restorations go through the existing `createAdjustment()` function, maintaining full accountability.

