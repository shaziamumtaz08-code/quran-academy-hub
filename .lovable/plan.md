

## Add Per-Row "Record Payment" Button to Invoice Table

### Problem
The "Record Payment" button only appears after selecting invoices via checkboxes (bulk action pattern). There is no visible, per-row action button, making it unclear how to record a payment for a single invoice.

### Solution
Add an **Actions** column to the invoice table with a per-row "Record Payment" button for unpaid/partially paid invoices. Keep the existing bulk selection flow as well.

### Changes (single file: `src/pages/Payments.tsx`)

1. **Add an "Actions" column** to the invoice table header.

2. **Per-row button**: For each invoice where `status !== 'paid'`, show a small "Record Payment" button (or icon button with a tooltip). Clicking it will:
   - Select only that invoice.
   - Open the existing payment modal pre-filled for that single invoice.

3. **New handler** `openSinglePay(invoiceId)`:
   - Sets `selectedIds` to just that one invoice.
   - Opens the bulk payment modal (reuses the same dialog — no new modal needed).

4. **Paid rows**: Show a checkmark or "Paid" indicator instead of the button.

### Visual Result

| Checkbox | Student | Package | Month | Amount | Paid | Due Date | Status | Actions |
|----------|---------|---------|-------|--------|------|----------|--------|---------|
| [ ] | Ahmad | UK-3 | Feb 2026 | GBP 25 | -- | Feb 28 | Pending | [Record Payment] |
| -- | Sara | USD-5 | Feb 2026 | USD 50 | USD 50 | Feb 28 | Paid | (checkmark) |

The bulk checkbox + floating button workflow remains unchanged for multi-invoice payments.
