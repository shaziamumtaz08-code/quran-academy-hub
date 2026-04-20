

## What you already have for parents

You have a **fully built Parent Portal** at `/parent` (`src/pages/ParentDashboard.tsx`, 814 lines). It is mobile-friendly, multilingual (English / Urdu / Arabic), and includes 6 sections accessed via `?section=` URL params:

1. **Overview** — child cards, attendance %, speaking score, latest assessment, next session, AI note
2. **AI Progress Report** — auto-generated parent report (PDF export)
3. **Sessions & Attendance** — attended / missed / late / excused log
4. **Materials & Resources** — videos, drills, vocab progress
5. **Fees & Payments** — monthly fee, paid-to-date, overdue months, family bulk pay
6. **Message Teacher** — DM thread with AI draft assist

There is also `FamilyManagement.tsx` for parents to manage linked children, PINs, and oversight levels.

**Linking model already in DB:** the `student_parent_links` table joins a parent profile to one or more student profiles. A parent can have many children; a child can have multiple guardians.

## Why "Create Guardian Account" is failing

The current button on the student's Guardian tab calls `LinkGuardianDialog` which tries to **provision a fresh auth user with a temp password in one shot**. That flow is the one currently breaking (HIBP / password rules / edge function permissions).

## Proposed fix — switch to "Find or Create User, then Link"

Replace the all-in-one provisioning with the same **two-step flow you already use elsewhere**:

**Step 1 — Pick or create the person (no auth yet)**
- Search existing users by email / phone / name
- If found → show match, click "Link as Guardian"
- If not found → create a *plain profile* (no auth account) with name, email, phone, relationship, country
- Insert row into `student_parent_links` with relationship + oversight level

**Step 2 — Activate login later (optional, on demand)**
- The new guardian appears on the **Parents & Guardians** page (`/parents`) with an "Activate Login" button (this flow already exists and works — uses `activate-parent-login` edge function)
- Admin clicks it when ready → parent gets credentials → can sign in to `/parent` portal

This matches how students are currently handled (profile first, login activated separately) and removes the failing single-shot provisioning.

## Changes required

**1. `src/components/users/LinkGuardianDialog.tsx`**
- Remove the `generateTempPassword` + `admin-create-user` invocation
- Add a search box (name / email / phone) that queries `profiles` 
- Show results; "Link Existing" button → only inserts into `student_parent_links`
- "Create New Guardian Profile" button → inserts into `profiles` (no auth) + `user_roles` (`parent`) + `student_parent_links`
- Success state: shows the linked guardian card with a "Activate login from Parents page →" hint

**2. Student profile drawer — Guardian tab**
- After linking, replace the empty "No Guardian Linked" state with a list of linked guardians (name, relationship, login status, unlink button)

**3. No DB migration needed** — `student_parent_links`, `profiles`, `user_roles` already support this.

**4. Parents page (`/parents`) already handles activation** — no changes needed; new guardians will appear in the "Need Login" tab automatically.

## Result

- Linking a guardian becomes a 5-second action (no password generation, no email failures)
- Parent profile can be linked to multiple children (siblings)
- Admin activates login on demand from the Parents page → guardian then has full access to the existing `/parent` dashboard
- Existing parent users (already in system) can be linked instead of duplicated

