
-- Partner-Mode: 1:1 Kopplung zwischen zwei Kunden
CREATE TABLE public.nutrition_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_partners_no_self CHECK (user_a <> user_b)
);

-- Normalize pair so (A,B) == (B,A) and enforce single partner per user.
CREATE UNIQUE INDEX nutrition_partners_pair_uniq
  ON public.nutrition_partners (LEAST(user_a, user_b), GREATEST(user_a, user_b));
CREATE UNIQUE INDEX nutrition_partners_user_a_uniq ON public.nutrition_partners(user_a);
CREATE UNIQUE INDEX nutrition_partners_user_b_uniq ON public.nutrition_partners(user_b);

GRANT SELECT ON public.nutrition_partners TO authenticated;
GRANT ALL ON public.nutrition_partners TO service_role;
ALTER TABLE public.nutrition_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner read own or coach"
  ON public.nutrition_partners FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b OR public.has_role(auth.uid(), 'coach'));
CREATE POLICY "partner coach write"
  ON public.nutrition_partners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coach'))
  WITH CHECK (public.has_role(auth.uid(), 'coach'));

-- Plan/Meal/Shopping-Erweiterungen
ALTER TABLE public.nutrition_plans
  ADD COLUMN IF NOT EXISTS partner_plan_id UUID REFERENCES public.nutrition_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_partner_plan BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.nutrition_plan_meals
  ADD COLUMN IF NOT EXISTS partner_meal_id UUID REFERENCES public.nutrition_plan_meals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.shopping_lists
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'individual'
    CHECK (scope IN ('individual','partner_combined')),
  ADD COLUMN IF NOT EXISTS partner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Combined shopping list keyed on (plan_id, scope) — drop old pk first
ALTER TABLE public.shopping_lists DROP CONSTRAINT IF EXISTS shopping_lists_pkey;
ALTER TABLE public.shopping_lists ADD CONSTRAINT shopping_lists_pkey PRIMARY KEY (plan_id, scope);
