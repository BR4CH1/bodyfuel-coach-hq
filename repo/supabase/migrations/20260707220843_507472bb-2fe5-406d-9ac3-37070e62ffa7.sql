
-- 1) nutrition_plans: org scoping + performance flag
ALTER TABLE public.nutrition_plans
  ADD COLUMN IF NOT EXISTS organization_id uuid NULL REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS performance_context boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS nutrition_plans_org_perf_idx
  ON public.nutrition_plans (organization_id, client_id, performance_context)
  WHERE performance_context = true;

-- Ensure the legacy unique-active-per-client index does not clash with a
-- future performance plan (a user may have a personal plan AND a performance
-- plan active in parallel).
DROP INDEX IF EXISTS public.nutrition_plans_one_active_per_client;
CREATE UNIQUE INDEX IF NOT EXISTS nutrition_plans_one_active_personal_per_client
  ON public.nutrition_plans (client_id, plan_type)
  WHERE status = 'active' AND performance_context = false;
CREATE UNIQUE INDEX IF NOT EXISTS nutrition_plans_one_active_perf_per_client_org
  ON public.nutrition_plans (client_id, organization_id, plan_type)
  WHERE status = 'active' AND performance_context = true;

-- 2) nutrition_plan_meals: modification source
ALTER TABLE public.nutrition_plan_meals
  ADD COLUMN IF NOT EXISTS modification_source text NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nutrition_plan_meals_mod_source_chk'
  ) THEN
    ALTER TABLE public.nutrition_plan_meals
      ADD CONSTRAINT nutrition_plan_meals_mod_source_chk
      CHECK (modification_source IS NULL OR modification_source IN
        ('auto_generated','athlete_swapped','athlete_locked','coach_fixed'));
  END IF;
END $$;

-- 3) performance_plan_jobs
CREATE TABLE IF NOT EXISTS public.performance_plan_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id uuid NULL REFERENCES public.organization_teams(id) ON DELETE SET NULL,
  athlete_user_id uuid NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  trigger text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','completed_with_errors','failed')),
  total_athletes integer NOT NULL DEFAULT 0,
  processed_athletes integer NOT NULL DEFAULT 0,
  generated_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  last_error text NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate pending/processing jobs for the same target window+trigger
CREATE UNIQUE INDEX IF NOT EXISTS performance_plan_jobs_dedupe_idx
  ON public.performance_plan_jobs (
    organization_id,
    coalesce(team_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(athlete_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    week_start,
    trigger
  )
  WHERE status IN ('pending','processing');

CREATE INDEX IF NOT EXISTS performance_plan_jobs_status_idx
  ON public.performance_plan_jobs (status, created_at);

GRANT SELECT, INSERT, UPDATE ON public.performance_plan_jobs TO authenticated;
GRANT ALL ON public.performance_plan_jobs TO service_role;
ALTER TABLE public.performance_plan_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perf_plan_jobs_staff_read"
  ON public.performance_plan_jobs FOR SELECT
  TO authenticated
  USING (
    public.is_org_staff(auth.uid(), organization_id, NULL)
    OR public.is_org_admin(auth.uid(), organization_id)
  );

CREATE POLICY "perf_plan_jobs_staff_insert"
  ON public.performance_plan_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_staff(auth.uid(), organization_id, NULL)
    OR public.is_org_admin(auth.uid(), organization_id)
  );

CREATE TRIGGER trg_perf_plan_jobs_touch
  BEFORE UPDATE ON public.performance_plan_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) performance_plan_history
CREATE TABLE IF NOT EXISTS public.performance_plan_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NULL REFERENCES public.nutrition_plans(id) ON DELETE SET NULL,
  job_id uuid NULL REFERENCES public.performance_plan_jobs(id) ON DELETE SET NULL,
  date date NOT NULL,
  trigger text NOT NULL,
  action text NOT NULL
    CHECK (action IN (
      'GENERATED','REOPTIMIZED','NO_CHANGE',
      'SKIPPED_PAST_DATE','SKIPPED_PROFILE_INCOMPLETE',
      'SKIPPED_TRACKED_DAY','SKIPPED_LIBRARY_TOO_SPARSE',
      'FAILED'
    )),
  previous_day_type text NULL,
  new_day_type text NULL,
  previous_target_kcal integer NULL,
  new_target_kcal integer NULL,
  engine_version text NULL,
  flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  message text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS performance_plan_history_user_date_idx
  ON public.performance_plan_history (user_id, date DESC);
CREATE INDEX IF NOT EXISTS performance_plan_history_job_idx
  ON public.performance_plan_history (job_id);

GRANT SELECT, INSERT ON public.performance_plan_history TO authenticated;
GRANT ALL ON public.performance_plan_history TO service_role;
ALTER TABLE public.performance_plan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perf_plan_history_own_read"
  ON public.performance_plan_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "perf_plan_history_staff_read"
  ON public.performance_plan_history FOR SELECT
  TO authenticated
  USING (
    public.is_org_staff(auth.uid(), organization_id, NULL)
    OR public.is_org_admin(auth.uid(), organization_id)
  );

-- No client insert path — pipeline uses service_role only.
