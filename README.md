# ORBIT Community Platform

The ORBIT community workspace is built with Next.js, TypeScript, and Supabase. It has separate member and administrator areas, email-and-password sign-in, and row-level security for community data.

The ORBIT wordmark and symbol assets are in `public/images/`; the app uses them across the sign-in page, workspace, membership card, and favicon.

## Run locally

1. Create a Supabase project.
2. In the Supabase SQL Editor, run the migrations in order:
   - [`supabase/migrations/202610270001_initial_community_schema.sql`](./supabase/migrations/202610270001_initial_community_schema.sql) creates the ORBIT community and empty platform tables without example members, events, or quests.
   - [`supabase/migrations/202610270002_rename_community_to_orbit.sql`](./supabase/migrations/202610270002_rename_community_to_orbit.sql) updates a database created from the earlier community name. On a fresh database it is safe to run and makes no data changes.
   - [`supabase/migrations/202610270003_add_usernames.sql`](./supabase/migrations/202610270003_add_usernames.sql) adds unique member usernames and safely fills profiles that already existed.
   - [`supabase/migrations/202610270004_admin_member_separation.sql`](./supabase/migrations/202610270004_admin_member_separation.sql) keeps admin accounts out of the member directory and counts.
   - [`supabase/migrations/202610270005_calendar_profiles_and_participation.sql`](./supabase/migrations/202610270005_calendar_profiles_and_participation.sql) adds calendar participation, profile photos, and member sleep mode.
   - [`supabase/migrations/202610270006_membership_lifecycle_and_verification.sql`](./supabase/migrations/202610270006_membership_lifecycle_and_verification.sql) adds member-controlled pausing and private-token live card verification.
   - [`supabase/migrations/202610270007_global_chat.sql`](./supabase/migrations/202610270007_global_chat.sql) adds persistent global chat, member profile visibility for chat, and realtime updates.
   - [`supabase/migrations/202610300001_chat_member_profile_visibility.sql`](./supabase/migrations/202610300001_chat_member_profile_visibility.sql) reapplies chat profile visibility for projects where an earlier, partial version of migration 007 was run.
   - [`supabase/migrations/202611010001_member_interactions.sql`](./supabase/migrations/202611010001_member_interactions.sql) adds an opt-in member directory presence, private direct messages, blocking, and member reports.
   - [`supabase/migrations/202611010002_fix_member_interaction_rls.sql`](./supabase/migrations/202611010002_fix_member_interaction_rls.sql) fixes direct-message, block, and report access checks to safely validate both members despite membership row-level security.
   - [`supabase/migrations/202611010003_quest_submission_review.sql`](./supabase/migrations/202611010003_quest_submission_review.sql) adds member quest submissions, admin review feedback, and one-time XP awards.
   - [`supabase/migrations/202611010004_admin_clear_global_chat.sql`](./supabase/migrations/202611010004_admin_clear_global_chat.sql) adds an admin-only, realtime-aware global chat clear action.
   - [`supabase/migrations/202611010005_event_capacity_waitlist.sql`](./supabase/migrations/202611010005_event_capacity_waitlist.sql) enforces event capacity, adds a FIFO waitlist, and promotes eligible members when seats open.
   - [`supabase/migrations/202611010006_community_announcements.sql`](./supabase/migrations/202611010006_community_announcements.sql) adds an admin-managed announcement board with pinned posts and unpublished drafts.
   - [`supabase/migrations/202611020001_passkey_required_access.sql`](./supabase/migrations/202611020001_passkey_required_access.sql) is the historical passkey access migration.
   - [`supabase/migrations/202611020002_password_auth_access.sql`](./supabase/migrations/202611020002_password_auth_access.sql) restores email-and-password access while preserving account, role, membership, and recovery-session restrictions.
   - [`supabase/migrations/202611020003_event_notifications.sql`](./supabase/migrations/202611020003_event_notifications.sql) adds in-app event notifications, email delivery queueing, and the reminder scheduler function.
   - [`supabase/migrations/202611020004_quest_notifications.sql`](./supabase/migrations/202611020004_quest_notifications.sql) adds in-app notifications when a quest is created.
3. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key from **Supabase → Project Settings → API**. Add the service-role key as `SUPABASE_SERVICE_ROLE_KEY` only to the server environment; it is required for permanent member account closure.
4. Start the website:

   ```powershell
   npm install
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

The project URL and publishable key are safe to use in the browser. `SUPABASE_SERVICE_ROLE_KEY` is a server-only secret required for permanent account closure. Never put it in a `NEXT_PUBLIC_` variable or commit a real key to source control.

For email confirmation, open **Supabase → Authentication → URL Configuration** and add `http://localhost:3000/auth/confirm` and `http://localhost:3000/auth/confirm?next=/auth/reset-password` to the Redirect URLs list. Member signup requires email confirmation when the project has email autoconfirm disabled; users return through this callback and sign in with their email and password. Configure a working SMTP provider in Supabase if confirmation or password-reset messages are not delivered. If you previously enabled the `public.orbit_passkey_access_token_hook`, migration 202611020002 makes it pass through normal access-token claims so password sign-in works.

## Event notifications

After running migrations `202611020003_event_notifications.sql` and then `202611020004_quest_notifications.sql`, members see RSVP confirmations, waitlist status, waitlist promotions, event changes, cancellations, reminders, and newly created quests in the bell menu. Quest notices go to active members who are not in sleep mode, excluding the quest creator, and are in-app only; creating a quest does not send an email blast. The database creates notifications automatically, and the inbox updates in realtime. Event email delivery and the approximately 24-hour reminder require the optional Resend and Supabase scheduled-function setup below; in-app notifications work without it.

1. In Resend, add and verify a domain you own. For example, if you own `orbitcommunity.id`, you could use `events@orbitcommunity.id` as the sender. Do not use an address on a domain you do not control. Create a Resend API key for sending email.
2. Install and link the Supabase CLI to this project, then deploy the worker:

   ```powershell
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy orbit-event-notifications --no-verify-jwt
   ```

3. In **Supabase → Edge Functions → Secrets**, set `RESEND_API_KEY`, `ORBIT_NOTIFICATION_FROM` (for example, `ORBIT <events@orbitcommunity.id>`), and `ORBIT_NOTIFICATION_CRON_SECRET`. Generate a random secret for the last value; the same value is stored in Vault in the next step. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Never put these secrets in `.env.local`, browser code, Git, or chat.
4. In the Supabase SQL Editor, enable `pg_cron` and `pg_net` if they are not already enabled. Store the project URL, publishable key, and the same random cron secret in Vault:

   ```sql
   select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'orbit_event_notifications_url');
   select vault.create_secret('YOUR_SUPABASE_PUBLISHABLE_KEY', 'orbit_event_notifications_apikey');
   select vault.create_secret('YOUR_RANDOM_CRON_SECRET', 'orbit_event_notifications_cron_secret');
   ```

5. Schedule the worker to run every 15 minutes:

   ```sql
   select cron.schedule(
     'orbit-event-notifications-every-15-minutes',
     '*/15 * * * *',
     $$
     select net.http_post(
       url := (select decrypted_secret from vault.decrypted_secrets where name = 'orbit_event_notifications_url')
         || '/functions/v1/orbit-event-notifications',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'orbit_event_notifications_apikey'),
         'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'orbit_event_notifications_cron_secret')
       ),
       body := '{}'::jsonb
     );
     $$
   );
   ```

The worker sends event emails through Resend, retries transient failures up to five times, and leaves repeated failures marked `failed` in the email outbox for an administrator to inspect. The reminder runs about 24 hours before the event; its 15-minute schedule uses a one-hour tolerance so a temporary scheduler delay does not skip it. The email time is labeled UTC. Keep the Resend domain verified and the Vault/Edge Function secrets configured for email delivery to continue.

## Member and admin accounts

- Members create their own accounts with a full name, unique username, email, and password. Members and administrators sign in with email and password; passkeys are not required. Password recovery sessions remain limited to account recovery and cannot access the workspace or app data. Email confirmation follows the project’s authentication settings. The database trigger creates the profile and ORBIT membership. The username `ADMIN` is reserved for the platform administrator.
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
- Existing projects that already applied migration `202611020001_passkey_required_access.sql` must run migration `202611020002_password_auth_access.sql` in the Supabase SQL Editor to remove the passkey requirement. Existing passkeys may remain registered with Supabase Auth, but ORBIT no longer requires them.
- Existing Supabase projects that already ran migrations 001–003 should run migration 004 in the SQL Editor. It synchronizes the admin role to the profile, removes admins from member counts/directory, and keeps that flag in sync when an admin is promoted or demoted.

## Workspace routes

- `/` — member sign in, member sign up, and the separate admin sign-in entry.
- `/member` — member dashboard, membership card, profile, and account options. Members can print or save a card; its QR code checks live membership status at `/verify/[token]`.
- **Chat** in either workspace — the shared global ORBIT conversation, with persistent history, profile photos, and live updates. Administrators can hide/restore individual messages without deleting the stored record, or permanently clear all global chat messages after a typed confirmation.
- **Members** in the member workspace — find active crew members, optionally share online status, exchange direct messages, and block or report contacts. Admins can review and resolve reports. Direct messages are restricted to their participants but are stored in the ORBIT database and are not end-to-end encrypted; do not use them for sensitive information.
- **Quests** — members can submit work for quests they joined; admins review submissions and provide feedback. Approved submissions award the configured XP once, and members can see their review history and XP in **My Progress**.
- **Quest Review** in the admin workspace — review pending member submissions, approve or reject them, and provide feedback when rejecting.
- **Events** — confirmed RSVPs cannot exceed event capacity. Full events accept members onto a first-in, first-out waitlist, and the next eligible member is automatically promoted when a confirmed attendee leaves or capacity increases.
- **Updates** in either workspace — admins can publish, pin, edit, unpublish, or delete official announcements; active members get a dedicated feed for published updates.
- **First visit** — a dismissible, role-specific quick start points members to events, crew conversations, and updates, and admins to common setup tasks. Its dismissal is remembered per account and role in that browser.
- **Empty Updates feed** — members are told that updates appear after an admin publishes one and can jump straight to Events or Chat; admins get a shortcut to create the first update.
- **Language selector** — English, Indonesian, Spanish, Brazilian Portuguese, French, German, Simplified Chinese, Japanese, Korean, and Arabic are available. Core navigation, sign-in, dashboard overview, event/quest forms, chat, member directory, and announcements are localized; some secondary management screens may still show English. The choice is saved in the browser, Arabic uses a right-to-left layout, and member-written content stays in its original language.
- **Appearance selector** — choose light, dark, or follow the device theme. The preference is saved in the browser and applies across sign-in and workspace screens.
- `/verify/[token]` — public, minimal live membership check. The unguessable token reveals only the active member's display name and crew ID; inactive or ended memberships do not verify.
- `/api/membership/leave` — authenticated, password-confirmed permanent account closure. It requires the server-only `SUPABASE_SERVICE_ROLE_KEY`.
- `/auth/reset-password` — secure password reset destination reached through a Supabase email link.
- `/admin` — administrator dashboard, member directory, event, quest, and member-report areas.

The dashboard starts with empty events, quests, and member content. Its counts are read from Supabase; it does not use seeded demo records or browser-local sample data.

## Database and access control

The initial migration creates profiles, the ORBIT community, memberships, events, registrations, quests, submissions, and an XP ledger. The username migration enforces unique case-insensitive usernames. The admin-role migration synchronizes administrator status to profiles, so admins are excluded from member counts and the member directory. Administrators can create, edit, cancel, and delete events and quests, and suspend or reactivate member access. Row-level security separates member data from administrator access. Normal sign-up only creates a member account. Never expose a privileged Supabase key to the browser.

Members can view admin-created events and quests in the calendar, join or leave either activity voluntarily, submit quest work for admin review, and see approval feedback and awarded XP in My Progress. Event capacity and waitlist order are enforced in the database; members see their waitlist position and are promoted automatically when a spot opens. Administrators cannot reduce an event’s capacity below its confirmed attendee count. Approved quest submissions award XP at most once; rejected work can be resubmitted with reviewer feedback. Members can also update their name and profile photo and place their membership in sleep mode for up to 30 days. They can pause membership, which keeps the account and progress while preventing access; administrators can reactivate paused memberships. Password recovery restores access to the existing server-side account and data. Permanent account closure requires the current password and an explicit typed confirmation, deletes the Auth user and its cascading profile, membership, registrations, submissions, and XP records, and removes the profile photo. It cannot be undone through the app; provider backups may retain deleted data according to their own retention schedule. A saved card cannot be remotely erased, but its live verification stops working when its membership is paused or its account is closed. Administrators can review event and quest participants.

The global chat is available to active members and administrators. Messages are stored in Supabase; the latest messages load first and older history can be paged in. Members see current profile names/photos, and past messages switch to “Former member” if the account is permanently closed. Paused members cannot access chat until an administrator reactivates them. Administrators can hide and restore inappropriate messages; hidden text is moved to an admin-only table and restored when the message is unhidden, so moderation does not discard its contents. Administrators can also permanently clear the entire chat after typing `CLEAR CHAT`; this deletes all messages, including hidden-message archives, and cannot be undone. The database limits each sender to 8 messages per minute and each message to 1,000 characters.

## Checks

```powershell
npm run lint
npm run typecheck
npm run build
```
