alter table public.profiles
  add column if not exists avatar_url text;

alter table public.memberships
  add column if not exists sleep_until timestamptz;

revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

drop policy if exists "Members can update their own name" on public.profiles;
create policy "Members can update their own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

grant update (sleep_until) on public.memberships to authenticated;

create policy "Members can manage their own sleep mode"
on public.memberships for update to authenticated
using (user_id = (select auth.uid()) and status = 'active')
with check (
  user_id = (select auth.uid())
  and status = 'active'
  and (sleep_until is null or sleep_until > now())
  and (sleep_until is null or sleep_until <= now() + interval '30 days')
);

create table public.quest_registrations (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'registered' check (status in ('registered', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (quest_id, user_id)
);

create index quest_registrations_user_id_idx
  on public.quest_registrations (user_id);

alter table public.quest_registrations enable row level security;

create policy "Members can read their quest registrations"
on public.quest_registrations for select to authenticated
using (user_id = (select auth.uid()) or public.is_platform_admin());

create policy "Active members can join quests"
on public.quest_registrations for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'registered'
  and exists (
    select 1
    from public.quests
    join public.memberships on memberships.community_id = quests.community_id
    where quests.id = quest_registrations.quest_id
      and memberships.user_id = (select auth.uid())
      and memberships.status = 'active'
      and (memberships.sleep_until is null or memberships.sleep_until <= now())
      and (quests.deadline is null or quests.deadline > now())
  )
);

create policy "Members can cancel their quest registration"
on public.quest_registrations for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and (
    status = 'cancelled'
    or (
      status = 'registered'
      and exists (
        select 1
        from public.quests
        join public.memberships on memberships.community_id = quests.community_id
        where quests.id = quest_registrations.quest_id
          and memberships.user_id = (select auth.uid())
          and memberships.status = 'active'
          and (memberships.sleep_until is null or memberships.sleep_until <= now())
          and (quests.deadline is null or quests.deadline > now())
      )
    )
  )
);

revoke update on public.quest_registrations from authenticated;
grant update (status) on public.quest_registrations to authenticated;

create policy "Admins can manage quest registrations"
on public.quest_registrations for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Community members can read events" on public.events;
create policy "Community members can read events"
on public.events for select to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1 from public.memberships
    where memberships.community_id = events.community_id
      and memberships.user_id = (select auth.uid())
      and memberships.status = 'active'
      and (memberships.sleep_until is null or memberships.sleep_until <= now())
  )
);

drop policy if exists "Members can register for community events" on public.event_registrations;
create policy "Members can register for community events"
on public.event_registrations for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.events
    join public.memberships on memberships.community_id = events.community_id
    where events.id = event_registrations.event_id
      and memberships.user_id = (select auth.uid())
      and memberships.status = 'active'
      and (memberships.sleep_until is null or memberships.sleep_until <= now())
      and events.status = 'open'
  )
);

drop policy if exists "Members can cancel their registration" on public.event_registrations;
create policy "Members can cancel their registration"
on public.event_registrations for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and (
    status = 'cancelled'
    or (
      status = 'registered'
      and exists (
        select 1
        from public.events
        join public.memberships on memberships.community_id = events.community_id
        where events.id = event_registrations.event_id
          and events.status = 'open'
          and memberships.user_id = (select auth.uid())
          and memberships.status = 'active'
          and (memberships.sleep_until is null or memberships.sleep_until <= now())
      )
    )
  )
);

drop policy if exists "Community members can read quests" on public.quests;
create policy "Community members can read quests"
on public.quests for select to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1 from public.memberships
    where memberships.community_id = quests.community_id
      and memberships.user_id = (select auth.uid())
      and memberships.status = 'active'
      and (memberships.sleep_until is null or memberships.sleep_until <= now())
  )
);

drop policy if exists "Members can submit their own quest work" on public.quest_submissions;
create policy "Members can submit their own quest work"
on public.quest_submissions for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'submitted'
  and exists (
    select 1 from public.quests
    join public.memberships on memberships.community_id = quests.community_id
    where quests.id = quest_submissions.quest_id
      and memberships.user_id = (select auth.uid())
      and memberships.status = 'active'
      and (memberships.sleep_until is null or memberships.sleep_until <= now())
      and exists (
        select 1 from public.quest_registrations
        where quest_registrations.quest_id = quests.id
          and quest_registrations.user_id = (select auth.uid())
          and quest_registrations.status = 'registered'
      )
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Profile photos are publicly readable"
on storage.objects for select
using (bucket_id = 'profile-photos');

create policy "Members can upload their own profile photo"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Members can update their own profile photo"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Members can delete their own profile photo"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
