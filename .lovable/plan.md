

# Salary Engine: Balance Column + Partial Payment Status Fix

## Problem
1. The "Net" column always shows the full net salary even after partial payment — it should show the **remaining balance**
2. After a partial payment, the status shows "Paid" if the partial amount equals or exceeds net — but partially paid records should keep behaving like draft (Save button enabled, no Lock button) until fully paid
3. Column name "Net" is misleading when balance differs from net

## Changes

### File: `src/pages/SalaryEngine.tsx`

**1. Rename "Net" column to "Balance"**
- Change `TableHead` from "Net" to "Balance" (line 946)

**2. Show balance instead of net salary in the table**
- Line 984: Instead of always showing `teacher.netSalary`, check if there's a payout with `amount_paid > 0`. If so, show `netSalary - amount_paid` as the balance. If no partial payment, show full net.
- Add a small secondary line showing the original net when balance differs (e.g., `Net: PKR 5,725.80`)

**3. Fix `canSave` logic for partially_paid**
- Line 958: Remove `'partially_paid'` from the disabled condition — partially paid records should still allow Save (same as draft behavior)
- Only `'locked'` and `'paid'` (fully paid) should disable Save

**4. Hide Lock button for partially_paid**
- Line 1001: The Lock button currently only shows for `'paid'` — this is already correct, no change needed

**5. Fix the `markPaid` partial status logic**
- Line 557: The `finalStatus` check `paidAmount >= netSalary` is using the freshly provided `amountPaid` directly, not cumulative. For partial payments, this should always set `'partially_paid'` unless the amount truly covers the full net. This logic looks correct already but needs to ensure cumulative top-ups work properly.

### Summary
| Line | Change |
|---|---|
| 946 | Rename "Net" → "Balance" |
| 958 | Allow Save for `partially_paid` (remove from disabled list) |
| 984 | Show remaining balance (net − amount_paid) when partially paid; show original net as subtitle |

