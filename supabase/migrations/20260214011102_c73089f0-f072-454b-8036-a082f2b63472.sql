
-- Create billing_cycle enum
CREATE TYPE public.billing_cycle AS ENUM ('monthly', 'quarterly', 'one_time');

-- Create discount_type enum
CREATE TYPE public.discount_type AS ENUM ('percentage', 'fixed_amount');

-- Create fee_packages table
CREATE TABLE public.fee_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES public.branches(id),
  division_id UUID REFERENCES public.divisions(id),
  name TEXT NOT NULL,
  subject_id UUID REFERENCES public.subjects(id),
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_cycle public.billing_cycle NOT NULL DEFAULT 'monthly',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create discount_rules table
CREATE TABLE public.discount_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES public.branches(id),
  division_id UUID REFERENCES public.divisions(id),
  name TEXT NOT NULL,
  type public.discount_type NOT NULL DEFAULT 'percentage',
  value DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fee_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies for fee_packages
CREATE POLICY "Super admins and admins can view fee packages"
  ON public.fee_packages FOR SELECT
  USING (
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Super admins can manage fee packages"
  ON public.fee_packages FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- RLS policies for discount_rules
CREATE POLICY "Super admins and admins can view discount rules"
  ON public.discount_rules FOR SELECT
  USING (
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Super admins can manage discount rules"
  ON public.discount_rules FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Timestamps triggers
CREATE TRIGGER update_fee_packages_updated_at
  BEFORE UPDATE ON public.fee_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_discount_rules_updated_at
  BEFORE UPDATE ON public.discount_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
