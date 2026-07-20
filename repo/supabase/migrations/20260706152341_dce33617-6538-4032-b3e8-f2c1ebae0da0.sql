
-- ============================================================
-- 0. ORGANIZATIONS.SETTINGS
-- ============================================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{"allow_athlete_posts": true}'::jsonb;

-- ============================================================
-- 1. EXTEND coach_exercise_library WITH exercise_type
-- ============================================================
ALTER TABLE public.coach_exercise_library
  ADD COLUMN IF NOT EXISTS exercise_type text NOT NULL DEFAULT 'strength'
    CHECK (exercise_type IN ('strength','power','plyometric','sprint','agility','conditioning','mobility','recovery','other'));

CREATE INDEX IF NOT EXISTS idx_cel_exercise_type ON public.coach_exercise_library(exercise_type);

-- ============================================================
-- 2. EXTEND organization_athletic_plans (plan header, template-capable)
-- ============================================================
ALTER TABLE public.organization_athletic_plans
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.organization_athletic_plans
  ADD COLUMN IF NOT EXISTS sport text,
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.organization_athletic_plans
  DROP CONSTRAINT IF EXISTS organization_athletic_plans_status_check;
ALTER TABLE public.organization_athletic_plans
  ADD CONSTRAINT organization_athletic_plans_status_check
    CHECK (status IN ('draft','active','archived'));

-- ============================================================
-- 3. organization_athletic_plan_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organization_athletic_plan_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.organization_athletic_plans(id) ON DELETE CASCADE,
  session_name text NOT NULL,
  description text,
  estimated_duration_minutes integer,
  scheduled_weekdays smallint[] NOT NULL DEFAULT '{}',
  focus_areas text[] NOT NULL DEFAULT '{}',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_plan_sessions_plan ON public.organization_athletic_plan_sessions(plan_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_athletic_plan_sessions TO authenticated;
GRANT ALL ON public.organization_athletic_plan_sessions TO service_role;

ALTER TABLE public.organization_athletic_plan_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org plan sessions read" ON public.organization_athletic_plan_sessions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_athletic_plans p
    WHERE p.id = plan_id
      AND (p.user_id = auth.uid()
        OR public.is_org_member(auth.uid(), p.organization_id)
        OR public.is_org_staff(auth.uid(), p.organization_id, 'view_members')
        OR public.is_org_admin(auth.uid(), p.organization_id)
        OR public.has_role(auth.uid(), 'coach'::public.app_role))
  ));

CREATE POLICY "org plan sessions manage" ON public.organization_athletic_plan_sessions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_athletic_plans p
    WHERE p.id = plan_id
      AND (public.is_org_admin(auth.uid(), p.organization_id)
        OR public.is_org_staff(auth.uid(), p.organization_id, 'manage_training')
        OR public.has_role(auth.uid(), 'coach'::public.app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_athletic_plans p
    WHERE p.id = plan_id
      AND (public.is_org_admin(auth.uid(), p.organization_id)
        OR public.is_org_staff(auth.uid(), p.organization_id, 'manage_training')
        OR public.has_role(auth.uid(), 'coach'::public.app_role))
  ));

CREATE TRIGGER trg_org_plan_sessions_updated
  BEFORE UPDATE ON public.organization_athletic_plan_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. organization_athletic_plan_exercises
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organization_athletic_plan_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.organization_athletic_plan_sessions(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES public.coach_exercise_library(id) ON DELETE SET NULL,
  order_index integer NOT NULL DEFAULT 0,
  sets integer,
  reps text,
  duration_seconds integer,
  rest_seconds integer,
  intensity_target text,
  rir integer,
  tempo text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_plan_exercises_session ON public.organization_athletic_plan_exercises(session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_athletic_plan_exercises TO authenticated;
GRANT ALL ON public.organization_athletic_plan_exercises TO service_role;

ALTER TABLE public.organization_athletic_plan_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org plan exercises read" ON public.organization_athletic_plan_exercises
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_athletic_plan_sessions s
    JOIN public.organization_athletic_plans p ON p.id = s.plan_id
    WHERE s.id = session_id
      AND (p.user_id = auth.uid()
        OR public.is_org_member(auth.uid(), p.organization_id)
        OR public.is_org_staff(auth.uid(), p.organization_id, 'view_members')
        OR public.is_org_admin(auth.uid(), p.organization_id)
        OR public.has_role(auth.uid(), 'coach'::public.app_role))
  ));

CREATE POLICY "org plan exercises manage" ON public.organization_athletic_plan_exercises
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_athletic_plan_sessions s
    JOIN public.organization_athletic_plans p ON p.id = s.plan_id
    WHERE s.id = session_id
      AND (public.is_org_admin(auth.uid(), p.organization_id)
        OR public.is_org_staff(auth.uid(), p.organization_id, 'manage_training')
        OR public.has_role(auth.uid(), 'coach'::public.app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_athletic_plan_sessions s
    JOIN public.organization_athletic_plans p ON p.id = s.plan_id
    WHERE s.id = session_id
      AND (public.is_org_admin(auth.uid(), p.organization_id)
        OR public.is_org_staff(auth.uid(), p.organization_id, 'manage_training')
        OR public.has_role(auth.uid(), 'coach'::public.app_role))
  ));

CREATE TRIGGER trg_org_plan_exercises_updated
  BEFORE UPDATE ON public.organization_athletic_plan_exercises
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. organization_athletic_plan_assignments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organization_athletic_plan_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.organization_athletic_plans(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('organization','team','position','athlete')),
  team_id uuid REFERENCES public.organization_teams(id) ON DELETE CASCADE,
  position text,
  athlete_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_org_plan_assign_plan ON public.organization_athletic_plan_assignments(plan_id);
CREATE INDEX IF NOT EXISTS idx_org_plan_assign_org ON public.organization_athletic_plan_assignments(organization_id, active);
CREATE INDEX IF NOT EXISTS idx_org_plan_assign_athlete ON public.organization_athletic_plan_assignments(athlete_user_id) WHERE athlete_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_plan_assign_team ON public.organization_athletic_plan_assignments(team_id) WHERE team_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_athletic_plan_assignments TO authenticated;
GRANT ALL ON public.organization_athletic_plan_assignments TO service_role;

ALTER TABLE public.organization_athletic_plan_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org plan assign read" ON public.organization_athletic_plan_assignments
  FOR SELECT TO authenticated
  USING (
    athlete_user_id = auth.uid()
    OR public.is_org_member(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'view_members')
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'coach'::public.app_role)
  );

CREATE POLICY "org plan assign manage" ON public.organization_athletic_plan_assignments
  FOR ALL TO authenticated
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_training')
    OR public.has_role(auth.uid(), 'coach'::public.app_role)
  )
  WITH CHECK (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_training')
    OR public.has_role(auth.uid(), 'coach'::public.app_role)
  );

CREATE TRIGGER trg_org_plan_assign_updated
  BEFORE UPDATE ON public.organization_athletic_plan_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6. organization_athletic_session_completions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organization_athletic_session_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.organization_athletic_plans(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.organization_athletic_plan_sessions(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.organization_tasks(id) ON DELETE SET NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  duration_minutes integer,
  rating smallint,
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_session_compl_user ON public.organization_athletic_session_completions(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_session_compl_org ON public.organization_athletic_session_completions(organization_id, completed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_athletic_session_completions TO authenticated;
GRANT ALL ON public.organization_athletic_session_completions TO service_role;

ALTER TABLE public.organization_athletic_session_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org session compl read" ON public.organization_athletic_session_completions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_org_staff(auth.uid(), organization_id, 'view_members')
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'coach'::public.app_role)
  );

CREATE POLICY "org session compl insert own" ON public.organization_athletic_session_completions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "org session compl update own or staff" ON public.organization_athletic_session_completions
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_training')
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'coach'::public.app_role)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_training')
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'coach'::public.app_role)
  );

CREATE TRIGGER trg_org_session_compl_updated
  BEFORE UPDATE ON public.organization_athletic_session_completions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 7. EXTEND organization_challenges
-- ============================================================
ALTER TABLE public.organization_challenges
  ADD COLUMN IF NOT EXISTS visibility_scope text NOT NULL DEFAULT 'organization'
    CHECK (visibility_scope IN ('organization','team','public')),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================
-- 8. organization_challenge_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organization_challenge_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.organization_challenges(id) ON DELETE CASCADE,
  rule_type text NOT NULL CHECK (rule_type IN (
    'daily_task','daily_checkin','training_completed','athletic_training_completed',
    'team_training_attendance','hydration','nutrition','recovery','manual_bonus','custom'
  )),
  title text NOT NULL,
  description text,
  points integer NOT NULL DEFAULT 1,
  frequency text NOT NULL DEFAULT 'per_completion'
    CHECK (frequency IN ('daily','per_completion','once','weekly')),
  max_per_day integer,
  max_total integer,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_challenge_rules_ch ON public.organization_challenge_rules(challenge_id, active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_challenge_rules TO authenticated;
GRANT ALL ON public.organization_challenge_rules TO service_role;

ALTER TABLE public.organization_challenge_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenge rules read" ON public.organization_challenge_rules
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_challenges c
    WHERE c.id = challenge_id
      AND (public.is_org_member(auth.uid(), c.organization_id) OR public.has_role(auth.uid(), 'coach'::public.app_role))
  ));

CREATE POLICY "challenge rules manage" ON public.organization_challenge_rules
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_challenges c
    WHERE c.id = challenge_id
      AND (public.is_org_admin(auth.uid(), c.organization_id)
        OR public.is_org_staff(auth.uid(), c.organization_id, 'manage_challenges')
        OR public.has_role(auth.uid(), 'coach'::public.app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_challenges c
    WHERE c.id = challenge_id
      AND (public.is_org_admin(auth.uid(), c.organization_id)
        OR public.is_org_staff(auth.uid(), c.organization_id, 'manage_challenges')
        OR public.has_role(auth.uid(), 'coach'::public.app_role))
  ));

CREATE TRIGGER trg_org_challenge_rules_updated
  BEFORE UPDATE ON public.organization_challenge_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 9. organization_challenge_point_events (Ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organization_challenge_point_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.organization_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.organization_challenge_rules(id) ON DELETE SET NULL,
  source_type text NOT NULL,
  source_id uuid,
  points integer NOT NULL,
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenge_events_ch_user ON public.organization_challenge_point_events(challenge_id, user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_events_org ON public.organization_challenge_point_events(organization_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_challenge_events_auto
  ON public.organization_challenge_point_events(challenge_id, user_id, rule_id, source_type, source_id, event_date)
  WHERE source_type <> 'manual_bonus' AND rule_id IS NOT NULL AND source_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_challenge_point_events TO authenticated;
GRANT ALL ON public.organization_challenge_point_events TO service_role;

ALTER TABLE public.organization_challenge_point_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenge events read by member" ON public.organization_challenge_point_events
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'coach'::public.app_role)
  );

CREATE POLICY "challenge events write by staff" ON public.organization_challenge_point_events
  FOR ALL TO authenticated
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_challenges')
    OR public.has_role(auth.uid(), 'coach'::public.app_role)
  )
  WITH CHECK (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_challenges')
    OR public.has_role(auth.uid(), 'coach'::public.app_role)
  );

-- ============================================================
-- 10. organization_community_posts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organization_community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.organization_teams(id) ON DELETE SET NULL,
  author_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_role_snapshot text NOT NULL DEFAULT 'athlete',
  post_type text NOT NULL DEFAULT 'general'
    CHECK (post_type IN ('general','staff_update','challenge','training','achievement','announcement')),
  content text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden','deleted')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_community_org_created ON public.organization_community_posts(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_community_team ON public.organization_community_posts(team_id) WHERE team_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_community_posts TO authenticated;
GRANT ALL ON public.organization_community_posts TO service_role;

ALTER TABLE public.organization_community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community posts read by member" ON public.organization_community_posts
  FOR SELECT TO authenticated
  USING (
    status = 'active' AND (
      public.is_org_member(auth.uid(), organization_id)
      OR public.is_org_staff(auth.uid(), organization_id, 'view_members')
      OR public.is_org_admin(auth.uid(), organization_id)
      OR public.has_role(auth.uid(), 'coach'::public.app_role)
    )
  );

CREATE POLICY "community posts insert" ON public.organization_community_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND (
      public.is_org_staff(auth.uid(), organization_id, 'manage_community')
      OR public.is_org_admin(auth.uid(), organization_id)
      OR public.has_role(auth.uid(), 'coach'::public.app_role)
      OR (
        public.is_org_member(auth.uid(), organization_id)
        AND post_type = 'general'
        AND COALESCE(
          (SELECT (settings->>'allow_athlete_posts')::boolean FROM public.organizations WHERE id = organization_id),
          true
        ) = true
      )
    )
  );

CREATE POLICY "community posts update" ON public.organization_community_posts
  FOR UPDATE TO authenticated
  USING (
    author_user_id = auth.uid()
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_community')
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'coach'::public.app_role)
  )
  WITH CHECK (
    author_user_id = auth.uid()
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_community')
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'coach'::public.app_role)
  );

CREATE POLICY "community posts delete" ON public.organization_community_posts
  FOR DELETE TO authenticated
  USING (
    author_user_id = auth.uid()
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_community')
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'coach'::public.app_role)
  );

CREATE TRIGGER trg_org_community_posts_updated
  BEFORE UPDATE ON public.organization_community_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 11. EXTEND daily_checks WITH organization context (nullable)
-- ============================================================
ALTER TABLE public.daily_checks
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.organization_teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_task_id uuid REFERENCES public.organization_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_daily_checks_org ON public.daily_checks(organization_id) WHERE organization_id IS NOT NULL;

DROP POLICY IF EXISTS "org staff view org daily checks" ON public.daily_checks;
CREATE POLICY "org staff view org daily checks" ON public.daily_checks
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL AND (
      public.is_org_staff(auth.uid(), organization_id, 'view_members')
      OR public.is_org_admin(auth.uid(), organization_id)
    )
  );
