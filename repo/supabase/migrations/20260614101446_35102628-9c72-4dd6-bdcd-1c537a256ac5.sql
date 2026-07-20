ALTER TABLE public.smart_nutrition_profile
  ADD COLUMN IF NOT EXISTS training_weekdays text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.smart_nutrition_profile
  DROP CONSTRAINT IF EXISTS smart_nutrition_profile_training_weekdays_check;

ALTER TABLE public.smart_nutrition_profile
  ADD CONSTRAINT smart_nutrition_profile_training_weekdays_check
  CHECK (training_weekdays <@ ARRAY['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::text[]);