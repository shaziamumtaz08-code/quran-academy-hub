-- Backfill NULL division_id on schedules from their assignment's division_id
UPDATE public.schedules s
SET division_id = sta.division_id
FROM public.student_teacher_assignments sta
WHERE s.assignment_id = sta.id
  AND s.division_id IS NULL
  AND sta.division_id IS NOT NULL;