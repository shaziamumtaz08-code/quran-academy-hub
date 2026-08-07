REVOKE ALL ON FUNCTION public.auto_generate_plan_invoices(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revise_billing_plan(uuid, uuid, integer, numeric, uuid, numeric, text, date, text, uuid, uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auto_generate_plan_invoices(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revise_billing_plan(uuid, uuid, integer, numeric, uuid, numeric, text, date, text, uuid, uuid, uuid, numeric) TO authenticated, service_role;