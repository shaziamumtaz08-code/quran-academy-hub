
-- 1. Create eligibility rule type enum
CREATE TYPE public.eligibility_rule_type AS ENUM ('prerequisite_course', 'min_attendance', 'must_pass_exam');

-- 2. Create course_eligibility_rules table
CREATE TABLE public.course_eligibility_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  rule_type eligibility_rule_type NOT NULL,
  rule_value JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.course_eligibility_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view eligibility rules"
  ON public.course_eligibility_rules FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage eligibility rules"
  ON public.course_eligibility_rules FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER update_eligibility_rules_updated_at
  BEFORE UPDATE ON public.course_eligibility_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Add webhook_secret to courses
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

-- 4. Add eligibility columns to registration_submissions
ALTER TABLE public.registration_submissions 
  ADD COLUMN IF NOT EXISTS eligibility_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS eligibility_notes TEXT,
  ADD COLUMN IF NOT EXISTS source_tag TEXT DEFAULT 'manual';
