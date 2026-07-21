ALTER TABLE public.nutrition_foods
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_source text;

COMMENT ON COLUMN public.nutrition_foods.image_url IS
  'Public thumbnail URL for food search results';

COMMENT ON COLUMN public.nutrition_foods.image_source IS
  'bodyfuel, open_food_facts, brand or manual';