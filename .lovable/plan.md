# Shareable Demo Links — Auto-Send to Teacher & Student

## What we're building

When an admin schedules a demo on a lead (assigns a teacher + sets date/time/Zoom link), the system automatically sends a **personalized shareable link** to both the teacher and the student/parent. Each link opens a public page tailored to that audience. After the demo's scheduled end time, the same link automatically swaps to a **feedback form** — unless the admin has rescheduled or cancelled the demo.

## User-visible behavior

1. Admin schedules a demo in **Leads Pipeline** → picks teacher, date/time, timezone, Zoom link.
2. System generates two unique tokens (one teacher, one student) and persists them on the demo record.
3. Delivery cascade per recipient:
   - **WhatsApp first** via existing WhatsChimp integration if the contact has a valid WhatsApp number.
   - **Email fallback** via Resend if WhatsApp is unavailable or fails.
   - **In-app notification** is always queued for the teacher (since they're a platform user).
4. Both messages contain a short shareable URL like `lms.alqurantimeacademy.com/demo/abc123xyz`.

## Public demo page (`/demo/:token`)

The page resolves the token, identifies the audience (teacher vs student), and decides what to show based on current time vs the demo window:

```text
Before demo end time          →  Demo details view
After demo end time           →  Feedback form view
Rescheduled                   →  Demo details view (with new time + "Rescheduled" banner)
Cancelled                     →  "This demo has been cancelled" notice
```

### Teacher view (details)
- Student name, age, country, timezone
- Subject(s) of interest, preferred time slots, notes
- Date/time in teacher's timezone + student's timezone
- Big "Join Zoom" button
- Parent contact (phone/email) for direct outreach

### Student/parent view (details)
- Teacher name + short bio/photo (if available)
- Subject
- Date/time in student's timezone (with a "Add to calendar" .ics link)
- Big "Join Zoom" button
- Light reminder of what to expect

### Feedback form (post-demo, both audiences)
- Teacher feedback: student level assessment, recommended package, notes, recommended next steps.
- Student/parent feedback: 1–5 star rating, free-text comments, "Interested to enroll?" yes/no/maybe.
- Submissions are stored against the lead so admin sees both sides in the lead drawer.

## Trigger logic

A single Edge Function `send-demo-links` is invoked from the frontend right after `createDemo`/`updateDemo` saves successfully **and** all of these are true: `teacher_id`, `scheduled_at`, and Zoom link are present and the status is `scheduled` (not cancelled).

It also runs on **reschedule** (re-sends a "📅 Rescheduled — new time" message using the same tokens). It does not re-send on minor edits like a note change.

## Channel setup the user needs

- **WhatsApp**: already wired (WhatsChimp). No new keys needed — we reuse the existing send-message helper.
- **Email**: requires **Resend connector**. I'll prompt the connect dialog when we get to that step; the user will pick a verified sender domain (or use Resend's test domain initially).
- **Lovable Emails alternative**: if the user prefers, we can use Lovable's built-in email instead of Resend — same UX, no third-party signup. Worth confirming.

## Technical details

### Database
New table `demo_share_tokens`:
- `id`, `demo_session_id` (FK), `lead_id` (FK), `token` (unique, 22-char nanoid), `audience` ('teacher' | 'student'), `created_at`, `revoked_at`.
- Public `anon` SELECT policy on this table is **deliberate** — the token is the access control (unguessable). No PII lives on this table; PII is fetched via a SECURITY DEFINER RPC `get_demo_by_token(_token)` that returns only the fields the audience is allowed to see.

New table `demo_feedback`:
- `id`, `demo_session_id`, `lead_id`, `audience` ('teacher' | 'student'), `rating`, `interested`, `recommended_package`, `notes`, `submitted_at`.
- Public anon INSERT allowed *only via* RPC `submit_demo_feedback(_token, _payload)` which validates the token and the timing.

### Frontend
- New route `/demo/:token` → `src/pages/PublicDemoView.tsx` (public, no auth).
- Hook into `LeadsPipeline.tsx` demo create/update flow → invoke `send-demo-links` Edge Function.
- "Resend demo link" button per lead in the existing lead drawer (manual safety valve).

### Edge functions
- `send-demo-links` — generates tokens (idempotent: reuses if already present), composes WhatsApp + email payloads, dispatches with fallback, logs to `notification_queue`.
- `get-demo-share` — public, takes a token, returns audience-scoped view.
- `submit-demo-feedback` — public, takes token + payload, writes to `demo_feedback`.

### Messaging templates (edit-friendly)
Stored as constants in the edge function for now (can move to `notification_templates` later). Concise and friendly, with student name, teacher name, subject, date/time in recipient's timezone, and the unique link.

## What we're NOT doing in this scope

- No SMS channel (would need Twilio).
- No CRON-based reminder emails ("starts in 1 hour") — happy to add as a follow-up.
- No multi-language templates yet (English only first; Urdu/Arabic can follow).

## Confirmation needed before I start coding

1. **Email channel**: Resend (recommended, fast to set up via connector) or Lovable Emails (no third-party)?
2. **Sender display name** for emails — "Al Quran Time Academy"?
3. **Feedback form swap time** — should it flip exactly at scheduled end time, or after a grace period (e.g. 15 min after end)?

Once you confirm those three, I'll build it end-to-end.