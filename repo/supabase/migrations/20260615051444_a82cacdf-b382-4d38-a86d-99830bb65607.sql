
-- 4-week training plan & richer client profile fields
ALTER TABLE public.training_days
  ADD COLUMN IF NOT EXISTS week_number smallint NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS training_days_plan_week_idx
  ON public.training_days (plan_id, week_number, sort_order);

ALTER TABLE public.nutrition_plans
  ADD COLUMN IF NOT EXISTS weeks_count smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_auto_generated_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sport text,
  ADD COLUMN IF NOT EXISTS injuries text,
  ADD COLUMN IF NOT EXISTS training_experience text
    CHECK (training_experience IN ('beginner','intermediate','advanced') OR training_experience IS NULL);
