
-- Cash Advances table
CREATE TABLE public.cash_advances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issued_to UUID NOT NULL REFERENCES public.profiles(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  purpose TEXT NOT NULL,
  remaining_balance NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled')),
  notes TEXT,
  branch_id UUID REFERENCES public.branches(id),
  division_id UUID REFERENCES public.divisions(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage cash_advances"
ON public.cash_advances FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = ANY(ARRAY['super_admin'::app_role, 'admin'::app_role, 'admin_fees'::app_role])
));

CREATE TRIGGER update_cash_advances_updated_at
BEFORE UPDATE ON public.cash_advances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cash Advance Transactions (expenses from advance + cash returns)
CREATE TABLE public.cash_advance_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  advance_id UUID NOT NULL REFERENCES public.cash_advances(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('expense', 'return')),
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_id UUID REFERENCES public.expenses(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_advance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage cash_advance_transactions"
ON public.cash_advance_transactions FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = ANY(ARRAY['super_admin'::app_role, 'admin'::app_role, 'admin_fees'::app_role])
));

-- Add advance_id to expenses for linking
ALTER TABLE public.expenses ADD COLUMN advance_id UUID REFERENCES public.cash_advances(id);
