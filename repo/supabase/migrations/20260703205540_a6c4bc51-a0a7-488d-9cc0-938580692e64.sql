
DO $$ BEGIN
  CREATE TYPE public.meal_slot_kind AS ENUM ('breakfast','lunch','dinner','snack','pre_workout','post_workout');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.meal_effort_level AS ENUM ('low','medium','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.meal_budget_level AS ENUM ('low','medium','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.coach_meal_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  name TEXT NOT NULL,
  description TEXT,
  category public.meal_slot_kind NOT NULL,
  kcal NUMERIC(7,2) NOT NULL DEFAULT 0,
  protein_g NUMERIC(6,2) NOT NULL DEFAULT 0,
  carbs_g NUMERIC(6,2) NOT NULL DEFAULT 0,
  fat_g NUMERIC(6,2) NOT NULL DEFAULT 0,
  portion_label TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  instructions TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  no_go_ingredients TEXT[] NOT NULL DEFAULT '{}',
  suitable_training BOOLEAN NOT NULL DEFAULT true,
  suitable_rest BOOLEAN NOT NULL DEFAULT true,
  mealprep_ok BOOLEAN NOT NULL DEFAULT true,
  eat_cold BOOLEAN NOT NULL DEFAULT false,
  effort public.meal_effort_level NOT NULL DEFAULT 'medium',
  budget public.meal_budget_level NOT NULL DEFAULT 'medium',
  main_protein TEXT,
  main_carb TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cml_category ON public.coach_meal_library(category) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_cml_created_by ON public.coach_meal_library(created_by);
CREATE INDEX IF NOT EXISTS idx_cml_tags ON public.coach_meal_library USING GIN (tags);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_meal_library TO authenticated;
GRANT ALL ON public.coach_meal_library TO service_role;

ALTER TABLE public.coach_meal_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can read library"
  ON public.coach_meal_library FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Coaches can insert own library entries"
  ON public.coach_meal_library FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'coach')
    AND created_by = auth.uid()
    AND is_system = false
  );

CREATE POLICY "Coaches can update own library entries"
  ON public.coach_meal_library FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND is_system = false)
  WITH CHECK (created_by = auth.uid() AND is_system = false);

CREATE POLICY "Coaches can delete own library entries"
  ON public.coach_meal_library FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND is_system = false);

CREATE TRIGGER trg_cml_updated_at
  BEFORE UPDATE ON public.coach_meal_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.nutrition_plan_meals
  ADD COLUMN IF NOT EXISTS meal_slot public.meal_slot_kind,
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked_prep_group UUID,
  ADD COLUMN IF NOT EXISTS library_meal_id UUID REFERENCES public.coach_meal_library(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_npm_meal_slot ON public.nutrition_plan_meals(meal_slot);
CREATE INDEX IF NOT EXISTS idx_npm_linked_prep_group ON public.nutrition_plan_meals(linked_prep_group);

INSERT INTO public.coach_meal_library
  (is_system, created_by, name, description, category, kcal, protein_g, carbs_g, fat_g,
   portion_label, ingredients, instructions, tags, no_go_ingredients,
   suitable_training, suitable_rest, mealprep_ok, eat_cold, effort, budget, main_protein, main_carb)
VALUES
(true,NULL,'Quark-Beeren-Bowl','Magerquark mit Haferflocken und Beeren','breakfast',420,42,45,8,'1 Bowl','[{"name":"Magerquark","amount_g":250},{"name":"Haferflocken","amount_g":40},{"name":"Beeren","amount_g":100},{"name":"Honig","amount_g":10}]'::jsonb,'Alles verrühren, Beeren obenauf.',ARRAY['high_protein','quick'],ARRAY['milch','laktose','gluten'],true,true,true,true,'low','low','quark','oats'),
(true,NULL,'Rührei mit Vollkornbrot','Klassisches proteinreiches Frühstück','breakfast',480,32,38,22,'3 Eier + 2 Scheiben','[{"name":"Eier","amount_g":150},{"name":"Vollkornbrot","amount_g":80},{"name":"Butter","amount_g":10}]'::jsonb,'Eier verquirlen und in Butter stocken lassen.',ARRAY['classic'],ARRAY['ei','gluten'],true,true,false,false,'low','low','ei','brot'),
(true,NULL,'Porridge Banane-Erdnussbutter','Warmer Haferbrei','breakfast',520,22,68,18,'1 Schale','[{"name":"Haferflocken","amount_g":70},{"name":"Milch","amount_g":250},{"name":"Banane","amount_g":100},{"name":"Erdnussbutter","amount_g":15}]'::jsonb,'Hafer + Milch köcheln, mit Banane und Erdnussbutter toppen.',ARRAY['warm','carb_heavy'],ARRAY['gluten','milch','erdnuss'],true,false,true,false,'low','low','milch','oats'),
(true,NULL,'Skyr mit Nüssen','Schnelles kaltes Frühstück','breakfast',360,32,20,15,'1 Becher','[{"name":"Skyr","amount_g":200},{"name":"Walnüsse","amount_g":20},{"name":"Beeren","amount_g":80}]'::jsonb,'Zutaten mischen.',ARRAY['quick','high_protein','low_carb'],ARRAY['milch','nüsse'],true,true,true,true,'low','medium','skyr','beeren'),
(true,NULL,'Overnight Oats Schoko','Am Vorabend vorbereitet','breakfast',480,25,58,16,'1 Glas','[{"name":"Haferflocken","amount_g":60},{"name":"Milch","amount_g":200},{"name":"Whey Schoko","amount_g":20},{"name":"Chiasamen","amount_g":10}]'::jsonb,'Alles vermischen, über Nacht kalt stellen.',ARRAY['mealprep','cold'],ARRAY['gluten','milch','whey'],true,true,true,true,'low','low','whey','oats'),
(true,NULL,'Hähnchen-Reis-Bowl','Klassische Mealprep-Bowl','lunch',650,50,72,15,'1 Bowl','[{"name":"Hähnchenbrust","amount_g":180},{"name":"Reis (roh)","amount_g":80},{"name":"Brokkoli","amount_g":150},{"name":"Olivenöl","amount_g":10}]'::jsonb,'Reis kochen, Hähnchen anbraten, Brokkoli dämpfen.',ARRAY['mealprep','classic'],ARRAY['huhn'],true,true,true,true,'medium','low','hähnchen','reis'),
(true,NULL,'Puten-Süßkartoffel-Pfanne','Süßkartoffel mit magerem Fleisch','lunch',620,48,62,14,'1 Portion','[{"name":"Putenbrust","amount_g":180},{"name":"Süßkartoffel","amount_g":250},{"name":"Paprika","amount_g":100},{"name":"Olivenöl","amount_g":10}]'::jsonb,'Süßkartoffel würfeln + rösten, Pute anbraten.',ARRAY['mealprep'],ARRAY['pute'],true,true,true,true,'medium','medium','pute','süßkartoffel'),
(true,NULL,'Rindfleisch-Nudeln','Bolognese-Style','lunch',720,45,78,22,'1 Portion','[{"name":"Rinderhack","amount_g":150},{"name":"Vollkornnudeln (roh)","amount_g":90},{"name":"Tomatensoße","amount_g":150}]'::jsonb,'Hack anbraten, mit Tomatensoße köcheln, über Nudeln.',ARRAY['classic'],ARRAY['rind','gluten'],true,true,true,false,'medium','medium','rind','nudeln'),
(true,NULL,'Lachs-Quinoa-Bowl','Omega-3 + Vollkorn','lunch',680,42,55,26,'1 Bowl','[{"name":"Lachsfilet","amount_g":150},{"name":"Quinoa (roh)","amount_g":70},{"name":"Zucchini","amount_g":150},{"name":"Olivenöl","amount_g":10}]'::jsonb,'Lachs braten, Quinoa kochen, Gemüse anbraten.',ARRAY['omega3','healthy'],ARRAY['fisch'],true,true,true,true,'medium','high','lachs','quinoa'),
(true,NULL,'Kichererbsen-Curry (vegan)','Vegetarisch/vegan mit Kichererbsen','lunch',580,25,72,20,'1 Portion','[{"name":"Kichererbsen","amount_g":200},{"name":"Reis (roh)","amount_g":70},{"name":"Kokosmilch","amount_g":100},{"name":"Currypaste","amount_g":15}]'::jsonb,'Kichererbsen + Kokosmilch + Curry köcheln, mit Reis.',ARRAY['vegan','vegetarian'],ARRAY['kokos'],true,true,true,true,'medium','low','kichererbsen','reis'),
(true,NULL,'Wrap mit Hähnchen','Schnelles Mittag to go','lunch',560,42,52,18,'1 Wrap','[{"name":"Vollkornwrap","amount_g":70},{"name":"Hähnchenbrust","amount_g":120},{"name":"Salat","amount_g":50},{"name":"Joghurtsoße","amount_g":30}]'::jsonb,'Hähnchen braten, Wrap füllen, rollen.',ARRAY['quick','portable'],ARRAY['huhn','gluten','milch'],true,false,true,true,'low','low','hähnchen','wrap'),
(true,NULL,'Lachs mit Ofengemüse','Leichtes Abendessen','dinner',540,40,25,28,'1 Portion','[{"name":"Lachsfilet","amount_g":180},{"name":"Zucchini","amount_g":150},{"name":"Paprika","amount_g":100},{"name":"Olivenöl","amount_g":10}]'::jsonb,'Alles bei 200°C 20 Min. backen.',ARRAY['healthy','low_carb'],ARRAY['fisch'],false,true,true,false,'low','high','lachs','gemüse'),
(true,NULL,'Puten-Gemüsepfanne (low carb)','Kohlenhydratarm am Abend','dinner',420,45,15,20,'1 Portion','[{"name":"Putenbrust","amount_g":180},{"name":"Zucchini","amount_g":150},{"name":"Paprika","amount_g":100},{"name":"Feta","amount_g":40}]'::jsonb,'Alles in der Pfanne braten, Feta darüber.',ARRAY['low_carb','high_protein'],ARRAY['pute','milch'],false,true,true,false,'low','medium','pute','gemüse'),
(true,NULL,'Rührei mit Gemüse','Einfaches Abendessen','dinner',380,28,12,24,'3 Eier','[{"name":"Eier","amount_g":150},{"name":"Spinat","amount_g":100},{"name":"Tomaten","amount_g":80},{"name":"Butter","amount_g":10}]'::jsonb,'Eier verquirlen, mit Gemüse braten.',ARRAY['low_carb','quick'],ARRAY['ei'],false,true,false,false,'low','low','ei','gemüse'),
(true,NULL,'Vollkornbrot mit Hüttenkäse','Kaltes Abendessen','dinner',420,35,42,10,'2 Scheiben','[{"name":"Vollkornbrot","amount_g":100},{"name":"Hüttenkäse","amount_g":200},{"name":"Gurke","amount_g":80}]'::jsonb,'Brot belegen.',ARRAY['quick','cold'],ARRAY['gluten','milch'],true,true,true,true,'low','low','hüttenkäse','brot'),
(true,NULL,'Linsensuppe (vegan)','Wärmend, vegan','dinner',460,28,55,10,'1 Teller','[{"name":"Linsen (roh)","amount_g":80},{"name":"Karotten","amount_g":100},{"name":"Zwiebeln","amount_g":50},{"name":"Gemüsebrühe","amount_g":400}]'::jsonb,'Alles ca. 30 Min köcheln.',ARRAY['vegan','warm','mealprep'],ARRAY[]::text[],true,true,true,false,'low','low','linsen','linsen'),
(true,NULL,'Proteinshake mit Banane','Schneller Post-Workout Snack','snack',280,32,32,3,'1 Shake','[{"name":"Whey","amount_g":30},{"name":"Banane","amount_g":120},{"name":"Wasser","amount_g":300}]'::jsonb,'Mixen.',ARRAY['quick','high_protein'],ARRAY['whey','milch'],true,false,false,true,'low','low','whey','banane'),
(true,NULL,'Apfel + Erdnussbutter','Snack für zwischendurch','snack',260,7,28,14,'1 Apfel','[{"name":"Apfel","amount_g":180},{"name":"Erdnussbutter","amount_g":20}]'::jsonb,'Apfel in Scheiben, Erdnussbutter dazu.',ARRAY['quick','portable'],ARRAY['erdnuss'],true,true,false,true,'low','low','erdnussbutter','apfel'),
(true,NULL,'Skyr mit Honig','Proteinreicher Snack','snack',220,22,22,2,'1 Becher','[{"name":"Skyr","amount_g":200},{"name":"Honig","amount_g":15}]'::jsonb,'Verrühren.',ARRAY['quick','high_protein','low_fat'],ARRAY['milch'],true,true,true,true,'low','low','skyr','honig'),
(true,NULL,'Reiswaffeln mit Frischkäse','Leichter Snack','snack',180,10,26,4,'3 Waffeln','[{"name":"Reiswaffeln","amount_g":30},{"name":"Frischkäse light","amount_g":40}]'::jsonb,'Reiswaffeln bestreichen.',ARRAY['quick','low_cal'],ARRAY['milch'],true,true,false,true,'low','low','frischkäse','reiswaffeln'),
(true,NULL,'Handvoll Nüsse','Fettreicher Mini-Snack','snack',200,6,6,18,'30 g','[{"name":"Mandeln","amount_g":30}]'::jsonb,'Direkt essen.',ARRAY['quick','portable','fat'],ARRAY['nüsse','mandeln'],true,true,true,true,'low','medium','mandeln','mandeln'),
(true,NULL,'Proteinriegel','Notfall-Snack','snack',210,20,20,7,'1 Riegel','[{"name":"Proteinriegel","amount_g":60}]'::jsonb,'Auspacken.',ARRAY['quick','portable'],ARRAY['whey','milch','soja'],true,false,true,true,'low','medium','protein','protein');
