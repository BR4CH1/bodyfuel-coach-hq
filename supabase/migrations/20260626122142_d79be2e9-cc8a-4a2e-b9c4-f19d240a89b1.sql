INSERT INTO public.nutrition_foods
  (name, aliases, category, source, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, verified_by_coach, notes)
SELECT *
FROM (VALUES
  ('Hafermehl', ARRAY['haferflockenmehl','haferflocken mehl','oat flour']::text[], 'Getreide', 'bodyfuel_verified'::public.nutrition_food_source, 370::numeric, 13.5::numeric, 60::numeric, 7::numeric, true, 'Standardwert Hafermehl'),
  ('Vollkornmehl', ARRAY['weizenvollkornmehl','weizen vollkornmehl','dinkelvollkornmehl','dinkel vollkornmehl','vollkorn mehl']::text[], 'Getreide', 'bodyfuel_verified'::public.nutrition_food_source, 340::numeric, 12::numeric, 60::numeric, 2.5::numeric, true, 'Standardwert Vollkornmehl')
) AS v(name, aliases, category, source, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, verified_by_coach, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.nutrition_foods nf WHERE lower(nf.name) = lower(v.name)
);