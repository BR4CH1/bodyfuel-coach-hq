CREATE TABLE public.meal_skips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_id UUID REFERENCES public.nutrition_plan_meals(id) ON DELETE SET NULL,
  meal_name TEXT,
  skip_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_meal_skips_user ON public.meal_skips(user_id, skip_date DESC);
CREATE INDEX idx_meal_skips_meal ON public.meal_skips(meal_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_skips TO authenticated;
GRANT ALL ON public.meal_skips TO service_role;
ALTER TABLE public.meal_skips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own skips" ON public.meal_skips FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Coaches view all skips" ON public.meal_skips FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'coach'));

ALTER TABLE public.nutrition_plans ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.nutrition_plans ADD COLUMN IF NOT EXISTS scheduled_activation_date DATE;
ALTER TABLE public.nutrition_plans ADD COLUMN IF NOT EXISTS generated_by TEXT;