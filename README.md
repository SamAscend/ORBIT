# ORBIT Community Platform

The ORBIT community workspace is built with Next.js, TypeScript, and Supabase. It has separate member and administrator areas, Supabase email/password authentication, and row-level security for community data.

The ORBIT wordmark and symbol assets are in `public/images/`; the app uses them across the sign-in page, workspace, membership card, and favicon.

## Run locally

1. Create a Supabase project.
2. In the Supabase SQL Editor, run the migrations in order:
   - [`supabase/migrations/202610270001_initial_community_schema.sql`](./supabase/migrations/202610270001_initial_community_schema.sql) creates the ORBIT community and empty platform tables without example members, events, or quests.
   - [`supabase/migrations/202610270002_rename_community_to_orbit.sql`](./supabase/migrations/202610270002_rename_community_to_orbit.sql) updates a database created from the earlier community name. On a fresh database it is safe to run and makes no data changes.
   - [`supabase/migrations/202610270003_add_usernames.sql`](./supabase/migrations/202610270003_add_usernames.sql) adds unique member usernames and safely fills profiles that already existed.
   - [`supabase/migrations/202610270004_admin_member_separation.sql`](./supabase/migrations/202610270004_admin_member_separation.sql) keeps admin accounts out of the member directory and counts.
   - [`supabase/migrations/202610270005_calendar_profiles_and_participation.sql`](./supabase/migrations/202610270005_calendar_profiles_and_participation.sql) adds calendar participation, profile photos, and member sleep mode.
3. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key from **Supabase → Project Settings → API**.
4. Start the website:

   ```powershell
   npm install
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

The project URL and publishable key are safe to use in the browser. Never put a Supabase `service_role` key, database password, or other secret in a `NEXT_PUBLIC_` variable or commit it to source control.

For email confirmation, open **Supabase → Authentication → URL Configuration** and add `http://localhost:3000/auth/confirm` and `http://localhost:3000/auth/confirm?next=/auth/reset-password` to the Redirect URLs list. For a deployed app, add the corresponding URLs for that exact domain. Member signup requires email confirmation when the project has email autoconfirm disabled; ORBIT returns users through this callback before opening the member dashboard. Configure a working SMTP provider in Supabase if confirmation or password-reset messages are not delivered.

## Member and admin accounts

- Members create their own accounts with a full name, unique username, email, and password. Usernames are saved to the `profiles` table; sign-in uses the account email. Supabase Auth stores and verifies passwords as secure hashes, never as readable plaintext. Email confirmation follows the project’s authentication settings. The database trigger creates the profile and ORBIT membership. The username `ADMIN` is reserved for the platform administrator.
- There is no public admin sign-up. Create the administrator’s account privately in Supabase Auth with a new password. Then promote the account and assign its reserved username from the Supabase SQL Editor using a trusted project-owner account:

  ```sql
  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
  where email = 'admin@example.com';

  update public.profiles
  set username = 'ADMIN'
  where id = (select id from auth.users where email = 'admin@example.com');
  ```

- Replace the example email with the administrator account email, run both statements, then sign out and sign back in to refresh the session. Create or reset the admin password privately in Supabase Auth; never hardcode it in the application or put it in source control. If an account using the intended password has already been shared in chat, reset it before use. Do not assign `role` through user-editable metadata. Admin role checks run on the server and database policies use the signed `app_metadata` claim.
- Existing Supabase projects that already ran migrations 001–003 should run migration 004 in the SQL Editor. It synchronizes the admin role to the profile, removes admins from member counts/directory, and keeps that flag in sync when an admin is promoted or demoted.

## Workspace routes

- `/` — member sign in, member sign up, and the separate admin sign-in entry.
- `/member` — member dashboard and digital membership card.
- `/auth/reset-password` — secure password reset destination reached through a Supabase email link.
- `/admin` — administrator dashboard, member directory, event, and quest areas.

The dashboard starts with empty events, quests, and member content. Its counts are read from Supabase; it does not use seeded demo records or browser-local sample data.

## Database and access control

The initial migration creates profiles, the ORBIT community, memberships, events, registrations, quests, submissions, and an XP ledger. The username migration enforces unique case-insensitive usernames. The admin-role migration synchronizes administrator status to profiles, so admins are excluded from member counts and the member directory. Administrators can create, edit, cancel, and delete events and quests, and suspend or reactivate member access. Row-level security separates member data from administrator access. Normal sign-up only creates a member account. Never expose a privileged Supabase key to the browser.

Members can view admin-created events and quests in the calendar, join or leave either activity voluntarily, update their name and profile photo, and place their membership in sleep mode for up to 30 days. Administrators can review event and quest participants. Password recovery uses Supabase Auth email delivery; configure the `/auth/confirm` redirect URL in the Supabase project.

## Checks

```powershell
npm run lint
npm run typecheck
npm run build
```
