
create or replace function public.get_safe_profiles(p_ids uuid[])
returns table (id uuid, full_name text, email text, country text, city text, timezone text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.email, p.country, p.city, p.timezone
  from public.profiles p
  where p.id = any(p_ids)
    and (
      p.id = auth.uid()
      or is_admin(auth.uid())
      or is_super_admin(auth.uid())
      or (has_role(auth.uid(), 'parent'::app_role)
          and p.id in (select get_parent_children_ids(auth.uid())))
      or (has_role(auth.uid(), 'student'::app_role)
          and p.id in (select get_student_teacher_ids(auth.uid())))
      or (has_role(auth.uid(), 'teacher'::app_role)
          and p.id in (select sta.student_id from public.student_teacher_assignments sta
                       where sta.teacher_id = auth.uid()))
      or (has_role(auth.uid(), 'examiner'::app_role)
          and p.id in (select e.student_id from public.exams e where e.examiner_id = auth.uid()))
    );
$$;

drop view if exists public.profiles_safe;

revoke execute on function public.get_safe_profiles(uuid[]) from anon;
grant execute on function public.get_safe_profiles(uuid[]) to authenticated;
