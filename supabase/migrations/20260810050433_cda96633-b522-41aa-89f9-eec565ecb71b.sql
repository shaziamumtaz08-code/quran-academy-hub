do $$
declare cols text;
begin
  select string_agg(format('%I', column_name), ', ')
    into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'courses'
    and column_name <> 'webhook_secret';

  revoke select on public.courses from anon;
  revoke select on public.courses from authenticated;

  execute format('grant select (%s) on public.courses to anon', cols);
  execute format('grant select (%s) on public.courses to authenticated', cols);
end $$;

grant all on public.courses to service_role;
