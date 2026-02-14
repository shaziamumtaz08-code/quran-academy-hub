

## Add Student Billing Plans List with Edit/Delete + Activity Logging

### Problem
Currently, once a student billing plan is created via "Set Up Student Fee," there is no way to view, edit, or delete it. The admin must blindly manage fee setups without seeing what already exists.

### Changes

**1. File: `src/pages/Payments.tsx` -- Add "Student Billing Plans" Tab/Section**

Add a new section (or a third tab) between the summary cards and the invoice table that shows all existing `student_billing_plans` as a table with:

- Columns: Student Name, Package Name, Session Duration, Net Fee, Currency, Discount, Status (Active/Inactive), Created Date, Actions
- **Edit button**: Opens the fee builder modal pre-populated with the plan's current values (student pre-selected and locked, package, duration, discounts filled in). On save, updates the existing row instead of inserting a new one.
- **Delete button**: Confirmation dialog, then deletes the billing plan. Also deletes any linked `pending` invoices for that plan.
- **Toggle Active/Inactive**: Quick switch to deactivate a plan without deleting it.
- Search/filter by student name.

**2. File: `src/pages/Payments.tsx` -- Edit Billing Plan Mutation**

- New `editPlanMutation` that updates an existing `student_billing_plans` row by ID with the recalculated values (package, duration, surcharge, discounts, net fee).
- When editing, the student selector is disabled (locked to the existing student).
- The modal title changes to "Edit Billing Plan" when in edit mode.

**3. File: `src/pages/Payments.tsx` -- Delete Billing Plan Mutation**

- New `deletePlanMutation` that:
  1. Deletes any `pending` fee_invoices linked to the plan (`plan_id`).
  2. Deletes the `student_billing_plans` row.
  3. Logs the activity.

**4. File: `src/pages/Payments.tsx` -- Invoice Edit and Delete**

- Add Edit and Delete buttons to the invoice table Actions column (for pending invoices only).
- **Edit**: Opens a small modal to adjust amount, due date, or billing month.
- **Delete**: Confirmation then removes the invoice.

**5. Activity Logging (`src/lib/activityLogger.ts`)**

- Add new action types: `'billing_plan_created'`, `'billing_plan_updated'`, `'billing_plan_deleted'`, `'invoice_edited'`, `'invoice_deleted'`.
- Add entity types: `'billing_plan'`, `'invoice'`.
- Call `trackActivity()` in each mutation's `onSuccess` for: creating plans, editing plans, deleting plans, editing invoices, deleting invoices, and recording payments.

**6. File: `src/pages/FinanceSetup.tsx` -- Activity Logging for Fee Packages and Discounts**

- Add `trackActivity()` calls when fee packages or discount rules are created, updated, or deleted.
- New action types: `'fee_package_created'`, `'fee_package_updated'`, `'fee_package_deleted'`, `'discount_created'`, `'discount_updated'`, `'discount_deleted'`.

### Technical Details

- The billing plans query joins `profiles` (for student name) and `fee_packages` (for package name).
- Edit mode reuses the existing "Composite Fee Builder" modal but sets an `editingPlanId` state to switch between insert and update.
- All `trackActivity()` calls include entity ID, action details (old/new values where applicable), and run in the background (non-blocking).
- No database migration needed -- all tables and columns already exist.

