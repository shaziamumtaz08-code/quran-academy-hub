create or replace function public.admin_set_zoom_webhook_token(_account_id uuid, _app_slug text, _secret_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and (role in ('admin','super_admin') or role::text like 'admin\_%')
  ) then
    raise exception 'Admin access required';
  end if;

  update public.zoom_accounts
     set webhook_app_slug = nullif(_app_slug,''),
         webhook_secret_token = nullif(_secret_token,''),
         updated_at = now()
   where id = _account_id;
end;
$$;

revoke all on function public.admin_set_zoom_webhook_token(uuid, text, text) from public, anon;
grant execute on function public.admin_set_zoom_webhook_token(uuid, text, text) to authenticated;