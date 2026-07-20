
CREATE TABLE public.nutrition_plan_meal_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_meal_id uuid NOT NULL REFERENCES public.nutrition_plan_meals(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  name text NOT NULL,
  description text,
  kcal integer,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_meal_id, override_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_plan_meal_overrides TO authenticated;
GRANT ALL ON public.nutrition_plan_meal_overrides TO service_role;

ALTER TABLE public.nutrition_plan_meal_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own meal overrides"
  ON public.nutrition_plan_meal_overrides
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_meal_overrides_user_date
  ON public.nutrition_plan_meal_overrides (user_id, override_date);
