-- Break recursive RLS dependency between tickets and ticket_watchers
-- by moving cross-table checks into SECURITY DEFINER helper functions.

create or replace function public.is_ticket_watcher(_ticket_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ticket_watchers tw
    where tw.ticket_id = _ticket_id
      and tw.user_id = _user_id
  );
$$;

create or replace function public.is_ticket_participant(_ticket_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = _ticket_id
      and (t.creator_id = _user_id or t.assignee_id = _user_id)
  );
$$;

drop policy if exists "Watchers can view watched tickets" on public.tickets;
create policy "Watchers can view watched tickets"
on public.tickets
for select
using (public.is_ticket_watcher(id, auth.uid()));

drop policy if exists "Ticket participants can add watchers" on public.ticket_watchers;
create policy "Ticket participants can add watchers"
on public.ticket_watchers
for insert
with check (public.is_ticket_participant(ticket_id, auth.uid()));

drop policy if exists "Users can view watchers on their tickets" on public.ticket_watchers;
create policy "Users can view watchers on their tickets"
on public.ticket_watchers
for select
using (public.is_ticket_participant(ticket_id, auth.uid()) or user_id = auth.uid());