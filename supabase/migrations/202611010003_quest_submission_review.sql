alter table public.quest_submissions
  add column if not exists reviewer_feedback text not null default '';

create unique index if not exists quest_submissions_one_active_attempt_idx
  on public.quest_submissions (quest_id, user_id)
  where status in ('submitted', 'verified');

revoke all on public.quest_submissions from anon, authenticated;
grant select on public.quest_submissions to authenticated;

create or replace function public.submit_orbit_quest_work(
  p_quest_id uuid,
  p_submission_text text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_community_id uuid;
  v_deadline timestamptz;
  v_submission_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in to submit quest work.';
  end if;

  if public.is_platform_admin() then
    raise exception 'Administrators cannot submit member quest work.';
  end if;

  if char_length(btrim(coalesce(p_submission_text, ''))) not between 1 and 3000 then
    raise exception 'Submission details must be between 1 and 3,000 characters.';
  end if;

  select quests.community_id, quests.deadline
  into v_community_id, v_deadline
  from public.quests
  where quests.id = p_quest_id
  for update;

  if not found then
    raise exception 'This quest is no longer available.';
  end if;

  if v_deadline is not null and v_deadline <= now() then
    raise exception 'The deadline for this quest has passed.';
  end if;

  if not exists (
    select 1
    from public.memberships
    where memberships.community_id = v_community_id
      and memberships.user_id = v_user_id
      and memberships.status = 'active'
      and (memberships.sleep_until is null or memberships.sleep_until <= now())
  ) then
    raise exception 'An active, awake membership is required to submit quest work.';
  end if;

  if not exists (
    select 1
    from public.quest_registrations
    where quest_registrations.quest_id = p_quest_id
      and quest_registrations.user_id = v_user_id
      and quest_registrations.status = 'registered'
  ) then
    raise exception 'Join this quest before submitting your work.';
  end if;

  if exists (
    select 1
    from public.quest_submissions
    where quest_submissions.quest_id = p_quest_id
      and quest_submissions.user_id = v_user_id
      and quest_submissions.status in ('submitted', 'verified')
  ) then
    raise exception 'This quest already has a submission awaiting review or an approved submission.';
  end if;

  insert into public.quest_submissions (quest_id, user_id, submission_text)
  values (p_quest_id, v_user_id, btrim(p_submission_text))
  returning id into v_submission_id;

  return v_submission_id;
end;
$$;

create or replace function public.review_orbit_quest_submission(
  p_submission_id uuid,
  p_status text,
  p_feedback text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quest_id uuid;
  v_user_id uuid;
  v_submission_status text;
  v_community_id uuid;
  v_xp_reward integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Only an ORBIT administrator can review quest work.';
  end if;

  if p_status is null or p_status not in ('verified', 'rejected') then
    raise exception 'Choose whether to approve or reject this submission.';
  end if;

  if char_length(btrim(coalesce(p_feedback, ''))) > 1000 then
    raise exception 'Feedback cannot be longer than 1,000 characters.';
  end if;

  if p_status = 'rejected'
    and char_length(btrim(coalesce(p_feedback, ''))) not between 1 and 1000 then
    raise exception 'Add feedback of 1 to 1,000 characters when rejecting a submission.';
  end if;

  select quest_submissions.quest_id, quest_submissions.user_id, quest_submissions.status
  into v_quest_id, v_user_id, v_submission_status
  from public.quest_submissions
  where quest_submissions.id = p_submission_id
  for update;

  if not found then
    raise exception 'This quest submission could not be found.';
  end if;

  if v_submission_status <> 'submitted' then
    raise exception 'This submission has already been reviewed.';
  end if;

  select quests.community_id, quests.xp_reward
  into v_community_id, v_xp_reward
  from public.quests
  where quests.id = v_quest_id;

  update public.quest_submissions
  set status = p_status,
      reviewer_feedback = btrim(coalesce(p_feedback, '')),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_submission_id;

  if p_status = 'verified' and v_xp_reward > 0 then
    insert into public.xp_ledger (community_id, user_id, submission_id, points)
    values (v_community_id, v_user_id, p_submission_id, v_xp_reward);
  end if;

  return p_submission_id;
end;
$$;

revoke all on function public.submit_orbit_quest_work(uuid, text) from public, anon;
grant execute on function public.submit_orbit_quest_work(uuid, text) to authenticated;

revoke all on function public.review_orbit_quest_submission(uuid, text, text) from public, anon;
grant execute on function public.review_orbit_quest_submission(uuid, text, text) to authenticated;

revoke insert, update, delete on public.quest_submissions from authenticated;
revoke insert on public.xp_ledger from authenticated;
