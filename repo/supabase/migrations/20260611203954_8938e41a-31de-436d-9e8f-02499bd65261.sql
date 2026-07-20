
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS birthdate DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS goal_weight_kg NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS activity_level TEXT;

CREATE TABLE IF NOT EXISTS public.body_measurements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  measured_at DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5,2),
  body_fat_pct NUMERIC(4,1),
  muscle_mass_kg NUMERIC(5,2),
  waist_cm NUMERIC(5,1),
  chest_cm NUMERIC(5,1),
  hip_cm NUMERIC(5,1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_measurements TO authenticated;
GRANT ALL ON public.body_measurements TO service_role;

ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own measurements read"
  ON public.body_measurements FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'coach'::public.app_role));

CREATE POLICY "own measurements insert"
  ON public.body_measurements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own measurements update"
  ON public.body_measurements FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own measurements delete"
  ON public.body_measurements FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS body_measurements_user_date_idx
  ON public.body_measurements (user_id, measured_at DESC);

CREATE TRIGGER body_measurements_updated_at
  BEFORE UPDATE ON public.body_measurements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
