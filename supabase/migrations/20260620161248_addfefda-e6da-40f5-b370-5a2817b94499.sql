-- BodyFuel Smart Onboarding: zus\u00e4tzliche Felder f\u00fcr Autopilot-Generierung
-- Additive Migration. Keine bestehenden Daten werden ver\u00e4ndert.

ALTER TABLE public.smart_nutrition_profile
  ADD COLUMN IF NOT EXISTS eating_style text,                       -- 'meal_prep' | 'fresh' | 'mixed'
  ADD COLUMN IF NOT EXISTS meal_prep_days smallint,                 -- 2..7
  ADD COLUMN IF NOT EXISTS variety_level text,                      -- 'low' | 'medium' | 'high'
  ADD COLUMN IF NOT EXISTS intolerances text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS training_experience text,                -- 'beginner' | 'intermediate' | 'advanced'
  ADD COLUMN IF NOT EXISTS training_location text,                  -- 'gym' | 'home_gym' | 'home'
  ADD COLUMN IF NOT EXISTS training_equipment text,                 -- 'machines' | 'free_weights' | 'both'
  ADD COLUMN IF NOT EXISTS training_duration_min smallint;          -- 30 | 45 | 60 | 90

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS smart_onboarding_completed_at timestamptz;
