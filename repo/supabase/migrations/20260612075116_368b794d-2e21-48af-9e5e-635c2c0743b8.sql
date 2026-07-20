ALTER TABLE public.nutrition_targets
  ADD COLUMN IF NOT EXISTS kcal_rest integer,
  ADD COLUMN IF NOT EXISTS protein_g_rest integer,
  ADD COLUMN IF NOT EXISTS carbs_g_rest integer,
  ADD COLUMN IF NOT EXISTS fat_g_rest integer;

CREATE TABLE IF NOT EXISTS public.day_type_overrides (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('training','rest')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entry_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.day_type_overrides TO authenticated;
GRANT ALL ON public.day_type_overrides TO service_role;

ALTER TABLE public.day_type_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user manages own day type" ON public.day_type_overrides
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'coach'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'coach'));

CREATE TRIGGER trg_day_type_overrides_updated
  BEFORE UPDATE ON public.day_type_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();