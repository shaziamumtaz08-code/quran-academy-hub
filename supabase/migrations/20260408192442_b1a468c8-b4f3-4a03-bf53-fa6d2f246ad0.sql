
-- Analytics snapshots: daily per-student metrics
CREATE TABLE public.analytics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  assessment_avg numeric DEFAULT 0,
  attendance_rate numeric DEFAULT 0,
  speaking_avg numeric DEFAULT 0,
  video_completion_rate numeric DEFAULT 0,
  flashcard_usage_rate numeric DEFAULT 0,
  assignment_completion_rate numeric DEFAULT 0,
  growth_delta numeric DEFAULT 0,
  phase_usage jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, course_id, snapshot_date)
);

ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view analytics snapshots"
  ON public.analytics_snapshots FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert analytics snapshots"
  ON public.analytics_snapshots FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update analytics snapshots"
  ON public.analytics_snapshots FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_analytics_snapshots_student ON public.analytics_snapshots(student_id, snapshot_date);
CREATE INDEX idx_analytics_snapshots_course ON public.analytics_snapshots(course_id, snapshot_date);

-- At-risk flags
CREATE TABLE public.at_risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  flagged_at timestamptz NOT NULL DEFAULT now(),
  risk_reasons jsonb DEFAULT '[]'::jsonb,
  ai_summary text,
  intervention_plan jsonb,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.at_risk_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view at-risk flags"
  ON public.at_risk_flags FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert at-risk flags"
  ON public.at_risk_flags FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update at-risk flags"
  ON public.at_risk_flags FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_at_risk_flags_student ON public.at_risk_flags(student_id);
CREATE INDEX idx_at_risk_flags_unresolved ON public.at_risk_flags(course_id) WHERE resolved_at IS NULL;

-- Academy reports
CREATE TABLE public.academy_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid,
  period_start date NOT NULL,
  period_end date NOT NULL,
  generated_by uuid,
  report_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.academy_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view academy reports"
  ON public.academy_reports FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create academy reports"
  ON public.academy_reports FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_academy_reports_period ON public.academy_reports(period_start, period_end);
