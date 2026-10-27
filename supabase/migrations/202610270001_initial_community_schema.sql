create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  created_at timestamptz not null default now()
);

insert into public.communities (name, slug, description)
values ('ORBIT', 'orbit', 'The ORBIT community workspace.');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  username text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,24}$')
);

create unique index profiles_username_lower_idx on public.profiles (lower(username));

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  crew_number bigint generated always as identity,
  status text not null default 'active' check (status in ('active', 'suspended', 'left')),
  created_at timestamptz not null default now(),
  unique (community_id, user_id),
  unique (crew_number)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  title text not null,
  description text not null default '',
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  status text not null default 'open' check (status in ('open', 'cancelled', 'completed')),
  start_at timestamptz not null,
  location text not null default '',
  capacity integer check (capacity is null or capacity > 0),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'registered' check (status in ('registered', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table public.quests (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  title text not null,
  description text not null default '',
  xp_reward integer not null default 0 check (xp_reward >= 0),
  goal integer not null default 1 check (goal > 0),
  deadline timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.quest_submissions (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  submission_text text not null,
  status text not null default 'submitted' check (status in ('submitted', 'verified', 'rejected')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.xp_ledger (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  submission_id uuid unique references public.quest_submissions (id) on delete set null,
  points integer not null check (points > 0),
  created_at timestamptz not null default now()
);

create index memberships_user_id_idx on public.memberships (user_id);
create index events_community_start_idx on public.events (community_id, start_at);
create index quests_community_deadline_idx on public.quests (community_id, deadline);
create index quest_submissions_user_id_idx on public.quest_submissions (user_id);
create index xp_ledger_user_id_idx on public.xp_ledger (user_id);

create function public.is_platform_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false);
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  orbit_id uuid;
  requested_username text;
begin
  requested_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    'member_' || substr(replace(new.id::text, '-', ''), 1, 8)
  );

  if lower(requested_username) = 'admin'
     and coalesce(new.raw_app_meta_data ->> 'role', '') <> 'admin' then
    raise exception 'The ADMIN username is reserved.';
  end if;

  insert into public.profiles (id, full_name, username)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Member'),
    requested_username
  );

  select id into orbit_id
  from public.communities
  where slug = 'orbit';

  if orbit_id is null then
    raise exception 'The ORBIT community has not been configured.';
  end if;

  insert into public.memberships (community_id, user_id)
  values (orbit_id, new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.communities enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;
alter table public.quests enable row level security;
alter table public.quest_submissions enable row level security;
alter table public.xp_ledger enable row level security;

create policy "Members and admins can read their communities"
on public.communities for select to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1 from public.memberships
    where memberships.community_id = communities.id
      and memberships.user_id = (select auth.uid())
      and memberships.status = 'active'
  )
);

create policy "Members can read their own profile"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.is_platform_admin());

revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

create policy "Members can update their own name"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Admins can manage profiles"
on public.profiles for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "Members can read their own membership"
on public.memberships for select to authenticated
using (user_id = (select auth.uid()) or public.is_platform_admin());

create policy "Admins can manage memberships"
on public.memberships for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "Community members can read events"
on public.events for select to authenticated
using (
  public.is_platform_admin()
  or (
    visibility = 'public'
    and exists (
      select 1 from public.memberships
      where memberships.community_id = events.community_id
        and memberships.user_id = (select auth.uid())
        and memberships.status = 'active'
    )
  )
  or (
    visibility = 'private'
    and exists (
      select 1 from public.memberships
      where memberships.community_id = events.community_id
        and memberships.user_id = (select auth.uid())
        and memberships.status = 'active'
    )
  )
);

create policy "Admins can manage events"
on public.events for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "Members can read their event registrations"
on public.event_registrations for select to authenticated
using (user_id = (select auth.uid()) or public.is_platform_admin());

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
      and events.status = 'open'
  )
);

create policy "Members can cancel their registration"
on public.event_registrations for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and status = 'cancelled');

revoke update on public.event_registrations from authenticated;
grant update (status) on public.event_registrations to authenticated;

create policy "Admins can manage registrations"
on public.event_registrations for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "Community members can read quests"
on public.quests for select to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1 from public.memberships
    where memberships.community_id = quests.community_id
      and memberships.user_id = (select auth.uid())
      and memberships.status = 'active'
  )
);

create policy "Admins can manage quests"
on public.quests for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "Members can read their submissions"
on public.quest_submissions for select to authenticated
using (user_id = (select auth.uid()) or public.is_platform_admin());

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
  )
);

create policy "Admins can review submissions"
on public.quest_submissions for update to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "Members can read their XP history"
on public.xp_ledger for select to authenticated
using (user_id = (select auth.uid()) or public.is_platform_admin());

create policy "Admins can award XP"
on public.xp_ledger for insert to authenticated
with check (public.is_platform_admin());
