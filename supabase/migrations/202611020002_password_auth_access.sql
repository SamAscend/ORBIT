create or replace function public.orbit_passkey_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return jsonb_build_object('claims', event -> 'claims');
end;
$$;

revoke all on function public.orbit_passkey_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.orbit_passkey_access_token_hook(jsonb) to supabase_auth_admin;

create or replace function public.is_orbit_authenticated_session()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
  and not exists (
    select 1
    from jsonb_array_elements(
      case
        when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr'
        else '[]'::jsonb
      end
    ) as amr_entry(value)
    where coalesce(amr_entry.value ->> 'method', amr_entry.value #>> '{}') = 'recovery'
  );
$$;

revoke all on function public.is_orbit_authenticated_session() from public, anon;
grant execute on function public.is_orbit_authenticated_session() to authenticated;

create or replace function public.is_orbit_passkey_session()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_orbit_authenticated_session();
$$;

revoke all on function public.is_orbit_passkey_session() from public, anon;
grant execute on function public.is_orbit_passkey_session() to authenticated;
comment on function public.is_orbit_passkey_session() is
  'Legacy compatibility gate for existing ORBIT RPC wrappers; permits authenticated non-recovery sessions.';

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
  end loop;
end;
$$;

drop policy if exists "ORBIT passkey authentication required" on storage.objects;
drop policy if exists "ORBIT passkey authentication required" on realtime.messages;
drop policy if exists "Users can read their own passkey activation" on public.orbit_passkey_accounts;
revoke select on public.orbit_passkey_accounts from authenticated;
