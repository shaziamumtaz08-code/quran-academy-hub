ALTER FUNCTION public.apply_schedule_period(uuid,time,time,integer,public.schedule_period_type,date,date,text) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.guard_schedule_period() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_student_grading_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_schedule_period() TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_student_grading_fields() TO service_role;