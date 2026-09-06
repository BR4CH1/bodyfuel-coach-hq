-- BodyFuel Soulfood library
-- Adds coach-friendly comfort-food options for both lunch and dinner.
-- Fixed UUIDs make the migration idempotent when environments are rebuilt.

WITH recipes AS (
  SELECT * FROM (VALUES
    (
      'a1100001-0000-4000-8000-000000000001'::uuid,
      'a1100001-0000-4000-8000-000000000002'::uuid,
      'Protein-Lasagne Bolognese',
      'Klassische Lasagne auf alltagstauglicher High-Protein-Basis mit magerem Rinderhack, Tomatensauce und leichter Käsecreme.',
      620::numeric, 58::numeric, 58::numeric, 16::numeric,
      '1 große Portion',
      '[{"name":"Rinderhack 5 % Fett","amount_g":140},{"name":"Lasagneplatten trocken","amount_g":60},{"name":"Passierte Tomaten","amount_g":200},{"name":"Hüttenkäse light","amount_g":100},{"name":"Mozzarella light","amount_g":30},{"name":"Zwiebel","amount_g":50}]'::jsonb,
      'Hack mit Zwiebel anbraten, Tomaten zugeben und würzen. Mit Lasagneplatten und Hüttenkäse schichten, Mozzarella darübergeben und bei 190 °C etwa 30 Minuten backen.',
      ARRAY['soulfood','comfort-food','high-protein','lasagne','italienisch']::text[],
      ARRAY['gluten','milch']::text[],
      'Rinderhack', 'Lasagneplatten', true, false, 'medium', 'medium'
    ),
    (
      'a1100002-0000-4000-8000-000000000001'::uuid,
      'a1100002-0000-4000-8000-000000000002'::uuid,
      'High-Protein Smash Burger',
      'Smash Burger mit magerem Rinderpatty, leichtem Käse, Pickles und Burgersauce – echtes Burgergefühl mit planbaren Makros.',
      575::numeric, 48::numeric, 48::numeric, 18::numeric,
      '1 Burger',
      '[{"name":"Rinderhack 5 % Fett","amount_g":150},{"name":"Burger Bun","amount_g":80},{"name":"Cheddar light","amount_g":30},{"name":"Gewürzgurken","amount_g":30},{"name":"Zwiebel","amount_g":30},{"name":"Tomate","amount_g":50},{"name":"leichte Burgersauce","amount_g":30}]'::jsonb,
      'Hack zu einer Kugel formen und sehr heiß in der Pfanne smashen. Von beiden Seiten kräftig braten, Käse auflegen. Bun toasten und mit Gemüse, Pickles und Sauce zusammenbauen.',
      ARRAY['soulfood','comfort-food','high-protein','burger','smash-burger']::text[],
      ARRAY['gluten','milch']::text[],
      'Rinderhack', 'Burger Bun', false, false, 'low', 'medium'
    ),
    (
      'a1100003-0000-4000-8000-000000000001'::uuid,
      'a1100003-0000-4000-8000-000000000002'::uuid,
      'Cheeseburger Bowl',
      'Burger-Komponenten als sättigende Bowl mit Kartoffeln, magerem Hack, leichtem Cheddar, Salat und Pickles.',
      620::numeric, 50::numeric, 60::numeric, 18::numeric,
      '1 Bowl',
      '[{"name":"Rinderhack 5 % Fett","amount_g":160},{"name":"Kartoffeln","amount_g":300},{"name":"Cheddar light","amount_g":30},{"name":"Blattsalat","amount_g":70},{"name":"Tomate","amount_g":80},{"name":"Gewürzgurken","amount_g":40},{"name":"leichte Burgersauce","amount_g":30}]'::jsonb,
      'Kartoffeln würzen und im Airfryer oder Ofen knusprig garen. Hack krümelig braten. Alles mit Salat, Tomate, Pickles, Käse und Sauce in einer Bowl anrichten.',
      ARRAY['soulfood','comfort-food','high-protein','burger','bowl','mealprep']::text[],
      ARRAY['milch']::text[],
      'Rinderhack', 'Kartoffeln', true, true, 'low', 'medium'
    ),
    (
      'a1100004-0000-4000-8000-000000000001'::uuid,
      'a1100004-0000-4000-8000-000000000002'::uuid,
      'Crispy Chicken Burger',
      'Knuspriger Chicken Burger aus dem Airfryer mit Cornflakes-Panade, frischem Salat und leichter Sauce.',
      630::numeric, 54::numeric, 65::numeric, 14::numeric,
      '1 Burger',
      '[{"name":"Hähnchenbrust","amount_g":180},{"name":"Burger Bun","amount_g":80},{"name":"Cornflakes ungesüßt","amount_g":30},{"name":"Ei","amount_g":50},{"name":"Blattsalat","amount_g":40},{"name":"Tomate","amount_g":60},{"name":"leichte Burgersauce","amount_g":30}]'::jsonb,
      'Hähnchen flach klopfen, würzen, durch Ei ziehen und mit zerdrückten Cornflakes panieren. Im Airfryer knusprig garen. Bun toasten und mit Salat, Tomate und Sauce belegen.',
      ARRAY['soulfood','comfort-food','high-protein','burger','chicken','airfryer']::text[],
      ARRAY['gluten','ei']::text[],
      'Hähnchenbrust', 'Burger Bun', false, false, 'medium', 'medium'
    ),
    (
      'a1100005-0000-4000-8000-000000000001'::uuid,
      'a1100005-0000-4000-8000-000000000002'::uuid,
      'Loaded Chili Cheese Fries Bowl',
      'Ofenkartoffeln mit würzigem Beef-Chili, Kidneybohnen und leichtem Käse – sättigendes Soulfood mit viel Protein.',
      690::numeric, 52::numeric, 75::numeric, 18::numeric,
      '1 große Bowl',
      '[{"name":"Kartoffeln","amount_g":300},{"name":"Rinderhack 5 % Fett","amount_g":150},{"name":"Kidneybohnen","amount_g":100},{"name":"Passierte Tomaten","amount_g":120},{"name":"Cheddar light","amount_g":30},{"name":"Zwiebel","amount_g":50}]'::jsonb,
      'Kartoffeln als Wedges im Ofen oder Airfryer garen. Hack und Zwiebel anbraten, Bohnen und Tomaten zugeben und kräftig würzen. Chili auf den Kartoffeln verteilen und Käse darübergeben.',
      ARRAY['soulfood','comfort-food','high-protein','chili-cheese','fries','bowl','mealprep']::text[],
      ARRAY['milch']::text[],
      'Rinderhack', 'Kartoffeln', true, false, 'medium', 'medium'
    ),
    (
      'a1100006-0000-4000-8000-000000000001'::uuid,
      'a1100006-0000-4000-8000-000000000002'::uuid,
      'High-Protein Mac & Cheese',
      'Cremige Mac & Cheese mit Hähnchen, Skyr und leichtem Cheddar – comfort food mit starkem Proteinprofil.',
      650::numeric, 68::numeric, 66::numeric, 12::numeric,
      '1 große Portion',
      '[{"name":"Makkaroni trocken","amount_g":80},{"name":"Hähnchenbrust","amount_g":150},{"name":"Skyr natur","amount_g":100},{"name":"Cheddar light","amount_g":40},{"name":"Milch 1,5 %","amount_g":100}]'::jsonb,
      'Pasta kochen. Hähnchen würfeln und anbraten. Milch und Käse bei niedriger Hitze cremig rühren, vom Herd nehmen und Skyr einarbeiten. Pasta und Hähnchen unterheben.',
      ARRAY['soulfood','comfort-food','high-protein','mac-and-cheese','pasta','mealprep']::text[],
      ARRAY['gluten','milch']::text[],
      'Hähnchenbrust', 'Makkaroni', true, false, 'low', 'medium'
    ),
    (
      'a1100007-0000-4000-8000-000000000001'::uuid,
      'a1100007-0000-4000-8000-000000000002'::uuid,
      'BBQ Chicken Pizza',
      'Schnelle High-Protein-Pizza auf Wrap-Basis mit BBQ-Hähnchen, Mozzarella und roten Zwiebeln.',
      605::numeric, 55::numeric, 55::numeric, 15::numeric,
      '1 große Wrap-Pizza',
      '[{"name":"Protein Wrap","amount_g":70},{"name":"Hähnchenbrust","amount_g":160},{"name":"Mozzarella light","amount_g":50},{"name":"BBQ Sauce light","amount_g":30},{"name":"Passierte Tomaten","amount_g":80},{"name":"Rote Zwiebel","amount_g":40}]'::jsonb,
      'Wrap mit Tomate und BBQ-Sauce bestreichen. Gegartes Hähnchen, Zwiebel und Mozzarella darauf verteilen. Bei 210 °C backen, bis der Rand knusprig und der Käse geschmolzen ist.',
      ARRAY['soulfood','comfort-food','high-protein','pizza','bbq','chicken']::text[],
      ARRAY['gluten','milch']::text[],
      'Hähnchenbrust', 'Protein Wrap', false, false, 'low', 'medium'
    ),
    (
      'a1100008-0000-4000-8000-000000000001'::uuid,
      'a1100008-0000-4000-8000-000000000002'::uuid,
      'Chicken Döner Bowl',
      'Döner-Style Bowl mit würzigem Hähnchen, Reis, knackigem Salat, Feta und leichter Knoblauch-Joghurt-Sauce.',
      675::numeric, 57::numeric, 70::numeric, 15::numeric,
      '1 große Bowl',
      '[{"name":"Hähnchenbrust","amount_g":180},{"name":"Basmatireis trocken","amount_g":70},{"name":"Joghurt 1,5 %","amount_g":100},{"name":"Feta light","amount_g":30},{"name":"Blattsalat","amount_g":70},{"name":"Tomate","amount_g":80},{"name":"Gurke","amount_g":80}]'::jsonb,
      'Reis garen. Hähnchen in Dönergewürz scharf anbraten. Joghurt mit Knoblauch, Salz und Zitronensaft verrühren. Mit Salat, Gemüse, Feta und Sauce als Bowl anrichten.',
      ARRAY['soulfood','comfort-food','high-protein','döner','kebab','bowl','mealprep']::text[],
      ARRAY['milch']::text[],
      'Hähnchenbrust', 'Basmatireis', true, true, 'low', 'medium'
    )
  ) AS r(
    lunch_id, dinner_id, name, description, kcal, protein_g, carbs_g, fat_g,
    portion_label, ingredients, instructions, tags, no_go_ingredients,
    main_protein, main_carb, mealprep_ok, eat_cold, effort, budget
  )
), expanded AS (
  SELECT
    CASE WHEN slot.category = 'lunch' THEN r.lunch_id ELSE r.dinner_id END AS id,
    r.name,
    r.description,
    slot.category::public.meal_slot_kind AS category,
    r.kcal,
    r.protein_g,
    r.carbs_g,
    r.fat_g,
    r.portion_label,
    r.ingredients,
    r.instructions,
    r.tags,
    r.no_go_ingredients,
    true AS suitable_training,
    true AS suitable_rest,
    r.mealprep_ok,
    r.eat_cold,
    r.effort::public.meal_effort_level AS effort,
    r.budget::public.meal_budget_level AS budget,
    r.main_protein,
    r.main_carb
  FROM recipes r
  CROSS JOIN (VALUES ('lunch'), ('dinner')) AS slot(category)
)
INSERT INTO public.coach_meal_library (
  id, name, description, category, kcal, protein_g, carbs_g, fat_g,
  portion_label, ingredients, instructions, tags, no_go_ingredients,
  suitable_training, suitable_rest, mealprep_ok, eat_cold, effort, budget,
  main_protein, main_carb, is_active, is_system, image_status
)
SELECT
  id, name, description, category, kcal, protein_g, carbs_g, fat_g,
  portion_label, ingredients, instructions, tags, no_go_ingredients,
  suitable_training, suitable_rest, mealprep_ok, eat_cold, effort, budget,
  main_protein, main_carb, true, true, 'none'
FROM expanded
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  kcal = EXCLUDED.kcal,
  protein_g = EXCLUDED.protein_g,
  carbs_g = EXCLUDED.carbs_g,
  fat_g = EXCLUDED.fat_g,
  portion_label = EXCLUDED.portion_label,
  ingredients = EXCLUDED.ingredients,
  instructions = EXCLUDED.instructions,
  tags = EXCLUDED.tags,
  no_go_ingredients = EXCLUDED.no_go_ingredients,
  suitable_training = EXCLUDED.suitable_training,
  suitable_rest = EXCLUDED.suitable_rest,
  mealprep_ok = EXCLUDED.mealprep_ok,
  eat_cold = EXCLUDED.eat_cold,
  effort = EXCLUDED.effort,
  budget = EXCLUDED.budget,
  main_protein = EXCLUDED.main_protein,
  main_carb = EXCLUDED.main_carb,
  is_active = true,
  is_system = true,
  updated_at = now();
