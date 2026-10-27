update public.communities
set name = 'ORBIT',
    slug = 'orbit',
    description = 'The ORBIT community workspace.'
where slug = 'milezero'
   or lower(name) = 'milezero';

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
