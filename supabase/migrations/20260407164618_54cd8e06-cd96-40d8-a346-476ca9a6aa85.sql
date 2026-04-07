
-- Fee plan templates per course
CREATE TABLE public.course_fee_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'PKR',
  installments INTEGER NOT NULL DEFAULT 1,
  installment_schedule JSONB NOT NULL DEFAULT '[]',
  tax_percent NUMERIC NOT NULL DEFAULT 0,
  notes TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.course_fee_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage course fee plans"
  ON public.course_fee_plans FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin_fees'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin_fees'));

CREATE TRIGGER update_course_fee_plans_updated_at
  BEFORE UPDATE ON public.course_fee_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Student-level fee assignments with overrides
CREATE TABLE public.course_student_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  plan_id UUID REFERENCES public.course_fee_plans(id) ON DELETE SET NULL,
  discount_type TEXT NOT NULL DEFAULT 'none',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  is_scholarship BOOLEAN NOT NULL DEFAULT false,
  total_due NUMERIC NOT NULL DEFAULT 0,
  total_paid NUMERIC NOT NULL DEFAULT 0,
  custom_installment_schedule JSONB DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, student_id)
);

ALTER TABLE public.course_student_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage course student fees"
  ON public.course_student_fees FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin_fees'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin_fees'));

CREATE TRIGGER update_course_student_fees_updated_at
  BEFORE UPDATE ON public.course_student_fees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Payment records
CREATE TABLE public.course_fee_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_fee_id UUID NOT NULL REFERENCES public.course_student_fees(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT DEFAULT NULL,
  payment_method TEXT DEFAULT NULL,
  payment_link TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  recorded_by UUID DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.course_fee_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage course fee payments"
  ON public.course_fee_payments FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin_fees'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin_fees'));
