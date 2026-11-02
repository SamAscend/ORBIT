create table if not exists public.orbit_passkey_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enrolled_at timestamptz not null default now()
);

alter table public.orbit_passkey_accounts enable row level security;
revoke all on public.orbit_passkey_accounts from public, anon, authenticated;
grant select, insert on public.orbit_passkey_accounts to service_role;
grant select on public.orbit_passkey_accounts to supabase_auth_admin;

create or replace function public.orbit_passkey_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has_passkey boolean;
  v_is_recovery boolean;
  v_amr jsonb := event -> 'claims' -> 'amr';
begin
  select exists (
    select 1
    from jsonb_array_elements(
      case when jsonb_typeof(v_amr) = 'array' then v_amr else '[]'::jsonb end
    ) as amr_entry(value)
    where coalesce(amr_entry.value ->> 'method', amr_entry.value #>> '{}') = 'passkey'
  )
  into v_has_passkey;

  select exists (
    select 1
    from jsonb_array_elements(
      case when jsonb_typeof(v_amr) = 'array' then v_amr else '[]'::jsonb end
    ) as amr_entry(value)
    where coalesce(amr_entry.value ->> 'method', amr_entry.value #>> '{}') = 'recovery'
  )
  into v_is_recovery;

  if exists (
    select 1
    from public.orbit_passkey_accounts
    where user_id = (event ->> 'user_id')::uuid
  ) and not v_has_passkey and not v_is_recovery then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code', 403,
        'message', 'A passkey is required to sign in to this ORBIT account.'
      )
    );
  end if;

  return jsonb_build_object('claims', event -> 'claims');
end;
$$;

revoke all on function public.orbit_passkey_access_token_hook(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.orbit_passkey_access_token_hook(jsonb) to supabase_auth_admin;

create or replace function public.is_orbit_passkey_session()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.orbit_passkey_accounts
    where user_id = (select auth.uid())
  )
  and case
      when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then exists (
        select 1
        from jsonb_array_elements(auth.jwt() -> 'amr') as amr_entry(value)
        where coalesce(amr_entry.value ->> 'method', amr_entry.value #>> '{}') = 'passkey'
      )
      else false
    end;
$$;

revoke all on function public.is_orbit_passkey_session() from public, anon;
grant execute on function public.is_orbit_passkey_session() to authenticated;

grant select on public.orbit_passkey_accounts to authenticated;
drop policy if exists "Users can read their own passkey activation" on public.orbit_passkey_accounts;
create policy "Users can read their own passkey activation"
on public.orbit_passkey_accounts for select to authenticated
using (user_id = (select auth.uid()) and public.is_orbit_passkey_session());

do $$
declare
  protected_table record;
begin
  for protected_table in
    select namespaces.nspname, relations.relname
    from pg_class as relations
    join pg_namespace as namespaces on namespaces.oid = relations.relnamespace
    where namespaces.nspname = 'public'
      and relations.relkind in ('r', 'p')
      and relations.relrowsecurity
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      'ORBIT passkey authentication required',
      protected_table.nspname,
      protected_table.relname
    );
    execute format(
      'create policy %I on %I.%I as restrictive for all to authenticated using (public.is_orbit_passkey_session()) with check (public.is_orbit_passkey_session())',
      'ORBIT passkey authentication required',
      protected_table.nspname,
      protected_table.relname
    );
  end loop;
end;
$$;

drop policy if exists "ORBIT passkey authentication required" on storage.objects;
create policy "ORBIT passkey authentication required"
on storage.objects as restrictive for all to authenticated
using (public.is_orbit_passkey_session())
with check (public.is_orbit_passkey_session());

drop policy if exists "ORBIT passkey authentication required" on realtime.messages;
create policy "ORBIT passkey authentication required"
on realtime.messages as restrictive for all to authenticated
using (public.is_orbit_passkey_session())
with check (public.is_orbit_passkey_session());

alter function public.pause_own_membership() rename to pause_own_membership_without_passkey;
revoke all on function public.pause_own_membership_without_passkey() from public, anon, authenticated;
create function public.pause_own_membership()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_orbit_passkey_session() then
    raise exception 'A passkey-authenticated session is required.';
  end if;
  perform public.pause_own_membership_without_passkey();
end;
$$;
revoke all on function public.pause_own_membership() from public, anon;
grant execute on function public.pause_own_membership() to authenticated;

alter function public.is_orbit_member_blocked(uuid) rename to is_orbit_member_blocked_without_passkey;
revoke all on function public.is_orbit_member_blocked_without_passkey(uuid) from public, anon, authenticated;
create function public.is_orbit_member_blocked(p_other_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_orbit_passkey_session() then
    raise exception 'A passkey-authenticated session is required.';
  end if;
  return public.is_orbit_member_blocked_without_passkey(p_other_user_id);
end;
$$;
revoke all on function public.is_orbit_member_blocked(uuid) from public, anon;
grant execute on function public.is_orbit_member_blocked(uuid) to authenticated;

alter function public.get_orbit_member_directory() rename to get_orbit_member_directory_without_passkey;
revoke all on function public.get_orbit_member_directory_without_passkey() from public, anon, authenticated;
create function public.get_orbit_member_directory()
returns table (
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  crew_number bigint,
  show_online_status boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_orbit_passkey_session() then
    raise exception 'A passkey-authenticated session is required.';
  end if;
  return query select * from public.get_orbit_member_directory_without_passkey();
end;
$$;
revoke all on function public.get_orbit_member_directory() from public, anon;
grant execute on function public.get_orbit_member_directory() to authenticated;

alter function public.create_orbit_direct_conversation(uuid) rename to create_orbit_direct_conversation_without_passkey;
revoke all on function public.create_orbit_direct_conversation_without_passkey(uuid) from public, anon, authenticated;
create function public.create_orbit_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_orbit_passkey_session() then
    raise exception 'A passkey-authenticated session is required.';
  end if;
  return public.create_orbit_direct_conversation_without_passkey(p_other_user_id);
end;
$$;
revoke all on function public.create_orbit_direct_conversation(uuid) from public, anon;
grant execute on function public.create_orbit_direct_conversation(uuid) to authenticated;

alter function public.are_active_orbit_members(uuid) rename to are_active_orbit_members_without_passkey;
revoke all on function public.are_active_orbit_members_without_passkey(uuid) from public, anon, authenticated;
create function public.are_active_orbit_members(p_other_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_orbit_passkey_session() then
    raise exception 'A passkey-authenticated session is required.';
  end if;
  return public.are_active_orbit_members_without_passkey(p_other_user_id);
end;
$$;
revoke all on function public.are_active_orbit_members(uuid) from public, anon;
grant execute on function public.are_active_orbit_members(uuid) to authenticated;

alter function public.can_access_orbit_direct_conversation(uuid) rename to can_access_orbit_direct_conversation_without_passkey;
revoke all on function public.can_access_orbit_direct_conversation_without_passkey(uuid) from public, anon, authenticated;
create function public.can_access_orbit_direct_conversation(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_orbit_passkey_session() then
    raise exception 'A passkey-authenticated session is required.';
  end if;
  return public.can_access_orbit_direct_conversation_without_passkey(p_conversation_id);
end;
$$;
revoke all on function public.can_access_orbit_direct_conversation(uuid) from public, anon;
grant execute on function public.can_access_orbit_direct_conversation(uuid) to authenticated;

alter function public.can_view_orbit_chat_profile(uuid) rename to can_view_orbit_chat_profile_without_passkey;
revoke all on function public.can_view_orbit_chat_profile_without_passkey(uuid) from public, anon, authenticated;
create function public.can_view_orbit_chat_profile(p_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_orbit_passkey_session() then
    raise exception 'A passkey-authenticated session is required.';
  end if;
  return public.can_view_orbit_chat_profile_without_passkey(p_profile_id);
end;
$$;
revoke all on function public.can_view_orbit_chat_profile(uuid) from public, anon;
grant execute on function public.can_view_orbit_chat_profile(uuid) to authenticated;

alter function public.submit_orbit_quest_work(uuid, text) rename to submit_orbit_quest_work_without_passkey;
revoke all on function public.submit_orbit_quest_work_without_passkey(uuid, text) from public, anon, authenticated;
create function public.submit_orbit_quest_work(p_quest_id uuid, p_submission_text text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_orbit_passkey_session() then
    raise exception 'A passkey-authenticated session is required.';
  end if;
  return public.submit_orbit_quest_work_without_passkey(p_quest_id, p_submission_text);
end;
$$;
revoke all on function public.submit_orbit_quest_work(uuid, text) from public, anon;
grant execute on function public.submit_orbit_quest_work(uuid, text) to authenticated;

alter function public.review_orbit_quest_submission(uuid, text, text) rename to review_orbit_quest_submission_without_passkey;
revoke all on function public.review_orbit_quest_submission_without_passkey(uuid, text, text) from public, anon, authenticated;
create function public.review_orbit_quest_submission(
  p_submission_id uuid,
  p_status text,
  p_feedback text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_orbit_passkey_session() then
    raise exception 'A passkey-authenticated session is required.';
  end if;
  return public.review_orbit_quest_submission_without_passkey(p_submission_id, p_status, p_feedback);
end;
$$;
revoke all on function public.review_orbit_quest_submission(uuid, text, text) from public, anon;
grant execute on function public.review_orbit_quest_submission(uuid, text, text) to authenticated;

alter function public.clear_orbit_global_chat() rename to clear_orbit_global_chat_without_passkey;
revoke all on function public.clear_orbit_global_chat_without_passkey() from public, anon, authenticated;
create function public.clear_orbit_global_chat()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_orbit_passkey_session() then
    raise exception 'A passkey-authenticated session is required.';
  end if;
  return public.clear_orbit_global_chat_without_passkey();
end;
$$;
revoke all on function public.clear_orbit_global_chat() from public, anon;
grant execute on function public.clear_orbit_global_chat() to authenticated;

alter function public.join_orbit_event(uuid) rename to join_orbit_event_without_passkey;
revoke all on function public.join_orbit_event_without_passkey(uuid) from public, anon, authenticated;
create function public.join_orbit_event(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_orbit_passkey_session() then
    raise exception 'A passkey-authenticated session is required.';
  end if;
  return public.join_orbit_event_without_passkey(p_event_id);
end;
$$;
revoke all on function public.join_orbit_event(uuid) from public, anon;
grant execute on function public.join_orbit_event(uuid) to authenticated;

alter function public.leave_orbit_event(uuid) rename to leave_orbit_event_without_passkey;
revoke all on function public.leave_orbit_event_without_passkey(uuid) from public, anon, authenticated;
create function public.leave_orbit_event(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_orbit_passkey_session() then
    raise exception 'A passkey-authenticated session is required.';
  end if;
  return public.leave_orbit_event_without_passkey(p_event_id);
end;
$$;
revoke all on function public.leave_orbit_event(uuid) from public, anon;
grant execute on function public.leave_orbit_event(uuid) to authenticated;

alter function public.get_orbit_event_availability() rename to get_orbit_event_availability_without_passkey;
revoke all on function public.get_orbit_event_availability_without_passkey() from public, anon, authenticated;
create function public.get_orbit_event_availability()
returns table (
  event_id uuid,
  registered_count bigint,
  waitlist_count bigint,
  my_status text,
  my_waitlist_position bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_orbit_passkey_session() then
    raise exception 'A passkey-authenticated session is required.';
  end if;
  return query select * from public.get_orbit_event_availability_without_passkey();
end;
$$;
revoke all on function public.get_orbit_event_availability() from public, anon;
grant execute on function public.get_orbit_event_availability() to authenticated;

drop policy if exists "Active members can read their direct conversations" on public.direct_conversations;
create policy "Active members can read their direct conversations"
on public.direct_conversations for select to authenticated
using (public.can_access_orbit_direct_conversation(id));

drop policy if exists "Conversation members can read direct messages" on public.direct_messages;
create policy "Conversation members can read direct messages"
on public.direct_messages for select to authenticated
using (public.can_access_orbit_direct_conversation(conversation_id));

drop policy if exists "Active members can send direct messages" on public.direct_messages;
create policy "Active members can send direct messages"
on public.direct_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and public.can_access_orbit_direct_conversation(conversation_id)
);

drop policy if exists "Active members can block ORBIT members" on public.member_blocks;
create policy "Active members can block ORBIT members"
on public.member_blocks for insert to authenticated
with check (
  blocker_id = (select auth.uid())
  and public.are_active_orbit_members(blocked_id)
);

drop policy if exists "Active members can report ORBIT members" on public.member_reports;
create policy "Active members can report ORBIT members"
on public.member_reports for insert to authenticated
with check (
  reporter_id = (select auth.uid())
  and status = 'open'
  and reviewed_at is null
  and reviewed_by is null
  and public.are_active_orbit_members(reported_id)
);

drop policy if exists "ORBIT members can view chat participants" on public.profiles;
create policy "ORBIT members can view chat participants"
on public.profiles for select to authenticated
using (public.can_view_orbit_chat_profile(profiles.id));
