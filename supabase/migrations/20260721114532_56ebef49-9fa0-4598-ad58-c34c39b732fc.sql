DROP POLICY IF EXISTS "Authenticated users subscribe to own channels" ON realtime.messages;
CREATE POLICY "Authenticated users subscribe to own channels" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL AND (
      topic = 'user:' || (auth.uid())::text
      OR public.is_admin(auth.uid())
      OR public.is_super_admin(auth.uid())
    )
  );