create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  is_hidden boolean not null default false,
  moderated_at timestamptz,
  moderated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_created_at_id_idx
  on public.chat_messages (created_at desc, id desc);

create index if not exists chat_messages_sender_created_at_idx
  on public.chat_messages (sender_id, created_at desc)
  where sender_id is not null;

create table if not exists public.chat_message_hidden_content (
  message_id uuid primary key references public.chat_messages (id) on delete cascade,
  original_body text not null
);

alter table public.chat_messages enable row level security;
alter table public.chat_message_hidden_content enable row level security;

drop policy if exists "ORBIT members and admins can read global chat" on public.chat_messages;
create policy "ORBIT members and admins can read global chat"
on public.chat_messages for select to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.memberships
    where memberships.user_id = (select auth.uid())
      and memberships.status = 'active'
  )
);

drop policy if exists "Active members and admins can send global chat messages" on public.chat_messages;
create policy "Active members and admins can send global chat messages"
on public.chat_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and not is_hidden
  and (
    public.is_platform_admin()
    or exists (
      select 1
      from public.memberships
      where memberships.user_id = (select auth.uid())
        and memberships.status = 'active'
    )
  )
);

drop policy if exists "Admins can moderate global chat messages" on public.chat_messages;
create policy "Admins can moderate global chat messages"
on public.chat_messages for update to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Only admins can read hidden chat content" on public.chat_message_hidden_content;
create policy "Only admins can read hidden chat content"
on public.chat_message_hidden_content for select to authenticated
using (public.is_platform_admin());

revoke all on public.chat_messages from anon, authenticated;
grant select, insert on public.chat_messages to authenticated;
grant update (is_hidden, moderated_at, moderated_by) on public.chat_messages to authenticated;

revoke all on public.chat_message_hidden_content from anon, authenticated;
grant select on public.chat_message_hidden_content to authenticated;

revoke select on public.profiles from authenticated;
grant select (id, full_name, username, avatar_url, is_admin)
  on public.profiles to authenticated;

create or replace function public.can_view_orbit_chat_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.memberships as viewer_membership
      join public.memberships as profile_membership
        on profile_membership.community_id = viewer_membership.community_id
      where viewer_membership.user_id = (select auth.uid())
        and viewer_membership.status = 'active'
        and profile_membership.user_id = p_profile_id
        and profile_membership.status in ('active', 'suspended')
    );
$$;

revoke all on function public.can_view_orbit_chat_profile(uuid) from public, anon;
grant execute on function public.can_view_orbit_chat_profile(uuid) to authenticated;

drop policy if exists "ORBIT members can view chat participants" on public.profiles;
create policy "ORBIT members can view chat participants"
on public.profiles for select to authenticated
using (public.can_view_orbit_chat_profile(profiles.id));

create or replace function public.enforce_global_chat_rate_limit()
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
  from public.chat_messages
  where sender_id = new.sender_id
    and created_at > now() - interval '1 minute';

  if recent_message_count >= 8 then
    raise exception 'You are sending messages too quickly. Please wait a moment.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_global_chat_rate_limit() from public, anon, authenticated;

drop trigger if exists enforce_global_chat_rate_limit on public.chat_messages;
create trigger enforce_global_chat_rate_limit
  before insert on public.chat_messages
  for each row execute function public.enforce_global_chat_rate_limit();

insert into public.chat_message_hidden_content (message_id, original_body)
select id, body
from public.chat_messages
where is_hidden
  and body <> '[Message hidden by an administrator.]'
on conflict (message_id) do nothing;

update public.chat_messages
set body = '[Message hidden by an administrator.]'
where is_hidden
  and body <> '[Message hidden by an administrator.]';

create or replace function public.preserve_hidden_chat_message_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_body text;
begin
  if new.is_hidden and not old.is_hidden then
    insert into public.chat_message_hidden_content (message_id, original_body)
    values (old.id, old.body)
    on conflict (message_id) do update
      set original_body = excluded.original_body;
    new.body := '[Message hidden by an administrator.]';
  elsif not new.is_hidden and old.is_hidden then
    select hidden_content.original_body into saved_body
    from public.chat_message_hidden_content
      as hidden_content
    where hidden_content.message_id = old.id;

    if saved_body is null then
      raise exception 'The original chat message could not be restored.';
    end if;

    new.body := saved_body;
    delete from public.chat_message_hidden_content
    where message_id = old.id;
  end if;

  return new;
end;
$$;

revoke all on function public.preserve_hidden_chat_message_content() from public, anon, authenticated;

drop trigger if exists preserve_hidden_chat_message_content on public.chat_messages;
create trigger preserve_hidden_chat_message_content
  before update of is_hidden on public.chat_messages
  for each row execute function public.preserve_hidden_chat_message_content();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'chat_messages'
     ) then
    execute 'alter publication supabase_realtime add table public.chat_messages';
  end if;
end;
$$;
