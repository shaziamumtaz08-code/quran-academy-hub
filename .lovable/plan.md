# Microsoft Teams classes — integration scope

Add Teams as a second live-class provider alongside Zoom, reusing the existing session, Join button, attendance and recording pipelines.

## Prerequisite (you, not code)
A Microsoft 365 tenant with licensed accounts for teachers, and one Entra ID app registration for the academy. Attendance reports require a paid Teams license. Nothing can be tested before this exists.

## Phase 1 — Meeting creation + Join button
- Store the academy Entra app credentials (tenant ID, client ID, client secret) securely, same pattern as the Zoom vault.
- Map each teacher to their Microsoft account (UPN), mirroring the existing Zoom account assignment screen.
- New edge function creates a Teams online meeting via Microsoft Graph when a class is started/scheduled, saving the join URL on the session record.
- Add a provider field per teacher/assignment (`zoom` | `teams`) so the existing Join button picks the right link. No UI redesign — same button, same student and teacher flows.

## Phase 2 — Attendance
- Scheduled job runs shortly after each class ends and pulls the Teams attendance report (join/leave times, duration per participant) from Graph.
- Feed those durations into the same attendance rules already used for Zoom (>50% duration = Present), writing `class_date` through the existing teacher-local date helper.
- Difference from Zoom: attendance lands a few minutes after class instead of live, since Teams has no per-teacher join/leave webhook.

## Phase 3 — Recordings
- Fetch the meeting recording from the organiser's OneDrive/SharePoint via Graph, then hand it to the existing compression + 60-day retention pipeline unchanged.

## Technical notes
- Access via the Microsoft Teams App User Connector (per-teacher consent) or an app-only Entra registration with `OnlineMeetings.ReadWrite.All` and `OnlineMeetingArtifact.Read.All` application permissions plus an application access policy. App-only is preferred here so teachers do not each have to consent.
- Graph change-notification subscriptions expire and must be renewed on a schedule; the polling approach in Phase 2 avoids that complexity.
- No changes to attendance business logic, salary windows or billing — Teams only becomes another source of session and duration data.

## Suggested order
Phase 1 alone makes Teams usable end to end for teaching. Phases 2 and 3 can follow once real meetings exist to test against.
