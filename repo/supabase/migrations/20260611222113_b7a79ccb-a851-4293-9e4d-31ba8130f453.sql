
-- nutrition_targets
CREATE TABLE public.nutrition_targets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  kcal INTEGER NOT NULL DEFAULT 2200,
  protein_g INTEGER NOT NULL DEFAULT 150,
  carbs_g INTEGER NOT NULL DEFAULT 220,
  fat_g INTEGER NOT NULL DEFAULT 70,
  water_glasses INTEGER NOT NULL DEFAULT 8,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_targets TO authenticated;
GRANT ALL ON public.nutrition_targets TO service_role;
ALTER TABLE public.nutrition_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own targets" ON public.nutrition_targets FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'coach'));
CREATE POLICY "coach manages targets" ON public.nutrition_targets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'coach')) WITH CHECK (public.has_role(auth.uid(), 'coach'));
CREATE TRIGGER trg_nutrition_targets_updated BEFORE UPDATE ON public.nutrition_targets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- food_entries
CREATE TABLE public.food_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal TEXT NOT NULL CHECK (meal IN ('breakfast','lunch','dinner','snack')),
  name TEXT NOT NULL,
  brand TEXT,
  barcode TEXT,
  serving_g NUMERIC NOT NULL DEFAULT 100,
  kcal NUMERIC NOT NULL DEFAULT 0,
  protein_g NUMERIC NOT NULL DEFAULT 0,
  carbs_g NUMERIC NOT NULL DEFAULT 0,
  fat_g NUMERIC NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_food_entries_user_date ON public.food_entries(user_id, entry_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_entries TO authenticated;
GRANT ALL ON public.food_entries TO service_role;
ALTER TABLE public.food_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own food" ON public.food_entries FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'coach')) WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'coach'));
CREATE TRIGGER trg_food_entries_updated BEFORE UPDATE ON public.food_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- water_logs
CREATE TABLE public.water_logs (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  glasses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entry_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.water_logs TO authenticated;
GRANT ALL ON public.water_logs TO service_role;
ALTER TABLE public.water_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own water" ON public.water_logs FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'coach')) WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'coach'));
CREATE TRIGGER trg_water_logs_updated BEFORE UPDATE ON public.water_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
