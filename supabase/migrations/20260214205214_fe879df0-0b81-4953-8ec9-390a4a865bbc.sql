
-- ═══════════════════════════════════════════════════════════
-- SALARY ENGINE + EXPENSE MODULE TABLES
-- ═══════════════════════════════════════════════════════════

-- 1. Leave Events
CREATE TABLE public.leave_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id),
  leave_type text NOT NULL DEFAULT 'unpaid' CHECK (leave_type IN ('paid', 'unpaid')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  replacement_teacher_id uuid REFERENCES public.profiles(id),
  approved_by uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage leave_events" ON public.leave_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin', 'admin_academic'))
  );

CREATE POLICY "Teachers can view own leave_events" ON public.leave_events
  FOR SELECT USING (teacher_id = auth.uid());

-- 2. Extra Classes
CREATE TABLE public.extra_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id),
  student_id uuid REFERENCES public.profiles(id),
  assignment_id uuid REFERENCES public.student_teacher_assignments(id),
  class_date date NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  rate numeric NOT NULL DEFAULT 0,
  reason text,
  approved_by uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.extra_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage extra_classes" ON public.extra_classes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin', 'admin_fees'))
  );

CREATE POLICY "Teachers can view own extra_classes" ON public.extra_classes
  FOR SELECT USING (teacher_id = auth.uid());

-- 3. Salary Adjustments
CREATE TABLE public.salary_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id),
  salary_month text NOT NULL, -- YYYY-MM
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('bonus', 'deduction', 'expense', 'allowance')),
  amount numeric NOT NULL DEFAULT 0,
  reason text,
  expense_id uuid, -- optional link to expenses table
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage salary_adjustments" ON public.salary_adjustments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin', 'admin_fees'))
  );

CREATE POLICY "Teachers can view own salary_adjustments" ON public.salary_adjustments
  FOR SELECT USING (teacher_id = auth.uid());

-- 4. Salary Payouts
CREATE TABLE public.salary_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id),
  salary_month text NOT NULL, -- YYYY-MM
  base_salary numeric NOT NULL DEFAULT 0,
  extra_class_amount numeric NOT NULL DEFAULT 0,
  adjustment_amount numeric NOT NULL DEFAULT 0,
  expense_amount numeric NOT NULL DEFAULT 0,
  gross_salary numeric NOT NULL DEFAULT 0,
  deductions numeric NOT NULL DEFAULT 0,
  net_salary numeric NOT NULL DEFAULT 0,
  calculation_json jsonb, -- full breakdown for audit
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'paid', 'locked')),
  paid_at timestamptz,
  paid_by uuid REFERENCES public.profiles(id),
  payment_method text,
  payment_reference text,
  notes text,
  locked_at timestamptz,
  locked_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage salary_payouts" ON public.salary_payouts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin', 'admin_fees'))
  );

CREATE POLICY "Teachers can view own salary_payouts" ON public.salary_payouts
  FOR SELECT USING (teacher_id = auth.uid());

-- 5. Expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('allowance', 'zoom', 'admin_cost', 'gifts', 'maternity', 'operational', 'manual')),
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  teacher_id uuid REFERENCES public.profiles(id),
  student_id uuid REFERENCES public.profiles(id),
  receipt_url text,
  created_by uuid REFERENCES public.profiles(id),
  approved_by uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  notes text,
  branch_id uuid REFERENCES public.branches(id),
  division_id uuid REFERENCES public.divisions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage expenses" ON public.expenses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin', 'admin_fees'))
  );

-- Add foreign key from salary_adjustments to expenses
ALTER TABLE public.salary_adjustments
  ADD CONSTRAINT salary_adjustments_expense_id_fkey
  FOREIGN KEY (expense_id) REFERENCES public.expenses(id);

-- Indexes
CREATE INDEX idx_leave_events_teacher ON public.leave_events(teacher_id, start_date);
CREATE INDEX idx_extra_classes_teacher ON public.extra_classes(teacher_id, class_date);
CREATE INDEX idx_salary_payouts_teacher_month ON public.salary_payouts(teacher_id, salary_month);
CREATE INDEX idx_expenses_category ON public.expenses(category, expense_date);
CREATE INDEX idx_expenses_teacher ON public.expenses(teacher_id) WHERE teacher_id IS NOT NULL;
CREATE INDEX idx_salary_adjustments_teacher_month ON public.salary_adjustments(teacher_id, salary_month);
