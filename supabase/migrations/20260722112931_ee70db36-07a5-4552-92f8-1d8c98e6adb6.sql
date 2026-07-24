-- BodyFuel nutrition integrity
-- 1) liquids are stored/displayed per 100 ml; all other foods per 100 g
-- 2) every row is audited with EU 1169/2011 energy factors
-- 3) unsafe rows are removed from the Smart/search pool, never silently trusted

ALTER TABLE public.nutrition_foods
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS language_code text NOT NULL DEFAULT 'de',
  ADD COLUMN IF NOT EXISTS country_codes text[],
  ADD COLUMN IF NOT EXISTS quality_score smallint,
  ADD COLUMN IF NOT EXISTS source_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS raw_data jsonb,
  ADD COLUMN IF NOT EXISTS macro_reference_unit text NOT NULL DEFAULT 'g',
  ADD COLUMN IF NOT EXISTS volume_conversion_estimated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS saturated_fat_per_100g numeric(7,2),
  ADD COLUMN IF NOT EXISTS sodium_mg_per_100g numeric(9,2),
  ADD COLUMN IF NOT EXISTS alcohol_per_100g numeric(7,2),
  ADD COLUMN IF NOT EXISTS polyols_per_100g numeric(7,2),
  ADD COLUMN IF NOT EXISTS organic_acids_per_100g numeric(7,2),
  ADD COLUMN IF NOT EXISTS audit_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS audited_at timestamptz,
  ADD COLUMN IF NOT EXISTS search_text text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.nutrition_foods.macro_reference_unit IS
  'Reference basis for all legacy *_per_100g columns: g for solids, ml for liquids.';

CREATE OR REPLACE FUNCTION public.normalize_food_search(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT trim(
    regexp_replace(
      replace(replace(replace(replace(lower(coalesce(_value, '')), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'),
      '[^a-z0-9]+', ' ', 'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.nutrition_foods_search_text_sync()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_text := public.normalize_food_search(
    concat_ws(' ', NEW.name, NEW.brand, NEW.source_name, array_to_string(NEW.aliases, ' '))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nutrition_foods_search_text ON public.nutrition_foods;
CREATE TRIGGER trg_nutrition_foods_search_text
  BEFORE INSERT OR UPDATE OF name, brand, source_name, aliases ON public.nutrition_foods
  FOR EACH ROW EXECUTE FUNCTION public.nutrition_foods_search_text_sync();

UPDATE public.nutrition_foods
SET search_text = public.normalize_food_search(
  concat_ws(' ', name, brand, source_name, array_to_string(aliases, ' '))
);

CREATE INDEX IF NOT EXISTS nutrition_foods_search_text_trgm_idx
  ON public.nutrition_foods USING gin (search_text gin_trgm_ops);

CREATE UNIQUE INDEX IF NOT EXISTS nutrition_foods_barcode_unique
  ON public.nutrition_foods (barcode)
  WHERE barcode IS NOT NULL AND barcode <> '';

-- A former import kit wrote USDA/OFF rows to public.foods while the app itself used
-- public.nutrition_foods. Copy complete legacy rows once; an existing catalog row wins.
-- USDA carbohydrate-by-difference includes fibre, so it is normalised to available
-- carbohydrate here. Incomplete legacy rows stay outside the live catalog.
INSERT INTO public.nutrition_foods (
  name, aliases, category, source, source_id, text_id, source_name, license, citation,
  kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
  fiber_per_100g, sugar_per_100g, salt_per_100g, unit_type, default_state,
  verified_by_coach, needs_review, is_active, barcode, brand, language_code,
  country_codes, quality_score, source_verified, source_updated_at, imported_at,
  raw_data, macro_reference_unit, saturated_fat_per_100g, sodium_mg_per_100g
)
SELECT
  f.name,
  '{}'::text[],
  f.category,
  CASE
    WHEN f.source = 'bls_4_0' THEN 'bls_4_0'
    WHEN f.source = 'open_food_facts' THEN 'open_food_facts'
    WHEN f.source LIKE 'usda%' THEN 'usda'
    WHEN f.source = 'bodyfuel_verified' THEN 'bodyfuel_verified'
    WHEN f.source = 'ai_estimate' THEN 'ai_estimate'
    ELSE 'manual'
  END::public.nutrition_food_source,
  f.source_id,
  'import_' || substr(md5(f.source || ':' || f.source_id), 1, 24),
  f.source,
  CASE
    WHEN f.source = 'bls_4_0' THEN 'CC BY 4.0'
    WHEN f.source = 'open_food_facts' THEN 'ODbL'
    WHEN f.source LIKE 'usda%' THEN 'CC0 / Public Domain'
    ELSE NULL
  END,
  CASE
    WHEN f.source = 'bls_4_0' THEN 'Bundeslebensmittelschlüssel (BLS), Max Rubner-Institut'
    WHEN f.source = 'open_food_facts' THEN 'Open Food Facts'
    WHEN f.source LIKE 'usda%' THEN 'USDA FoodData Central, FDC ' || f.source_id
    ELSE NULL
  END,
  f.kcal,
  f.protein_g,
  CASE
    WHEN f.source LIKE 'usda%' THEN greatest(0, f.carbohydrates_g - coalesce(f.fiber_g, 0))
    ELSE f.carbohydrates_g
  END,
  f.fat_g,
  f.fiber_g,
  f.sugar_g,
  f.salt_g,
  'raw'::public.nutrition_food_unit,
  'n_a'::public.nutrition_food_state,
  false,
  false,
  f.is_active,
  CASE
    WHEN nullif(trim(coalesce(f.barcode, '')), '') IS NOT NULL
      AND f.id = (SELECT min(f2.id) FROM public.foods f2 WHERE f2.barcode = f.barcode)
      AND NOT EXISTS (
        SELECT 1 FROM public.nutrition_foods nf WHERE nf.barcode = f.barcode
      )
    THEN f.barcode
    ELSE NULL
  END,
  f.brand,
  coalesce(f.language_code, 'de'),
  f.country_codes,
  f.quality_score,
  CASE
    WHEN f.source = 'bls_4_0' THEN true
    WHEN f.source LIKE 'usda%foundation%' THEN true
    ELSE coalesce(f.is_verified, false)
  END,
  f.source_updated_at,
  f.imported_at,
  f.raw_data,
  CASE WHEN lower(coalesce(f.data_basis, '')) IN ('per_100ml', 'per100ml') THEN 'ml' ELSE 'g' END,
  f.saturated_fat_g,
  f.sodium_mg
FROM public.foods f
WHERE nullif(trim(coalesce(f.source_id, '')), '') IS NOT NULL
  AND nullif(trim(coalesce(f.name, '')), '') IS NOT NULL
  AND f.kcal IS NOT NULL
  AND f.protein_g IS NOT NULL
  AND f.carbohydrates_g IS NOT NULL
  AND f.fat_g IS NOT NULL
ON CONFLICT (source, source_id) DO NOTHING;

COMMENT ON TABLE public.foods IS
  'Legacy import table. New imports and every app consumer use public.nutrition_foods.';

-- Piece/serving units are presentation shortcuts, not a stable nutrient reference.
-- The catalog keeps their unchanged per-100 values but exposes every solid in grams.
UPDATE public.nutrition_foods
SET unit_type = 'raw',
    macro_reference_unit = 'g',
    density_g_per_ml = NULL
WHERE unit_type = 'piece';

-- Existing rows explicitly created as ml were already entered as label values per 100 ml.
UPDATE public.nutrition_foods
SET macro_reference_unit = 'ml'
WHERE unit_type = 'ml';

-- Label/manual drink sources are volume-based. External mass-based rows remain on a
-- gram basis until converted below; OFF needs an explicit volume basis in its source data.
UPDATE public.nutrition_foods
SET macro_reference_unit = 'ml'
WHERE (
    lower(coalesce(category, '')) IN ('getränke', 'getraenke')
    OR name ~* '(drink|saft|schorle|wasser|kaffee|espresso|tee|cola|limonade|bier|wein|cappuccino|latte|shake|kokosmilch|buttermilch|kefir|sojasauce|essig|brühe|bruehe)'
    OR name ~* '(^|[^[:alpha:]])(milch|vollmilch|sahne)([^[:alpha:]]|$)'
  )
  AND (
    source IN ('manual', 'bodyfuel_verified')
    OR (
      source = 'open_food_facts'
      AND (
        macro_reference_unit = 'ml'
        OR lower(coalesce(raw_data ->> 'nutrition_data_per', '')) IN ('100ml', '100 ml', 'per 100ml')
        OR lower(coalesce(raw_data ->> 'product_quantity_unit', '')) IN ('ml', 'cl', 'l')
      )
    )
  );

-- Assign an explicit density to every physical liquid. Specific values are used where stable;
-- otherwise 1.000 is a documented conservative fallback for legacy mass compatibility only.
UPDATE public.nutrition_foods
SET volume_conversion_estimated = (
  macro_reference_unit = 'g'
  AND name !~* '(olivenöl|olivenoel|rapsöl|rapsoel|sonnenblumenöl|sonnenblumenoel|kokosöl|kokosoel|speiseöl|speiseoel|(^|[^[:alpha:]])öl([^[:alpha:]]|$)|(^|[^[:alpha:]])oel([^[:alpha:]]|$)|milch|haferdrink|mandeldrink|sojadrink|milchkaffee|cappuccino|latte|sahne|kefir|saft|schorle|bier|wein|wasser|kaffee|espresso|tee|sojasauce|essig|brühe|bruehe)'
)
WHERE unit_type = 'ml'
   OR lower(coalesce(category, '')) IN ('getränke', 'getraenke')
   OR name ~* '(drink|saft|schorle|wasser|kaffee|espresso|tee|cola|limonade|bier|wein|cappuccino|latte|shake|kokosmilch|buttermilch|kefir|sojasauce|essig|brühe|bruehe)'
   OR name ~* '(^|[^[:alpha:]])(milch|vollmilch|sahne)([^[:alpha:]]|$)'
   OR name ~* '(olivenöl|olivenoel|rapsöl|rapsoel|sonnenblumenöl|sonnenblumenoel|kokosöl|kokosoel|speiseöl|speiseoel|(^|[^[:alpha:]])öl([^[:alpha:]]|$)|(^|[^[:alpha:]])oel([^[:alpha:]]|$))';

UPDATE public.nutrition_foods
SET density_g_per_ml = CASE
      WHEN name ~* '(olivenöl|olivenoel|rapsöl|rapsoel|sonnenblumenöl|sonnenblumenoel|kokosöl|kokosoel|speiseöl|speiseoel|(^|[^[:alpha:]])öl([^[:alpha:]]|$)|(^|[^[:alpha:]])oel([^[:alpha:]]|$))' THEN 0.910
      WHEN name ~* '(milch|haferdrink|mandeldrink|sojadrink|protein shake|milchkaffee|cappuccino|latte|sahne|kefir)' THEN 1.030
      WHEN name ~* '(saft|schorle)' THEN 1.040
      WHEN name ~* '(bier)' THEN 1.010
      WHEN name ~* '(wein)' THEN 0.990
      ELSE 1.000
    END
WHERE unit_type = 'ml'
   OR lower(coalesce(category, '')) IN ('getränke', 'getraenke')
   OR name ~* '(drink|saft|schorle|wasser|kaffee|espresso|tee|cola|limonade|bier|wein|cappuccino|latte|shake|kokosmilch|buttermilch|kefir|sojasauce|essig|brühe|bruehe)'
   OR name ~* '(^|[^[:alpha:]])(milch|vollmilch|sahne)([^[:alpha:]]|$)'
   OR name ~* '(olivenöl|olivenoel|rapsöl|rapsoel|sonnenblumenöl|sonnenblumenoel|kokosöl|kokosoel|speiseöl|speiseoel|(^|[^[:alpha:]])öl([^[:alpha:]]|$)|(^|[^[:alpha:]])oel([^[:alpha:]]|$))';

-- Convert rows whose source values were mass-based to a volume reference before switching unit.
UPDATE public.nutrition_foods
SET kcal_per_100g = round(kcal_per_100g * density_g_per_ml, 2),
    protein_per_100g = round(protein_per_100g * density_g_per_ml, 2),
    carbs_per_100g = round(carbs_per_100g * density_g_per_ml, 2),
    fat_per_100g = round(fat_per_100g * density_g_per_ml, 2),
    fiber_per_100g = round(coalesce(fiber_per_100g, 0) * density_g_per_ml, 2),
    sugar_per_100g = round(coalesce(sugar_per_100g, 0) * density_g_per_ml, 2),
    salt_per_100g = round(coalesce(salt_per_100g, 0) * density_g_per_ml, 3),
    saturated_fat_per_100g = round(coalesce(saturated_fat_per_100g, 0) * density_g_per_ml, 2),
    sodium_mg_per_100g = round(coalesce(sodium_mg_per_100g, 0) * density_g_per_ml, 1),
    unit_type = 'ml'::public.nutrition_food_unit
WHERE macro_reference_unit = 'ml'
  AND unit_type <> 'ml'
  AND density_g_per_ml IS NOT NULL
  AND density_g_per_ml > 0;

UPDATE public.nutrition_foods
SET macro_reference_unit = 'g'
WHERE unit_type <> 'ml';

UPDATE public.nutrition_foods
SET source_verified = true
WHERE (
    source = 'bls_4_0'
    OR (source = 'usda' AND lower(coalesce(source_name, '')) LIKE '%foundation%')
  )
  AND nullif(trim(coalesce(source_id, '')), '') IS NOT NULL;

CREATE OR REPLACE FUNCTION public.nutrition_foods_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_calc numeric;
  v_reasons text[] := ARRAY[]::text[];
BEGIN
  IF NEW.unit_type = 'piece' THEN
    NEW.unit_type := 'raw';
  END IF;

  IF NEW.unit_type = 'ml' THEN
    NEW.macro_reference_unit := 'ml';
    NEW.default_state := 'n_a';
    IF NEW.density_g_per_ml IS NULL OR NEW.density_g_per_ml <= 0 OR NEW.density_g_per_ml > 2 THEN
      v_reasons := array_append(v_reasons, 'Flüssigkeit ohne plausible Dichte');
    END IF;
    IF NEW.volume_conversion_estimated THEN
      v_reasons := array_append(v_reasons, 'Volumenumrechnung ohne belastbare Dichte');
    END IF;
  ELSE
    NEW.macro_reference_unit := 'g';
  END IF;

  IF NEW.kcal_per_100g < 0 OR NEW.kcal_per_100g > 900
     OR NEW.protein_per_100g < 0 OR NEW.protein_per_100g > 100
     OR NEW.carbs_per_100g < 0 OR NEW.carbs_per_100g > 100
     OR NEW.fat_per_100g < 0 OR NEW.fat_per_100g > 100
     OR coalesce(NEW.fiber_per_100g, 0) < 0 OR coalesce(NEW.fiber_per_100g, 0) > 100
     OR coalesce(NEW.sugar_per_100g, 0) < 0 OR coalesce(NEW.sugar_per_100g, 0) > 100
     OR coalesce(NEW.saturated_fat_per_100g, 0) < 0 OR coalesce(NEW.saturated_fat_per_100g, 0) > 100
     OR coalesce(NEW.salt_per_100g, 0) < 0 OR coalesce(NEW.salt_per_100g, 0) > 100
     OR coalesce(NEW.sodium_mg_per_100g, 0) < 0 OR coalesce(NEW.sodium_mg_per_100g, 0) > 40000
     OR coalesce(NEW.alcohol_per_100g, 0) < 0 OR coalesce(NEW.alcohol_per_100g, 0) > 100
     OR coalesce(NEW.polyols_per_100g, 0) < 0 OR coalesce(NEW.polyols_per_100g, 0) > 100
     OR coalesce(NEW.organic_acids_per_100g, 0) < 0 OR coalesce(NEW.organic_acids_per_100g, 0) > 100 THEN
    v_reasons := array_append(v_reasons, 'Nährwert außerhalb des zulässigen Bereichs');
  END IF;
  IF NEW.quality_score IS NOT NULL AND (NEW.quality_score < 0 OR NEW.quality_score > 100) THEN
    v_reasons := array_append(v_reasons, 'Quality-Score außerhalb 0–100');
  END IF;

  IF NEW.sugar_per_100g IS NOT NULL AND NEW.sugar_per_100g > NEW.carbs_per_100g + 0.5 THEN
    v_reasons := array_append(v_reasons, 'Zucker ist größer als Kohlenhydrate');
  END IF;
  IF NEW.saturated_fat_per_100g IS NOT NULL AND NEW.saturated_fat_per_100g > NEW.fat_per_100g + 0.5 THEN
    v_reasons := array_append(v_reasons, 'Gesättigte Fettsäuren sind größer als Fett');
  END IF;
  IF NEW.salt_per_100g IS NOT NULL AND NEW.sodium_mg_per_100g IS NOT NULL
     AND abs(NEW.salt_per_100g - NEW.sodium_mg_per_100g * 0.0025)
         > greatest(0.05, NEW.salt_per_100g * 0.15) THEN
    v_reasons := array_append(v_reasons, 'Salz/Natrium-Werte sind widersprüchlich');
  END IF;
  IF NEW.protein_per_100g + NEW.carbs_per_100g + NEW.fat_per_100g
       + coalesce(NEW.fiber_per_100g, 0) + coalesce(NEW.alcohol_per_100g, 0)
       + coalesce(NEW.polyols_per_100g, 0) + coalesce(NEW.organic_acids_per_100g, 0) > 105 THEN
    v_reasons := array_append(v_reasons, 'Summierte Hauptnährstoffe überschreiten 105 je Referenzmenge');
  END IF;

  v_calc := NEW.protein_per_100g * 4
          + NEW.carbs_per_100g * 4
          + NEW.fat_per_100g * 9
          + coalesce(NEW.fiber_per_100g, 0) * 2
          + coalesce(NEW.alcohol_per_100g, 0) * 7
          + coalesce(NEW.polyols_per_100g, 0) * 2.4
          + coalesce(NEW.organic_acids_per_100g, 0) * 3;
  IF NEW.kcal_per_100g > 0 AND v_calc > 0
     AND abs(v_calc - NEW.kcal_per_100g) > greatest(20, NEW.kcal_per_100g * 0.15) THEN
    v_reasons := array_append(
      v_reasons,
      'Energieabweichung ' || round(abs(v_calc - NEW.kcal_per_100g) / NEW.kcal_per_100g * 100)::text || '%'
    );
  END IF;

  IF NEW.source = 'ai_estimate' THEN
    v_reasons := array_append(v_reasons, 'KI-Schätzwert ist als Nährwertquelle nicht zulässig');
  ELSIF NEW.source = 'manual' AND NEW.verified_by_coach = false THEN
    v_reasons := array_append(v_reasons, 'Ungeprüfte manuelle Quelle');
  END IF;
  IF NEW.source IN ('bls_4_0', 'open_food_facts', 'usda')
     AND nullif(trim(coalesce(NEW.source_id, '')), '') IS NULL THEN
    v_reasons := array_append(v_reasons, 'Externe Quelle ohne nachvollziehbare Datensatz-ID');
  END IF;

  NEW.audited_at := now();
  IF cardinality(v_reasons) > 0 THEN
    NEW.needs_review := true;
    NEW.safe_for_smart := false;
    NEW.audit_status := 'needs_review';
    NEW.review_reason := '[AUTO-AUDIT] ' || array_to_string(v_reasons, '; ');
  ELSE
    NEW.audit_status := CASE WHEN NEW.verified_by_coach THEN 'verified' ELSE 'passed' END;
    IF coalesce(NEW.review_reason, '') LIKE '[AUTO-AUDIT]%' THEN
      NEW.review_reason := NULL;
      NEW.needs_review := false;
    END IF;
    NEW.safe_for_smart := NEW.is_active
      AND NOT NEW.needs_review
      AND (
        NEW.verified_by_coach
        OR NEW.source_verified
        OR (NEW.source = 'open_food_facts' AND coalesce(NEW.quality_score, 0) >= 85)
      );
  END IF;

  IF NEW.verified_by_coach THEN
    NEW.verified_at := coalesce(NEW.verified_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nutrition_foods_validate ON public.nutrition_foods;
CREATE TRIGGER trg_nutrition_foods_validate
  BEFORE INSERT OR UPDATE ON public.nutrition_foods
  FOR EACH ROW EXECUTE FUNCTION public.nutrition_foods_validate();

UPDATE public.nutrition_foods
SET needs_review = false,
    review_reason = NULL
WHERE review_reason LIKE 'Makro-Kalorien-Abweichung %';

UPDATE public.nutrition_foods
SET audited_at = NULL;

ALTER TABLE public.nutrition_foods
  DROP CONSTRAINT IF EXISTS nutrition_foods_reference_unit_chk,
  DROP CONSTRAINT IF EXISTS nutrition_foods_no_piece_unit_chk,
  DROP CONSTRAINT IF EXISTS nutrition_foods_audit_status_chk,
  DROP CONSTRAINT IF EXISTS nutrition_foods_macro_ranges_chk,
  ADD CONSTRAINT nutrition_foods_reference_unit_chk
    CHECK (macro_reference_unit IN ('g', 'ml')) NOT VALID,
  ADD CONSTRAINT nutrition_foods_no_piece_unit_chk
    CHECK (unit_type <> 'piece') NOT VALID,
  ADD CONSTRAINT nutrition_foods_audit_status_chk
    CHECK (audit_status IN ('pending', 'passed', 'verified', 'needs_review')) NOT VALID,
  ADD CONSTRAINT nutrition_foods_macro_ranges_chk CHECK (
    kcal_per_100g BETWEEN 0 AND 900
    AND protein_per_100g BETWEEN 0 AND 100
    AND carbs_per_100g BETWEEN 0 AND 100
    AND fat_per_100g BETWEEN 0 AND 100
    AND coalesce(fiber_per_100g, 0) BETWEEN 0 AND 100
    AND coalesce(sugar_per_100g, 0) BETWEEN 0 AND 100
    AND coalesce(saturated_fat_per_100g, 0) BETWEEN 0 AND 100
    AND coalesce(salt_per_100g, 0) BETWEEN 0 AND 100
    AND coalesce(sodium_mg_per_100g, 0) BETWEEN 0 AND 40000
    AND (quality_score IS NULL OR quality_score BETWEEN 0 AND 100)
  ) NOT VALID;

CREATE INDEX IF NOT EXISTS nutrition_foods_audit_status_idx
  ON public.nutrition_foods (audit_status, source);

ALTER TABLE public.food_entries
  ADD COLUMN IF NOT EXISTS food_id uuid REFERENCES public.nutrition_foods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS serving_amount numeric,
  ADD COLUMN IF NOT EXISTS amount_unit text;

UPDATE public.food_entries
SET serving_amount = coalesce(serving_amount, serving_g),
    amount_unit = coalesce(
      amount_unit,
      CASE
        WHEN name ~* '(drink|saft|schorle|wasser|kaffee|espresso|tee|cola|limonade|bier|wein|cappuccino|latte|shake|kokosmilch|buttermilch|kefir|sojasauce|essig|brühe|bruehe)'
          OR name ~* '(^|[^[:alpha:]])(milch|vollmilch|sahne)([^[:alpha:]]|$)'
          OR name ~* '(olivenöl|olivenoel|rapsöl|rapsoel|kokosöl|kokosoel|(^|[^[:alpha:]])öl([^[:alpha:]]|$)|(^|[^[:alpha:]])oel([^[:alpha:]]|$))'
        THEN 'ml' ELSE 'g'
      END
    );

ALTER TABLE public.food_entries
  ALTER COLUMN serving_amount SET DEFAULT 100,
  ALTER COLUMN serving_amount SET NOT NULL,
  ALTER COLUMN amount_unit SET DEFAULT 'g',
  ALTER COLUMN amount_unit SET NOT NULL,
  DROP CONSTRAINT IF EXISTS food_entries_amount_unit_chk,
  DROP CONSTRAINT IF EXISTS food_entries_serving_amount_chk,
  ADD CONSTRAINT food_entries_amount_unit_chk CHECK (amount_unit IN ('g', 'ml')),
  ADD CONSTRAINT food_entries_serving_amount_chk CHECK (serving_amount > 0 AND serving_amount <= 10000);

CREATE INDEX IF NOT EXISTS food_entries_food_id_idx ON public.food_entries(food_id);

ALTER TABLE public.food_favorites
  ADD COLUMN IF NOT EXISTS food_id uuid REFERENCES public.nutrition_foods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reference_unit text,
  ADD COLUMN IF NOT EXISTS density_g_per_ml numeric(6,3),
  ADD COLUMN IF NOT EXISTS last_amount numeric,
  ADD COLUMN IF NOT EXISTS source text;

UPDATE public.food_favorites
SET reference_unit = coalesce(
      reference_unit,
      CASE
        WHEN name ~* '(drink|saft|schorle|wasser|kaffee|espresso|tee|cola|limonade|bier|wein|cappuccino|latte|shake|kokosmilch|buttermilch|kefir|sojasauce|essig|brühe|bruehe)'
          OR name ~* '(^|[^[:alpha:]])(milch|vollmilch|sahne)([^[:alpha:]]|$)'
          OR name ~* '(olivenöl|olivenoel|rapsöl|rapsoel|kokosöl|kokosoel|(^|[^[:alpha:]])öl([^[:alpha:]]|$)|(^|[^[:alpha:]])oel([^[:alpha:]]|$))'
        THEN 'ml' ELSE 'g'
      END
    ),
    last_amount = coalesce(last_amount, last_amount_g);

UPDATE public.food_favorites
SET density_g_per_ml = CASE
      WHEN reference_unit = 'ml' THEN coalesce(density_g_per_ml, 1)
      ELSE NULL
    END;

ALTER TABLE public.food_favorites
  ALTER COLUMN reference_unit SET DEFAULT 'g',
  ALTER COLUMN reference_unit SET NOT NULL,
  DROP CONSTRAINT IF EXISTS food_favorites_reference_unit_chk,
  ADD CONSTRAINT food_favorites_reference_unit_chk CHECK (reference_unit IN ('g', 'ml'));

CREATE INDEX IF NOT EXISTS food_favorites_food_id_idx ON public.food_favorites(food_id);

CREATE OR REPLACE VIEW public.nutrition_foods_public
WITH (security_invoker = true)
AS
SELECT
  id, name, aliases, category, source, source_id, source_name, license, citation,
  kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
  fiber_per_100g, sugar_per_100g, salt_per_100g, unit_type, default_state,
  density_g_per_ml, verified_by_coach, verified_at, created_at, updated_at,
  text_id, is_active, safe_for_smart, image_url, image_source,
  macro_reference_unit, saturated_fat_per_100g, sodium_mg_per_100g,
  alcohol_per_100g, polyols_per_100g, organic_acids_per_100g,
  audit_status, audited_at, search_text, barcode, brand, language_code,
  country_codes, quality_score, source_verified, source_updated_at, imported_at
FROM public.nutrition_foods;

GRANT SELECT ON public.nutrition_foods_public TO authenticated;
GRANT SELECT ON public.nutrition_foods_public TO anon;

COMMENT ON VIEW public.nutrition_foods_public IS
  'Public food catalog. Search consumers must require is_active=true and safe_for_smart=true.';

CREATE OR REPLACE FUNCTION public.search_nutrition_foods(
  _q text,
  _max_results integer DEFAULT 50
)
RETURNS SETOF public.nutrition_foods_public
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH query AS (
    SELECT
      public.normalize_food_search(_q) AS raw,
      regexp_split_to_array(public.normalize_food_search(_q), '\s+') AS tokens
  ), candidates AS (
    SELECT
      nf AS food,
      nf.search_text AS haystack
    FROM public.nutrition_foods_public nf
    CROSS JOIN query q
    WHERE nf.is_active = true
      AND nf.safe_for_smart = true
      AND nf.search_text LIKE '%' || q.tokens[1] || '%'
  )
  SELECT (c.food).*
  FROM candidates c
  CROSS JOIN query q
  WHERE q.raw <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(q.tokens) AS token
      WHERE token <> '' AND c.haystack NOT LIKE '%' || token || '%'
    )
  ORDER BY
    CASE
      WHEN public.normalize_food_search((c.food).name) = q.raw THEN 0
      WHEN public.normalize_food_search((c.food).name) LIKE q.raw || '%' THEN 1
      ELSE 2
    END,
    CASE (c.food).source
      WHEN 'bodyfuel_verified' THEN 0
      WHEN 'bls_4_0' THEN 1
      WHEN 'open_food_facts' THEN 2
      WHEN 'usda' THEN 3
      ELSE 4
    END,
    similarity(c.haystack, q.raw) DESC,
    (c.food).name
  LIMIT least(50, greatest(1, coalesce(_max_results, 50)));
$$;

GRANT EXECUTE ON FUNCTION public.search_nutrition_foods(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_nutrition_foods(text, integer) TO anon;
