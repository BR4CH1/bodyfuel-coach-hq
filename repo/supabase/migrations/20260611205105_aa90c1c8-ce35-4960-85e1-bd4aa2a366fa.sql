
CREATE TABLE IF NOT EXISTS public.weekly_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  weight_kg NUMERIC(5,2),
  body_fat_pct NUMERIC(4,1),
  waist_cm NUMERIC(5,1),
  chest_cm NUMERIC(5,1),
  hip_cm NUMERIC(5,1),
  mood SMALLINT,
  energy SMALLINT,
  sleep_quality SMALLINT,
  training_adherence SMALLINT,
  nutrition_adherence SMALLINT,
  wins TEXT,
  struggles TEXT,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  coach_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_checkins TO authenticated;
GRANT ALL ON public.weekly_checkins TO service_role;

ALTER TABLE public.weekly_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own checkins read"
  ON public.weekly_checkins FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'coach'::public.app_role));

CREATE POLICY "own checkins insert"
  ON public.weekly_checkins FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own checkins update"
  ON public.weekly_checkins FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'coach'::public.app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'coach'::public.app_role));

CREATE POLICY "own checkins delete"
  ON public.weekly_checkins FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS weekly_checkins_user_week_idx
  ON public.weekly_checkins (user_id, week_start DESC);

CREATE TRIGGER weekly_checkins_updated_at
  BEFORE UPDATE ON public.weekly_checkins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
