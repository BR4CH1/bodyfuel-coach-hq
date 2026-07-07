
CREATE UNIQUE INDEX IF NOT EXISTS performance_plan_jobs_team_active_uniq
  ON public.performance_plan_jobs (organization_id, team_id, week_start, trigger)
  WHERE status IN ('pending', 'processing') AND team_id IS NOT NULL AND athlete_user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS performance_plan_jobs_athlete_active_uniq
  ON public.performance_plan_jobs (organization_id, athlete_user_id, week_start, trigger)
  WHERE status IN ('pending', 'processing') AND athlete_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS performance_plan_jobs_org_active_uniq
  ON public.performance_plan_jobs (organization_id, week_start, trigger)
  WHERE status IN ('pending', 'processing') AND team_id IS NULL AND athlete_user_id IS NULL;
