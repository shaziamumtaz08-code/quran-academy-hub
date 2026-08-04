# AQT-Branded Student Logins

## The rule

- Parent emails belong to parents only. Teacher/staff emails belong to them.
- Students never log in with a parent's or sibling's email.
- On approval, the system generates a unique AQT login address for each student:
  `firstname.lastname@alqurantimeacademy.com`
- These are login IDs only — no inbox. All communication stays inside the LMS, and password resets are done by an admin (no self-service reset for students).

## How the handle is built

From the student's full name, skipping common prefixes/honorifics so the alias is distinctive:

```text
Muhammad Saadin Hussain  -> saadin.hussain@alqurantimeacademy.com
Syeda Aairah Fatima      -> aairah.fatima@alqurantimeacademy.com
Hafiz Bilal              -> bilal@alqurantimeacademy.com
```

Skip list: muhammad, mohammad, mohammed, md, syed, syeda, mst, hafiz, hafiza, mirza, mst., shaikh (when leading), plus common title spellings. If skipping leaves nothing, the original first name is used.

Cleanup rules: lowercase, strip accents/non-letters, collapse spaces to a single dot, max 2 name parts.
Collision handling: if the address already exists, append the next free number (`saadin.hussain2@...`), never the parent's email.

## Registration form changes

- Remove "Use the parent / guardian email" from the student section, and remove the student email input entirely — students no longer supply an email.
- The form shows a short note: "Your child will receive an AQT login from the academy after approval."
- Parent/guardian email stays required, used for the parent account and for admin contact.

## Approval flow changes

- On approving a student registration, the system generates the AQT address, creates the login with the email pre-confirmed, and generates a strong initial password.
- The approval result screen lists each created student with their login address and initial password, with a copy-all button so the admin can pass credentials over WhatsApp.
- Approval is blocked only if the generated address cannot be produced (empty name) — never blocked on a missing student email anymore.
- The parent account is still created/reused from the parent email and linked to every sibling.

## Migration of existing students

- One-time repair pass over students currently sitting on a parent's or shared email: generate their AQT address, update their login, and keep the profile/URN and all history unchanged.
- Produces a downloadable credential list (name, new login, temporary password) for the admin.
- Saadin's pending application gets approved through the new flow and receives his own AQT login.

## Admin password reset

- Existing admin reset action in User Management is the supported path for students; the student-facing "forgot password" entry point is hidden for AQT-domain accounts since those addresses have no inbox.

## Technical notes

- New shared helper `supabase/functions/_shared/aqt-email.ts` with the skip-list handle generator and collision check.
- `approve-registration` switches from "require unique student email" to "generate AQT email"; the existing hard block on parent-email reuse stays as a safety net.
- `StudentRegistration.tsx`: drop `email` / `useGuardianEmail` from the student model; `family_registrations` child payload stores `email: null`, `uses_parent_email: false`.
- `RegistrationReview.tsx`: student email field becomes read-only "assigned on approval".
- Migration handled by a one-off admin edge action using the service-role client (auth email update + profile email update in one transaction-like sequence, logged).
- No email domain provisioning is required, because nothing is sent to these addresses.
