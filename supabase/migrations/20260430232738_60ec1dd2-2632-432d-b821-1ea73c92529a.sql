-- ════════════════════════════════════════════════════════════════
-- TEACHER PHASE 4 — POLISH: indices + route_hits telemetry table
-- ════════════════════════════════════════════════════════════════

-- ── 1. PERFORMANCE INDICES ──
-- Note: idx_attendance_teacher_date, idx_chat_members_user, idx_notification_queue_recipient
-- already exist (skipped). student_reports table does not exist (skipped).
-- live_sessions has scheduled_start (not started_at) — adapted accordingly.

CREATE INDEX IF NOT EXISTS idx_sta_teacher_active
  ON public.student_teacher_assignments(teacher_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_sta_student_active
  ON public.student_teacher_assignments(student_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_course_class_staff_user
  ON public.course_class_staff(user_id);

CREATE INDEX IF NOT EXISTS idx_course_class_students_class_active
  ON public.course_class_students(class_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment
  ON public.course_assignment_submissions(assignment_id, status);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz
  ON public.course_quiz_attempts(quiz_id, student_id);

CREATE INDEX IF NOT EXISTS idx_live_sessions_teacher_date
  ON public.live_sessions(teacher_id, scheduled_start DESC);

-- ── 2. ROUTE_HITS TELEMETRY TABLE ──

CREATE TABLE IF NOT EXISTS public.route_hits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  route text NOT NULL,
  division_id uuid,
  hit_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid DEFAULT auth.uid()
);

ALTER TABLE public.route_hits ENABLE ROW LEVEL SECURITY;

-- Authenticated users can INSERT their own row
DROP POLICY IF EXISTS "users_can_insert_own_route_hit" ON public.route_hits;
CREATE POLICY "users_can_insert_own_route_hit"
  ON public.route_hits FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Only super_admin can read
DROP POLICY IF EXISTS "super_admin_can_select_route_hits" ON public.route_hits;
CREATE POLICY "super_admin_can_select_route_hits"
  ON public.route_hits FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_route_hits_role_hit ON public.route_hits(role, hit_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_hits_user_hit ON public.route_hits(user_id, hit_at DESC);
