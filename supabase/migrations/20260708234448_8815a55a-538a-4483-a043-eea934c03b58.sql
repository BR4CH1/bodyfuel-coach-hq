-- ============================================================
-- PHASE 1: FUNDAMENT — Profilbild + zentrale training_sessions
-- ============================================================

-- 1) PROFILBILD: avatar_url auf profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2) TRAINING_SESSIONS zur zentralen SoT erweitern
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.organization_teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS training_source text NOT NULL DEFAULT 'athlete',
  ADD COLUMN IF NOT EXISTS training_type text,
  ADD COLUMN IF NOT EXISTS load_category text,
  ADD COLUMN IF NOT EXISTS intensity_target smallint,
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS mandatory boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS template_id uuid,
  ADD COLUMN IF NOT EXISTS session_rpe smallint,
  ADD COLUMN IF NOT EXISTS actual_duration_minutes smallint,
  ADD COLUMN IF NOT EXISTS pain_reported boolean;

-- Backfill: alte Zeilen sind vom Athleten selbst gemeldete, absolvierte Einheiten
UPDATE public.training_sessions
   SET training_source = 'athlete',
       status = 'completed',
       training_type = COALESCE(training_type, CASE
         WHEN session_type = 'strength' THEN 'strength'
         WHEN session_type = 'cardio'   THEN 'conditioning'
         WHEN session_type = 'class'    THEN 'team_practice'
         WHEN session_type = 'mobility' THEN 'mobility'
         WHEN session_type = 'sport'    THEN 'competition'
         ELSE 'individual_training'
       END)
 WHERE training_source IS NULL OR training_type IS NULL;

-- Constraints (nach Backfill, mit NOT VALID Vermeidung)
DO $$ BEGIN
  ALTER TABLE public.training_sessions
    ADD CONSTRAINT training_sessions_source_check
    CHECK (training_source IN ('coach','smart','athlete','system'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.training_sessions
    ADD CONSTRAINT training_sessions_training_type_check
    CHECK (training_type IS NULL OR training_type IN (
      'team_practice','strength','conditioning','speed','mobility',
      'position_training','recovery','smart_workout','individual_training',
      'competition','gameday'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.training_sessions
    ADD CONSTRAINT training_sessions_load_category_check
    CHECK (load_category IS NULL OR load_category IN ('recovery','low','moderate','high','very_high'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.training_sessions
    ADD CONSTRAINT training_sessions_status_check2
    CHECK (status IN ('planned','in_progress','completed','partially_completed','missed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.training_sessions
    ADD CONSTRAINT training_sessions_session_rpe_check
    CHECK (session_rpe IS NULL OR (session_rpe BETWEEN 1 AND 10));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Indexe für Coach/Team/Org-Views
CREATE INDEX IF NOT EXISTS training_sessions_org_date_idx
  ON public.training_sessions (organization_id, session_date DESC)
  WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS training_sessions_team_date_idx
  ON public.training_sessions (team_id, session_date DESC)
  WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS training_sessions_client_status_idx
  ON public.training_sessions (client_id, status, session_date DESC);

-- 3) NEUE RLS-POLICIES: Org-Mitglieder + Coach/Admin einer Org

-- Org-Mitglieder lesen Einheiten ihrer Organisation
DROP POLICY IF EXISTS "ts org read" ON public.training_sessions;
CREATE POLICY "ts org read" ON public.training_sessions
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.is_org_member(auth.uid(), organization_id)
  );

-- Coaches/Vereinsleitung planen und verwalten für ihre Organisation
DROP POLICY IF EXISTS "ts org staff manage" ON public.training_sessions;
CREATE POLICY "ts org staff manage" ON public.training_sessions
  FOR ALL TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.is_org_admin(auth.uid(), organization_id)
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND public.is_org_admin(auth.uid(), organization_id)
  );

-- 4) updated_at Trigger falls nicht vorhanden
DO $$ BEGIN
  CREATE TRIGGER trg_training_sessions_updated_at
    BEFORE UPDATE ON public.training_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
