

# Salary Engine State Machine Redesign

## Current Issues Identified

1. **Single `receipt_url` column**: Only 1 attachment supported, no multi-part payment proofs
2. **No status for "confirmed/saved"**: Draft → Paid → Locked, but "Save" just creates/updates the record without a distinct status
3. **Once "Paid", no edits allowed**: Can't upload proofs after marking paid
4. **No revert functionality**: Locked/Paid cannot be undone
5. **Save button disabled only for "locked"**: Should also be disabled after "paid" unless specifically editing proofs

## Proposed State Machine

```text
┌─────────┐  Save   ┌───────────┐  Mark Paid  ┌────────┐  Lock   ┌────────┐
│  DRAFT  │ ──────> │ CONFIRMED │ ──────────> │  PAID  │ ──────> │ LOCKED │
└─────────┘         └───────────┘             └────────┘         └────────┘
     ↑                    │                       │                   │
     │                    │ Revert                │ Revert            │ Revert
     └────────────────────┴───────────────────────┴───────────────────┘
              (Admin only, with confirmation + audit log)
```

**Status Definitions:**
- **Draft**: Live calculation, no payout record or status='draft'. Fully editable.
- **Confirmed**: Snapshot saved to `salary_payouts`. Admin can still edit amounts, add proofs.
- **Paid**: Payment marked, `paid_at` set. Admin can upload/update up to 3 proofs, edit invoice number. Calculation locked, only proof metadata editable.
- **Locked**: Final. No changes unless admin clicks "Revert to Draft" (with confirmation).

## Database Changes

### 1. Add `receipt_urls` array column (up to 3 attachments)
```sql
ALTER TABLE salary_payouts 
ADD COLUMN receipt_urls text[] DEFAULT '{}';
-- Migrate existing single receipt_url to array
UPDATE salary_payouts SET receipt_urls = ARRAY[receipt_url] WHERE receipt_url IS NOT NULL;
```

### 2. Add `reverted_at`, `reverted_by`, `revert_reason` for audit trail
```sql
ALTER TABLE salary_payouts 
ADD COLUMN reverted_at timestamptz,
ADD COLUMN reverted_by uuid,
ADD COLUMN revert_reason text;
```

## Code Changes

### A. `src/pages/SalaryEngine.tsx`

1. **Add `revertToDraft` mutation**: Resets status to 'draft', clears paid_at/locked_at, sets reverted_at/reverted_by/revert_reason
2. **Add Revert button**: Visible on `paid` or `locked` rows with confirmation dialog
3. **Block Save for 'paid'**: `disabled={status === 'locked' || status === 'paid'}` — calculation edits blocked
4. **Allow proof update after Paid**: Add "Update Proofs" button for `paid` status

### B. `src/components/salary/SalarySheetDialog.tsx`

1. **Multi-attachment support**: Replace single `FileUploadField` with array of 3 upload slots
2. **Show all attachments in "Paid" state**: Display up to 3 proof previews
3. **Allow proof editing when `paid` (not locked)**: Proofs-only section remains editable
4. **Revert button in sheet**: With AlertDialog confirmation requiring reason input

### C. State-Based UI Logic

| Status | Save | Mark Paid | Lock | Upload Proofs | Revert |
|--------|------|-----------|------|---------------|--------|
| Draft | ✓ | ✓ | ✗ | ✓ | ✗ |
| Confirmed | ✓ | ✓ | ✗ | ✓ | ✓ (to Draft) |
| Paid | ✗ | ✗ | ✓ | ✓ | ✓ (to Draft) |
| Locked | ✗ | ✗ | ✗ | ✗ | ✓ (to Draft) |

### D. Revert Confirmation Dialog
- Requires selecting a reason: "Incorrect amount", "Wrong month", "Duplicate entry", "Other"
- If "Other", mandatory text input
- Logged to `system_logs` table via `trackActivity()`

## Migration Plan

```sql
-- Add new columns
ALTER TABLE salary_payouts 
ADD COLUMN IF NOT EXISTS receipt_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS reverted_at timestamptz,
ADD COLUMN IF NOT EXISTS reverted_by uuid,
ADD COLUMN IF NOT EXISTS revert_reason text;

-- Migrate existing receipt_url to receipt_urls array
UPDATE salary_payouts 
SET receipt_urls = ARRAY[receipt_url] 
WHERE receipt_url IS NOT NULL AND (receipt_urls IS NULL OR receipt_urls = '{}');
```

## Summary

| Change | Purpose |
|--------|---------|
| `receipt_urls` array | Support up to 3 proof attachments for partial payments |
| Revert functionality | Allow admin to undo paid/locked mistakes |
| Proof editing for Paid | Upload screenshots after marking paid |
| Audit trail columns | Track who reverted and why |
| Status-based button logic | Clear UX for what actions are available at each state |

