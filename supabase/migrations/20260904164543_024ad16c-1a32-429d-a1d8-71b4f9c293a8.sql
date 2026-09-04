-- ============================================================
-- 1) Recording status: canonical success = 'completed'.
--    Legacy 'saved' rows remain valid for compatibility.
-- ============================================================
ALTER TABLE public.vcr_call_recordings
  DROP CONSTRAINT IF EXISTS vcr_call_recordings_status_check;
ALTER TABLE public.vcr_call_recordings
  ADD CONSTRAINT vcr_call_recordings_status_check
  CHECK (status IN ('recording', 'completed', 'saved', 'failed')) NOT VALID;
ALTER TABLE public.vcr_call_recordings VALIDATE CONSTRAINT vcr_call_recordings_status_check;

-- Only real teaching staff may open a recording row, and only as themselves.
DROP POLICY IF EXISTS recordings_insert_teacher ON public.vcr_call_recordings;
CREATE POLICY recordings_insert_teacher
  ON public.vcr_call_recordings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND teacher_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'teacher'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- ============================================================
-- 2) Storage upload: bind every upload to the caller's own
--    in-progress recording row. Bucket stays private; the
--    existing participant/admin read policy is untouched.
-- ============================================================
DROP POLICY IF EXISTS vcr_rec_upload_staff ON storage.objects;
CREATE POLICY vcr_rec_upload_staff
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vcr-call-recordings'
    AND (
      public.has_role(auth.uid(), 'teacher'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
    AND EXISTS (
      SELECT 1
      FROM public.vcr_call_recordings r
      WHERE r.storage_path = objects.name
        AND r.created_by = auth.uid()
        AND r.teacher_id = auth.uid()
        AND r.status = 'recording'
    )
  );

-- ============================================================
-- 3) can_observe_vcr: authenticated callers only.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.can_observe_vcr(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_observe_vcr(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_observe_vcr(uuid) TO authenticated, service_role;

-- ============================================================
-- 4) Observer stamping: least-privilege, DB-side.
--    Updates ONLY observer_id / observer_joined / updated_at on
--    the open log for the room, and only for an authorised observer.
-- ============================================================
CREATE OR REPLACE FUNCTION public.vcr_stamp_observer_joined(_room_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid     uuid := auth.uid();
  _log_id  uuid;
  _student uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT l.id, COALESCE(l.student_id, l.room_id)
    INTO _log_id, _student
  FROM public.vcr_call_logs l
  WHERE l.room_id = _room_id
    AND l.ended_at IS NULL
  ORDER BY l.started_at DESC
  LIMIT 1;

  IF _log_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT public.can_observe_vcr(_student) THEN
    RAISE EXCEPTION 'Not authorised to observe this call' USING ERRCODE = '42501';
  END IF;

  UPDATE public.vcr_call_logs
     SET observer_id     = _uid,
         observer_joined = true,
         updated_at      = now()
   WHERE id = _log_id;

  RETURN _log_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vcr_stamp_observer_joined(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.vcr_stamp_observer_joined(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.vcr_stamp_observer_joined(uuid) TO authenticated, service_role;

-- Observers may read the log they were stamped on (additive, permissive).
DROP POLICY IF EXISTS vcr_call_logs_select_observer ON public.vcr_call_logs;
CREATE POLICY vcr_call_logs_select_observer
  ON public.vcr_call_logs
  FOR SELECT
  TO authenticated
  USING (observer_id = auth.uid());

-- Participants' edits may not re-home the row to someone else.
DROP POLICY IF EXISTS vcr_call_logs_update_participants ON public.vcr_call_logs;
CREATE POLICY vcr_call_logs_update_participants
  ON public.vcr_call_logs
  FOR UPDATE
  TO authenticated
  USING (
    initiator_id = auth.uid()
    OR peer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    initiator_id = auth.uid()
    OR peer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );