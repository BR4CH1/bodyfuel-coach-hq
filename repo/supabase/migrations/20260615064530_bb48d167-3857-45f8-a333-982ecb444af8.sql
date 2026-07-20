-- 1) Athleten-Felder am Profil erweitern
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sport_position text,
  ADD COLUMN IF NOT EXISTS sport_level text,
  ADD COLUMN IF NOT EXISTS team_sport boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS match_days_per_week smallint,
  ADD COLUMN IF NOT EXISTS practice_days_per_week smallint,
  ADD COLUMN IF NOT EXISTS season_phase text,
  ADD COLUMN IF NOT EXISTS class_types text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS class_days_per_week smallint,
  ADD COLUMN IF NOT EXISTS mobility_frequency text,
  ADD COLUMN IF NOT EXISTS mobility_focus text,
  ADD COLUMN IF NOT EXISTS cardio_outside_gym text,
  ADD COLUMN IF NOT EXISTS athlete_profile_updated_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_sport_level_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_sport_level_check CHECK (
    sport_level IS NULL OR sport_level IN ('recreational','amateur','semi_pro','pro','coach')
  );

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_season_phase_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_season_phase_check CHECK (
    season_phase IS NULL OR season_phase IN ('off_season','pre_season','in_season','post_season')
  );

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_mobility_frequency_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_mobility_frequency_check CHECK (
    mobility_frequency IS NULL OR mobility_frequency IN ('none','1_2x','3_4x','daily')
  );

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_match_days_range_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_match_days_range_check CHECK (
    match_days_per_week IS NULL OR (match_days_per_week BETWEEN 0 AND 7)
  );

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_practice_days_range_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_practice_days_range_check CHECK (
    practice_days_per_week IS NULL OR (practice_days_per_week BETWEEN 0 AND 7)
  );

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_class_days_range_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_class_days_range_check CHECK (
    class_days_per_week IS NULL OR (class_days_per_week BETWEEN 0 AND 7)
  );

-- 2) Freie Trainingseinheiten (Kurse / Mobility / Cardio / Sport / sonstiges)
CREATE TABLE IF NOT EXISTS public.training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  session_type text NOT NULL,
  name text NOT NULL,
  duration_minutes smallint,
  intensity smallint,
  sets smallint,
  reps text,
  weight_kg numeric(6,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_sessions_type_check CHECK (
    session_type IN ('strength','cardio','class','mobility','sport','other')
  ),
  CONSTRAINT training_sessions_intensity_check CHECK (
    intensity IS NULL OR (intensity BETWEEN 1 AND 10)
  ),
  CONSTRAINT training_sessions_duration_check CHECK (
    duration_minutes IS NULL OR (duration_minutes BETWEEN 1 AND 600)
  ),
  CONSTRAINT training_sessions_name_check CHECK (length(btrim(name)) BETWEEN 1 AND 120)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_sessions TO authenticated;
GRANT ALL ON public.training_sessions TO service_role;

ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ts self read"
  ON public.training_sessions FOR SELECT TO authenticated
  USING (auth.uid() = client_id);
CREATE POLICY "ts coach read"
  ON public.training_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));
CREATE POLICY "ts self insert"
  ON public.training_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = client_id);
CREATE POLICY "ts self update"
  ON public.training_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = client_id) WITH CHECK (auth.uid() = client_id);
CREATE POLICY "ts self delete"
  ON public.training_sessions FOR DELETE TO authenticated
  USING (auth.uid() = client_id);

CREATE INDEX IF NOT EXISTS training_sessions_client_date_idx
  ON public.training_sessions (client_id, session_date DESC);

CREATE TRIGGER training_sessions_updated_at
  BEFORE UPDATE ON public.training_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();