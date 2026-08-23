# Unified Person Creation and Role Onboarding

## Goal
Make admin entry and self-registration two entrances into the same onboarding pipeline:

```text
Person (one permanent ID + one login)
  ├─ Student role tag + student profile details
  ├─ Teacher role tag + teacher profile details
  ├─ Parent role tag + family links
  └─ Staff/admin role tag + access scope
```

A person is never created as a “student-type user” or “teacher-type user.” Their permanent identity stays unchanged; rows in `user_roles` determine what they can do.

## User experience
- Replace the generic **Add User** modal with **Add person**.
- First search by authentic email:
  - Existing person: show their permanent ID and current role tags, then offer **Add role** and open only that role’s onboarding details.
  - New person: collect core identity once, then select one or more role tags.
- For **Student**, open the same student form used by the public registration page in admin mode.
- For **Teacher**, open the same teacher form used by the public application page in admin mode.
- Admin mode hides fields that the system owns and shows them as read-only after creation.
- Provide two admin actions:
  - **Save draft** — creates/updates a reviewable registration without activating access.
  - **Approve & create account** — completes the same approval pipeline immediately.
- Keep public submissions in the existing registration review queue; admin-created drafts appear there with an **Entered by admin** source badge.

## Field ownership
### Admin/person-entered
- Name, authentic email, contact and location details
- Student guardian, education, medical/wellbeing and learning details
- Teacher qualification, experience, availability and payout details
- Division selection and role-specific operational details

### System-generated
- Permanent user/profile ID
- Login/auth identity
- Academy login email when policy allows and the student has no personal email
- Registration/URN reference for each role
- Role rows and role status
- Organization, branch and division context defaults
- Created/reviewed timestamps and audit actor
- Parent/student links and duplicate-review flags

These generated fields will never be editable form inputs.

## Unified mechanics
1. Extract the student and teacher form definitions into reusable form components and shared validation/payload builders.
2. Public pages submit those shared payloads as pending registrations.
3. Admin **Add person** submits the same payload, records the admin as source, and can either leave it pending or invoke approval immediately.
4. Make the shared identity resolver the only path allowed to create or reuse a person:
   - Resolve by normalized unique email.
   - Reuse the existing permanent ID when the person exists.
   - Add a `user_roles` tag instead of creating another person.
   - Create a separate parent and student identity; never share one login.
5. Retire direct identity creation logic duplicated inside `admin-create-user`; make it call the same resolver/approval service.
6. Generate role-specific registration references only when a role is attached. The permanent UUID remains role-neutral and never changes.
7. Store sensitive identity, medical and payment details through the existing protected sensitive-data/payment-account structures rather than exposing them on general profile reads.
8. Preserve division context deterministically: selected division → admin default division → configured academy fallback, with the chosen source recorded.

## Safeguards and verification
- Block duplicate normalized emails at both UI and backend levels.
- Test new student, new teacher, existing person gaining a second role, parent + child separation, generated student login, save-draft, and approve-now paths.
- Confirm every path creates exactly one auth identity and one profile ID, with role tags in `user_roles`.
- Confirm direct caller-supplied IDs, generated references and audit actors cannot override system values.
- Verify admin/student/teacher forms render on desktop and mobile and that the existing public links still work.

## Technical scope
- Refactor `StudentRegistration`, `TeacherRegistration`, `UserManagement`, `RegistrationReview`, `approve-registration`, and `admin-create-user` around shared payload schemas and the existing identity resolver.
- Add only additive database metadata needed to identify submission source/draft state and audit role onboarding; preserve all existing records and columns.
- Keep profile pages and current role-based navigation intact.
