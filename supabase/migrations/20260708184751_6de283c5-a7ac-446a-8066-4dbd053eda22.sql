-- Phase 1+2: Trainingsplan-Engine — set_type für Übungen (Warm-up/Working/Cool-down trennen)
-- day_date auf training_days existiert bereits.

ALTER TABLE public.training_exercises
  ADD COLUMN IF NOT EXISTS set_type text NOT NULL DEFAULT 'working';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'training_exercises_set_type_check'
  ) THEN
    ALTER TABLE public.training_exercises
      ADD CONSTRAINT training_exercises_set_type_check
      CHECK (set_type IN ('warmup','working','backoff','dropset','amrap','cooldown'));
  END IF;
END $$;

-- Backfill anhand des Namens für bestehende Zeilen.
UPDATE public.training_exercises
   SET set_type = 'warmup'
 WHERE set_type = 'working'
   AND (name ILIKE 'Warm-up%' OR name ILIKE 'Warmup%' OR name ILIKE 'Aufwärm%' OR name ILIKE 'Warm up%');

UPDATE public.training_exercises
   SET set_type = 'cooldown'
 WHERE set_type = 'working'
   AND (name ILIKE 'Cool-down%' OR name ILIKE 'Cooldown%' OR name ILIKE 'Abwärm%' OR name ILIKE 'Cool down%' OR name ILIKE 'Stretching%');

CREATE INDEX IF NOT EXISTS training_exercises_day_settype_idx
  ON public.training_exercises (day_id, set_type);
