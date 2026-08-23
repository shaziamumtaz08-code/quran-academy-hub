# Add one-time exam templates

## Goal
Allow admins to create and use an exam/report template that is taken once in a student's lifetime, such as a whole-Quran or whole-Qaida exam.

## Changes
- Extend the exam frequency options with **One time** while preserving Weekly, Monthly, Quarterly, and Yearly.
- Add **One time** to the template create/edit form and exam-report frequency filter.
- Ensure one-time templates continue through the existing report generation, bulk generation, printing, and display flows without date-recurrence assumptions.
- Update the shared exam type so every screen recognizes the new frequency.

## Technical details
- Extend the database `exam_tenure` enum with `one_time`; no table or data deletion.
- Use the existing `exam_templates.tenure` field, so existing templates and reports remain unchanged.
- Keep the one-time rule descriptive at template level; creating the actual exam report remains explicit, matching the current report-generation workflow.
- Validate template creation, filtering, and existing report-generation screens after the migration and frontend changes.
