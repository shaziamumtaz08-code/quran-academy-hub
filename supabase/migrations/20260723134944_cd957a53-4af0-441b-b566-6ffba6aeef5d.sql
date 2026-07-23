
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
                   r.nspname, r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- Grant anon access back only to intentionally public helpers
GRANT EXECUTE ON FUNCTION public.get_demo_by_share_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.list_public_quiz_banks_safe() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_quiz_bank_safe(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.normalize_phone(text, text) TO anon;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='submit_demo_feedback'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.submit_demo_feedback(%s) TO anon', r.args);
  END LOOP;
END $$;
