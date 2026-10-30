grant select (id, full_name, avatar_url, is_admin)
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
      where viewer_membership.user_id = (select auth.uid())
        and viewer_membership.status = 'active'
        and (
          exists (
            select 1
            from public.memberships as profile_membership
            where profile_membership.community_id = viewer_membership.community_id
              and profile_membership.user_id = p_profile_id
              and profile_membership.status in ('active', 'suspended')
          )
          or exists (
            select 1
            from public.profiles as chat_admin_profile
            where chat_admin_profile.id = p_profile_id
              and chat_admin_profile.is_admin
          )
        )
    );
$$;

revoke all on function public.can_view_orbit_chat_profile(uuid) from public, anon;
grant execute on function public.can_view_orbit_chat_profile(uuid) to authenticated;

drop policy if exists "ORBIT members can view chat participants" on public.profiles;
create policy "ORBIT members can view chat participants"
on public.profiles for select to authenticated
using (public.can_view_orbit_chat_profile(profiles.id));
