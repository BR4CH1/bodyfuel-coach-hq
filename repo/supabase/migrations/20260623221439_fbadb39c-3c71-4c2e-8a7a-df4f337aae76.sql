
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$ BEGIN
  CREATE TYPE public.nutrition_food_source AS ENUM (
    'bls_4_0','open_food_facts','usda','bodyfuel_verified','ai_estimate','manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.nutrition_food_unit AS ENUM ('raw','cooked','ml','piece');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.nutrition_food_state AS ENUM ('raw','cooked','n_a');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.nutrition_foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  category text,
  source public.nutrition_food_source NOT NULL DEFAULT 'manual',
  source_id text,
  source_name text,
  license text,
  citation text,
  kcal_per_100g numeric(8,2) NOT NULL,
  protein_per_100g numeric(7,2) NOT NULL DEFAULT 0,
  carbs_per_100g numeric(7,2) NOT NULL DEFAULT 0,
  fat_per_100g numeric(7,2) NOT NULL DEFAULT 0,
  fiber_per_100g numeric(7,2),
  sugar_per_100g numeric(7,2),
  salt_per_100g numeric(7,2),
  unit_type public.nutrition_food_unit NOT NULL DEFAULT 'raw',
  default_state public.nutrition_food_state NOT NULL DEFAULT 'raw',
  density_g_per_ml numeric(6,3),
  verified_by_coach boolean NOT NULL DEFAULT false,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  needs_review boolean NOT NULL DEFAULT false,
  review_reason text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_nutrition_foods_name_trgm
  ON public.nutrition_foods USING gin (name public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_nutrition_foods_verified
  ON public.nutrition_foods (verified_by_coach) WHERE verified_by_coach = true;
CREATE INDEX IF NOT EXISTS idx_nutrition_foods_review
  ON public.nutrition_foods (needs_review) WHERE needs_review = true;
CREATE INDEX IF NOT EXISTS idx_nutrition_foods_source
  ON public.nutrition_foods (source);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_foods TO authenticated;
GRANT ALL ON public.nutrition_foods TO service_role;

ALTER TABLE public.nutrition_foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read foods" ON public.nutrition_foods
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "coaches insert foods" ON public.nutrition_foods
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'coach'));
CREATE POLICY "coaches update foods" ON public.nutrition_foods
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'coach'))
  WITH CHECK (public.has_role(auth.uid(),'coach'));
CREATE POLICY "coaches delete foods" ON public.nutrition_foods
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'coach'));

DROP TRIGGER IF EXISTS trg_nutrition_foods_updated_at ON public.nutrition_foods;
CREATE TRIGGER trg_nutrition_foods_updated_at
  BEFORE UPDATE ON public.nutrition_foods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.nutrition_foods_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_calc numeric; v_diff numeric;
BEGIN
  v_calc := NEW.protein_per_100g*4 + NEW.carbs_per_100g*4 + NEW.fat_per_100g*9;
  IF NEW.kcal_per_100g > 0 AND v_calc > 0 THEN
    v_diff := abs(v_calc - NEW.kcal_per_100g) / NEW.kcal_per_100g;
    IF v_diff > 0.05 AND NEW.verified_by_coach = false THEN
      NEW.needs_review := true;
      NEW.review_reason := COALESCE(NEW.review_reason,
        'Makro-Kalorien-Abweichung ' || round(v_diff*100)::text || '%');
    END IF;
  END IF;
  IF NEW.verified_by_coach = true THEN
    NEW.verified_at := COALESCE(NEW.verified_at, now());
    NEW.needs_review := false;
    NEW.review_reason := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_nutrition_foods_validate ON public.nutrition_foods;
CREATE TRIGGER trg_nutrition_foods_validate
  BEFORE INSERT OR UPDATE ON public.nutrition_foods
  FOR EACH ROW EXECUTE FUNCTION public.nutrition_foods_validate();
