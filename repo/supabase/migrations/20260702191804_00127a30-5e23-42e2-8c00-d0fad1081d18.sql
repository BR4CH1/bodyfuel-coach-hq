ALTER TABLE public.smart_nutrition_profile
  ADD COLUMN IF NOT EXISTS diet_style TEXT,
  ADD COLUMN IF NOT EXISTS diet_notes TEXT;