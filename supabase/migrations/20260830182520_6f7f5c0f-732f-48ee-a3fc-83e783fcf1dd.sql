GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_queue TO authenticated;
GRANT ALL ON public.notification_queue TO service_role;