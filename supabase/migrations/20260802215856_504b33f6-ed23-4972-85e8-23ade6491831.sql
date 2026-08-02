
create or replace function public.fn_is_grading_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.role() = 'service_role', false)
      or public.has_role(auth.uid(), 'teacher')
      or public.has_role(auth.uid(), 'examiner')
      or public.has_role(auth.uid(), 'admin')
      or public.has_role(auth.uid(), 'super_admin')
      or public.has_role(auth.uid(), 'admin_academic');
$$;

create or replace function public.fn_guard_quiz_attempt_scores()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.fn_is_grading_staff() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.score := null;
    new.max_score := null;
    new.percentage := null;
    if new.status is distinct from 'in_progress' then
      new.status := 'submitted';
    end if;
  else
    new.score := old.score;
    new.max_score := old.max_score;
    new.percentage := old.percentage;
    if old.status in ('graded','marked','completed') then
      new.status := old.status;
    elsif new.status not in ('in_progress','submitted') then
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.fn_guard_exam_submission_scores()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.fn_is_grading_staff() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.total_score := null;
    new.percentage := null;
    new.passed := null;
    if new.status is distinct from 'in_progress' then
      new.status := 'submitted';
    end if;
  else
    new.total_score := old.total_score;
    new.percentage := old.percentage;
    new.passed := old.passed;
    new.total_possible := old.total_possible;
    if old.status in ('marked','graded') then
      new.status := old.status;
    elsif new.status not in ('in_progress','submitted') then
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_course_quiz_attempt_scores on public.course_quiz_attempts;
create trigger trg_guard_course_quiz_attempt_scores
before insert or update on public.course_quiz_attempts
for each row execute function public.fn_guard_quiz_attempt_scores();

drop trigger if exists trg_guard_quiz_attempt_scores on public.quiz_attempts;
create trigger trg_guard_quiz_attempt_scores
before insert or update on public.quiz_attempts
for each row execute function public.fn_guard_quiz_attempt_scores();

drop trigger if exists trg_guard_teaching_exam_submission_scores on public.teaching_exam_submissions;
create trigger trg_guard_teaching_exam_submission_scores
before insert or update on public.teaching_exam_submissions
for each row execute function public.fn_guard_exam_submission_scores();
