DROP INDEX IF EXISTS public.idx_sta_teacher_active;
DROP INDEX IF EXISTS public.idx_sta_student_active;

ALTER TYPE public.assignment_status RENAME TO assignment_status_old;
CREATE TYPE public.assignment_status AS ENUM ('active', 'on_hold', 'completed', 'left');

ALTER TABLE public.student_teacher_assignments
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.assignment_status USING status::text::public.assignment_status,
  ALTER COLUMN status SET DEFAULT 'active'::public.assignment_status;

DROP TYPE public.assignment_status_old;

CREATE INDEX idx_sta_teacher_active ON public.student_teacher_assignments USING btree (teacher_id, status) WHERE (status = 'active'::public.assignment_status);
CREATE INDEX idx_sta_student_active ON public.student_teacher_assignments USING btree (student_id, status) WHERE (status = 'active'::public.assignment_status);

ALTER TABLE public.student_teacher_assignments
  ADD CONSTRAINT student_teacher_assignments_status_check
  CHECK (status = ANY (ARRAY['active'::public.assignment_status, 'on_hold'::public.assignment_status, 'completed'::public.assignment_status, 'left'::public.assignment_status]));