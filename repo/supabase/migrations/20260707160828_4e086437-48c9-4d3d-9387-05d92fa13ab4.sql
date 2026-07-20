CREATE TABLE public.athlete_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  checkin_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  sleep smallint,
  energy smallint,
  stress smallint,
  training_feel smallint,
  pain_level smallint,
  pain_note text,
  notes text,
  weight_kg numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT athlete_checkins_sleep_range CHECK (sleep IS NULL OR (sleep >= 1 AND sleep <= 5)),
  CONSTRAINT athlete_checkins_energy_range CHECK (energy IS NULL OR (energy >= 1 AND energy <= 5)),
  CONSTRAINT athlete_checkins_stress_range CHECK (stress IS NULL OR (stress >= 1 AND stress <= 5)),
  CONSTRAINT athlete_checkins_training_range CHECK (training_feel IS NULL OR (training_feel >= 1 AND training_feel <= 5)),
  CONSTRAINT athlete_checkins_pain_range CHECK (pain_level IS NULL OR (pain_level >= 0 AND pain_level <= 5)),
  CONSTRAINT athlete_checkins_notes_len CHECK (notes IS NULL OR char_length(notes) <= 2000),
  CONSTRAINT athlete_checkins_pain_note_len CHECK (pain_note IS NULL OR char_length(pain_note) <= 500),
  CONSTRAINT athlete_checkins_unique_per_day UNIQUE (user_id, checkin_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_checkins TO authenticated;
GRANT ALL ON public.athlete_checkins TO service_role;

ALTER TABLE public.athlete_checkins ENABLE ROW LEVEL SECURITY;

-- Athlet: eigene Check-ins voll verwalten
CREATE POLICY "athlete_checkins_own_all"
  ON public.athlete_checkins
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Coach/Staff: alle Check-ins der Athleten der eigenen Org LESEN
CREATE POLICY "athlete_checkins_coach_read"
  ON public.athlete_checkins
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach'::app_role)
    OR (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.staff_assignments s
        WHERE s.user_id = auth.uid()
          AND s.organization_id = athlete_checkins.organization_id
      )
    )
  );

CREATE INDEX idx_athlete_checkins_user_date
  ON public.athlete_checkins (user_id, checkin_date DESC);
CREATE INDEX idx_athlete_checkins_org_date
  ON public.athlete_checkins (organization_id, checkin_date DESC)
  WHERE organization_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.athlete_checkins_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_athlete_checkins_touch_updated_at
  BEFORE UPDATE ON public.athlete_checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.athlete_checkins_touch_updated_at();
