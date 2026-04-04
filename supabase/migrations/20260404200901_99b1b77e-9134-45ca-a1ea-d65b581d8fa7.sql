
-- Notification templates for reusable messages
CREATE TABLE public.notification_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms', 'email', 'in_app')),
  event_trigger TEXT NOT NULL,
  template_text TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  branch_id UUID REFERENCES public.branches(id),
  division_id UUID REFERENCES public.divisions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage notification templates"
  ON public.notification_templates FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Notification events queue
CREATE TABLE public.notification_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.notification_templates(id),
  recipient_id UUID REFERENCES public.profiles(id),
  recipient_phone TEXT,
  recipient_email TEXT,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms', 'email', 'in_app')),
  payload JSONB DEFAULT '{}',
  rendered_text TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'delivered')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  triggered_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all notification events"
  ON public.notification_events FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can create notification events"
  ON public.notification_events FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Teachers view own triggered notifications"
  ON public.notification_events FOR SELECT
  TO authenticated
  USING (triggered_by = auth.uid());

-- Indexes
CREATE INDEX idx_notification_events_status ON public.notification_events(status);
CREATE INDEX idx_notification_events_recipient ON public.notification_events(recipient_id);
CREATE INDEX idx_notification_events_created ON public.notification_events(created_at DESC);
CREATE INDEX idx_notification_templates_trigger ON public.notification_templates(event_trigger);

-- Triggers for updated_at
CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_events_updated_at
  BEFORE UPDATE ON public.notification_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default templates
INSERT INTO public.notification_templates (name, channel, event_trigger, template_text, variables) VALUES
  ('Fee Reminder', 'whatsapp', 'fee_reminder', 'Assalamu Alaikum {{parent_name}}, this is a reminder that {{student_name}}''s fee of {{amount}} {{currency}} for {{month}} is due. JazakAllah Khair.', ARRAY['parent_name', 'student_name', 'amount', 'currency', 'month']),
  ('Attendance Alert', 'whatsapp', 'attendance_absent', 'Assalamu Alaikum, {{student_name}} was marked absent today ({{date}}). Please contact the admin if needed.', ARRAY['student_name', 'date']),
  ('Class Reminder', 'whatsapp', 'class_reminder', 'Reminder: {{student_name}} has a {{subject}} class at {{time}} today with {{teacher_name}}.', ARRAY['student_name', 'subject', 'time', 'teacher_name']),
  ('Welcome Message', 'whatsapp', 'enrollment_complete', 'Welcome to {{org_name}}! {{student_name}} has been enrolled successfully. Login details will follow.', ARRAY['org_name', 'student_name']),
  ('Exam Result', 'whatsapp', 'exam_result', '{{student_name}}''s report card for {{exam_name}} is ready. Score: {{percentage}}%. View details in the portal.', ARRAY['student_name', 'exam_name', 'percentage']);
