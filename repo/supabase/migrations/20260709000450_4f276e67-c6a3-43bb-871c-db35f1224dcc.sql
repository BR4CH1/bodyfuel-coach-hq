
-- 1. Erweiterte Spalten auf training_sessions
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS source_ats_id uuid,
  ADD COLUMN IF NOT EXISTS source_week_session_id uuid,
  ADD COLUMN IF NOT EXISTS focus text,
  ADD COLUMN IF NOT EXISTS exercises jsonb,
  ADD COLUMN IF NOT EXISTS progress jsonb,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- eindeutige Abbildung 1:1 athlete_training_session -> training_sessions
CREATE UNIQUE INDEX IF NOT EXISTS training_sessions_source_ats_uidx
  ON public.training_sessions(source_ats_id)
  WHERE source_ats_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS training_sessions_source_week_session_idx
  ON public.training_sessions(source_week_session_id)
  WHERE source_week_session_id IS NOT NULL;

-- FK weich (SET NULL) um Migrations-Sicherheit
DO $$ BEGIN
  ALTER TABLE public.training_sessions
    ADD CONSTRAINT training_sessions_source_ats_fk
    FOREIGN KEY (source_ats_id) REFERENCES public.athlete_training_session(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.training_sessions
    ADD CONSTRAINT training_sessions_source_week_session_fk
    FOREIGN KEY (source_week_session_id) REFERENCES public.org_team_training_week_session(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Mapping-Funktionen
CREATE OR REPLACE FUNCTION public.map_ats_status_to_ts(_s text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _s
    WHEN 'scheduled'   THEN 'planned'
    WHEN 'in_progress' THEN 'in_progress'
    WHEN 'completed'   THEN 'completed'
    WHEN 'skipped'     THEN 'missed'
    ELSE 'planned'
  END
$$;

-- 3. Sync-Trigger: athlete_training_session -> training_sessions
CREATE OR REPLACE FUNCTION public.sync_ats_to_training_sessions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.training_sessions WHERE source_ats_id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public.training_sessions AS ts (
    client_id, session_date, session_type, name,
    training_source, training_type, status,
    organization_id, team_id,
    focus, exercises, progress, completed_at,
    duration_minutes,
    source_ats_id, source_week_session_id,
    created_at, updated_at
  ) VALUES (
    NEW.user_id, NEW.session_date, 'sport', NEW.title,
    'coach', 'team_practice',
    public.map_ats_status_to_ts(NEW.status),
    NEW.organization_id, NEW.team_id,
    NEW.focus, NEW.exercises, NEW.progress, NEW.completed_at,
    NEW.duration_min,
    NEW.id, NEW.source_week_session_id,
    NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (source_ats_id) WHERE source_ats_id IS NOT NULL
  DO UPDATE SET
    session_date = EXCLUDED.session_date,
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    organization_id = EXCLUDED.organization_id,
    team_id = EXCLUDED.team_id,
    focus = EXCLUDED.focus,
    exercises = EXCLUDED.exercises,
    progress = EXCLUDED.progress,
    completed_at = EXCLUDED.completed_at,
    duration_minutes = EXCLUDED.duration_minutes,
    source_week_session_id = EXCLUDED.source_week_session_id,
    updated_at = NEW.updated_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_ats_to_ts ON public.athlete_training_session;
CREATE TRIGGER trg_sync_ats_to_ts
AFTER INSERT OR UPDATE OR DELETE ON public.athlete_training_session
FOR EACH ROW EXECUTE FUNCTION public.sync_ats_to_training_sessions();

-- 4. Backfill: alle bestehenden athlete_training_session in training_sessions materialisieren
INSERT INTO public.training_sessions (
  client_id, session_date, session_type, name,
  training_source, training_type, status,
  organization_id, team_id,
  focus, exercises, progress, completed_at,
  duration_minutes,
  source_ats_id, source_week_session_id,
  created_at, updated_at
)
SELECT
  ats.user_id, ats.session_date, 'sport', ats.title,
  'coach', 'team_practice',
  public.map_ats_status_to_ts(ats.status),
  ats.organization_id, ats.team_id,
  ats.focus, ats.exercises, ats.progress, ats.completed_at,
  ats.duration_min,
  ats.id, ats.source_week_session_id,
  ats.created_at, ats.updated_at
FROM public.athlete_training_session ats
WHERE NOT EXISTS (
  SELECT 1 FROM public.training_sessions ts WHERE ts.source_ats_id = ats.id
);

-- 5. Athleten dürfen ihre coach-sessions in training_sessions auch dann sehen,
-- wenn sie nicht der client_id sind — sie sind es aber immer (client_id = user_id).
-- Bestehende Policies decken das ab (ts self read + ts org read).
COMMENT ON COLUMN public.training_sessions.source_ats_id IS
  'Herkunft: 1:1-Abbildung eines athlete_training_session-Datensatzes (Coach-Team-Training).';
COMMENT ON COLUMN public.training_sessions.source_week_session_id IS
  'Herkunft: dazugehörige org_team_training_week_session (Team-Wochenplan).';
COMMENT ON TABLE public.athlete_training_session IS
  'DEPRECATED als primäre Lesequelle — bleibt für Coach-Team-Session-Materialisierung. Athleten-Kalender liest aus training_sessions.';
