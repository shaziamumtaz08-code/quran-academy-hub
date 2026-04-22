BEGIN;

DROP POLICY IF EXISTS "Authenticated users can update at-risk flags" ON public.at_risk_flags;
DROP POLICY IF EXISTS "Authenticated users can view at-risk flags" ON public.at_risk_flags;
DROP POLICY IF EXISTS "Insert at-risk flags - admin/assigned teacher" ON public.at_risk_flags;
DROP POLICY IF EXISTS "Admins and assigned teachers can update at-risk flags" ON public.at_risk_flags;
DROP POLICY IF EXISTS "Admins and assigned teachers can view at-risk flags" ON public.at_risk_flags;

DROP POLICY IF EXISTS "Authenticated view assessment insights" ON public.assessment_insights;

COMMIT;