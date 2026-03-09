

# Non-Teaching Staff Salary Support

## Current State

The Salary Engine is tightly coupled to the **teacher** role — it queries `user_roles` for `role = 'teacher'`, fetches `student_teacher_assignments` to compute per-student breakdowns, and the `salary_payouts` table uses `teacher_id`. Non-teaching roles (admin, examiner, etc.) have no salary pathway.

Additionally, a person like Kulsoom who holds both `teacher` and `examiner` roles needs a **combined** statement showing teaching salary + role-based flat salary.

## Design Approach

### Key Principle: Reuse existing `salary_payouts` + `salary_adjustments`

Rather than creating a parallel payroll system, we extend the current one:

1. **`salary_payouts.teacher_id`** — keep the column name (renaming would break too much), but treat it as `staff_id` conceptually. Non-teaching staff get payout records here too.

2. **New table: `staff_salaries`** — stores flat monthly salary config per user per role.

### Database Changes

```sql
-- Staff salary configuration (flat monthly amounts per role)
CREATE TABLE public.staff_salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  role text NOT NULL, -- 'admin', 'examiner', etc.
  monthly_amount numeric NOT NULL DEFAULT 0,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date, -- NULL = ongoing
  prorate_partial_months boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role, effective_from)
);

-- RLS: admin/super_admin manage, user can view own
ALTER TABLE public.staff_salaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage staff_salaries" ON public.staff_salaries
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() 
            AND role IN ('super_admin', 'admin', 'admin_fees'))
  );

CREATE POLICY "Users can view own staff_salaries" ON public.staff_salaries
  FOR SELECT USING (user_id = auth.uid());

-- Update salary_payouts status CHECK to include 'partially_paid'
ALTER TABLE public.salary_payouts DROP CONSTRAINT IF EXISTS salary_payouts_status_check;
ALTER TABLE public.salary_payouts ADD CONSTRAINT salary_payouts_status_check 
  CHECK (status IN ('draft', 'confirmed', 'paid', 'locked', 'partially_paid'));
```

### How It Works

**For pure non-teaching staff (e.g., Ayesha — Admin only):**
- Has a `staff_salaries` record: `role='admin'`, `monthly_amount=X`
- No student assignments → no student breakdown rows
- Salary = flat amount, pro-rated by days if partial month (using `effective_from`/`effective_to`)
- Adjustments/deductions still apply via `salary_adjustments`
- Same payment workflow: Draft → Confirmed → Paid → Locked

**For dual-role staff (e.g., Kulsoom — Teacher + Examiner):**
- Appears once in the salary table (not duplicated)
- Teaching salary: computed from student assignments (existing logic)
- Examiner salary: computed from `staff_salaries` record for that role
- Combined into a single `salary_payouts` record
- Sheet shows two sections: "Teaching Breakdown" (students table) + "Role-Based Salary" (flat entries)

### Code Changes

#### A. `src/pages/SalaryEngine.tsx`

1. **Query `staff_salaries`** — new query alongside existing ones
2. **Query ALL salaried users** — not just teachers. Fetch profiles where user has either a teacher role OR a `staff_salaries` record for the selected month
3. **Calculation engine update:**
   - For each salaried user, compute teaching base (from assignments, existing logic) + role-based amounts (from `staff_salaries`, pro-rated)
   - `baseSalary` = teaching student rows total + role salary total
   - Store role salary entries in `calculation_json` for audit
4. **Filter: show "Staff" tab or "All" view** — add a filter toggle: "Teachers" | "Staff" | "All"
5. **Table columns**: For staff-only rows, show "Flat Salary" instead of student count

#### B. `src/components/salary/SalarySheetDialog.tsx`

1. **Add "Role-Based Salary" section** — displayed above or below student breakdown
   - Shows: Role, Monthly Amount, Effective Period, Pro-rated Amount
   - Editable amount (same as student row edit)
2. **For staff-only users**: Hide student breakdown section entirely, show only role salary + adjustments
3. **For dual-role users**: Show both sections with subtotals

#### C. `SalaryStatementTemplate` & Print

- Add role salary rows to the breakdown table (with "Role: Examiner" label instead of student name)
- Ensure print template handles zero-student case gracefully

### State Permission Table (unchanged)

| Status | Save | Mark Paid | Top Up | Lock | Proofs | Revert |
|--------|------|-----------|--------|------|--------|--------|
| Draft/Confirmed | Yes | Yes | No | No | Yes | Yes |
| Partially Paid | No | Yes | Yes | No | Yes | Yes |
| Paid | No | No | No | Yes | Yes | Yes |
| Locked | No | No | No | No | No | Yes |

### Summary

| Change | Purpose |
|--------|---------|
| `staff_salaries` table | Configure flat monthly salary per user per role |
| Extended user query | Include non-teaching salaried staff |
| Pro-ration logic | `(monthly / days_in_month) * active_days` for partial months |
| Combined statements | Dual-role users get one unified payout record |
| Staff filter toggle | Separate views for Teachers / Staff / All |
| Fix CHECK constraint | Add `partially_paid` to allowed statuses |

