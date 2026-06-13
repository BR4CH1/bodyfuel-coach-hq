ALTER TABLE public.nutrition_plan_meals
  ADD COLUMN IF NOT EXISTS recipe_ingredients text[],
  ADD COLUMN IF NOT EXISTS recipe_steps text[],
  ADD COLUMN IF NOT EXISTS recipe_generated_at timestamptz;