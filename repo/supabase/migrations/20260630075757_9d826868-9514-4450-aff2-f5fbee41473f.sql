
DELETE FROM public.nutrition_foods
WHERE name IN (
  'Gemischtes Gemüse (TK, gegart)',
  'Gemüsecurry-Mix (gegart)',
  'Salatmix (Blattsalat gemischt)',
  'Rohkost-Mix (gemischtes Gemüse roh)'
);

INSERT INTO public.nutrition_foods (name, aliases, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, verified_by_coach, source, default_state, unit_type)
VALUES
  ('Gemischtes Gemüse (TK, gegart)',
   ARRAY['gemüse','gemuese','gemüsemix','gemuesemix','gemüsemischung','gemuesemischung','tk gemüse','tk-gemüse','tk gemuese','tk-gemuese','tiefkühlgemüse','tiefkuehlgemuese','wokgemüse','wokgemuese','asia gemüse','asiagemüse','gemischtes gemüse','mischgemüse','mischgemuese','buntes gemüse','grillgemüse','grillgemuese','ofengemüse','ofengemuese','gemüsepfanne','gemuesepfanne','beilagengemüse','beilagengemuese'],
   35, 2.5, 5.0, 0.4, 2.5, true, 'bodyfuel_verified', 'cooked', 'cooked'),
  ('Gemüsecurry-Mix (gegart)',
   ARRAY['gemüsecurry','gemuesecurry','currygemüse','currygemuese','currygemüsemix','currygemuesemix'],
   55, 2.0, 7.0, 2.0, 2.5, true, 'bodyfuel_verified', 'cooked', 'cooked'),
  ('Salatmix (Blattsalat gemischt)',
   ARRAY['salat','salatmix','blattsalat','gemischter salat','mischsalat','salat gemischt','grüner salat','gruener salat'],
   18, 1.4, 2.0, 0.2, 1.8, true, 'bodyfuel_verified', 'raw', 'raw'),
  ('Rohkost-Mix (gemischtes Gemüse roh)',
   ARRAY['rohkost','rohkostmix','rohkost gemüse','rohkost gemuese','gemüse roh','gemuese roh','gemüsesticks','gemuesesticks'],
   30, 1.5, 5.0, 0.3, 2.2, true, 'bodyfuel_verified', 'raw', 'raw');
