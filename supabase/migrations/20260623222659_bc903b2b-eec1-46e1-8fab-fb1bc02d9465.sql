-- Add data-source / DB-verification metadata to AI-generated plan meals
ALTER TABLE public.nutrition_plan_meals
  ADD COLUMN IF NOT EXISTS data_source text NOT NULL DEFAULT 'ai_estimate',
  ADD COLUMN IF NOT EXISTS verified_ratio numeric;

COMMENT ON COLUMN public.nutrition_plan_meals.data_source IS
  'Quelle der Nährwerte: db_verified (≥80% Zutaten aus BodyFuel-DB), db_mixed (40-80%), ai_estimate (<40% oder nicht geprüft), coach_verified (manuell freigegeben).';
COMMENT ON COLUMN public.nutrition_plan_meals.verified_ratio IS
  'Anteil 0..1 der Zutaten, die in nutrition_foods gefunden wurden.';

-- Soft check: allow only the four valid labels
ALTER TABLE public.nutrition_plan_meals DROP CONSTRAINT IF EXISTS nutrition_plan_meals_data_source_chk;
ALTER TABLE public.nutrition_plan_meals
  ADD CONSTRAINT nutrition_plan_meals_data_source_chk
  CHECK (data_source IN ('db_verified','db_mixed','ai_estimate','coach_verified'));