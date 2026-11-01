create or replace function public.are_active_orbit_members(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and p_other_user_id is not null
    and exists (
      select 1
      from public.memberships as own_membership
      join public.communities on communities.id = own_membership.community_id
      join public.memberships as other_membership
        on other_membership.community_id = own_membership.community_id
      where own_membership.user_id = (select auth.uid())
        and other_membership.user_id = p_other_user_id
        and own_membership.status = 'active'
        and other_membership.status = 'active'
        and communities.slug = 'orbit'
    );
$$;

revoke all on function public.are_active_orbit_members(uuid) from public, anon;
grant execute on function public.are_active_orbit_members(uuid) to authenticated;

create or replace function public.can_access_orbit_direct_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.direct_conversations
    where direct_conversations.id = p_conversation_id
      and (
        direct_conversations.participant_one_id = (select auth.uid())
        or direct_conversations.participant_two_id = (select auth.uid())
      )
      and public.are_active_orbit_members(
        case
          when direct_conversations.participant_one_id = (select auth.uid())
            then direct_conversations.participant_two_id
          else direct_conversations.participant_one_id
        end
      )
      and not public.is_orbit_member_blocked(
        case
          when direct_conversations.participant_one_id = (select auth.uid())
            then direct_conversations.participant_two_id
          else direct_conversations.participant_one_id
        end
      )
  );
$$;

revoke all on function public.can_access_orbit_direct_conversation(uuid) from public, anon;
grant execute on function public.can_access_orbit_direct_conversation(uuid) to authenticated;

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
