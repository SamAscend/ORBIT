alter table public.profiles
  add column if not exists show_online_status boolean not null default false;

grant select (show_online_status) on public.profiles to authenticated;
grant update (show_online_status) on public.profiles to authenticated;

create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  participant_one_id uuid not null references public.profiles (id) on delete cascade,
  participant_two_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint direct_conversations_distinct_participants
    check (participant_one_id < participant_two_id),
  constraint direct_conversations_unique_pair
    unique (participant_one_id, participant_two_id)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists direct_conversations_participant_one_idx
  on public.direct_conversations (participant_one_id, created_at desc);
create index if not exists direct_conversations_participant_two_idx
  on public.direct_conversations (participant_two_id, created_at desc);
create index if not exists direct_messages_conversation_created_idx
  on public.direct_messages (conversation_id, created_at desc, id desc);

create table if not exists public.member_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint member_blocks_distinct_members check (blocker_id <> blocked_id)
);

create table if not exists public.member_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 10 and 1000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  constraint member_reports_distinct_members check (reporter_id <> reported_id)
);

create or replace function public.is_orbit_member_blocked(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.member_blocks
    where (blocker_id = (select auth.uid()) and blocked_id = p_other_user_id)
      or (blocker_id = p_other_user_id and blocked_id = (select auth.uid()))
  );
$$;

revoke all on function public.is_orbit_member_blocked(uuid) from public, anon;
grant execute on function public.is_orbit_member_blocked(uuid) to authenticated;

alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;
alter table public.member_blocks enable row level security;
alter table public.member_reports enable row level security;

revoke all on public.direct_conversations from anon, authenticated;
grant select on public.direct_conversations to authenticated;
revoke all on public.direct_messages from anon, authenticated;
grant select on public.direct_messages to authenticated;
grant insert (conversation_id, sender_id, body) on public.direct_messages to authenticated;
revoke all on public.member_blocks from anon, authenticated;
grant select, insert, delete on public.member_blocks to authenticated;
revoke all on public.member_reports from anon, authenticated;
grant select on public.member_reports to authenticated;
grant insert (reporter_id, reported_id, reason) on public.member_reports to authenticated;
grant update (status, reviewed_at, reviewed_by) on public.member_reports to authenticated;

drop policy if exists "Active members can read their direct conversations" on public.direct_conversations;
create policy "Active members can read their direct conversations"
on public.direct_conversations for select to authenticated
using (
  (participant_one_id = (select auth.uid()) or participant_two_id = (select auth.uid()))
  and exists (
    select 1
    from public.memberships as own_membership
    join public.communities on communities.id = own_membership.community_id
    where own_membership.user_id = (select auth.uid())
      and own_membership.status = 'active'
      and communities.slug = 'orbit'
  )
  and exists (
    select 1
    from public.memberships as other_membership
    join public.communities on communities.id = other_membership.community_id
    where other_membership.user_id = case
      when participant_one_id = (select auth.uid()) then participant_two_id
      else participant_one_id
    end
      and other_membership.status = 'active'
      and communities.slug = 'orbit'
  )
  and not public.is_orbit_member_blocked(case
    when participant_one_id = (select auth.uid()) then participant_two_id
    else participant_one_id
  end)
);

drop policy if exists "Conversation members can read direct messages" on public.direct_messages;
create policy "Conversation members can read direct messages"
on public.direct_messages for select to authenticated
using (
  exists (
    select 1 from public.direct_conversations
    where direct_conversations.id = direct_messages.conversation_id
      and (
        direct_conversations.participant_one_id = (select auth.uid())
        or direct_conversations.participant_two_id = (select auth.uid())
      )
  )
  and exists (
    select 1
    from public.memberships
    join public.communities on communities.id = memberships.community_id
    where memberships.user_id = (select auth.uid())
      and memberships.status = 'active'
      and communities.slug = 'orbit'
  )
  and exists (
    select 1
    from public.direct_conversations
    join public.memberships as other_membership
      on other_membership.user_id = case
        when direct_conversations.participant_one_id = (select auth.uid())
          then direct_conversations.participant_two_id
        else direct_conversations.participant_one_id
      end
    join public.communities on communities.id = other_membership.community_id
    where direct_conversations.id = direct_messages.conversation_id
      and other_membership.status = 'active'
      and communities.slug = 'orbit'
  )
  and not public.is_orbit_member_blocked((
    select case
      when direct_conversations.participant_one_id = (select auth.uid())
        then direct_conversations.participant_two_id
      else direct_conversations.participant_one_id
    end
    from public.direct_conversations
    where direct_conversations.id = direct_messages.conversation_id
  ))
);

drop policy if exists "Active members can send direct messages" on public.direct_messages;
create policy "Active members can send direct messages"
on public.direct_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1
    from public.direct_conversations
    join public.memberships as own_membership
      on own_membership.user_id = (select auth.uid())
    join public.communities as own_community
      on own_community.id = own_membership.community_id
    join public.memberships as other_membership
      on other_membership.community_id = own_membership.community_id
    where direct_conversations.id = direct_messages.conversation_id
      and (direct_conversations.participant_one_id = (select auth.uid())
        or direct_conversations.participant_two_id = (select auth.uid()))
      and other_membership.user_id = case
        when direct_conversations.participant_one_id = (select auth.uid())
          then direct_conversations.participant_two_id
        else direct_conversations.participant_one_id
      end
      and own_membership.status = 'active'
      and other_membership.status = 'active'
      and own_community.slug = 'orbit'
  )
  and not public.is_orbit_member_blocked((
    select case
      when direct_conversations.participant_one_id = (select auth.uid())
        then direct_conversations.participant_two_id
      else direct_conversations.participant_one_id
    end
    from public.direct_conversations
    where direct_conversations.id = direct_messages.conversation_id
  ))
);

drop policy if exists "Members can view their own blocks" on public.member_blocks;
create policy "Members can view their own blocks"
on public.member_blocks for select to authenticated
using (blocker_id = (select auth.uid()));

drop policy if exists "Active members can block ORBIT members" on public.member_blocks;
create policy "Active members can block ORBIT members"
on public.member_blocks for insert to authenticated
with check (
  blocker_id = (select auth.uid())
  and exists (
    select 1
    from public.memberships as blocker_membership
    join public.communities on communities.id = blocker_membership.community_id
    join public.memberships as blocked_membership
      on blocked_membership.community_id = blocker_membership.community_id
    where blocker_membership.user_id = (select auth.uid())
      and blocked_membership.user_id = member_blocks.blocked_id
      and blocker_membership.status = 'active'
      and blocked_membership.status = 'active'
      and communities.slug = 'orbit'
  )
);

drop policy if exists "Members can unblock their own blocks" on public.member_blocks;
create policy "Members can unblock their own blocks"
on public.member_blocks for delete to authenticated
using (blocker_id = (select auth.uid()));

drop policy if exists "Admins can review member reports" on public.member_reports;
create policy "Admins can review member reports"
on public.member_reports for select to authenticated
using (public.is_platform_admin());

drop policy if exists "Active members can report ORBIT members" on public.member_reports;
create policy "Active members can report ORBIT members"
on public.member_reports for insert to authenticated
with check (
  reporter_id = (select auth.uid())
  and status = 'open'
  and reviewed_at is null
  and reviewed_by is null
  and exists (
    select 1
    from public.memberships as reporter_membership
    join public.communities on communities.id = reporter_membership.community_id
    join public.memberships as reported_membership
      on reported_membership.community_id = reporter_membership.community_id
    where reporter_membership.user_id = (select auth.uid())
      and reported_membership.user_id = member_reports.reported_id
      and reporter_membership.status = 'active'
      and reported_membership.status = 'active'
      and communities.slug = 'orbit'
  )
);

drop policy if exists "Admins can resolve member reports" on public.member_reports;
create policy "Admins can resolve member reports"
on public.member_reports for update to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create or replace function public.get_orbit_member_directory()
returns table (
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  crew_number bigint,
  show_online_status boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.id, profiles.full_name, profiles.username, profiles.avatar_url,
         memberships.crew_number, profiles.show_online_status
  from public.profiles
  join public.memberships on memberships.user_id = profiles.id
  join public.communities on communities.id = memberships.community_id
  where communities.slug = 'orbit'
    and memberships.status = 'active'
    and not profiles.is_admin
    and profiles.id <> (select auth.uid())
    and exists (
      select 1
      from public.memberships as viewer_membership
      where viewer_membership.user_id = (select auth.uid())
        and viewer_membership.community_id = memberships.community_id
        and viewer_membership.status = 'active'
    )
    and not exists (
      select 1 from public.member_blocks
      where (blocker_id = (select auth.uid()) and blocked_id = profiles.id)
        or (blocker_id = profiles.id and blocked_id = (select auth.uid()))
    )
  order by profiles.full_name, memberships.crew_number;
$$;

revoke all on function public.get_orbit_member_directory() from public, anon;
grant execute on function public.get_orbit_member_directory() to authenticated;

create or replace function public.create_orbit_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation_id uuid;
  first_user_id uuid;
  second_user_id uuid;
begin
  if auth.uid() is null or p_other_user_id is null or p_other_user_id = auth.uid() then
    raise exception 'Choose another active ORBIT member to message.';
  end if;

  if not exists (
    select 1
    from public.memberships as own_membership
    join public.communities on communities.id = own_membership.community_id
    join public.memberships as other_membership
      on other_membership.community_id = own_membership.community_id
    where own_membership.user_id = auth.uid()
      and other_membership.user_id = p_other_user_id
      and own_membership.status = 'active'
      and other_membership.status = 'active'
      and communities.slug = 'orbit'
  ) then
    raise exception 'Both people must be active ORBIT members to start a conversation.';
  end if;

  if exists (
    select 1 from public.member_blocks
    where (blocker_id = auth.uid() and blocked_id = p_other_user_id)
      or (blocker_id = p_other_user_id and blocked_id = auth.uid())
  ) then
    raise exception 'This conversation is unavailable.';
  end if;

  first_user_id := least(auth.uid(), p_other_user_id);
  second_user_id := greatest(auth.uid(), p_other_user_id);

  insert into public.direct_conversations (participant_one_id, participant_two_id)
  values (first_user_id, second_user_id)
  on conflict (participant_one_id, participant_two_id) do nothing;

  select id into conversation_id
  from public.direct_conversations
  where participant_one_id = first_user_id
    and participant_two_id = second_user_id;

  return conversation_id;
end;
$$;

revoke all on function public.create_orbit_direct_conversation(uuid) from public, anon;
grant execute on function public.create_orbit_direct_conversation(uuid) to authenticated;

create or replace function public.enforce_direct_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_message_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.sender_id::text, 0));

  select count(*) into recent_message_count
  from public.direct_messages
  where sender_id = new.sender_id
    and created_at > now() - interval '1 minute';

  if recent_message_count >= 30 then
    raise exception 'You are sending messages too quickly. Please wait a moment.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_direct_message_rate_limit() from public, anon, authenticated;

drop trigger if exists enforce_direct_message_rate_limit on public.direct_messages;
create trigger enforce_direct_message_rate_limit
  before insert on public.direct_messages
  for each row execute function public.enforce_direct_message_rate_limit();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'direct_messages'
    ) then
      alter publication supabase_realtime add table public.direct_messages;
    end if;
  end if;
end;
$$;

drop policy if exists "Active ORBIT members can receive member presence" on realtime.messages;
create policy "Active ORBIT members can receive member presence"
on realtime.messages for select to authenticated
using (
  realtime.topic() = 'orbit-member-presence'
  and exists (
    select 1
    from public.memberships
    join public.communities on communities.id = memberships.community_id
    where memberships.user_id = (select auth.uid())
      and memberships.status = 'active'
      and communities.slug = 'orbit'
  )
);

drop policy if exists "Active ORBIT members can publish member presence" on realtime.messages;
create policy "Active ORBIT members can publish member presence"
on realtime.messages for insert to authenticated
with check (
  realtime.topic() = 'orbit-member-presence'
  and exists (
    select 1
    from public.memberships
    join public.communities on communities.id = memberships.community_id
    where memberships.user_id = (select auth.uid())
      and memberships.status = 'active'
      and communities.slug = 'orbit'
  )
);
