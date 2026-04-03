

# Anonymous/Incognito Mode for WorkHub Tickets

## Overview
Add an "Anonymous" toggle to the ticket creation form so any user can submit complaints, feedback, or suggestions without their identity being visible to the recipient. Admins (super_admin/admin) can always see the real creator for moderation purposes.

## How It Works
- A new `is_anonymous` boolean column on the `tickets` table (default `false`)
- When creating a ticket, a toggle appears for complaint/feedback/suggestion categories
- The `creator_id` is still stored (system always knows who submitted), but the UI hides it from non-admin viewers
- In ticket lists and ticket detail views, if `is_anonymous = true`:
  - **Non-admin users** see "Anonymous" instead of the creator's name
  - **Admins** see the real name with a small "Anonymous" badge so they know it was submitted anonymously
- Comments posted by the anonymous creator on their own anonymous ticket also show as "Anonymous" to non-admins

## Technical Changes

### 1. Database Migration
- Add `is_anonymous BOOLEAN NOT NULL DEFAULT false` to `tickets` table

### 2. CreateTicketDialog (`src/components/hub/CreateTicketDialog.tsx`)
- Add `isAnonymous` state toggle (Switch component)
- Only show toggle when category is `complaint`, `feedback`, or `suggestion`
- Pass `is_anonymous: isAnonymous` in the insert payload

### 3. TicketList (`src/components/hub/TicketList.tsx`)
- When enriching creator names, check `t.is_anonymous`:
  - If true and current user is not admin → show "Anonymous" as `creator_name`
  - If true and current user is admin → show real name + "(Anon)" suffix

### 4. TicketDetail (`src/components/hub/TicketDetail.tsx`)
- In the header "From" section: if `ticket.is_anonymous` and viewer is not admin, show "Anonymous"
- In comment bubbles: if comment `author_id === ticket.creator_id` and `ticket.is_anonymous` and viewer is not admin, show "Anonymous"

### 5. TeacherNotificationsSection
- Same anonymous name masking for WorkHub notification previews

### Files Modified
1. **Migration SQL** — add `is_anonymous` column
2. **`src/components/hub/CreateTicketDialog.tsx`** — anonymous toggle UI + insert field
3. **`src/components/hub/TicketList.tsx`** — mask creator name for anonymous tickets
4. **`src/components/hub/TicketDetail.tsx`** — mask creator in header and comments
5. **`src/components/dashboard/teacher/TeacherNotificationsSection.tsx`** — mask in notification previews

