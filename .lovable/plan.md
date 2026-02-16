

## Align Assignment Bulk Import with Export and Enable Partial Updates

### Problem
The assignment import template only has 4 fields (`student_name, teacher_name, subject_name, guardian_email`) while the export has 8 fields including `Payout Amount`, `Payout Type`, `Effective From`, and `Status`. The edge functions also don't process these fields during validation or execution, making it impossible to bulk-update teacher pay rates.

### What Changes

**1. Expand the CSV template to match all importable fields**

New template format:
```
student_name,teacher_name,subject_name,status,payout_amount,payout_type,effective_from,guardian_email
Fatima Ali,Mohammad Hassan,Hifz,active,2500,monthly,2026-01-01,parent@example.com
```

- `status` -- optional, defaults to "active" for new rows
- `payout_amount` -- optional numeric field
- `payout_type` -- optional, "monthly" or "per_class"
- `effective_from` -- optional date (YYYY-MM-DD or D-Mon-YY format)
- `guardian_email` -- stays optional, reference only

**2. Update the validation edge function to handle new fields**

In `bulk-validate-import/index.ts`, the `validateAssignmentRow` function will:
- Parse and validate `payout_amount` as a number (using locale-aware parsing)
- Validate `payout_type` against allowed values ("monthly", "per_class")
- Parse `effective_from` date in multiple formats (YYYY-MM-DD, D-Mon-YY, M/D/YYYY)
- Validate `status` against allowed values ("active", "paused", "completed", "left")
- Include these fields in the diff comparison for existing assignments (so updating just payout shows as an "update" row, not "no changes")

**3. Update the execute edge function to write new fields**

In `bulk-import-execute/index.ts`, the assignment section will:
- Include `payout_amount`, `payout_type`, `effective_from_date`, and `status` in both INSERT (new) and UPDATE (existing) operations
- Only update fields that are actually provided (non-empty) so admins can upload a CSV with just `student_name, teacher_name, payout_amount` to update pay rates without touching other fields

**4. Update the client-side template generator**

In `useImportLogic.ts`, update the `generateTemplate("assignments")` output to include the new columns with example data.

### Partial Update Workflow

The key user need: "I only want to update teacher pay and effective date for existing records."

This is handled by the upsert logic already in place -- when a row matches an existing assignment (by teacher+student), it becomes an "update" row. The new fields will be included in the diff preview. Admins can:
1. Export current assignments (already works)
2. Edit only `payout_amount` and `effective_from` columns in the CSV
3. Re-import -- the system detects all rows as "update" and shows diffs for changed fields only
4. Confirm import -- only changed fields are written

### Technical Details

**Files to modify:**

1. **`src/hooks/useImportLogic.ts`** -- Update `generateTemplate("assignments")` to include `status, payout_amount, payout_type, effective_from, guardian_email`

2. **`supabase/functions/bulk-validate-import/index.ts`** -- In `validateAssignmentRow`:
   - Add parsing for `payout_amount` (numeric), `payout_type` (enum), `effective_from` (date), `status` (enum)
   - Fetch existing assignments with `payout_amount, payout_type, effective_from_date, status` for diff comparison
   - Include these fields in diff output

3. **`supabase/functions/bulk-import-execute/index.ts`** -- In the assignments section:
   - Add `payout_amount`, `payout_type`, `effective_from_date`, `status` to both insert and update payloads
   - Only include fields that have non-null values to support partial updates

**Date parsing helper** (added to validate function):
```typescript
function parseFlexibleDate(value: string): string | null {
  // Supports: 2026-01-01, 1/1/2026, 1-Jan-26
  // Returns ISO date string or null
}
```

**Numeric parsing** (for payout_amount):
```typescript
function parseNumericValue(value: string): number | null {
  // Handles commas, currency symbols, locale formats
}
```

