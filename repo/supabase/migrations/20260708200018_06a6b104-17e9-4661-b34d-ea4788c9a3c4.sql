CREATE TYPE public.training_smart_lock AS ENUM ('none','locked','weight_only','reps_only','volume_only');

ALTER TABLE public.training_exercises
  ADD COLUMN IF NOT EXISTS smart_lock public.training_smart_lock NOT NULL DEFAULT 'none';

COMMENT ON COLUMN public.training_exercises.smart_lock IS
  'Coach-Lock für Smart-Progression: none=frei, locked=keine Änderung, weight_only/reps_only/volume_only=nur diese Dimension darf progressieren.';