
-- =============== meal_favorites ===============
CREATE TABLE public.meal_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES public.nutrition_plan_meals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, meal_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_favorites TO authenticated;
GRANT ALL ON public.meal_favorites TO service_role;
ALTER TABLE public.meal_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own favorites" ON public.meal_favorites
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Coaches read all favorites" ON public.meal_favorites
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));
CREATE INDEX idx_meal_favorites_user ON public.meal_favorites(user_id);
CREATE INDEX idx_meal_favorites_meal ON public.meal_favorites(meal_id);

-- =============== meal_ratings ===============
CREATE TABLE public.meal_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES public.nutrition_plan_meals(id) ON DELETE CASCADE,
  stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, meal_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_ratings TO authenticated;
GRANT ALL ON public.meal_ratings TO service_role;
ALTER TABLE public.meal_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own ratings" ON public.meal_ratings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Coaches read all ratings" ON public.meal_ratings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));
CREATE INDEX idx_meal_ratings_user ON public.meal_ratings(user_id);
CREATE INDEX idx_meal_ratings_meal ON public.meal_ratings(meal_id);
CREATE TRIGGER update_meal_ratings_updated_at
  BEFORE UPDATE ON public.meal_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============== meal_interactions ===============
CREATE TABLE public.meal_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES public.nutrition_plan_meals(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('shown','eaten','swapped')),
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.meal_interactions TO authenticated;
GRANT ALL ON public.meal_interactions TO service_role;
ALTER TABLE public.meal_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert their own interactions" ON public.meal_interactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read their own interactions" ON public.meal_interactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Coaches read all interactions" ON public.meal_interactions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coach'));
CREATE INDEX idx_meal_interactions_user_kind ON public.meal_interactions(user_id, kind);
CREATE INDEX idx_meal_interactions_meal ON public.meal_interactions(meal_id);
