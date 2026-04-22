create or replace function public.can_manage_course_content(_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    or public.has_role(auth.uid(), 'admin'::app_role)
    or public.has_role(auth.uid(), 'admin_academic'::app_role)
    or exists (
      select 1
      from public.courses c
      where c.id = _course_id
        and c.teacher_id = auth.uid()
    )
    or public.is_course_staff(auth.uid(), _course_id)
  )
$$;

create or replace function public.can_view_course_content(_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    public.can_manage_course_content(_course_id)
    or public.is_enrolled_in_course(auth.uid(), _course_id)
  )
$$;

create or replace function public.can_manage_content_kit(_kit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.content_kits ck
    left join public.session_plans sp on sp.id = ck.session_plan_id
    left join public.syllabi s on s.id = sp.syllabus_id
    where ck.id = _kit_id
      and (
        s.user_id = auth.uid()
        or public.can_manage_course_content(coalesce(ck.course_id, s.course_id))
      )
  )
$$;

create or replace function public.can_view_content_kit(_kit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.content_kits ck
    left join public.session_plans sp on sp.id = ck.session_plan_id
    left join public.syllabi s on s.id = sp.syllabus_id
    where ck.id = _kit_id
      and (
        s.user_id = auth.uid()
        or public.can_view_course_content(coalesce(ck.course_id, s.course_id))
      )
  )
$$;

drop policy if exists "Users can manage content kits" on public.content_kits;
create policy "Authorized users can view content kits"
on public.content_kits
for select
using (public.can_view_content_kit(id));
create policy "Authorized users can create content kits"
on public.content_kits
for insert
to authenticated
with check (
  exists (
    select 1
    from public.session_plans sp
    left join public.syllabi s on s.id = sp.syllabus_id
    where sp.id = content_kits.session_plan_id
      and (
        s.user_id = auth.uid()
        or public.can_manage_course_content(coalesce(content_kits.course_id, s.course_id))
      )
  )
);
create policy "Authorized users can update content kits"
on public.content_kits
for update
using (public.can_manage_content_kit(id))
with check (public.can_manage_content_kit(id));
create policy "Authorized users can delete content kits"
on public.content_kits
for delete
using (public.can_manage_content_kit(id));

drop policy if exists "Users can manage slides" on public.slides;
create policy "Authorized users can view slides"
on public.slides
for select
using (public.can_view_content_kit(kit_id));
create policy "Authorized users can create slides"
on public.slides
for insert
to authenticated
with check (public.can_manage_content_kit(kit_id));
create policy "Authorized users can update slides"
on public.slides
for update
using (public.can_manage_content_kit(kit_id))
with check (public.can_manage_content_kit(kit_id));
create policy "Authorized users can delete slides"
on public.slides
for delete
using (public.can_manage_content_kit(kit_id));

drop policy if exists "Users can manage flashcards" on public.flashcards;
create policy "Authorized users can view flashcards"
on public.flashcards
for select
using (public.can_view_content_kit(kit_id));
create policy "Authorized users can create flashcards"
on public.flashcards
for insert
to authenticated
with check (public.can_manage_content_kit(kit_id));
create policy "Authorized users can update flashcards"
on public.flashcards
for update
using (public.can_manage_content_kit(kit_id))
with check (public.can_manage_content_kit(kit_id));
create policy "Authorized users can delete flashcards"
on public.flashcards
for delete
using (public.can_manage_content_kit(kit_id));

drop policy if exists "Users can manage worksheets" on public.worksheets;
create policy "Authorized users can view worksheets"
on public.worksheets
for select
using (public.can_view_content_kit(kit_id));
create policy "Authorized users can create worksheets"
on public.worksheets
for insert
to authenticated
with check (public.can_manage_content_kit(kit_id));
create policy "Authorized users can update worksheets"
on public.worksheets
for update
using (public.can_manage_content_kit(kit_id))
with check (public.can_manage_content_kit(kit_id));
create policy "Authorized users can delete worksheets"
on public.worksheets
for delete
using (public.can_manage_content_kit(kit_id));

drop policy if exists "Users can manage quiz questions" on public.quiz_questions;
create policy "Authorized users can view quiz questions"
on public.quiz_questions
for select
using (public.can_view_content_kit(kit_id));
create policy "Authorized users can create quiz questions"
on public.quiz_questions
for insert
to authenticated
with check (public.can_manage_content_kit(kit_id));
create policy "Authorized users can update quiz questions"
on public.quiz_questions
for update
using (public.can_manage_content_kit(kit_id))
with check (public.can_manage_content_kit(kit_id));
create policy "Authorized users can delete quiz questions"
on public.quiz_questions
for delete
using (public.can_manage_content_kit(kit_id));

drop policy if exists "Users can manage kit shares" on public.kit_shares;
create policy "Authorized users can view kit shares"
on public.kit_shares
for select
using (
  public.can_view_content_kit(kit_id)
  or shared_by = auth.uid()
);
create policy "Authorized users can create kit shares"
on public.kit_shares
for insert
to authenticated
with check (
  shared_by = auth.uid()
  and public.can_manage_content_kit(kit_id)
);
create policy "Authorized users can update kit shares"
on public.kit_shares
for update
using (public.can_manage_content_kit(kit_id))
with check (public.can_manage_content_kit(kit_id));
create policy "Authorized users can delete kit shares"
on public.kit_shares
for delete
using (public.can_manage_content_kit(kit_id));

drop policy if exists "Users can manage quiz submissions" on public.quiz_submissions;
create policy "Authorized users can view own or course quiz submissions"
on public.quiz_submissions
for select
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.quiz_questions qq
    where qq.id = quiz_submissions.quiz_question_id
      and public.can_manage_content_kit(qq.kit_id)
  )
);
create policy "Students can create own quiz submissions"
on public.quiz_submissions
for insert
to authenticated
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.quiz_questions qq
    where qq.id = quiz_submissions.quiz_question_id
      and public.can_view_content_kit(qq.kit_id)
  )
);
create policy "Authorized users can update quiz submissions"
on public.quiz_submissions
for update
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.quiz_questions qq
    where qq.id = quiz_submissions.quiz_question_id
      and public.can_manage_content_kit(qq.kit_id)
  )
)
with check (
  student_id = auth.uid()
  or exists (
    select 1
    from public.quiz_questions qq
    where qq.id = quiz_submissions.quiz_question_id
      and public.can_manage_content_kit(qq.kit_id)
  )
);
create policy "Authorized users can delete quiz submissions"
on public.quiz_submissions
for delete
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.quiz_questions qq
    where qq.id = quiz_submissions.quiz_question_id
      and public.can_manage_content_kit(qq.kit_id)
  )
);

drop policy if exists "Authenticated users can create source files" on public.source_files;
drop policy if exists "Authenticated users can update source files" on public.source_files;
drop policy if exists "Authenticated users can view source files" on public.source_files;
create policy "Authorized users can view source files"
on public.source_files
for select
using (public.can_view_course_content(course_id));
create policy "Authorized users can create source files"
on public.source_files
for insert
to authenticated
with check (public.can_manage_course_content(course_id));
create policy "Authorized users can update source files"
on public.source_files
for update
using (public.can_manage_course_content(course_id))
with check (public.can_manage_course_content(course_id));