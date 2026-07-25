
create or replace function public.get_student_live_class(p_student_id uuid)
returns table (
  session_id uuid,
  teacher_id uuid,
  teacher_name text,
  assignment_id uuid,
  meeting_link text,
  actual_start timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Requester must be the student, a linked parent, or an admin
  if not (
    auth.uid() = p_student_id
    or is_admin(auth.uid())
    or is_super_admin(auth.uid())
    or exists (
      select 1 from student_parent_links spl
      where spl.student_id = p_student_id and spl.parent_id = auth.uid()
    )
  ) then
    return;
  end if;

  return query
  select ls.id,
         ls.teacher_id,
         p.full_name,
         ls.assignment_id,
         coalesce(za.meeting_link, zl.meeting_link),
         ls.actual_start
  from live_sessions ls
  left join zoom_accounts za on za.id = ls.zoom_account_id
  left join zoom_licenses zl on zl.id = ls.license_id
  left join profiles p on p.id = ls.teacher_id
  where ls.status = 'live'
    and ls.teacher_id in (
      select sta.teacher_id from student_teacher_assignments sta
      where sta.student_id = p_student_id and sta.status = 'active'
    )
  order by ls.actual_start desc nulls last
  limit 1;
end;
$$;

revoke execute on function public.get_student_live_class(uuid) from anon;
grant execute on function public.get_student_live_class(uuid) to authenticated;
