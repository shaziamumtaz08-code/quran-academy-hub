
-- Staff salary configuration (flat monthly amounts per role)
CREATE TABLE public.staff_salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  role text NOT NULL,
  monthly_amount numeric NOT NULL DEFAULT 0,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  prorate_partial_months boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role, effective_from)
);

-- RLS
ALTER TABLE public.staff_salaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage staff_salaries" ON public.staff_salaries
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() 
            AND role IN ('super_admin', 'admin', 'admin_fees'))
  );

CREATE POLICY "Users can view own staff_salaries" ON public.staff_salaries
  FOR SELECT USING (user_id = auth.uid());

-- Fix salary_payouts status CHECK to include 'partially_paid'
ALTER TABLE public.salary_payouts DROP CONSTRAINT IF EXISTS salary_payouts_status_check;
ALTER TABLE public.salary_payouts ADD CONSTRAINT salary_payouts_status_check 
  CHECK (status IN ('draft', 'confirmed', 'paid', 'locked', 'partially_paid'));
