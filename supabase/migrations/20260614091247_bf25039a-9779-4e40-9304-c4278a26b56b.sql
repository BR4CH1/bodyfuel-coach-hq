ALTER TABLE public.smart_nutrition_profile
  ADD COLUMN IF NOT EXISTS shopping_days text[] NOT NULL DEFAULT '{}';

UPDATE public.smart_nutrition_profile
  SET shopping_days = ARRAY[shopping_day]
  WHERE shopping_day IS NOT NULL
    AND (shopping_days IS NULL OR array_length(shopping_days, 1) IS NULL);