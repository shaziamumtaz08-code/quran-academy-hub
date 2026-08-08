
-- 1. Add nullable assignment_id columns
ALTER TABLE public.course_quizzes ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.student_teacher_assignments(id) ON DELETE CASCADE;
ALTER TABLE public.course_lesson_plans ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.student_teacher_assignments(id) ON DELETE CASCADE;
ALTER TABLE public.quiz_banks ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.student_teacher_assignments(id) ON DELETE SET NULL;
ALTER TABLE public.syllabi ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.student_teacher_assignments(id) ON DELETE SET NULL;
ALTER TABLE public.course_outlines ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.student_teacher_assignments(id) ON DELETE SET NULL;
ALTER TABLE public.content_kits ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.student_teacher_assignments(id) ON DELETE SET NULL;
ALTER TABLE public.speaking_drills ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.student_teacher_assignments(id) ON DELETE SET NULL;
ALTER TABLE public.session_playlists ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.student_teacher_assignments(id) ON DELETE SET NULL;

-- 2. Relax NOT NULL on course_id where an assignment can stand in
ALTER TABLE public.course_quizzes ALTER COLUMN course_id DROP NOT NULL;
ALTER TABLE public.course_lesson_plans ALTER COLUMN course_id DROP NOT NULL;

-- 3. Exactly-one constraints (strict) for the two newly-nullable tables
ALTER TABLE public.course_quizzes DROP CONSTRAINT IF EXISTS course_quizzes_scope_chk;
ALTER TABLE public.course_quizzes ADD CONSTRAINT course_quizzes_scope_chk CHECK (num_nonnulls(course_id, assignment_id) = 1);
ALTER TABLE public.course_lesson_plans DROP CONSTRAINT IF EXISTS course_lesson_plans_scope_chk;
ALTER TABLE public.course_lesson_plans ADD CONSTRAINT course_lesson_plans_scope_chk CHECK (num_nonnulls(course_id, assignment_id) = 1);

-- 4. Mutual-exclusion (never both) for tables that already allowed a null course_id
ALTER TABLE public.quiz_banks DROP CONSTRAINT IF EXISTS quiz_banks_scope_chk;
ALTER TABLE public.quiz_banks ADD CONSTRAINT quiz_banks_scope_chk CHECK (num_nonnulls(course_id, assignment_id) <= 1);
ALTER TABLE public.syllabi DROP CONSTRAINT IF EXISTS syllabi_scope_chk;
ALTER TABLE public.syllabi ADD CONSTRAINT syllabi_scope_chk CHECK (num_nonnulls(course_id, assignment_id) <= 1);
ALTER TABLE public.course_outlines DROP CONSTRAINT IF EXISTS course_outlines_scope_chk;
ALTER TABLE public.course_outlines ADD CONSTRAINT course_outlines_scope_chk CHECK (num_nonnulls(course_id, assignment_id) <= 1);
ALTER TABLE public.content_kits DROP CONSTRAINT IF EXISTS content_kits_scope_chk;
ALTER TABLE public.content_kits ADD CONSTRAINT content_kits_scope_chk CHECK (num_nonnulls(course_id, assignment_id) <= 1);
ALTER TABLE public.speaking_drills DROP CONSTRAINT IF EXISTS speaking_drills_scope_chk;
ALTER TABLE public.speaking_drills ADD CONSTRAINT speaking_drills_scope_chk CHECK (num_nonnulls(course_id, assignment_id) <= 1);
ALTER TABLE public.session_playlists DROP CONSTRAINT IF EXISTS session_playlists_scope_chk;
ALTER TABLE public.session_playlists ADD CONSTRAINT session_playlists_scope_chk CHECK (num_nonnulls(course_id, assignment_id) <= 1);

CREATE INDEX IF NOT EXISTS idx_course_quizzes_assignment ON public.course_quizzes(assignment_id);
CREATE INDEX IF NOT EXISTS idx_course_lesson_plans_assignment ON public.course_lesson_plans(assignment_id);
CREATE INDEX IF NOT EXISTS idx_quiz_banks_assignment ON public.quiz_banks(assignment_id);
CREATE INDEX IF NOT EXISTS idx_syllabi_assignment ON public.syllabi(assignment_id);

-- 5. Helper functions
CREATE OR REPLACE FUNCTION public.is_assignment_teacher(_user_id uuid, _assignment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _assignment_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.student_teacher_assignments a
    WHERE a.id = _assignment_id
      AND (a.teacher_id = _user_id OR a.original_teacher_id = _user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_assignment_student(_user_id uuid, _assignment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _assignment_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.student_teacher_assignments a
    WHERE a.id = _assignment_id
      AND (
        a.student_id = _user_id
        OR a.student_id IN (SELECT public.get_parent_children_ids(_user_id))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_assignment_teacher(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_assignment_student(uuid, uuid) TO authenticated;

-- 6. Additive RLS policies for assignment-scoped rows
CREATE POLICY "assignment_staff_manage_lesson_plans" ON public.course_lesson_plans
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_assignment_teacher(auth.uid(), assignment_id))
  WITH CHECK (public.is_assignment_teacher(auth.uid(), assignment_id));

CREATE POLICY "assignment_student_view_lesson_plans" ON public.course_lesson_plans
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_assignment_student(auth.uid(), assignment_id));

CREATE POLICY "assignment_staff_manage_quizzes" ON public.course_quizzes
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_assignment_teacher(auth.uid(), assignment_id))
  WITH CHECK (public.is_assignment_teacher(auth.uid(), assignment_id));

CREATE POLICY "assignment_student_view_quizzes" ON public.course_quizzes
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_assignment_student(auth.uid(), assignment_id) AND status = 'published');

CREATE POLICY "assignment_staff_manage_outlines" ON public.course_outlines
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_assignment_teacher(auth.uid(), assignment_id))
  WITH CHECK (public.is_assignment_teacher(auth.uid(), assignment_id));

CREATE POLICY "assignment_staff_manage_speaking_drills" ON public.speaking_drills
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_assignment_teacher(auth.uid(), assignment_id))
  WITH CHECK (public.is_assignment_teacher(auth.uid(), assignment_id));

CREATE POLICY "assignment_student_view_content_kits" ON public.content_kits
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_assignment_student(auth.uid(), assignment_id));

CREATE POLICY "assignment_staff_view_content_kits" ON public.content_kits
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_assignment_teacher(auth.uid(), assignment_id));
