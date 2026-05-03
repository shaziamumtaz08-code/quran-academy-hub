
DELETE FROM public.student_parent_links WHERE student_id = parent_id;

ALTER TABLE public.student_parent_links
  ADD CONSTRAINT student_parent_links_no_self_link CHECK (student_id <> parent_id);
