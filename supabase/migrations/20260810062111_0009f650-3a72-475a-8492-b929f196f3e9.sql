REVOKE EXECUTE ON FUNCTION public.mark_salary_payouts_for_revision(uuid, date, date, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_generate_plan_invoices(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_salary_payouts_for_revision(uuid, date, date, text) TO service_role;