ALTER TABLE public.custom_meals
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_path text,
  ADD COLUMN IF NOT EXISTS image_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS image_source text,
  ADD COLUMN IF NOT EXISTS image_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS image_error text;

ALTER TABLE public.custom_meals
  DROP CONSTRAINT IF EXISTS custom_meals_image_status_check;

ALTER TABLE public.custom_meals
  ADD CONSTRAINT custom_meals_image_status_check
  CHECK (image_status IN ('none', 'pending', 'generating', 'ready', 'fallback', 'failed'));

ALTER TABLE public.food_entries
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.food_favorites
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.coach_meal_library
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_path text,
  ADD COLUMN IF NOT EXISTS image_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS image_source text,
  ADD COLUMN IF NOT EXISTS image_generated_at timestamptz;

ALTER TABLE public.coach_meal_library
  DROP CONSTRAINT IF EXISTS coach_meal_library_image_status_check;

ALTER TABLE public.coach_meal_library
  ADD CONSTRAINT coach_meal_library_image_status_check
  CHECK (image_status IN ('none', 'pending', 'generating', 'ready', 'fallback', 'failed'));

ALTER TABLE public.nutrition_plan_meals
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_path text,
  ADD COLUMN IF NOT EXISTS image_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS image_source text,
  ADD COLUMN IF NOT EXISTS image_generated_at timestamptz;

ALTER TABLE public.nutrition_plan_meals
  DROP CONSTRAINT IF EXISTS nutrition_plan_meals_image_status_check;

ALTER TABLE public.nutrition_plan_meals
  ADD CONSTRAINT nutrition_plan_meals_image_status_check
  CHECK (image_status IN ('none', 'pending', 'generating', 'ready', 'fallback', 'failed'));

ALTER TABLE public.nutrition_plan_meal_overrides
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.custom_meals.image_url IS
  'Public URL of the generated or uploaded meal image';
COMMENT ON COLUMN public.custom_meals.image_path IS
  'Storage path in the meal-images bucket';
COMMENT ON COLUMN public.food_entries.image_url IS
  'Image snapshot shown for this tracked entry';
COMMENT ON COLUMN public.nutrition_plan_meals.image_url IS
  'Public URL of the meal image shown in plan and recipe views';

DROP POLICY IF EXISTS "meal images public read" ON storage.objects;
CREATE POLICY "meal images public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'meal-images');