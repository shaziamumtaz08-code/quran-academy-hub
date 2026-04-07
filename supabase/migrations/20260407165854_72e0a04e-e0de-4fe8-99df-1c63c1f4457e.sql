
-- Teacher payouts table
CREATE TABLE public.teacher_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  class_id UUID REFERENCES public.course_classes(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  payout_type TEXT NOT NULL DEFAULT 'per_session',
  rate NUMERIC NOT NULL DEFAULT 0,
  sessions_count INTEGER NOT NULL DEFAULT 0,
  students_count INTEGER NOT NULL DEFAULT 0,
  calculated_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_reference TEXT DEFAULT NULL,
  paid_at TIMESTAMPTZ DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage teacher payouts"
  ON public.teacher_payouts FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Teachers can view their own payouts"
  ON public.teacher_payouts FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE TRIGGER update_teacher_payouts_updated_at
  BEFORE UPDATE ON public.teacher_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add default payout rate to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_payout_rate NUMERIC DEFAULT NULL;
