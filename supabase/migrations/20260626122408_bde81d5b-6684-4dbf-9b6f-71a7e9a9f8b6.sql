UPDATE public.nutrition_foods
SET aliases = (SELECT array_agg(DISTINCT x) FROM unnest(COALESCE(aliases, '{}'::text[]) || ARRAY['putenbrustaufschnitt','putenbrust aufschnitt','pute aufschnitt','putenaufschnitt']) AS x)
WHERE lower(name) = 'putenbrust aufschnitt';

UPDATE public.nutrition_foods
SET aliases = (SELECT array_agg(DISTINCT x) FROM unnest(COALESCE(aliases, '{}'::text[]) || ARRAY['hähnchenbrustaufschnitt','haehnchenbrustaufschnitt','hähnchenbrust aufschnitt','haehnchenbrust aufschnitt','geflügelaufschnitt','gefluegelaufschnitt']) AS x)
WHERE lower(name) = 'hähnchenbrust aufschnitt';

UPDATE public.nutrition_foods
SET aliases = (SELECT array_agg(DISTINCT x) FROM unnest(COALESCE(aliases, '{}'::text[]) || ARRAY['weizentortilla','weizentortillas','vollkorntortilla','vollkorntortillas','1 weizentortilla','tortilla wrap']) AS x)
WHERE lower(name) = 'wraps / tortilla weizen';

UPDATE public.nutrition_foods
SET aliases = (SELECT array_agg(DISTINCT x) FROM unnest(COALESCE(aliases, '{}'::text[]) || ARRAY['chiasamen','chia samen']) AS x)
WHERE lower(name) = 'chia-samen';

UPDATE public.nutrition_foods
SET aliases = (SELECT array_agg(DISTINCT x) FROM unnest(COALESCE(aliases, '{}'::text[]) || ARRAY['mandelsplitter','mandelstifte','mandelblättchen','mandelblaettchen']) AS x)
WHERE lower(name) = 'mandeln';

UPDATE public.nutrition_foods
SET aliases = (SELECT array_agg(DISTINCT x) FROM unnest(COALESCE(aliases, '{}'::text[]) || ARRAY['nussmischung','nüsse gemischt','nuesse gemischt','gemischte nüsse','gemischte nuesse']) AS x)
WHERE lower(name) = 'cashewkerne';

UPDATE public.nutrition_foods
SET aliases = (SELECT array_agg(DISTINCT x) FROM unnest(COALESCE(aliases, '{}'::text[]) || ARRAY['vanille-proteinpulver','vanille proteinpulver','schoko-proteinpulver','schoko proteinpulver','schokoladen-proteinpulver','proteinisolat','eiweißpulver vanille','eiweisspulver vanille']) AS x)
WHERE lower(name) = 'whey protein';

INSERT INTO public.nutrition_foods
  (name, aliases, category, source, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, verified_by_coach, notes)
SELECT *
FROM (VALUES
  ('Linsen gekocht (Dose)', ARRAY['linsen dose','linsen gekocht','gegarte linsen dose','gegarte linsen dose abgetropft','linsen abgetropft']::text[], 'Hülsenfrüchte', 'bodyfuel_verified'::public.nutrition_food_source, 116::numeric, 9::numeric, 17::numeric, 0.5::numeric, true, 'Standardwert Linsen gekocht/abgetropft'),
  ('Kidneybohnen gekocht (Dose)', ARRAY['kidneybohnen','kidneybohnen dose','kidneybohnen dose abgetropft','bohnen kidney']::text[], 'Hülsenfrüchte', 'bodyfuel_verified'::public.nutrition_food_source, 110::numeric, 8::numeric, 16::numeric, 0.6::numeric, true, 'Standardwert Kidneybohnen gekocht/abgetropft'),
  ('Balsamicoessig', ARRAY['balsamico','balsamico essig']::text[], 'Saucen', 'bodyfuel_verified'::public.nutrition_food_source, 88::numeric, 0.5::numeric, 17::numeric, 0::numeric, true, 'Standardwert Balsamico'),
  ('Sonnenblumenkerne', ARRAY['sonnenblumenkerne geschält','sonnenblumenkerne geschaelt']::text[], 'Nüsse', 'bodyfuel_verified'::public.nutrition_food_source, 580::numeric, 21::numeric, 12::numeric, 50::numeric, true, 'Standardwert Sonnenblumenkerne'),
  ('Nussmus', ARRAY['cashewmus','mandelmus','erdnussmus','nuss butter','nussbutter']::text[], 'Nüsse', 'bodyfuel_verified'::public.nutrition_food_source, 620::numeric, 20::numeric, 15::numeric, 52::numeric, true, 'Durchschnitt Nussmus'),
  ('Mayonnaise light', ARRAY['mayo light','leichte mayonnaise']::text[], 'Saucen', 'bodyfuel_verified'::public.nutrition_food_source, 280::numeric, 1::numeric, 7::numeric, 27::numeric, true, 'Standardwert Mayonnaise light'),
  ('Pesto Genovese', ARRAY['pesto','pesto genovese fertig','basilikum pesto']::text[], 'Saucen', 'bodyfuel_verified'::public.nutrition_food_source, 450::numeric, 5::numeric, 6::numeric, 44::numeric, true, 'Standardwert Pesto Genovese'),
  ('Radieschen', ARRAY['radieschen frisch']::text[], 'Gemüse', 'bodyfuel_verified'::public.nutrition_food_source, 17::numeric, 1::numeric, 2::numeric, 0.1::numeric, true, 'Standardwert Radieschen'),
  ('Basilikum', ARRAY['basilikum frisch']::text[], 'Gewürze', 'bodyfuel_verified'::public.nutrition_food_source, 41::numeric, 3::numeric, 5::numeric, 0.8::numeric, true, 'Standardwert frischer Basilikum'),
  ('Schinkenwürfel mager', ARRAY['magere schinkenwürfel','schinkenwürfel','schinken wuerfel','schinkenwürfel light']::text[], 'Aufschnitt', 'bodyfuel_verified'::public.nutrition_food_source, 125::numeric, 22::numeric, 1::numeric, 4::numeric, true, 'Standardwert magere Schinkenwürfel'),
  ('Preiselbeermarmelade light', ARRAY['preiselbeermarmelade','preiselbeeren light','preiselbeeren']::text[], 'Süßes', 'bodyfuel_verified'::public.nutrition_food_source, 120::numeric, 0.3::numeric, 28::numeric, 0.1::numeric, true, 'Standardwert Preiselbeeren light'),
  ('Marmelade zuckerreduziert', ARRAY['zuckerreduzierte marmelade','marmelade light','konfitüre zuckerreduziert','konfituere zuckerreduziert']::text[], 'Süßes', 'bodyfuel_verified'::public.nutrition_food_source, 120::numeric, 0.4::numeric, 28::numeric, 0.1::numeric, true, 'Standardwert zuckerreduzierte Marmelade')
) AS v(name, aliases, category, source, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, verified_by_coach, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.nutrition_foods nf WHERE lower(nf.name) = lower(v.name)
);