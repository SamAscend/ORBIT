create table public.event_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  event_title text not null,
  kind text not null check (kind in (
    'registration_confirmed',
    'waitlisted',
    'waitlist_promoted',
    'event_updated',
    'event_cancelled',
    'event_reminder'
  )),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index event_notifications_user_created_idx
  on public.event_notifications (user_id, created_at desc);
create unique index event_notifications_reminder_once_idx
  on public.event_notifications (event_id, user_id)
  where kind = 'event_reminder';

alter table public.event_notifications enable row level security;
revoke all on public.event_notifications from anon, authenticated;
grant select on public.event_notifications to authenticated;
grant select on public.event_notifications to service_role;
grant update (read_at) on public.event_notifications to authenticated;

create policy "Users can read their own event notifications"
on public.event_notifications for select to authenticated
using (
  user_id = (select auth.uid())
  and public.is_orbit_authenticated_session()
);

create policy "Users can mark their own event notifications as read"
on public.event_notifications for update to authenticated
using (
  user_id = (select auth.uid())
  and public.is_orbit_authenticated_session()
)
with check (
  user_id = (select auth.uid())
  and public.is_orbit_authenticated_session()
  and read_at is not null
);

create table public.event_notification_emails (
  notification_id uuid primary key references public.event_notifications (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text
);

create index event_notification_emails_pending_idx
  on public.event_notification_emails (next_attempt_at)
  where status = 'pending';

alter table public.event_notification_emails enable row level security;
revoke all on public.event_notification_emails from public, anon, authenticated;
grant all on public.event_notification_emails to service_role;

create or replace function public.enqueue_orbit_event_notification_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.event_notification_emails (notification_id)
  values (new.id);
  return new;
end;
$$;

revoke all on function public.enqueue_orbit_event_notification_email() from public, anon, authenticated;

create trigger enqueue_orbit_event_notification_email
  after insert on public.event_notifications
  for each row execute function public.enqueue_orbit_event_notification_email();

create or replace function public.create_orbit_event_notification(
  p_user_id uuid,
  p_event_id uuid,
  p_kind text,
  p_event_title text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notification_id uuid;
  v_event_title text;
begin
  if p_kind not in (
    'registration_confirmed',
    'waitlisted',
    'waitlist_promoted',
    'event_updated',
    'event_cancelled',
    'event_reminder'
  ) then
    raise exception 'Unsupported ORBIT event notification type.';
  end if;

  select events.title into v_event_title
  from public.events
  where events.id = p_event_id;

  insert into public.event_notifications (user_id, event_id, event_title, kind)
  values (
    p_user_id,
    p_event_id,
    coalesce(p_event_title, v_event_title, 'ORBIT event'),
    p_kind
  )
  on conflict do nothing
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

revoke all on function public.create_orbit_event_notification(uuid, uuid, text, text)
  from public, anon, authenticated;

create or replace function public.notify_orbit_event_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
begin
  if new.status not in ('registered', 'waitlisted') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_kind := case new.status
      when 'registered' then 'registration_confirmed'
      else 'waitlisted'
    end;
  elsif old.status is distinct from new.status then
    v_kind := case
      when old.status = 'waitlisted' and new.status = 'registered' then 'waitlist_promoted'
      when new.status = 'registered' then 'registration_confirmed'
      else 'waitlisted'
    end;
  else
    return new;
  end if;

  perform public.create_orbit_event_notification(
    new.user_id,
    new.event_id,
    v_kind
  );
  return new;
end;
$$;

revoke all on function public.notify_orbit_event_registration() from public, anon, authenticated;

create trigger notify_orbit_event_registration
  after insert or update of status on public.event_registrations
  for each row execute function public.notify_orbit_event_registration();

create or replace function public.notify_orbit_event_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration record;
  v_kind text;
begin
  if tg_op = 'DELETE' then
    for v_registration in
      select registrations.user_id
      from public.event_registrations as registrations
      where registrations.event_id = old.id
        and registrations.status in ('registered', 'waitlisted')
    loop
      perform public.create_orbit_event_notification(
        v_registration.user_id,
        old.id,
        'event_cancelled',
        old.title
      );
    end loop;
    return old;
  end if;

  if old.status is distinct from new.status and new.status = 'cancelled' then
    v_kind := 'event_cancelled';
  elsif new.status = 'open' and (
    old.title is distinct from new.title
    or old.description is distinct from new.description
    or old.visibility is distinct from new.visibility
    or old.start_at is distinct from new.start_at
    or old.location is distinct from new.location
    or old.capacity is distinct from new.capacity
  ) then
    v_kind := 'event_updated';
  else
    return new;
  end if;

  for v_registration in
    select registrations.user_id
    from public.event_registrations as registrations
    where registrations.event_id = new.id
      and registrations.status in ('registered', 'waitlisted')
  loop
    perform public.create_orbit_event_notification(
      v_registration.user_id,
      new.id,
      v_kind,
      new.title
    );
  end loop;

  return new;
end;
$$;

revoke all on function public.notify_orbit_event_changes() from public, anon, authenticated;

create trigger notify_orbit_event_changes
  after update of title, description, visibility, start_at, location, capacity, status on public.events
  for each row execute function public.notify_orbit_event_changes();

create trigger notify_orbit_event_deletion
  before delete on public.events
  for each row execute function public.notify_orbit_event_changes();

create or replace function public.enqueue_orbit_event_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration record;
  v_notification_id uuid;
  v_enqueued integer := 0;
begin
  for v_registration in
    select registrations.user_id, events.id as event_id, events.title
    from public.events
    join public.event_registrations as registrations
      on registrations.event_id = events.id
    where events.status = 'open'
      and registrations.status = 'registered'
      and events.start_at > now() + interval '23 hours 30 minutes'
      and events.start_at <= now() + interval '24 hours 30 minutes'
  loop
    v_notification_id := public.create_orbit_event_notification(
      v_registration.user_id,
      v_registration.event_id,
      'event_reminder',
      v_registration.title
    );
    if v_notification_id is not null then
      v_enqueued := v_enqueued + 1;
    end if;
  end loop;

  return v_enqueued;
end;
$$;

revoke all on function public.enqueue_orbit_event_reminders() from public, anon, authenticated;
grant execute on function public.enqueue_orbit_event_reminders() to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'event_notifications'
     ) then
    execute 'alter publication supabase_realtime add table public.event_notifications';
  end if;
end;
$$;
