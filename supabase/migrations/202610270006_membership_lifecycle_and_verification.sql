alter table public.memberships
  add column if not exists verification_token uuid not null default gen_random_uuid();

create unique index if not exists memberships_verification_token_idx
  on public.memberships (verification_token);

create function public.pause_own_membership()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to pause your membership.';
  end if;

  update public.memberships
  set status = 'suspended',
      sleep_until = null
  where user_id = auth.uid()
    and status = 'active';

  if not found then
    raise exception 'An active membership was not found.';
  end if;
end;
$$;

revoke all on function public.pause_own_membership() from public;
grant execute on function public.pause_own_membership() to authenticated;

create function public.verify_orbit_membership(p_token uuid)
returns table (member_name text, crew_number bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.full_name, memberships.crew_number
  from public.memberships
  join public.profiles on profiles.id = memberships.user_id
  where memberships.verification_token = p_token
    and memberships.status = 'active';
$$;

revoke all on function public.verify_orbit_membership(uuid) from public;
grant execute on function public.verify_orbit_membership(uuid) to anon, authenticated;
