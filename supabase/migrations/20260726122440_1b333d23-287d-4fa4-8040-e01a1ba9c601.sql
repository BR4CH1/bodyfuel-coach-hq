UPDATE public.nutrition_foods
SET source_id = 'bls-4.0:' || text_id
WHERE source = 'bls_4_0' AND nullif(trim(coalesce(source_id, '')), '') IS NULL;

UPDATE public.nutrition_foods SET updated_at = now() WHERE source = 'bls_4_0';

CREATE OR REPLACE FUNCTION public.search_nutrition_foods(_q text, _max_results integer DEFAULT 50)
RETURNS SETOF public.nutrition_foods_public
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH query AS (
    SELECT
      public.normalize_food_search(_q) AS raw,
      regexp_split_to_array(public.normalize_food_search(_q), '\s+') AS tokens
  ), candidates AS (
    SELECT nf AS food, nf.search_text AS haystack
    FROM public.nutrition_foods_public nf
    CROSS JOIN query q
    WHERE nf.is_active = true
      AND nf.audit_status <> 'needs_review'
      AND nf.search_text LIKE '%' || q.tokens[1] || '%'
  )
  SELECT (c.food).*
  FROM candidates c
  CROSS JOIN query q
  WHERE q.raw <> ''
    AND NOT EXISTS (
      SELECT 1 FROM unnest(q.tokens) AS token
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
  LIMIT least(100, greatest(1, coalesce(_max_results, 50)));
$function$;

CREATE OR REPLACE FUNCTION public.search_nutrition_foods_variants(_terms text[], _max_results integer DEFAULT 50)
RETURNS SETOF public.nutrition_foods_public
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH variants AS (
    SELECT DISTINCT public.normalize_food_search(t) AS raw
    FROM unnest(coalesce(_terms, ARRAY[]::text[])) AS t
    WHERE public.normalize_food_search(t) <> ''
  ), matches AS (
    SELECT DISTINCT ON (nf.id) nf AS food, v.raw AS matched_term
    FROM public.nutrition_foods_public nf
    CROSS JOIN variants v
    WHERE nf.is_active = true
      AND nf.audit_status <> 'needs_review'
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(regexp_split_to_array(v.raw, '\s+')) AS token
        WHERE token <> '' AND nf.search_text NOT LIKE '%' || token || '%'
      )
    ORDER BY nf.id, length(v.raw) DESC
  )
  SELECT (m.food).*
  FROM matches m
  ORDER BY
    CASE
      WHEN public.normalize_food_search((m.food).name) = m.matched_term THEN 0
      WHEN public.normalize_food_search((m.food).name) LIKE m.matched_term || '%' THEN 1
      ELSE 2
    END,
    CASE (m.food).source
      WHEN 'bodyfuel_verified' THEN 0
      WHEN 'bls_4_0' THEN 1
      WHEN 'open_food_facts' THEN 2
      WHEN 'usda' THEN 3
      ELSE 4
    END,
    similarity((m.food).search_text, m.matched_term) DESC,
    (m.food).name
  LIMIT least(100, greatest(1, coalesce(_max_results, 50)));
$function$;

GRANT EXECUTE ON FUNCTION public.search_nutrition_foods(text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_nutrition_foods_variants(text[], integer) TO authenticated, service_role;

INSERT INTO public.nutrition_foods
  (name, text_id, aliases, category, source, source_verified, verified_by_coach, language_code,
   unit_type, default_state, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, sugar_per_100g)
VALUES
  ('Ei (roh)', 'ei-roh',
   ARRAY['ei','eier','vollei','huehnerei','hühnerei','hühnereier','frischei','eier roh'],
   'Eier', 'bodyfuel_verified', true, true, 'de', 'raw', 'raw', 139, 12.9, 0.7, 9.5, 0, 0.7),
  ('Ei gekocht', 'ei-gekocht',
   ARRAY['ei','eier','gekochtes ei','fruehstuecksei','frühstücksei','hartgekochtes ei','vollei gekocht'],
   'Eier', 'bodyfuel_verified', true, true, 'de', 'cooked', 'cooked', 139, 12.9, 0.7, 9.5, 0, 0.7),
  ('Eigelb (roh)', 'eigelb-roh',
   ARRAY['eigelb','eidotter','dotter','eier eigelb'],
   'Eier', 'bodyfuel_verified', true, true, 'de', 'raw', 'raw', 352, 16.1, 0.3, 31.9, 0, 0.3),
  ('Spiegelei (gebraten)', 'spiegelei-gebraten',
   ARRAY['spiegelei','spiegeleier','ei gebraten','eier gebraten'],
   'Eier', 'bodyfuel_verified', true, true, 'de', 'cooked', 'cooked', 192, 13.6, 0.6, 15.0, 0, 0.6),
  ('Rührei (mit Milch)', 'ruehrei-mit-milch',
   ARRAY['ruehrei','rührei','ruehreier','rühreier','scrambled eggs','eier ruehrei'],
   'Eier', 'bodyfuel_verified', true, true, 'de', 'cooked', 'cooked', 174, 11.5, 1.6, 13.5, 0, 1.6)
ON CONFLICT (text_id) DO NOTHING;

UPDATE public.nutrition_foods
SET aliases = (
  SELECT array_agg(DISTINCT a) FROM unnest(aliases || ARRAY['eiklar','eiweiss','eiweiß','eier eiklar','egg white']) AS a
)
WHERE text_id = 'eiklar';