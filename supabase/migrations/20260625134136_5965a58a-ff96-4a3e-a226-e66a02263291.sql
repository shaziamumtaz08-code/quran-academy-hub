
-- B1. Salary linkage + temp cover fields
ALTER TABLE public.student_teacher_assignments
  ADD COLUMN IF NOT EXISTS salary_linked boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_temporary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS temp_start_date date,
  ADD COLUMN IF NOT EXISTS temp_end_date date,
  ADD COLUMN IF NOT EXISTS original_teacher_id uuid,
  ADD COLUMN IF NOT EXISTS original_assignment_id uuid REFERENCES public.student_teacher_assignments(id),
  ADD COLUMN IF NOT EXISTS auto_closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by_admin boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_sta_temp_active
  ON public.student_teacher_assignments(temp_end_date)
  WHERE is_temporary = true AND status = 'active';

-- B2. Schedule snapshot table for clean restoration
CREATE TABLE IF NOT EXISTS public.schedule_cover_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cover_assignment_id uuid NOT NULL REFERENCES public.student_teacher_assignments(id) ON DELETE CASCADE,
  original_assignment_id uuid NOT NULL,
  schedule_id uuid NOT NULL,
  original_assignment_snapshot uuid NOT NULL,
  snapshot_data jsonb NOT NULL,
  restored boolean NOT NULL DEFAULT false,
  restored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.schedule_cover_snapshots TO authenticated;
GRANT ALL ON public.schedule_cover_snapshots TO service_role;
ALTER TABLE public.schedule_cover_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage cover snapshots" ON public.schedule_cover_snapshots
  FOR ALL USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- B3. Open a Paid Leave Cover
CREATE OR REPLACE FUNCTION public.create_paid_leave_cover(
  _original_assignment_id uuid,
  _replacement_teacher_id uuid,
  _temp_start_date date,
  _temp_end_date date,
  _payout_amount numeric,
  _salary_linked boolean DEFAULT true,
  _reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _orig public.student_teacher_assignments%ROWTYPE;
  _cover_id uuid;
  _sched record;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _temp_end_date < _temp_start_date THEN
    RAISE EXCEPTION 'temp_end_date must be on or after temp_start_date';
  END IF;

  SELECT * INTO _orig FROM public.student_teacher_assignments
   WHERE id = _original_assignment_id;
  IF _orig.id IS NULL THEN RAISE EXCEPTION 'original assignment not found'; END IF;

  -- Insert replacement (temporary) assignment — original row stays active & on payroll
  INSERT INTO public.student_teacher_assignments(
    student_id, teacher_id, subject_id, division_id, branch_id,
    duration_minutes, payout_type, payout_amount, status,
    start_date, effective_from_date, effective_to_date,
    is_temporary, temp_start_date, temp_end_date,
    original_teacher_id, original_assignment_id,
    salary_linked, status_change_reason
  ) VALUES (
    _orig.student_id, _replacement_teacher_id, _orig.subject_id, _orig.division_id, _orig.branch_id,
    _orig.duration_minutes, _orig.payout_type, _payout_amount, 'active',
    _temp_start_date, _temp_start_date, _temp_end_date,
    true, _temp_start_date, _temp_end_date,
    _orig.teacher_id, _orig.id,
    _salary_linked, COALESCE(_reason,'Paid leave cover')
  ) RETURNING id INTO _cover_id;

  -- Reassign schedule rows + snapshot for restore
  FOR _sched IN
    SELECT * FROM public.schedules WHERE assignment_id = _original_assignment_id AND is_active = true
  LOOP
    INSERT INTO public.schedule_cover_snapshots(
      cover_assignment_id, original_assignment_id, schedule_id,
      original_assignment_snapshot, snapshot_data
    ) VALUES (_cover_id, _original_assignment_id, _sched.id, _original_assignment_id, to_jsonb(_sched));

    UPDATE public.schedules SET assignment_id = _cover_id WHERE id = _sched.id;
  END LOOP;

  RETURN jsonb_build_object('cover_assignment_id', _cover_id, 'snapshots_taken',
    (SELECT count(*) FROM public.schedule_cover_snapshots WHERE cover_assignment_id = _cover_id));
END; $$;

-- B4. Close a Paid Leave Cover
CREATE OR REPLACE FUNCTION public.close_paid_leave_cover(
  _cover_assignment_id uuid,
  _manual boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _cover public.student_teacher_assignments%ROWTYPE;
  _snap record;
  _restored int := 0;
BEGIN
  IF _manual AND NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO _cover FROM public.student_teacher_assignments WHERE id = _cover_assignment_id;
  IF _cover.id IS NULL OR _cover.is_temporary = false THEN
    RAISE EXCEPTION 'not a temporary cover assignment';
  END IF;
  IF _cover.status = 'completed' THEN
    RETURN jsonb_build_object('already_closed', true);
  END IF;

  -- Restore only the snapshotted schedules — never overwrite unrelated changes
  FOR _snap IN
    SELECT * FROM public.schedule_cover_snapshots
     WHERE cover_assignment_id = _cover_assignment_id AND restored = false
  LOOP
    UPDATE public.schedules
       SET assignment_id = _snap.original_assignment_snapshot
     WHERE id = _snap.schedule_id AND assignment_id = _cover_assignment_id;

    UPDATE public.schedule_cover_snapshots
       SET restored = true, restored_at = now()
     WHERE id = _snap.id;
    _restored := _restored + 1;
  END LOOP;

  UPDATE public.student_teacher_assignments
     SET status = 'completed',
         effective_to_date = COALESCE(effective_to_date, CURRENT_DATE),
         auto_closed_at = CASE WHEN _manual THEN auto_closed_at ELSE now() END,
         closed_by_admin = _manual,
         status_change_reason = CASE WHEN _manual
           THEN 'Cover closed manually' ELSE 'Cover auto-closed on end date' END
   WHERE id = _cover_assignment_id;

  RETURN jsonb_build_object('schedules_restored', _restored, 'manual', _manual);
END; $$;

-- B5. Extend cover by closing current temp and opening a new temp row
CREATE OR REPLACE FUNCTION public.extend_paid_leave_cover(
  _cover_assignment_id uuid,
  _new_temp_end_date date,
  _reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _cover public.student_teacher_assignments%ROWTYPE;
  _new_start date;
  _result jsonb;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO _cover FROM public.student_teacher_assignments WHERE id = _cover_assignment_id;
  IF _cover.id IS NULL OR _cover.is_temporary = false THEN
    RAISE EXCEPTION 'not a temporary cover assignment';
  END IF;
  IF _new_temp_end_date <= _cover.temp_end_date THEN
    RAISE EXCEPTION 'new end date must be after current temp_end_date';
  END IF;

  -- Close current temp row on its existing end date
  PERFORM public.close_paid_leave_cover(_cover_assignment_id, true);

  _new_start := _cover.temp_end_date + 1;

  _result := public.create_paid_leave_cover(
    _cover.original_assignment_id,
    _cover.teacher_id,
    _new_start,
    _new_temp_end_date,
    _cover.payout_amount,
    _cover.salary_linked,
    COALESCE(_reason, 'Extension of cover')
  );

  RETURN _result || jsonb_build_object('extended_from', _cover_assignment_id);
END; $$;

-- B6. Nightly auto-close
CREATE OR REPLACE FUNCTION public.auto_close_expired_covers()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _row record;
  _count int := 0;
BEGIN
  FOR _row IN
    SELECT id FROM public.student_teacher_assignments
     WHERE is_temporary = true AND status = 'active'
       AND temp_end_date < CURRENT_DATE
  LOOP
    PERFORM public.close_paid_leave_cover(_row.id, false);
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END; $$;
