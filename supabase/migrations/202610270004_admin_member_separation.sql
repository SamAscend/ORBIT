alter table public.profiles
  add column if not exists is_admin boolean not null default false;

update public.profiles
set is_admin = coalesce(auth_user.raw_app_meta_data ->> 'role' = 'admin', false)
from auth.users as auth_user
where auth_user.id = profiles.id;

delete from public.memberships
where user_id in (
  select id
  from auth.users
  where raw_app_meta_data ->> 'role' = 'admin'
);

create or replace function public.sync_profile_admin_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_app_meta_data ->> 'role' = 'admin' then
    update public.profiles
    set is_admin = true
    where id = new.id;

    delete from public.memberships
    where user_id = new.id;
  else
    update public.profiles
    set is_admin = false
    where id = new.id;

    insert into public.memberships (community_id, user_id)
    select id, new.id
    from public.communities
    where slug = 'orbit'
    on conflict (community_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_profile_admin_role on auth.users;

create trigger sync_profile_admin_role
  after update of raw_app_meta_data on auth.users
  for each row
  when (old.raw_app_meta_data is distinct from new.raw_app_meta_data)
  execute function public.sync_profile_admin_role();
