
drop policy if exists "Examiners view assigned exam student profiles" on public.profiles;
drop policy if exists "Parents can view children profiles" on public.profiles;
drop policy if exists "Students view assigned teacher profiles" on public.profiles;
drop policy if exists "Teachers view assigned student profiles" on public.profiles;

create or replace view public.profiles_safe
with (security_barrier = true) as
select p.id,
       p.full_name,
       p.display_name,
       p.email,
       p.gender,
       p.country,
       p.city,
       p.timezone,
       p.registration_id,
       p.account_status,
       p.archived_at
from public.profiles p
where
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
      and p.id in (select e.student_id from public.exams e where e.examiner_id = auth.uid()));

grant select on public.profiles_safe to authenticated;

create or replace function public.get_safe_profiles(p_ids uuid[])
returns table (id uuid, full_name text, email text, country text, city text, timezone text)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.full_name, s.email, s.country, s.city, s.timezone
  from public.profiles_safe s
  where s.id = any(p_ids);
$$;

revoke execute on function public.get_safe_profiles(uuid[]) from anon;
grant execute on function public.get_safe_profiles(uuid[]) to authenticated;

revoke select on public.courses from anon;
do $$
declare cols text;
begin
  select string_agg(format('%I', column_name), ', ')
    into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'courses'
    and column_name <> 'webhook_secret';
  execute format('grant select (%s) on public.courses to anon', cols);
end $$;
