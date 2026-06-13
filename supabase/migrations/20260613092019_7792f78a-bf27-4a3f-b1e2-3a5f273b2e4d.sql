
CREATE TABLE public.nutrition_plan_days (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.nutrition_plans(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX nutrition_plan_days_plan_idx ON public.nutrition_plan_days(plan_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_plan_days TO authenticated;
GRANT ALL ON public.nutrition_plan_days TO service_role;
ALTER TABLE public.nutrition_plan_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "npd read" ON public.nutrition_plan_days FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM nutrition_plans p WHERE p.id = nutrition_plan_days.plan_id AND (p.client_id = auth.uid() OR has_role(auth.uid(), 'coach'::app_role))));
CREATE POLICY "npd coach write" ON public.nutrition_plan_days FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role)) WITH CHECK (has_role(auth.uid(), 'coach'::app_role));

CREATE TABLE public.nutrition_plan_meals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_id uuid NOT NULL REFERENCES public.nutrition_plan_days(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  kcal integer,
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX nutrition_plan_meals_day_idx ON public.nutrition_plan_meals(day_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_plan_meals TO authenticated;
GRANT ALL ON public.nutrition_plan_meals TO service_role;
ALTER TABLE public.nutrition_plan_meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "npm read" ON public.nutrition_plan_meals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM nutrition_plan_days d JOIN nutrition_plans p ON p.id = d.plan_id
    WHERE d.id = nutrition_plan_meals.day_id AND (p.client_id = auth.uid() OR has_role(auth.uid(), 'coach'::app_role))));
CREATE POLICY "npm coach write" ON public.nutrition_plan_meals FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role)) WITH CHECK (has_role(auth.uid(), 'coach'::app_role));
