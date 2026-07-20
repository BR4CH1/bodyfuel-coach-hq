
-- 1) Neue Spalten auf nutrition_foods
ALTER TABLE public.nutrition_foods
  ADD COLUMN IF NOT EXISTS text_id text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS safe_for_smart boolean NOT NULL DEFAULT false;

-- 2) Slug-Helper (immutable, deterministisch)
CREATE OR REPLACE FUNCTION public.nutrition_foods_slugify(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(
        lower(
          translate(
            coalesce(_name, ''),
            'äöüÄÖÜßáàâéèêíìîóòôúùû',
            'aeouAOUsaaaeeeiiiooouuu'
          )
        ),
        '[^a-z0-9]+', '_', 'g'
      ),
      '^_+|_+$', '', 'g'
    ),
    ''
  );
$$;

-- 3) Trigger: text_id automatisch pflegen (bei INSERT/UPDATE), Kollisionen durch Suffix _2, _3 …
CREATE OR REPLACE FUNCTION public.nutrition_foods_ensure_text_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  i int := 1;
BEGIN
  IF NEW.text_id IS NULL OR length(trim(NEW.text_id)) = 0 THEN
    base := public.nutrition_foods_slugify(NEW.name);
    IF base IS NULL THEN
      base := 'food_' || substr(replace(NEW.id::text, '-', ''), 1, 8);
    END IF;
    candidate := base;
    WHILE EXISTS (
      SELECT 1 FROM public.nutrition_foods
      WHERE text_id = candidate AND id <> NEW.id
    ) LOOP
      i := i + 1;
      candidate := base || '_' || i;
    END LOOP;
    NEW.text_id := candidate;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nutrition_foods_ensure_text_id ON public.nutrition_foods;
CREATE TRIGGER trg_nutrition_foods_ensure_text_id
BEFORE INSERT OR UPDATE OF name, text_id
ON public.nutrition_foods
FOR EACH ROW
EXECUTE FUNCTION public.nutrition_foods_ensure_text_id();

-- 4) Backfill: text_id für alle Bestandssätze
UPDATE public.nutrition_foods
SET text_id = COALESCE(text_id, public.nutrition_foods_slugify(name))
WHERE text_id IS NULL OR length(trim(text_id)) = 0;

-- Kollisionen auflösen (falls Namen doppelt vorkommen)
WITH ranked AS (
  SELECT id, text_id,
         row_number() OVER (PARTITION BY text_id ORDER BY created_at, id) AS rn
  FROM public.nutrition_foods
)
UPDATE public.nutrition_foods nf
SET text_id = nf.text_id || '_' || r.rn
FROM ranked r
WHERE nf.id = r.id AND r.rn > 1;

ALTER TABLE public.nutrition_foods
  ALTER COLUMN text_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS nutrition_foods_text_id_key
  ON public.nutrition_foods (text_id);

-- 5) Safe-Pool initial füllen: alle Coach-verifizierten Foods dürfen Smart nutzen
UPDATE public.nutrition_foods
SET safe_for_smart = true
WHERE verified_by_coach = true
  AND is_active = true
  AND safe_for_smart = false;

CREATE INDEX IF NOT EXISTS nutrition_foods_safe_pool_idx
  ON public.nutrition_foods (safe_for_smart, is_active, verified_by_coach)
  WHERE safe_for_smart = true AND is_active = true;

-- 6) Neuer Plan-Status: needs_review (Plan mit fehlender Zutat wird nicht aktiviert)
ALTER TABLE public.nutrition_plans
  DROP CONSTRAINT IF EXISTS nutrition_plans_status_check;

ALTER TABLE public.nutrition_plans
  ADD CONSTRAINT nutrition_plans_status_check
  CHECK (status = ANY (ARRAY['draft','approved','published','active','archived','needs_review']));
