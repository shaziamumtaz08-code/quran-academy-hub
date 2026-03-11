

## Analysis of Payment System Bugs

After investigating the database and code, here is what is happening with Muhammad Subhan's January 2026 invoice:

**Invoice state**: amount=225, amount_paid=288.1, status=paid

**Transactions on this invoice** (4 total):
1. 38.1 AED (duplicate entry)
2. 38.1 AED (duplicate entry)
3. -38.1 AED (correction attempt)
4. 250 AED (the actual payment — but user intended 225)

Sum = 38.1 + 38.1 + (-38.1) + 250 = **288.1** — this is why the "Paid" column shows 288.1.

---

### Root Causes Identified

**Bug 1: Record Payment adds to `amount_paid` instead of recalculating from transactions**
Line 763: `amount_paid: Number(inv.amount_paid || 0) + allocated`. Each new payment adds to the running total. If there are corrections or duplicate transactions, the total drifts. The "Edit Payment" flow correctly recalculates from the transaction sum (lines 2260-2272), but the initial "Record Payment" does not.

**Bug 2: "Pay" button pre-fills with outstanding amount, which was 250 (the old fee) when the user clicked it**
The user updated the fee from 250 to 225 AFTER the invoice was already generated at 250. When they clicked "Pay", line 977 pre-filled `due = inv.amount - inv.amount_paid = 250 - 0 = 250`. The transaction was recorded at 250, not the intended 225.

**Bug 3: Edit Invoice exchange rate uses wrong field**
Line 1782: `editAmountForeign = parseFloat(editInvoiceData.amount_paid)` — uses `amount_paid` (288.1) for the rate denominator instead of the invoice `amount` (225). Result: 13916 / 288.1 = 48.30 PKR instead of the correct rate.

**Bug 4: Invoice regeneration skips non-pending invoices**
Line 601: `checkAndQueueUpdate` only processes invoices with status `pending`. When the user updated the fee to 225 and regenerated, the paid invoice at 250 was skipped. Error "already generated" is thrown because all invoices exist.

**Bug 5: Realised PKR column sums ALL transactions including duplicates/corrections**
The `realisedMap` query (lines 304-318) sums all `amount_local` values without filtering, resulting in inflated PKR totals (18288 + 18249.9 + 18432.5 + 13916 = 68,886).

---

### Plan

#### Fix 1: Recalculate `amount_paid` from transaction sum after recording payment
In `bulkPayMutation` (after inserting transactions), query all transactions for each affected invoice and set `amount_paid` = sum of `amount_foreign`. This matches the pattern already used in "Edit Payment" (lines 2260-2272).

#### Fix 2: Fix Edit Invoice exchange rate calculation
Change line 1782 from:
```
const editAmountForeign = parseFloat(editInvoiceData.amount_paid) || 0;
```
to:
```
const editAmountForeign = parseFloat(editInvoiceData.amount) || 0;
```
The rate should be based on the invoice amount, not the cumulative paid amount.

#### Fix 3: Allow invoice regeneration to update paid invoices' amounts
Modify `checkAndQueueUpdate` to also update invoices in `paid` or `partially_paid` status when the fee amount has changed. Add a flag to only update the `amount` field (not reset payment status). This way, when a billing plan fee changes and invoices are regenerated, the invoice amount reflects the corrected fee while preserving payment records.

#### Fix 4: Net the Realised PKR calculation
Update the `realisedMap` query to properly handle negative transaction amounts (corrections) so the PKR total reflects the true net realised amount. The current sum is mathematically correct (it nets negatives), but duplicate entries still inflate it. The real fix is #1 above — preventing bad `amount_paid` values from accumulating.

#### Fix 5: Add a "Recalculate from Transactions" safeguard
Add a utility function that, when viewing/editing an invoice, recalculates `amount_paid` from the sum of all linked transactions. This serves as a self-healing mechanism for existing corrupted data. Run this recalculation when opening the Edit Invoice dialog.

### Files to modify
- `src/pages/Payments.tsx` — all five fixes in one file

