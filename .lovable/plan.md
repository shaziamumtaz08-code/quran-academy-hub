

## Salary Engine Redesign -- Professional Salary Sheet UI

### What Changes

**1. Remove "Extra Class" button from Salary Engine header**
The top-bar buttons will be reduced to only "Leave" and "Adjustment". Extra classes are linked through assignments automatically. Replacement teacher logic stays exclusively in the Assignment Reassign workflow.

**2. Replace expandable rows with a dedicated Salary Sheet view**
Clicking a teacher name in the summary table opens a full-page styled salary report (dialog/modal) instead of an inline expandable row. This report is designed to be viewable by teachers and downloadable.

**3. Salary Sheet Layout (Professional Report Style)**

```text
+---------------------------------------------------------------+
| HEADER SECTION                                                |
|  Left:  Teacher Name, ID, WhatsApp, Country/City              |
|         Bank: Account Title, Bank Name, Account #, IBAN       |
|  Right: Teacher's own attendance snapshot (mini stats)         |
|         Total Present / Absent / Leave days this month         |
|         Salary Period dropdown (month selector)                |
+---------------------------------------------------------------+
| LEGEND BAR                                                    |
|  Green=Present  Red=Absent  Yellow=Leave  Grey=Not Marked     |
+---------------------------------------------------------------+
| PER-STUDENT ROWS (auto-generated from assignments)            |
|  Student Name | FROM--TO | Monthly Fee | Due Amt | Final Amt  |
|  [Attendance dot timeline with color coding]                  |
|  15/25 days present | 3 absent | 1 leave | 6 not marked      |
|  Fee Status: PAID or UNPAID (with last payment date)          |
+---------------------------------------------------------------+
| ADJUSTMENTS SECTION                                           |
|  + Add Manual Adjustment (Reason + Amount +/-)                |
|  Auto-pulled from Expenses module                             |
|  List: Description | Type | Amount                            |
+---------------------------------------------------------------+
| NET SALARY FOOTER                                             |
|  Base: $XXX | Additions: +$XX | Deductions: -$XX | Net: $XXX |
|  [Mark Fully Paid] [Mark Partially Paid (with reason input)]  |
+---------------------------------------------------------------+
```

**4. Database: Add bank detail fields to profiles**
New columns on `profiles` table:
- `bank_name` (text, nullable)
- `bank_account_title` (text, nullable)
- `bank_account_number` (text, nullable)
- `bank_iban` (text, nullable)

**5. Fix Expenses page empty-string Select bug**
The Expenses page has `<SelectItem value="">None</SelectItem>` for teacher and student dropdowns which will crash on Radix. Fix to use `"none"` pattern.

**6. Summary table stays clean**
The main summary table keeps columns: Teacher | Base | Extras | Additions | Deductions | Net | Status | Actions (View Sheet / Save / Pay / Lock). Teacher name is clickable to open the sheet.

### Technical Details

**Files to modify:**
- `src/pages/SalaryEngine.tsx` -- Complete UI restructure: remove Extra Class button/modal, replace expandable rows with full salary sheet dialog, add teacher header with bank details, add partial payment support with reason field, downloadable layout
- `src/pages/Expenses.tsx` -- Fix empty-string SelectItem values (lines 376, 389)
- Database migration -- Add bank detail columns to `profiles`

**Key UI decisions:**
- Salary sheet opens as a large dialog (max-w-4xl) with print-friendly styling
- Color legend uses the requested palette: green (present), red (absent), yellow (leave), grey (not marked)
- Fee status per student row helps admin identify inactive/unpaid students before issuing salary
- Partial payment requires mandatory reason text
- Download button triggers browser print dialog with print-optimized CSS
