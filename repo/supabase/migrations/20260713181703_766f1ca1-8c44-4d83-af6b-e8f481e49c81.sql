
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.food_alias_learning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_term text NOT NULL,
  food_id uuid NOT NULL REFERENCES public.nutrition_foods(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_alias_learning TO authenticated;
GRANT ALL ON public.food_alias_learning TO service_role;

ALTER TABLE public.food_alias_learning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "food_alias_learning read all authenticated"
  ON public.food_alias_learning FOR SELECT TO authenticated USING (true);

CREATE POLICY "food_alias_learning insert own"
  ON public.food_alias_learning FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "food_alias_learning delete own"
  ON public.food_alias_learning FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS food_alias_learning_term_idx ON public.food_alias_learning (normalized_term);
CREATE UNIQUE INDEX IF NOT EXISTS food_alias_learning_uniq ON public.food_alias_learning (user_id, normalized_term, food_id);
CREATE INDEX IF NOT EXISTS nutrition_foods_name_trgm ON public.nutrition_foods USING gin (name gin_trgm_ops);

-- Erweiterte Aliase auf Kaffee schwarz
UPDATE public.nutrition_foods
   SET aliases = ARRAY(SELECT DISTINCT unnest(
       coalesce(aliases,'{}'::text[]) ||
       ARRAY['kaffeegetraenk','kaffeegetränk','kaffee','filterkaffee','espresso','americano','schwarzer kaffee']::text[]))
 WHERE name = 'Kaffee schwarz';

-- Seed neue Lebensmittel (idempotent per NOT EXISTS)
INSERT INTO public.nutrition_foods
  (name, aliases, category, source, source_name, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, unit_type, default_state, verified_by_coach, needs_review, is_active)
SELECT * FROM (VALUES
  ('Süßkirschen, frisch',
    ARRAY['kirschen','kirsche','süßkirsche','suesskirsche','süsskirschen','sweet cherries','cherries']::text[],
    'Obst','bls_4_0'::nutrition_food_source,'BLS 4.0',63::numeric,1.1::numeric,12.9::numeric,0.3::numeric,1.3::numeric,'raw'::nutrition_food_unit,'raw'::nutrition_food_state,true,false,true),
  ('Coca-Cola',
    ARRAY['cola','coca cola','coke','coca-cola']::text[],
    'Getränke','manual'::nutrition_food_source,'Etikett',42::numeric,0::numeric,10.6::numeric,0::numeric,0::numeric,'ml'::nutrition_food_unit,'n_a'::nutrition_food_state,true,false,true),
  ('Coca-Cola Zero',
    ARRAY['cola zero','coke zero','cola ohne zucker','coca cola zero','zero cola','cola light']::text[],
    'Getränke','manual'::nutrition_food_source,'Etikett',0.2::numeric,0::numeric,0::numeric,0::numeric,0::numeric,'ml'::nutrition_food_unit,'n_a'::nutrition_food_state,true,false,true),
  ('Cappuccino',
    ARRAY['cappucino','capuccino']::text[],
    'Getränke','manual'::nutrition_food_source,'BodyFuel Standard',40::numeric,2.5::numeric,3.5::numeric,1.5::numeric,0::numeric,'ml'::nutrition_food_unit,'n_a'::nutrition_food_state,false,false,true),
  ('Latte Macchiato',
    ARRAY['latte','macchiato','latte machiato']::text[],
    'Getränke','manual'::nutrition_food_source,'BodyFuel Standard',50::numeric,3.2::numeric,4.5::numeric,1.8::numeric,0::numeric,'ml'::nutrition_food_unit,'n_a'::nutrition_food_state,false,false,true),
  ('Milchkaffee',
    ARRAY['kaffee mit milch','café au lait','cafe au lait','milch kaffee']::text[],
    'Getränke','manual'::nutrition_food_source,'BodyFuel Standard',35::numeric,2::numeric,3::numeric,1.2::numeric,0::numeric,'ml'::nutrition_food_unit,'n_a'::nutrition_food_state,false,false,true),
  ('Eiskaffee',
    ARRAY['ice coffee','iced coffee','iced latte']::text[],
    'Getränke','manual'::nutrition_food_source,'BodyFuel Standard',90::numeric,2.3::numeric,15::numeric,2.6::numeric,0::numeric,'ml'::nutrition_food_unit,'n_a'::nutrition_food_state,false,false,true)
) AS v(name, aliases, category, source, source_name, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, unit_type, default_state, verified_by_coach, needs_review, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.nutrition_foods nf WHERE lower(nf.name) = lower(v.name));
