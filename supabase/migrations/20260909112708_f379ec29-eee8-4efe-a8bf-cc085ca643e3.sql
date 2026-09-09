create or replace function public.profile_privileged_fields_unchanged(
  _id uuid,
  _gov_id_verified boolean,
  _account_status text,
  _cv_status public.cv_review_status,
  _banking_status public.banking_verify_status,
  _default_payout_rate numeric
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin','super_admin','admin_division','admin_academic','admin_admissions','admin_fees')
  )
  or exists (
    select 1 from public.profiles p
    where p.id = _id
      and p.gov_id_verified is not distinct from _gov_id_verified
      and p.account_status is not distinct from _account_status
      and p.cv_status is not distinct from _cv_status
      and p.banking_status is not distinct from _banking_status
      and p.default_payout_rate is not distinct from _default_payout_rate
  );
$$;

revoke all on function public.profile_privileged_fields_unchanged(uuid, boolean, text, public.cv_review_status, public.banking_verify_status, numeric) from public, anon;
grant execute on function public.profile_privileged_fields_unchanged(uuid, boolean, text, public.cv_review_status, public.banking_verify_status, numeric) to authenticated, service_role;

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and public.profile_privileged_fields_unchanged(
    id, gov_id_verified, account_status, cv_status, banking_status, default_payout_rate
  )
);