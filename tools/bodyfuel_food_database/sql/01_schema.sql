-- BodyFuel Food Database Import Kit
--
-- The application migrations are the schema source of truth. In particular, run
-- supabase/migrations/20260722180000_food_macro_unit_integrity.sql before importing.
-- This guard deliberately refuses to create a second foods table.

DO $$
BEGIN
  IF to_regclass('public.nutrition_foods') IS NULL THEN
    RAISE EXCEPTION
      'public.nutrition_foods is missing. Apply the BodyFuel Supabase migrations first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'nutrition_foods'
      AND column_name = 'audit_status'
  ) THEN
    RAISE EXCEPTION
      'Nutrition integrity migration is missing. Apply 20260722180000_food_macro_unit_integrity.sql first.';
  END IF;
END
$$;

COMMENT ON TABLE public.nutrition_foods IS
  'Authoritative BodyFuel food catalog used by import, search, tracker and nutrition plans.';
