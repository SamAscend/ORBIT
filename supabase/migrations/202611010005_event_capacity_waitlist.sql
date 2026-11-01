alter table public.event_registrations
  drop constraint if exists event_registrations_status_check;

alter table public.event_registrations
  add constraint event_registrations_status_check
  check (status in ('registered', 'waitlisted', 'cancelled'));

alter table public.event_registrations
  add column if not exists waitlisted_at timestamptz;

update public.event_registrations
set waitlisted_at = created_at
where status = 'waitlisted'
  and waitlisted_at is null;

create index if not exists event_registrations_waitlist_order_idx
  on public.event_registrations (event_id, waitlisted_at, id)
  where status = 'waitlisted';

revoke insert, update, delete on public.event_registrations from authenticated;
grant select on public.event_registrations to authenticated;

create or replace function public.promote_orbit_event_waitlist(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_registered_count integer;
  v_promoted_count integer := 0;
  v_registration_id uuid;
begin
  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found or v_event.status <> 'open' then
    return 0;
  end if;

  select count(*) into v_registered_count
  from public.event_registrations
  where event_id = p_event_id
    and status = 'registered';

  loop
    exit when v_event.capacity is not null
      and v_registered_count >= v_event.capacity;

    select registrations.id into v_registration_id
    from public.event_registrations as registrations
    join public.memberships
      on memberships.user_id = registrations.user_id
      and memberships.community_id = v_event.community_id
    where registrations.event_id = p_event_id
      and registrations.status = 'waitlisted'
      and memberships.status = 'active'
      and (memberships.sleep_until is null or memberships.sleep_until <= now())
    order by registrations.waitlisted_at, registrations.created_at, registrations.id
    for update of registrations skip locked
    limit 1;

    exit when not found;

    update public.event_registrations
    set status = 'registered',
        waitlisted_at = null
    where id = v_registration_id;

    v_registered_count := v_registered_count + 1;
    v_promoted_count := v_promoted_count + 1;
  end loop;

  return v_promoted_count;
end;
$$;

revoke all on function public.promote_orbit_event_waitlist(uuid) from public, anon, authenticated;

create or replace function public.join_orbit_event(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_event public.events%rowtype;
  v_registration public.event_registrations%rowtype;
  v_registered_count integer;
  v_waitlist_count integer;
  v_next_status text;
  v_has_registration boolean;
begin
  if v_user_id is null or public.is_platform_admin() then
    raise exception 'An ORBIT member account is required to join events.';
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found or v_event.status <> 'open' then
    raise exception 'This event is no longer open for registration.';
  end if;

  if not exists (
    select 1
    from public.memberships
    where memberships.community_id = v_event.community_id
      and memberships.user_id = v_user_id
      and memberships.status = 'active'
      and (memberships.sleep_until is null or memberships.sleep_until <= now())
  ) then
    raise exception 'An active, awake membership is required to join this event.';
  end if;

  perform public.promote_orbit_event_waitlist(p_event_id);

  select * into v_registration
  from public.event_registrations
  where event_id = p_event_id
    and user_id = v_user_id
  for update;
  v_has_registration := found;

  if v_has_registration and v_registration.status in ('registered', 'waitlisted') then
    return v_registration.status;
  end if;

  select count(*) into v_registered_count
  from public.event_registrations
  where event_id = p_event_id
    and status = 'registered';

  select count(*) into v_waitlist_count
  from public.event_registrations as registrations
  join public.memberships
    on memberships.user_id = registrations.user_id
    and memberships.community_id = v_event.community_id
  where registrations.event_id = p_event_id
    and registrations.status = 'waitlisted'
    and memberships.status = 'active'
    and (memberships.sleep_until is null or memberships.sleep_until <= now());

  v_next_status := case
    when v_event.capacity is not null and v_registered_count >= v_event.capacity
      then 'waitlisted'
    when v_waitlist_count > 0
      then 'waitlisted'
    else 'registered'
  end;

  if v_has_registration then
    update public.event_registrations
    set status = v_next_status,
        waitlisted_at = case when v_next_status = 'waitlisted' then clock_timestamp() else null end
    where id = v_registration.id;
  else
    insert into public.event_registrations (event_id, user_id, status, waitlisted_at)
    values (
      p_event_id,
      v_user_id,
      v_next_status,
      case when v_next_status = 'waitlisted' then clock_timestamp() else null end
    );
  end if;

  return v_next_status;
end;
$$;

create or replace function public.leave_orbit_event(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_registration public.event_registrations%rowtype;
  v_previous_status text;
  v_promoted_count integer := 0;
begin
  if v_user_id is null or public.is_platform_admin() then
    raise exception 'An ORBIT member account is required to leave an event.';
  end if;

  perform 1
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'This event could not be found.';
  end if;

  select * into v_registration
  from public.event_registrations
  where event_id = p_event_id
    and user_id = v_user_id
  for update;

  if not found or v_registration.status not in ('registered', 'waitlisted') then
    raise exception 'You are not registered or waitlisted for this event.';
  end if;

  v_previous_status := v_registration.status;

  update public.event_registrations
  set status = 'cancelled',
      waitlisted_at = null
  where id = v_registration.id;

  if v_previous_status = 'registered' then
    v_promoted_count := public.promote_orbit_event_waitlist(p_event_id);
  end if;

  return v_promoted_count;
end;
$$;

revoke all on function public.join_orbit_event(uuid) from public, anon;
grant execute on function public.join_orbit_event(uuid) to authenticated;

revoke all on function public.leave_orbit_event(uuid) from public, anon;
grant execute on function public.leave_orbit_event(uuid) to authenticated;

create or replace function public.get_orbit_event_availability()
returns table (
  event_id uuid,
  registered_count bigint,
  waitlist_count bigint,
  my_status text,
  my_waitlist_position bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    events.id,
    (
      select count(*)
      from public.event_registrations as registrations
      where registrations.event_id = events.id
        and registrations.status = 'registered'
    ),
    (
      select count(*)
      from public.event_registrations as registrations
      where registrations.event_id = events.id
        and registrations.status = 'waitlisted'
    ),
    (
      select registrations.status
      from public.event_registrations as registrations
      where registrations.event_id = events.id
        and registrations.user_id = (select auth.uid())
        and registrations.status in ('registered', 'waitlisted')
    ),
    case when exists (
      select 1
      from public.event_registrations as own_registration
      where own_registration.event_id = events.id
        and own_registration.user_id = (select auth.uid())
        and own_registration.status = 'waitlisted'
    ) then (
      select count(*)
      from public.event_registrations as position
      join public.event_registrations as own_registration
        on own_registration.event_id = position.event_id
        and own_registration.user_id = (select auth.uid())
        and own_registration.status = 'waitlisted'
      where position.event_id = events.id
        and position.status = 'waitlisted'
        and (
          position.waitlisted_at < own_registration.waitlisted_at
          or (
            position.waitlisted_at = own_registration.waitlisted_at
            and position.id <= own_registration.id
          )
        )
    ) end
  from public.events
  where public.is_platform_admin()
    or exists (
      select 1
      from public.memberships
      where memberships.community_id = events.community_id
        and memberships.user_id = (select auth.uid())
        and memberships.status = 'active'
        and (memberships.sleep_until is null or memberships.sleep_until <= now())
    );
$$;

revoke all on function public.get_orbit_event_availability() from public, anon;
grant execute on function public.get_orbit_event_availability() to authenticated;

create or replace function public.guard_orbit_event_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registered_count integer;
begin
  if new.capacity is distinct from old.capacity and new.capacity is not null then
    select count(*) into v_registered_count
    from public.event_registrations
    where event_id = old.id
      and status = 'registered';

    if new.capacity < v_registered_count then
      raise exception 'Event capacity cannot be lower than the number of confirmed attendees (%).', v_registered_count;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_orbit_event_capacity() from public, anon, authenticated;

drop trigger if exists guard_orbit_event_capacity on public.events;
create trigger guard_orbit_event_capacity
  before update of capacity on public.events
  for each row execute function public.guard_orbit_event_capacity();

create or replace function public.promote_waitlist_after_capacity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.capacity is distinct from old.capacity then
    perform public.promote_orbit_event_waitlist(new.id);
  end if;

  return new;
end;
$$;

revoke all on function public.promote_waitlist_after_capacity_change() from public, anon, authenticated;

drop trigger if exists promote_waitlist_after_capacity_change on public.events;
create trigger promote_waitlist_after_capacity_change
  after update of capacity on public.events
  for each row execute function public.promote_waitlist_after_capacity_change();
