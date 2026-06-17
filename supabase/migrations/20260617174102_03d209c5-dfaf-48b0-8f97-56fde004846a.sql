-- ============= EIGENE MAHLZEITEN =============
CREATE TABLE IF NOT EXISTS public.custom_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  meal_slot text NOT NULL DEFAULT 'any' CHECK (meal_slot IN ('breakfast','lunch','dinner','snack','any')),
  ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  kcal integer,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_meals TO authenticated;
GRANT ALL ON public.custom_meals TO service_role;

ALTER TABLE public.custom_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_meals owner all" ON public.custom_meals
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'coach'::app_role))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'coach'::app_role));

CREATE INDEX IF NOT EXISTS custom_meals_user_idx ON public.custom_meals(user_id, created_at DESC);

CREATE TRIGGER trg_custom_meals_updated_at
  BEFORE UPDATE ON public.custom_meals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= PROGRESS FOTOS =============
CREATE TABLE IF NOT EXISTS public.progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  taken_on date NOT NULL DEFAULT (now()::date),
  pose text NOT NULL CHECK (pose IN ('front','side_left','side_right','back')),
  file_path text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_photos TO authenticated;
GRANT ALL ON public.progress_photos TO service_role;

ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "progress_photos owner read"   ON public.progress_photos FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'coach'::app_role));
CREATE POLICY "progress_photos owner insert" ON public.progress_photos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "progress_photos owner delete" ON public.progress_photos FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'coach'::app_role));

CREATE INDEX IF NOT EXISTS progress_photos_user_date_idx
  ON public.progress_photos(user_id, taken_on DESC);

-- ============= FOTO-BEWERTUNGEN =============
CREATE TABLE IF NOT EXISTS public.photo_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  before_date date,
  after_date date NOT NULL DEFAULT (now()::date),
  -- Körperfett: +/=/-
  fat_belly text CHECK (fat_belly IN ('+','=','-')),
  fat_hip   text CHECK (fat_hip   IN ('+','=','-')),
  fat_back  text CHECK (fat_back  IN ('+','=','-')),
  -- Muskulatur: +/=/-
  muscle_chest    text CHECK (muscle_chest    IN ('+','=','-')),
  muscle_shoulder text CHECK (muscle_shoulder IN ('+','=','-')),
  muscle_arms     text CHECK (muscle_arms     IN ('+','=','-')),
  muscle_back     text CHECK (muscle_back     IN ('+','=','-')),
  muscle_legs     text CHECK (muscle_legs     IN ('+','=','-')),
  -- Gesamteindruck
  overall text CHECK (overall IN ('strongly_improved','improved','unchanged','worsened')),
  ai_summary text,
  coach_note text,
  released_to_client boolean NOT NULL DEFAULT false,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_assessments TO authenticated;
GRANT ALL ON public.photo_assessments TO service_role;

ALTER TABLE public.photo_assessments ENABLE ROW LEVEL SECURITY;

-- Kunde sieht nur freigegebene; Coach sieht alles
CREATE POLICY "assessments read" ON public.photo_assessments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach'::app_role)
    OR (user_id = auth.uid() AND released_to_client = true)
  );
CREATE POLICY "assessments coach write" ON public.photo_assessments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coach'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coach'::app_role));

CREATE INDEX IF NOT EXISTS photo_assessments_user_idx
  ON public.photo_assessments(user_id, after_date DESC);

CREATE TRIGGER trg_photo_assessments_updated_at
  BEFORE UPDATE ON public.photo_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();