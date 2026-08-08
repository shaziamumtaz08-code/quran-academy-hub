DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(format('%I', column_name), ', ')
    INTO cols
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='exams' AND column_name <> 'examiner_remarks';

  REVOKE SELECT ON public.exams FROM authenticated;
  EXECUTE format('GRANT SELECT (%s) ON public.exams TO authenticated', cols);
  REVOKE SELECT ON public.exams FROM anon;
END $$;

GRANT INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT ALL ON public.exams TO service_role;