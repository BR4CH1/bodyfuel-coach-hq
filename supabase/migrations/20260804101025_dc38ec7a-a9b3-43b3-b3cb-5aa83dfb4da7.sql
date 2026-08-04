ALTER TABLE public.coach_exercise_library
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS animation_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_source text,
  ADD COLUMN IF NOT EXISTS technique_hint text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coach_exercise_library_media_type_check'
  ) THEN
    ALTER TABLE public.coach_exercise_library
      ADD CONSTRAINT coach_exercise_library_media_type_check
      CHECK (media_type IS NULL OR media_type IN ('image','gif','video'));
  END IF;
END $$;