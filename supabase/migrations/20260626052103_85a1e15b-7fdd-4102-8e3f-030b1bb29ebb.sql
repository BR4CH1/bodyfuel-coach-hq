
-- Expand nutrition_foods: add missing common items + aliases so the
-- DB-recompute actually fires for everyday meals (porridge, brot+aufschnitt).

-- Extra aliases on existing rows
UPDATE public.nutrition_foods SET aliases = ARRAY['Vollkornbrot','Vollkornbrot Roggen','Roggenbrot','Mischbrot','Brot Vollkorn']
  WHERE name = 'Brot Vollkorn (Roggen)';
UPDATE public.nutrition_foods SET aliases = ARRAY['Tomate','Tomate frisch','Strauchtomate','Cherrytomate']
  WHERE name = 'Tomaten';
UPDATE public.nutrition_foods SET aliases = ARRAY['Salatgurke']
  WHERE name = 'Gurke';
UPDATE public.nutrition_foods SET aliases = ARRAY['Haferflocken kernig','Haferflocken zart','Oats','Porridge-Haferflocken','Porridge Haferflocken']
  WHERE name = 'Haferflocken';

-- New foods. kcal-Werte aus BLS / Standardwerten.
INSERT INTO public.nutrition_foods
  (name, aliases, category, source, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)
VALUES
  ('Wasser', ARRAY['Mineralwasser','Leitungswasser','Stilles Wasser'], 'Getränke', 'bls_4_0', 0, 0, 0, 0),
  ('Kaffee schwarz', ARRAY['Kaffee','Espresso','schwarzer Kaffee'], 'Getränke', 'bls_4_0', 2, 0.1, 0.3, 0),
  ('Tee', ARRAY['Schwarztee','Grüntee','Kräutertee'], 'Getränke', 'bls_4_0', 1, 0, 0.2, 0),
  ('Zimt', ARRAY['Zimt gemahlen','Ceylon Zimt'], 'Gewürze', 'bls_4_0', 261, 4, 56, 3.2),
  ('Salz', ARRAY['Speisesalz','Meersalz'], 'Gewürze', 'bls_4_0', 0, 0, 0, 0),
  ('Pfeffer', ARRAY['Pfeffer schwarz','schwarzer Pfeffer','Pfeffer gemahlen'], 'Gewürze', 'bls_4_0', 251, 10, 64, 3.3),
  ('Gewürze', ARRAY['Kräuter','Gewürzmischung','Paprikapulver','Currypulver'], 'Gewürze', 'manual', 0, 0, 0, 0),
  ('Senf', ARRAY['Senf mittelscharf','Dijon Senf'], 'Saucen', 'bls_4_0', 105, 6, 8, 6),
  ('Ketchup', ARRAY['Tomatenketchup'], 'Saucen', 'bls_4_0', 110, 1.5, 24, 0.3),
  ('Sojasauce', ARRAY['Soja Sauce','Soy Sauce'], 'Saucen', 'bls_4_0', 60, 9, 5, 0.5),
  ('Essig', ARRAY['Balsamico','Apfelessig','Weißweinessig'], 'Saucen', 'bls_4_0', 20, 0.4, 0.6, 0),
  ('Zitronensaft', ARRAY['Limettensaft'], 'Saucen', 'bls_4_0', 24, 0.4, 8, 0.1),

  -- Aufschnitt / Wurst
  ('Rinderaufschnitt mager', ARRAY['Rinderaufschnitt','Roastbeef Aufschnitt','Bresaola','Bündnerfleisch'], 'Aufschnitt', 'bls_4_0', 120, 27, 0.5, 1.5),
  ('Putenbrust Aufschnitt', ARRAY['Putenaufschnitt','Putenbrust geräuchert','Pute Aufschnitt'], 'Aufschnitt', 'bls_4_0', 110, 22, 1, 2),
  ('Hähnchenbrust Aufschnitt', ARRAY['Hühnchen Aufschnitt','Geflügelaufschnitt'], 'Aufschnitt', 'bls_4_0', 110, 22, 1, 2),
  ('Lachsschinken', ARRAY[]::text[], 'Aufschnitt', 'bls_4_0', 130, 25, 0.5, 3),
  ('Kochschinken mager', ARRAY['Kochschinken','Schinken gekocht'], 'Aufschnitt', 'bls_4_0', 110, 21, 0.5, 3),
  ('Serrano-Schinken', ARRAY['Serrano','Parmaschinken','Prosciutto'], 'Aufschnitt', 'bls_4_0', 240, 30, 0.5, 13),
  ('Salami', ARRAY[]::text[], 'Aufschnitt', 'bls_4_0', 380, 19, 1, 33),

  -- Brot / Getreide
  ('Gewürzgurken', ARRAY['Gewürzgurke','saure Gurken','Cornichons'], 'Gemüse', 'bls_4_0', 16, 0.7, 2.3, 0.2),
  ('Vollkorntoast', ARRAY['Toast Vollkorn','Vollkorn-Toast'], 'Brot', 'bls_4_0', 240, 9, 41, 4),
  ('Eiweißbrot', ARRAY['Proteinbrot','Low-Carb Brot'], 'Brot', 'manual', 240, 22, 8, 12),
  ('Knäckebrot', ARRAY['Roggen-Knäckebrot'], 'Brot', 'bls_4_0', 350, 10, 65, 2),
  ('Brötchen Weizen', ARRAY['Brötchen','Semmel','Weißmehlbrötchen'], 'Brot', 'bls_4_0', 270, 9, 53, 1.5),
  ('Vollkornbrötchen', ARRAY[]::text[], 'Brot', 'bls_4_0', 245, 10, 44, 2.5),
  ('Reiswaffel', ARRAY['Reiswaffeln'], 'Brot', 'bls_4_0', 380, 8, 81, 3),
  ('Quinoa gekocht', ARRAY[]::text[], 'Beilage', 'bls_4_0', 120, 4.4, 21, 1.9),
  ('Bulgur gekocht', ARRAY['Bulgur'], 'Beilage', 'bls_4_0', 130, 4, 26, 0.5),
  ('Couscous gekocht', ARRAY['Couscous gar'], 'Beilage', 'bls_4_0', 130, 4, 27, 0.2),
  ('Süßkartoffel gekocht', ARRAY['Süßkartoffel gegart'], 'Beilage', 'bls_4_0', 90, 1.6, 20, 0.1),

  -- Milchprodukte
  ('Skyr Vanille', ARRAY['Skyr mit Vanille'], 'Milch', 'manual', 70, 11, 6, 0.2),
  ('Quark 40% Fett', ARRAY['Quark 40','Sahnequark'], 'Milch', 'bls_4_0', 160, 11, 3, 11),
  ('Frischkäse Doppelrahm', ARRAY['Frischkäse'], 'Milch', 'bls_4_0', 340, 6, 3, 33),
  ('Frischkäse light', ARRAY['Frischkäse leicht','Frischkäse 0,2%'], 'Milch', 'bls_4_0', 120, 10, 4, 7),
  ('Feta', ARRAY['Feta Käse','Schafskäse'], 'Milch', 'bls_4_0', 260, 17, 1, 21),
  ('Mozzarella', ARRAY[]::text[], 'Milch', 'bls_4_0', 250, 18, 1, 19),
  ('Gouda 45%', ARRAY['Gouda','Goudakäse'], 'Milch', 'bls_4_0', 370, 25, 0.5, 30),
  ('Parmesan', ARRAY['Parmigiano'], 'Milch', 'bls_4_0', 400, 36, 0, 28),
  ('Schmand', ARRAY[]::text[], 'Milch', 'bls_4_0', 240, 3, 4, 24),
  ('Sahne 30%', ARRAY['Schlagsahne'], 'Milch', 'bls_4_0', 290, 2.4, 3.5, 30),
  ('Haferdrink', ARRAY['Hafermilch','Oat Drink'], 'Milch', 'manual', 45, 0.4, 6.5, 1.5),
  ('Mandeldrink', ARRAY['Mandelmilch','Almond Drink'], 'Milch', 'manual', 22, 0.5, 0.3, 1.1),
  ('Sojadrink', ARRAY['Sojamilch'], 'Milch', 'manual', 40, 3.3, 2.5, 1.8),

  -- Obst
  ('Birne', ARRAY[]::text[], 'Obst', 'bls_4_0', 55, 0.5, 12, 0.3),
  ('Mandarine', ARRAY['Clementine'], 'Obst', 'bls_4_0', 50, 0.7, 10, 0.2),
  ('Trauben', ARRAY['Weintrauben'], 'Obst', 'bls_4_0', 70, 0.7, 16, 0.3),
  ('Kiwi', ARRAY[]::text[], 'Obst', 'bls_4_0', 60, 1, 13, 0.5),
  ('Mango', ARRAY[]::text[], 'Obst', 'bls_4_0', 62, 0.6, 14, 0.4),

  -- Gemüse
  ('Paprika gelb', ARRAY['Paprika'], 'Gemüse', 'bls_4_0', 25, 1, 5, 0.2),
  ('Paprika grün', ARRAY[]::text[], 'Gemüse', 'bls_4_0', 22, 0.9, 4, 0.2),
  ('Blumenkohl', ARRAY[]::text[], 'Gemüse', 'bls_4_0', 28, 2.5, 4, 0.3),
  ('Aubergine', ARRAY[]::text[], 'Gemüse', 'bls_4_0', 24, 1, 4, 0.2),
  ('Knoblauch', ARRAY['Knoblauchzehe'], 'Gemüse', 'bls_4_0', 140, 6, 28, 0.5),
  ('Rucola', ARRAY[]::text[], 'Gemüse', 'bls_4_0', 28, 2.6, 2, 0.7),
  ('Feldsalat', ARRAY[]::text[], 'Gemüse', 'bls_4_0', 21, 1.8, 0.4, 0.4),
  ('Mais Dose', ARRAY['Mais','Süßmais'], 'Gemüse', 'bls_4_0', 90, 3, 18, 1.2),
  ('Erbsen TK', ARRAY['Erbsen','grüne Erbsen'], 'Gemüse', 'bls_4_0', 80, 5, 12, 0.5),

  -- Fett / Nüsse
  ('Butter Salzig', ARRAY['Süßrahmbutter'], 'Fett', 'bls_4_0', 740, 0.7, 0.6, 82),
  ('Kokosöl', ARRAY[]::text[], 'Fett', 'bls_4_0', 900, 0, 0, 100),
  ('Erdnüsse geröstet', ARRAY['Erdnüsse'], 'Nüsse', 'bls_4_0', 600, 25, 12, 49),
  ('Haselnüsse', ARRAY[]::text[], 'Nüsse', 'bls_4_0', 640, 12, 11, 61),

  -- Protein
  ('Putenbrust gegart', ARRAY['Putenbrust gegrillt','Pute Filet gegart'], 'Fleisch', 'bls_4_0', 110, 24, 0, 1),
  ('Rinderhack mager', ARRAY['Rinderhack','Hackfleisch Rind mager'], 'Fleisch', 'bls_4_0', 130, 21, 0, 5),
  ('Räucherlachs', ARRAY['Lachs geräuchert'], 'Fisch', 'bls_4_0', 200, 22, 0, 12),
  ('Thunfisch frisch', ARRAY['Thunfischsteak'], 'Fisch', 'bls_4_0', 145, 23, 0, 6),
  ('Garnelen roh', ARRAY['Shrimps roh'], 'Fisch', 'bls_4_0', 85, 18, 1, 1),
  ('Tofu natur', ARRAY['Tofu'], 'Protein', 'bls_4_0', 130, 14, 1.5, 8),
  ('Whey Protein', ARRAY['Eiweißpulver','Proteinpulver','Whey'], 'Protein', 'manual', 380, 80, 6, 5);
