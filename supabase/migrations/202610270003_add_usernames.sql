alter table public.profiles
  add column if not exists username text;

update public.profiles
set username =
  left(
    coalesce(
      nullif(regexp_replace(lower(trim(full_name)), '[^a-z0-9_]+', '_', 'g'), ''),
      'member'
    ),
    15
  ) || '_' || substr(replace(id::text, '-', ''), 1, 8)
where username is null;

alter table public.profiles
  alter column username set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_username_format'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_username_format
      check (username ~ '^[A-Za-z0-9_]{3,24}$');
  end if;
end;
$$;

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

create or replace function public.handle_new_user()
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
