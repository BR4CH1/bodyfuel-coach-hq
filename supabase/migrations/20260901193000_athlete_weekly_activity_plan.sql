-- Weekly training-plan overlay for courses, home workouts and per-day step targets.
-- Kept separate from training_days so a day can contain BOTH a normal gym workout
-- and additional activities (e.g. Tuesday: Push + Spinning + 10k steps).

create table if not exists public.athlete_weekly_activity_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  step_target integer null check (step_target between 0 and 100000),
  activities jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint athlete_weekly_activity_plan_user_weekday_key unique (user_id, weekday),
  constraint athlete_weekly_activity_plan_activities_array_check
    check (jsonb_typeof(activities) = 'array')
);

create index if not exists athlete_weekly_activity_plan_user_idx
  on public.athlete_weekly_activity_plan(user_id);

alter table public.athlete_weekly_activity_plan enable row level security;

-- Athletes may read their own weekly targets. All coach writes go through the
-- authenticated server functions, which enforce coach/org-staff access and use
-- the server-side admin client.
drop policy if exists "athletes_read_own_weekly_activity_plan" on public.athlete_weekly_activity_plan;
create policy "athletes_read_own_weekly_activity_plan"
  on public.athlete_weekly_activity_plan
  for select
  to authenticated
  using (auth.uid() = user_id);
