grant select (id, full_name, avatar_url)
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
