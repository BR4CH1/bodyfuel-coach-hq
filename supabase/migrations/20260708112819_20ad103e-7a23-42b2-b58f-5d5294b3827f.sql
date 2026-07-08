-- =============================================================
-- 1) TRAINING SESSION TEMPLATES (Coach-Vorlagen)
-- =============================================================
CREATE TABLE public.org_training_session_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text NOT NULL,
  description text,
  focus text NOT NULL DEFAULT 'none'
    CHECK (focus IN ('football','strength','speed','agility','conditioning','mobility','recovery','none')),
  duration_min int,
  start_time time,
  end_time time,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ottst_org ON public.org_training_session_template(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_training_session_template TO authenticated;
GRANT ALL ON public.org_training_session_template TO service_role;

ALTER TABLE public.org_training_session_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ottst_read_staff" ON public.org_training_session_template
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach'::app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, NULL)
  );

CREATE POLICY "ottst_write_staff" ON public.org_training_session_template
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach'::app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, NULL)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coach'::app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, NULL)
  );

CREATE TRIGGER ottst_updated_at
  BEFORE UPDATE ON public.org_training_session_template
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 2) FOKUS-FELDER auf org_team_training_week_session
-- =============================================================
ALTER TABLE public.org_team_training_week_session
  ADD COLUMN IF NOT EXISTS focus text
    CHECK (focus IN ('football','strength','speed','agility','conditioning','mobility','recovery','none')),
  ADD COLUMN IF NOT EXISTS focus_source text
    CHECK (focus_source IN ('auto','manual','none'));

-- =============================================================
-- 3) ATHLETE TRAINING SESSION (individuelle Athletik-Session)
-- =============================================================
CREATE TABLE public.athlete_training_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.organization_teams(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  source_week_session_id uuid NOT NULL
    REFERENCES public.org_team_training_week_session(id) ON DELETE CASCADE,
  focus text NOT NULL
    CHECK (focus IN ('strength','speed','agility','conditioning','mobility','recovery')),
  title text NOT NULL,
  position_code text,
  duration_min int,
  exercises jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','in_progress','completed','skipped')),
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_date, source_week_session_id)
);
CREATE INDEX idx_ats_user_date ON public.athlete_training_session(user_id, session_date);
CREATE INDEX idx_ats_team_date ON public.athlete_training_session(team_id, session_date);
CREATE INDEX idx_ats_source ON public.athlete_training_session(source_week_session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_training_session TO authenticated;
GRANT ALL ON public.athlete_training_session TO service_role;

ALTER TABLE public.athlete_training_session ENABLE ROW LEVEL SECURITY;

-- Athlet: sieht + updated seine eigenen Sessions (nur Fortschrittsfelder per Trigger-Guard)
CREATE POLICY "ats_read_own" ON public.athlete_training_session
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'coach'::app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, NULL)
  );

CREATE POLICY "ats_update_own_progress" ON public.athlete_training_session
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Coach/Staff darf alles (Publish-Sync läuft mit service_role, aber Fallback für Verwaltung)
CREATE POLICY "ats_manage_staff" ON public.athlete_training_session
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach'::app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, NULL)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coach'::app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, NULL)
  );

-- Trigger: Athlet darf nur Fortschritts-/Statusfelder ändern
CREATE OR REPLACE FUNCTION public.athlete_training_session_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff boolean;
BEGIN
  v_is_staff :=
    public.has_role(auth.uid(), 'coach'::app_role)
    OR public.is_org_admin(auth.uid(), NEW.organization_id)
    OR public.is_org_staff(auth.uid(), NEW.organization_id, NULL);

  IF v_is_staff THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.team_id IS DISTINCT FROM OLD.team_id
     OR NEW.session_date IS DISTINCT FROM OLD.session_date
     OR NEW.source_week_session_id IS DISTINCT FROM OLD.source_week_session_id
     OR NEW.focus IS DISTINCT FROM OLD.focus
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.position_code IS DISTINCT FROM OLD.position_code
     OR NEW.duration_min IS DISTINCT FROM OLD.duration_min
     OR NEW.exercises IS DISTINCT FROM OLD.exercises
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'athlete_training_session: nur status/progress/completed_at dürfen von Athleten geändert werden';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER ats_update_guard
  BEFORE UPDATE ON public.athlete_training_session
  FOR EACH ROW EXECUTE FUNCTION public.athlete_training_session_update_guard();

CREATE TRIGGER ats_updated_at
  BEFORE UPDATE ON public.athlete_training_session
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 4) SECURITY-FIX: organization_memberships self-update
-- =============================================================
-- Verhindert, dass Mitglieder ihre eigene Rolle/Status per UPDATE ändern.
CREATE OR REPLACE FUNCTION public.organization_memberships_self_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  v_is_admin :=
    public.has_role(auth.uid(), 'coach'::app_role)
    OR public.is_org_admin(auth.uid(), NEW.organization_id)
    OR public.is_org_staff(auth.uid(), NEW.organization_id, 'manage_members');

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Ohne Admin-Recht: role und status müssen unverändert bleiben.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'organization_memberships: role darf nur durch Admins geändert werden';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'organization_memberships: status darf nur durch Admins geändert werden';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'organization_memberships: identifizierende Felder unveränderlich';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS org_memberships_self_update_guard ON public.organization_memberships;
CREATE TRIGGER org_memberships_self_update_guard
  BEFORE UPDATE ON public.organization_memberships
  FOR EACH ROW EXECUTE FUNCTION public.organization_memberships_self_update_guard();