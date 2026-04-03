
CREATE TABLE public.holidays (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_date date NOT NULL,
  name text NOT NULL,
  is_recurring boolean NOT NULL DEFAULT false,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  division_id uuid REFERENCES public.divisions(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_holidays_date ON public.holidays (holiday_date);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view holidays"
ON public.holidays FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage holidays"
ON public.holidays FOR ALL
USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

CREATE TRIGGER update_holidays_updated_at
BEFORE UPDATE ON public.holidays
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
