CREATE TABLE public.food_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  brand text,
  barcode text,
  serving_g numeric,
  serving_label text,
  kcal_per_100g numeric NOT NULL DEFAULT 0,
  protein_per_100g numeric NOT NULL DEFAULT 0,
  carbs_per_100g numeric NOT NULL DEFAULT 0,
  fat_per_100g numeric NOT NULL DEFAULT 0,
  last_amount_g numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX food_favorites_user_key
  ON public.food_favorites(user_id, COALESCE(barcode, name), COALESCE(brand, ''));

CREATE INDEX food_favorites_user_created
  ON public.food_favorites(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_favorites TO authenticated;
GRANT ALL ON public.food_favorites TO service_role;

ALTER TABLE public.food_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own food favorites"
  ON public.food_favorites
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);