create table if not exists public.orbit_chat_state (
  id boolean primary key default true check (id),
  cleared_at timestamptz not null default clock_timestamp(),
  cleared_by uuid references public.profiles (id) on delete set null,
  deleted_count integer not null default 0 check (deleted_count >= 0)
);

insert into public.orbit_chat_state (id)
values (true)
on conflict (id) do nothing;

alter table public.orbit_chat_state enable row level security;

revoke all on public.orbit_chat_state from anon, authenticated;
grant select on public.orbit_chat_state to authenticated;

drop policy if exists "Active ORBIT members and admins can read global chat state"
  on public.orbit_chat_state;
create policy "Active ORBIT members and admins can read global chat state"
on public.orbit_chat_state for select to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.memberships
    join public.communities on communities.id = memberships.community_id
    where memberships.user_id = (select auth.uid())
      and memberships.status = 'active'
      and communities.slug = 'orbit'
  )
);

create or replace function public.clear_orbit_global_chat()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_count integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Only an ORBIT administrator can clear global chat.';
  end if;

  lock table public.chat_messages in share row exclusive mode;

  delete from public.chat_messages;
  get diagnostics v_deleted_count = row_count;

  update public.orbit_chat_state
  set cleared_at = clock_timestamp(),
      cleared_by = auth.uid(),
      deleted_count = v_deleted_count
  where id = true;

  return v_deleted_count;
end;
$$;

revoke all on function public.clear_orbit_global_chat() from public, anon;
grant execute on function public.clear_orbit_global_chat() to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'orbit_chat_state'
     ) then
    execute 'alter publication supabase_realtime add table public.orbit_chat_state';
  end if;
end;
$$;
