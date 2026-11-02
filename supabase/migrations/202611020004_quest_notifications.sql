alter table public.event_notifications
  add column quest_id uuid references public.quests (id) on delete set null;

alter table public.event_notifications
  drop constraint event_notifications_kind_check;

alter table public.event_notifications
  add constraint event_notifications_kind_check
  check (kind in (
    'registration_confirmed',
    'waitlisted',
    'waitlist_promoted',
    'event_updated',
    'event_cancelled',
    'event_reminder',
    'quest_published'
  ));

create index event_notifications_quest_id_idx
  on public.event_notifications (quest_id)
  where quest_id is not null;

create or replace function public.enqueue_orbit_event_notification_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind <> 'quest_published' then
    insert into public.event_notification_emails (notification_id)
    values (new.id);
  end if;
  return new;
end;
$$;

create or replace function public.notify_orbit_quest_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.event_notifications (user_id, quest_id, event_title, kind)
  select memberships.user_id, new.id, new.title, 'quest_published'
  from public.memberships
  join public.profiles on profiles.id = memberships.user_id
  where memberships.community_id = new.community_id
    and memberships.status = 'active'
    and (memberships.sleep_until is null or memberships.sleep_until <= now())
    and not profiles.is_admin
    and memberships.user_id <> new.created_by;

  return new;
end;
$$;

revoke all on function public.notify_orbit_quest_published() from public, anon, authenticated;

create trigger notify_orbit_quest_published
  after insert on public.quests
  for each row execute function public.notify_orbit_quest_published();
