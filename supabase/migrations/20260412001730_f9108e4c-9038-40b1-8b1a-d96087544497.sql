
ALTER TABLE public.course_class_staff
  ADD CONSTRAINT course_class_staff_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.course_class_students
  ADD CONSTRAINT course_class_students_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
