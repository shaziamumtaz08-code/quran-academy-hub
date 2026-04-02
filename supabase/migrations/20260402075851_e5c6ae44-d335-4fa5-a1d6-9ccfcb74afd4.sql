CREATE TABLE public.billing_plan_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.student_billing_plans(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id),
  effective_from TEXT NOT NULL,
  previous_values JSONB NOT NULL DEFAULT '{}',
  new_values JSONB NOT NULL DEFAULT '{}',
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_plan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage billing plan history"
ON public.billing_plan_history
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin_fees')
)
WITH CHECK (
  public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin_fees')
);

CREATE INDEX idx_billing_plan_history_plan_id ON public.billing_plan_history(plan_id);
CREATE INDEX idx_billing_plan_history_created_at ON public.billing_plan_history(created_at DESC);