
## Lead Pipeline v2 — Phased Implementation

### Phase 1: Database Schema & Lead Form Enhancement
**Migration:**
- Add to `leads`: `gender`, `date_of_birth`, `current_level_specimen`, `learning_goals`, `guardian_name`, `guardian_relationship`, `attachment_urls` (jsonb)
- Add `pre_screen` stage to pipeline
- Create `lead_screenings` table: `lead_id`, `screened_by`, `screened_at`, `channel`, `material_tested`, `estimated_level`, `observations`, `quick_tags` (text[]), `confidence_rating`, `proceed_decision`, `suggested_teacher_id`, `is_skipped`
- Add to `demo_sessions`: `teacher_note`, `notify_channels` (jsonb)
- Create `lead_attachments` table for file uploads (image/pdf/voice)
- Create storage bucket `lead-attachments`

**UI Changes:**
- Update `PublicInquiryForm` — add academic info section (subject multi-select already exists, add `current_level_specimen`, `learning_goals`)
- Update `CreateLeadDialog` — add gender, DOB, guardian fields, subject multi-select
- Update pipeline stages to include `pre_screen` between `contacted` and `demo_scheduled`

### Phase 2: Pre-Screen Stage UI
- Add Pre-Screen form in lead detail view with bypass checkbox
- Screening logistics: screened_by (admin selector), date/time, channel (pill toggles), duration
- Material & Level Assessment: material_tested, estimated_level (4-card selector), quick observation tags, screening notes
- Admin Recommendation: proceed decision radio, confidence rating (1-5), suggested teacher
- Save draft / Complete & schedule demo buttons

### Phase 3: Demo Scheduling Upgrade
- Enhanced demo scheduling form with teacher note from screening
- Platform selector, meeting link, notify via toggles (WhatsApp/Email/WorkHub)
- Auto-advance lead status on schedule

### Phase 4: Feedback System (Future)
- Teacher feedback form (public, token-based)
- Student/parent feedback form (public, token-based)
- Auto-trigger 30min after demo end
- Rating, level assessment, recommendation, decision tracking

### Phase 5: Temp User & Notifications (Future)
- Magic link temp user creation for demo students
- WhatsApp/Email notifications for teacher and student
- Calendar integration (.ics generation)

---

**This plan implements Phases 1-3 now. Phases 4-5 involve external integrations (WhatsApp API, email sending, Google Calendar) and will be planned separately.**

### Files Changed

| File | Change |
|------|--------|
| Migration | Add new columns to `leads`, create `lead_screenings` table, create `lead_attachments` table, storage bucket |
| `src/pages/PublicInquiryForm.tsx` | Add academic info section with current_level_specimen, learning_goals |
| `src/pages/LeadsPipeline.tsx` | Add pre_screen stage, enhance lead detail with screening form, update create dialog |
