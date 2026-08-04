ALTER TABLE public.nutrition_plan_days
  ADD COLUMN IF NOT EXISTS target_kcal integer,
  ADD COLUMN IF NOT EXISTS target_protein_g integer,
  ADD COLUMN IF NOT EXISTS target_carbs_g integer,
  ADD COLUMN IF NOT EXISTS target_fat_g integer;

COMMENT ON COLUMN public.nutrition_plan_days.target_kcal IS 'Optionales individuelles Tagesziel (überschreibt Profilziel nur in diesem Plan). NULL = Profilziel.';
COMMENT ON COLUMN public.nutrition_plan_days.target_protein_g IS 'Optionales individuelles Protein-Tagesziel in g. NULL = Profilziel.';
COMMENT ON COLUMN public.nutrition_plan_days.target_carbs_g IS 'Optionales individuelles Kohlenhydrat-Tagesziel in g. NULL = Profilziel.';
COMMENT ON COLUMN public.nutrition_plan_days.target_fat_g IS 'Optionales individuelles Fett-Tagesziel in g. NULL = Profilziel.';