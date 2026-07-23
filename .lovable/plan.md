
# Fix the three sisters' finance (Dua, Areej, Ayesha Khan)

## Target state

| Period | Fee per sister | Total fee | Payout per assignment | Total payout |
|---|---|---|---|---|
| Jan – Feb 2026 | 2,333 PKR | 7,000 | 1,666.67 PKR | 5,000 |
| Mar – Jun 2026 | 3,000 PKR | 9,000 | 1,666.67 PKR | 5,000 |
| Jul 2026 onward | 3,000 PKR | 9,000 | **2,000 PKR** | **6,000** |

Currency stays PKR. Teacher stays the same (`82237100-…`). No academic records touched.

---

## Step 1 — Ayesha's duplicate invoices (root cause of "arrears")

Ayesha has **3 duplicate invoices per month** for Jan, Feb, Mar, Apr, May 2026. Real payments got smeared across duplicates so each one shows as partially paid → phantom arrears.

For each affected month, keep **one** invoice per sister and drop the extras:

- **Jan 2026 (Ayesha)** — keep 1 invoice at 2,333, mark paid (7,000 total paid across duplicates already). Delete the other 2 duplicates + their payment_transactions after re-pointing them to the kept invoice.
- **Feb 2026 (Ayesha)** — same treatment, kept invoice at 2,333, paid.
- **Mar / Apr 2026 (Ayesha)** — keep 1 invoice at 3,000, mark paid. Delete 2 duplicates each month, re-point transactions.
- **May 2026 (Ayesha)** — keep 1 invoice at 3,000, mark paid (one duplicate already paid, two are pending zeros → just delete the two unpaid duplicates).

Result: Ayesha's account matches Dua & Areej — one invoice per month, all Jan–Jun paid in full.

## Step 2 — Rewrite Jan–Feb fee to 2,333 per sister

Dua and Areej's Jan-Feb invoices are currently 2,500 each (paid 2,500). Update them to 2,333, keep `amount_paid` intact, and record a 167 PKR **credit adjustment** on each so ledger balances (available toward July).

Ayesha's Jan-Feb kept invoice from Step 1 goes in at 2,333 (paid 2,333); the extra 667 PKR she paid each month (2,333 vs 3,000 previously billed) also becomes a credit adjustment.

_Alternative if you prefer no credit adjustments:_ leave Jan-Feb Dua/Areej at 2,500 as historical and set only Ayesha to 2,333 — say the word and I'll take that path instead.

## Step 3 — Backdate Ayesha's assignment to align with sisters

Ayesha's `student_teacher_assignments.effective_from_date` is currently **01-Apr-2026** while Dua/Areej are **01-Jan-2026**. Since teacher was paid 1,666.67 for Ayesha from Jan (part of the 5,000 total), backdate Ayesha's assignment `effective_from_date` to **01-Jan-2026** so historical payroll math ties out.

## Step 4 — Raise all three payouts to 2,000 from July

Update `student_teacher_assignments.payout_amount` from **1,666.60 → 2,000** on all three assignments, effective **01-Jul-2026** (`effective_from_date` stays Jan; we use the existing salary revision flow so history stays at 1,666.67 and Jul onward is 2,000). If your payroll model requires a new row per rate change, I'll close the current rows on 30-Jun and insert three fresh ones from 01-Jul instead — flag which model you use.

## Step 5 — Regenerate July→ invoices via auto-generator

Trigger `auto_generate_plan_invoices` for all three billing plans. Existing Jul-Oct pending invoices are already 3,000 PKR ✓ so no change expected; the run just confirms nothing stale remains.

## Step 6 — Verification query

Run a single readback showing per-sister per-month: invoice amount, amount_paid, status, plus per-assignment monthly payout, and confirm:
- 3 sisters × (Jan-Feb 2,333) + (Mar-Jun 3,000) all marked paid
- Jul-Oct 3,000 each, pending
- Payouts 1,666.67 for Jan-Jun, 2,000 for Jul+

Screenshot / paste of the readback returned to you.

---

## Technical details

- All writes go through the `supabase--insert` tool for data (UPDATE / DELETE on `fee_invoices`, `payment_transactions`, `invoice_adjustments`, `student_teacher_assignments`) since these are data-only changes on existing tables — no schema migration.
- `trg_sync_invoice_from_transactions` will auto-recompute `amount_paid` / `status` on affected invoices after we re-point transactions.
- `trg_recompute_plans_on_assignment_change` will fire when we backdate Ayesha's assignment; we'll disable regeneration for closed months by relying on the "paid invoices never modified" rule already in `auto_generate_plan_invoices`.
- Nothing touches academic tables (attendance, schedules, enrollments).

Reply **go** to run it, or tell me to switch Step 2 to the "keep 2,500" alternative and I'll adjust.
