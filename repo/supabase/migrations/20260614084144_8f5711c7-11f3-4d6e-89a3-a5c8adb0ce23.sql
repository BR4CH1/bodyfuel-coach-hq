
CREATE TABLE public.smart_nutrition_profile (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  favorite_foods text[] NOT NULL DEFAULT '{}',
  nogo_foods text[] NOT NULL DEFAULT '{}',
  allergies text[] NOT NULL DEFAULT '{}',
  extra_favorites text,
  extra_nogos text,
  extra_allergies text,
  meal_prep_style text CHECK (meal_prep_style IN ('daily','2_3_week','meal_prep','low_effort')),
  shopping_day text CHECK (shopping_day IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  shopping_lead_days integer NOT NULL DEFAULT 1,
  budget_band text CHECK (budget_band IN ('<50','50_75','75_100','>100')),
  auto_publish boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.smart_nutrition_profile TO authenticated;
GRANT ALL ON public.smart_nutrition_profile TO service_role;

ALTER TABLE public.smart_nutrition_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snp self read"   ON public.smart_nutrition_profile FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "snp self upsert" ON public.smart_nutrition_profile FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "snp self update" ON public.smart_nutrition_profile FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "snp coach read"  ON public.smart_nutrition_profile FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'coach'));

CREATE TRIGGER snp_updated_at BEFORE UPDATE ON public.smart_nutrition_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
