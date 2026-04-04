

# Make Parental Supervision Optional (Not Parental Identity)

## Understanding
The issue is NOT about skipping parent contact info — kids or parents can fill in name/email freely. The issue is that **parental dashboard oversight** (full oversight, notifications) should be **optional**, not forced. A parent might provide their details but not want a dashboard. Or a kid might enroll alone and add a parent later.

## Changes — `src/pages/EnrollmentForm.tsx` only

### 1. Keep parent fields visible but never mandatory
- Remove the "Required" badge from the parental consent section
- Parent name, email, WhatsApp remain visible for minors but are all optional
- Anyone can fill them in or leave them blank

### 2. Make oversight selection optional with a "No thanks" option
- Add a third option to the parent oversight dropdown: **"None — no parent dashboard needed"**
- Default to "None" instead of "full"
- Remove the forced oversight lock for under-13 (the `computedForcedOversight` logic that hides the "None" option)

### 3. Update `canSubmit` validation (line ~116)
- Remove the requirement for `parent_name && parent_email && parental_consent` for minors
- Only require: `student_name`, `terms_accepted`, `privacy_accepted` for everyone
- The parental consent checkbox becomes optional too — only shown if parent fields are filled

### 4. Adjust the under-13 message
- Instead of "Full parental oversight is mandatory", show: "We recommend adding a parent/guardian for students under 13"

### No database changes needed
`enrollment_form_data` is JSONB — new field values are stored automatically.

### File modified
- `src/pages/EnrollmentForm.tsx`

