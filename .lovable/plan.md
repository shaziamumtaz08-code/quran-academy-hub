

# LMS Advanced Data System — Implementation Plan

## What Already Exists
- **Bulk Import Wizard** for users/assignments/schedules with CSV validation via edge functions
- **Course Applicants** system with registration forms, submissions, and enrollment flow
- **Identity resolution** via email matching in CourseApplicants (create or link existing profile)
- **Course Enrollments** table with student_id, course_id, status
- **Registration Submissions** table for form-based applications

## What Needs to Be Built

### Phase 1: CSV/XLS Student Import with Smart Field Mapping

**New edge function: `course-applicant-import`**
- Accepts CSV rows with field mapping
- Maps columns to system fields (full_name, email, phone, gender, dob, city, source, course_id)
- Auto-suggest mapping based on header similarity (e.g., "Name" → full_name, "Mobile" → phone)
- Deduplicates by email (primary) then phone (fallback)
- Creates registration_submission records per row
- Returns validation results with diff for existing users

**New component: `CourseApplicantImport.tsx`**
- Upload CSV/XLS file (uses SheetJS for XLS parsing)
- Preview first 5 rows in a table
- Column mapping UI: dropdown per detected column → system field
- Save/load mapping templates (localStorage)
- Validation summary (new, matched, errors)
- Execute import button

**Integration point**: Add "Import CSV" button in CourseApplicants tab

### Phase 2: External Form API (Google Forms / Zapier)

**New edge function: `applicant-webhook`**
- POST endpoint accepting JSON payload with applicant fields
- Same dedup logic: email → phone → create new
- Creates registration_submission with `source_tag = 'google_form'` or `'webhook'`
- Optional: runs eligibility check if course_id provided
- Returns applicant status (enrolled/pending/rejected)
- Secured via a webhook secret token (configurable per course)

**Database migration**: Add `webhook_secret` column to `courses` table for per-course webhook auth

### Phase 3: Course Eligibility Engine

**Database migration**: New `course_eligibility_rules` table
- `id`, `course_id` (FK), `rule_type` (enum: prerequisite_course, min_attendance, must_pass_exam), `rule_value` (JSONB — stores course_id, threshold %, etc.), `is_active`, `created_at`

**New component: `CourseEligibilitySettings.tsx`**
- UI within Course Builder → Settings tab
- Add rules: prerequisite course (dropdown), min attendance %, must pass exam (toggle)
- Admin manual override toggle

**Eligibility check function** (shared utility):
- Called during enrollment (both CSV import and webhook)
- Checks each rule against the student's history
- Returns eligible/not-eligible with reasons
- If not eligible → submission stays as `rejected` with reason in `notes`

### Phase 4: Enhanced Identity Engine

**Upgrade `CourseApplicants.tsx` enrollment flow**:
- Add phone-based fallback matching (currently email-only)
- Show "User already exists" dialog with profile preview and options (view profile, enroll in another course)
- Display course history for matched users

**Upgrade bulk-validate-import edge function**:
- Add phone dedup as secondary matcher
- Return matched profile data for review

### Phase 5: Unified Data Flow

Wire everything together:
- CSV Import → applicant-webhook → CourseApplicants pipeline
- All paths run through: Dedup → Eligibility Check → Enroll or Reject
- Add eligibility status column to applicants table view
- Add "Override & Enroll" button for admins on rejected applicants

## Technical Details

### Database Changes (3 migrations)
1. `course_eligibility_rules` table with RLS policies
2. `webhook_secret` column on `courses` table
3. `eligibility_status` and `eligibility_notes` columns on `registration_submissions`

### New Files
- `src/components/courses/CourseApplicantImport.tsx` — CSV upload + mapping UI
- `src/components/courses/CourseEligibilitySettings.tsx` — rule builder UI
- `supabase/functions/applicant-webhook/index.ts` — external API endpoint
- `supabase/functions/course-applicant-import/index.ts` — CSV import with mapping + dedup + eligibility

### Modified Files
- `src/components/courses/CourseApplicants.tsx` — add import button, phone dedup, eligibility display
- `src/pages/CourseBuilder.tsx` — add eligibility settings to Settings tab
- `supabase/config.toml` — add new function configs

### Dependencies
- `xlsx` (SheetJS) npm package for XLS/XLSX file parsing on the frontend

## Implementation Order
1. Database migrations (eligibility rules, webhook secret, submission columns)
2. Eligibility settings UI + backend check logic
3. CSV/XLS import with field mapping
4. Applicant webhook endpoint
5. Enhanced dedup (phone fallback) + unified flow wiring

