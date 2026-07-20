ALTER TABLE public.nutrition_plan_days
  ADD COLUMN IF NOT EXISTS week_number integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS nutrition_plan_days_plan_week_idx
  ON public.nutrition_plan_days(plan_id, week_number, sort_order);