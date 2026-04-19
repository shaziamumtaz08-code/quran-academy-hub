-- Add relationship column for guardian links
ALTER TABLE public.student_parent_links
  ADD COLUMN IF NOT EXISTS relationship text;

COMMENT ON COLUMN public.student_parent_links.relationship IS 'Relationship of the linked guardian to the student (Mother, Father, Grandmother, Grandfather, Uncle, Aunt, Sibling, Other).';

-- Bug 2 fix: Remove erroneous "parent" role from profiles that are actually students
-- (created during sibling/shared-email migration). Affects only profiles holding BOTH
-- student AND parent role.
DELETE FROM public.user_roles
WHERE role = 'parent'
  AND user_id IN (
    SELECT user_id FROM public.user_roles WHERE role = 'student'
    INTERSECT
    SELECT user_id FROM public.user_roles WHERE role = 'parent'
  );