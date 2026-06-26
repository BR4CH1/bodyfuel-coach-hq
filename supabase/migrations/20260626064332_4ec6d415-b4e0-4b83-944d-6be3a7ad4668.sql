
-- 1) Strukturierte Zutaten + Warnungen für jede Mahlzeit
ALTER TABLE public.nutrition_plan_meals
  ADD COLUMN IF NOT EXISTS ingredients_json jsonb,
  ADD COLUMN IF NOT EXISTS compute_warnings text[] DEFAULT '{}'::text[];

-- 2) Aliase in nutrition_foods auf Lowercase normalisieren (sonst greift
--    Postgres-Array-Containment-Match `aliases.cs.{vollkornbrot}` nicht,
--    wenn der Alias als "Vollkornbrot" gespeichert ist).
UPDATE public.nutrition_foods
SET aliases = (
  SELECT COALESCE(array_agg(DISTINCT lower(a)) FILTER (WHERE a IS NOT NULL AND length(trim(a)) > 0), '{}'::text[])
  FROM unnest(COALESCE(aliases, '{}'::text[])) AS a
)
WHERE aliases IS NOT NULL;

-- 3) Trigger: Aliase ab sofort immer lowercased speichern
CREATE OR REPLACE FUNCTION public.nutrition_foods_normalize_aliases()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.aliases IS NOT NULL THEN
    NEW.aliases := (
      SELECT COALESCE(array_agg(DISTINCT lower(a)) FILTER (WHERE a IS NOT NULL AND length(trim(a)) > 0), '{}'::text[])
      FROM unnest(NEW.aliases) AS a
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS nutrition_foods_normalize_aliases_trg ON public.nutrition_foods;
CREATE TRIGGER nutrition_foods_normalize_aliases_trg
BEFORE INSERT OR UPDATE OF aliases ON public.nutrition_foods
FOR EACH ROW EXECUTE FUNCTION public.nutrition_foods_normalize_aliases();

-- 4) GIN-Index für schnellen Alias-/Namens-Lookup
CREATE INDEX IF NOT EXISTS nutrition_foods_aliases_gin
  ON public.nutrition_foods USING gin (aliases);
CREATE INDEX IF NOT EXISTS nutrition_foods_name_trgm
  ON public.nutrition_foods USING gin (lower(name) gin_trgm_ops);
