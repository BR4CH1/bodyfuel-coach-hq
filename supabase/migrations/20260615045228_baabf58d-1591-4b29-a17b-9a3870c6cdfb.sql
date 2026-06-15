
ALTER TABLE public.smart_nutrition_profile
  ADD COLUMN IF NOT EXISTS auto_publish_training boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS training_session_minutes integer;

ALTER TABLE public.training_exercises
  ADD COLUMN IF NOT EXISTS rest_seconds integer,
  ADD COLUMN IF NOT EXISTS category text;

ALTER TABLE public.training_exercises
  DROP CONSTRAINT IF EXISTS training_exercises_category_check;
ALTER TABLE public.training_exercises
  ADD CONSTRAINT training_exercises_category_check
  CHECK (category IS NULL OR category IN ('barbell','dumbbell','machine','cardio','core','bodyweight','cable'));
