create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 140),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  is_published boolean not null default false,
  is_pinned boolean not null default false,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists announcements_community_published_idx
  on public.announcements (community_id, is_published, is_pinned desc, created_at desc);

alter table public.announcements enable row level security;

revoke all on public.announcements from anon, authenticated;
grant select, insert, update, delete on public.announcements to authenticated;

drop policy if exists "Active ORBIT members and admins can read announcements"
  on public.announcements;
create policy "Active ORBIT members and admins can read announcements"
on public.announcements for select to authenticated
using (
  public.is_platform_admin()
  or (
    is_published
    and exists (
      select 1
      from public.memberships
      join public.communities on communities.id = memberships.community_id
      where memberships.community_id = announcements.community_id
        and memberships.user_id = (select auth.uid())
        and memberships.status = 'active'
        and communities.slug = 'orbit'
    )
  )
);

drop policy if exists "Admins can create announcements" on public.announcements;
create policy "Admins can create announcements"
on public.announcements for insert to authenticated
with check (
  public.is_platform_admin()
  and created_by = (select auth.uid())
  and exists (
    select 1 from public.communities
    where communities.id = announcements.community_id
      and communities.slug = 'orbit'
  )
);

drop policy if exists "Admins can update announcements" on public.announcements;
create policy "Admins can update announcements"
on public.announcements for update to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Admins can delete announcements" on public.announcements;
create policy "Admins can delete announcements"
on public.announcements for delete to authenticated
using (public.is_platform_admin());

create or replace function public.set_announcement_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_announcement_updated_at() from public, anon, authenticated;

drop trigger if exists set_announcement_updated_at on public.announcements;
create trigger set_announcement_updated_at
  before update on public.announcements
  for each row execute function public.set_announcement_updated_at();
