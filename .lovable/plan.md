
## Manual Fee Override in Composite Fee Builder

Add a toggle that lets admins bypass the fee package system entirely and enter a custom fee amount and currency directly.

### How It Works

1. **New Toggle**: Add a "Manual Fee" switch above the Base Package section. When enabled:
   - Hide the Base Package, Session Duration, Discounts sections
   - Show two simple fields: **Amount** (number input) and **Currency** (dropdown: USD, PKR, GBP, EUR, etc.)

2. **Invoice Preview**: When manual mode is active, the preview simplifies to show only the entered amount as the Net Recurring Fee -- no base, surcharge, or discount lines.

3. **Save Logic**: The `savePlanMutation` saves with `base_package_id: null`, `duration_surcharge: 0`, `flat_discount: 0`, `global_discount_id: null`, and uses the manual amount as `net_recurring_fee` and the selected currency as `currency`.

4. **Validation**: `canSavePlan` updated so that either a base package OR a valid manual amount is required.

### Database

No schema changes needed. The `student_billing_plans` table already allows `base_package_id` to be nullable, and `net_recurring_fee` / `currency` can store the manual values directly.

### Technical Details

**File:** `src/pages/Payments.tsx`

- **State**: Add `isManualFee` boolean and `manualFeeAmount` / `manualFeeCurrency` to `feeForm` state.
- **Lines ~147-153** (feeForm state): Add `manual_fee: false`, `manual_amount: ''`, `manual_currency: 'USD'` fields.
- **Lines ~300-320** (computed values): When `feeForm.manual_fee` is true, override `netRecurringFee` to `parseFloat(feeForm.manual_amount)` and `feeCurrency` to `feeForm.manual_currency`.
- **Line ~320** (canSavePlan): Update to `(editingPlanId || selectedStudentIds.length > 0) && (feeForm.base_package_id || (feeForm.manual_fee && parseFloat(feeForm.manual_amount) > 0)) && !flatDiscountNeedsReason`.
- **Lines ~395-429** (savePlanMutation): When manual mode, set `base_package_id: null`, `session_duration: 30`, `duration_surcharge: 0`, `flat_discount: 0`, `global_discount_id: null`.
- **Lines ~447-455** (resetFeeForm): Reset manual fields.
- **Lines ~1098-1144** (form UI): Wrap package/duration/discounts in a conditional. Add Switch toggle and manual inputs above.
- **Lines ~1148-1193** (preview): Simplify preview when manual mode is on to show only the direct amount.
