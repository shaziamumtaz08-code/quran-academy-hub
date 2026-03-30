

# Unique ID System & Signup Process

## Current State
- Profiles use UUIDs as primary keys (no human-readable IDs)
- Admin creates all users via `admin-create-user` edge function
- Sibling/family sharing works via `forceNewProfile` flag
- No public signup — admin-only creation confirmed by user preference
- Google OAuth deferred to a later phase

## User's Request
1. **IBAN-style unique IDs**: A structured, human-readable registration ID incorporating org, branch, division, and role segments
2. **Signup strategy**: Admin-only creation (confirmed), with future website integration in mind

---

## Plan

### 1. Database: Add `registration_id` column + sequence table

Add a `registration_id` (text, unique) column to `profiles` and create a `registration_sequences` table to track the next number per org-branch-division-role combination.

**ID Format**: `{ORG_CODE}-{BRANCH_CODE}-{ROLE_CODE}-{AUTO_NUMBER}`

Example IDs:
- `QHS-KHI-STU-0001` (Quran Hifz School, Karachi branch, Student #1)
- `QHS-ONL-TCH-0012` (Online branch, Teacher #12)
- `QHS-LDN-PAR-0003` (London branch, Parent #3)

Division is intentionally omitted from the ID because a single student can be in multiple divisions (1:1 + Group). The ID represents the person, not their enrollment context.

**Migration SQL:**
- Add `registration_id` (text, unique, nullable) to `profiles`
- Create `registration_sequences` table: `(org_code, branch_code, role_code, next_val)`
- Add `code` column (3-4 char uppercase) to `branches` table for branch codes
- Add `code` column to `organizations` table for org code
- Create a DB function `generate_registration_id(org_code, branch_code, role_code)` that atomically increments the sequence and returns the formatted ID

### 2. Edge Function: Auto-assign registration_id on user creation

Update `admin-create-user/index.ts`:
- Accept `branch_id` in the request body (required for ID generation)
- After profile creation, call the DB function to generate and assign the `registration_id`
- Return `registration_id` in the response

### 3. Edge Function: Auto-link siblings to parent

In the same `admin-create-user` update:
- Accept optional `parent_id` in request body
- If `role === 'student'` and `parent_id` is provided, insert into `student_parent_links`
- If `role === 'student'` and no `parent_id` but `forceNewProfile === true`, auto-detect parent from existing `student_parent_links` for profiles sharing the same email

### 4. UI: Show registration_id in User Management

Update `UserManagement.tsx`:
- Display `registration_id` column in the users table
- Add `branch_id` selector in the Create User dialog (required field)
- Add optional "Link to Parent" searchable dropdown when creating a student
- Show registration ID on student cards and profile views

### 5. UI: Show registration_id across the app

- `StudentCard.tsx` — show reg ID badge
- `StudentDetailDrawer.tsx` — display in header
- Profile sections in dashboards — display as "Your ID: QHS-KHI-STU-0001"

---

## Technical Details

### Registration Sequence DB Function
```text
generate_registration_id(org_code TEXT, branch_code TEXT, role_code TEXT)
→ Returns TEXT like "QHS-KHI-STU-0001"

Uses SELECT ... FOR UPDATE on registration_sequences to atomically
increment and return the next value, zero-padded to 4 digits.
```

### Role Code Mapping
```text
super_admin     → SA
admin           → ADM
admin_admissions → ADA
admin_fees      → ADF
admin_academic  → ADC
teacher         → TCH
student         → STU
parent          → PAR
examiner        → EXM
```

### Branch Code
Each branch gets a short `code` field (e.g., KHI, LDN, ONL). Set by admin in Organization Settings.

### Signup Strategy (Confirmed)
- **No public self-signup**. All accounts created by admin via User Management.
- Future website "Apply" button will create a WorkHub ticket/lead, not an account.
- Email + Password only (Google OAuth deferred).
- This means the existing `signUp` function in `AuthContext.tsx` can remain but won't be exposed publicly — only the Login page is public-facing.

### Files to Modify
1. **Migration** — `profiles` add `registration_id`, new `registration_sequences` table, add `code` to `branches` and `organizations`, DB function
2. **`supabase/functions/admin-create-user/index.ts`** — Add branch_id, parent_id params, call generate_registration_id, insert student_parent_links
3. **`src/pages/UserManagement.tsx`** — Add branch selector, parent linker, show reg ID column
4. **`src/components/students/StudentCard.tsx`** — Show registration_id badge
5. **`src/components/students/StudentDetailDrawer.tsx`** — Show registration_id in header

