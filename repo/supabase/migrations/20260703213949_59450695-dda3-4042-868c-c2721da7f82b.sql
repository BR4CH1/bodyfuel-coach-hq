ALTER TABLE public.nutrition_plan_days
  ADD COLUMN IF NOT EXISTS day_type text CHECK (day_type IN ('training','rest')),
  ADD COLUMN IF NOT EXISTS day_date date;

CREATE INDEX IF NOT EXISTS nutrition_plan_days_day_date_idx
  ON public.nutrition_plan_days (plan_id, day_date);