
-- ===== 1. team_memberships extensions =====
ALTER TABLE public.team_memberships
  ADD COLUMN IF NOT EXISTS gym_access text,
  ADD COLUMN IF NOT EXISTS available_training_days int[],
  ADD COLUMN IF NOT EXISTS limitations text,
  ADD COLUMN IF NOT EXISTS personal_goal text;

-- ===== 2. organization_tasks =====
CREATE TABLE IF NOT EXISTS public.organization_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.organization_teams(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type text NOT NULL,
  title text NOT NULL,
  subtitle text,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  duration_min int,
  status text NOT NULL DEFAULT 'open',
  link_target text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_tasks_user_org ON public.organization_tasks(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_org_tasks_scheduled ON public.organization_tasks(scheduled_for);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_tasks TO authenticated;
GRANT ALL ON public.organization_tasks TO service_role;
ALTER TABLE public.organization_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org tasks read own or staff" ON public.organization_tasks
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_org_staff(auth.uid(), organization_id, 'view_members')
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'coach')
  );
CREATE POLICY "org tasks update own" ON public.organization_tasks
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "org tasks manage by staff" ON public.organization_tasks
  FOR ALL TO authenticated
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_training')
    OR public.has_role(auth.uid(), 'coach')
  )
  WITH CHECK (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_training')
    OR public.has_role(auth.uid(), 'coach')
  );
CREATE TRIGGER trg_org_tasks_updated_at BEFORE UPDATE ON public.organization_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 3. organization_challenges =====
CREATE TABLE IF NOT EXISTS public.organization_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.organization_teams(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_challenges_org ON public.organization_challenges(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_challenges TO authenticated;
GRANT ALL ON public.organization_challenges TO service_role;
ALTER TABLE public.organization_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org challenges read by member" ON public.organization_challenges
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'coach')
  );
CREATE POLICY "org challenges manage by staff" ON public.organization_challenges
  FOR ALL TO authenticated
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_challenges')
    OR public.has_role(auth.uid(), 'coach')
  )
  WITH CHECK (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_challenges')
    OR public.has_role(auth.uid(), 'coach')
  );
CREATE TRIGGER trg_org_challenges_updated_at BEFORE UPDATE ON public.organization_challenges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 4. organization_challenge_progress =====
CREATE TABLE IF NOT EXISTS public.organization_challenge_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.organization_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_challenge_progress TO authenticated;
GRANT ALL ON public.organization_challenge_progress TO service_role;
ALTER TABLE public.organization_challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenge progress read by member" ON public.organization_challenge_progress
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_challenges c
      WHERE c.id = challenge_id
        AND (public.is_org_member(auth.uid(), c.organization_id)
             OR public.has_role(auth.uid(), 'coach'))
    )
  );
CREATE POLICY "challenge progress upsert own" ON public.organization_challenge_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "challenge progress manage by staff" ON public.organization_challenge_progress
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_challenges c
      WHERE c.id = challenge_id
        AND (public.is_org_admin(auth.uid(), c.organization_id)
             OR public.is_org_staff(auth.uid(), c.organization_id, 'manage_challenges')
             OR public.has_role(auth.uid(), 'coach'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_challenges c
      WHERE c.id = challenge_id
        AND (public.is_org_admin(auth.uid(), c.organization_id)
             OR public.is_org_staff(auth.uid(), c.organization_id, 'manage_challenges')
             OR public.has_role(auth.uid(), 'coach'))
    )
  );
CREATE TRIGGER trg_org_challenge_progress_updated_at BEFORE UPDATE ON public.organization_challenge_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 5. organization_activity_log =====
CREATE TABLE IF NOT EXISTS public.organization_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_activity_org ON public.organization_activity_log(organization_id, created_at DESC);

GRANT SELECT, INSERT ON public.organization_activity_log TO authenticated;
GRANT ALL ON public.organization_activity_log TO service_role;
ALTER TABLE public.organization_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org activity read by member" ON public.organization_activity_log
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'coach')
  );
CREATE POLICY "org activity insert own" ON public.organization_activity_log
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_org_member(auth.uid(), organization_id)
  );

-- ===== 6. organization_athletic_plans =====
CREATE TABLE IF NOT EXISTS public.organization_athletic_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.organization_teams(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  focus_areas text[] NOT NULL DEFAULT '{}',
  week_start date,
  status text NOT NULL DEFAULT 'active',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_plans_user ON public.organization_athletic_plans(user_id, organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_athletic_plans TO authenticated;
GRANT ALL ON public.organization_athletic_plans TO service_role;
ALTER TABLE public.organization_athletic_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org plans read own or staff" ON public.organization_athletic_plans
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_org_staff(auth.uid(), organization_id, 'view_members')
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'coach')
  );
CREATE POLICY "org plans manage by staff" ON public.organization_athletic_plans
  FOR ALL TO authenticated
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_training')
    OR public.has_role(auth.uid(), 'coach')
  )
  WITH CHECK (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_training')
    OR public.has_role(auth.uid(), 'coach')
  );
CREATE TRIGGER trg_org_plans_updated_at BEFORE UPDATE ON public.organization_athletic_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 7. Feature flags for Bulls =====
INSERT INTO public.organization_features (organization_id, feature, enabled)
SELECT id, f.feature, f.enabled
FROM public.organizations o,
  (VALUES
    ('home', true),
    ('athletic_training', true),
    ('challenges', true)
  ) AS f(feature, enabled)
WHERE o.slug = 'bulls'
ON CONFLICT DO NOTHING;

-- Community explizit auf false setzen für v1 (Placeholder-only)
UPDATE public.organization_features
SET enabled = false
WHERE feature = 'community'
  AND organization_id = (SELECT id FROM public.organizations WHERE slug = 'bulls');

-- ===== 8. Data migration: bulls_profiles → team_memberships (soft) =====
UPDATE public.team_memberships tm
SET
  position = COALESCE(NULLIF(tm.position, ''), bp.position::text),
  personal_goal = COALESCE(tm.personal_goal, bp.main_goal::text)
FROM public.bulls_profiles bp
JOIN public.organization_teams ot
  ON ot.organization_id = (SELECT id FROM public.organizations WHERE slug = 'bulls')
  AND ot.slug = 'seniors'
WHERE tm.team_id = ot.id
  AND tm.user_id = bp.user_id;
