CREATE TABLE public.nutrition_plan_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id uuid NOT NULL,
  organization_id uuid NULL,
  title text NOT NULL,
  notes text NULL,
  plan_days integer NOT NULL DEFAULT 7,
  days jsonb NOT NULL DEFAULT '[]'::jsonb,
  partner_days jsonb NULL,
  shared_slots jsonb NULL,
  config jsonb NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_plan_templates TO authenticated;
GRANT ALL ON public.nutrition_plan_templates TO service_role;

ALTER TABLE public.nutrition_plan_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches manage their own nutrition plan templates"
  ON public.nutrition_plan_templates
  FOR ALL
  TO authenticated
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

CREATE INDEX idx_nutrition_plan_templates_coach ON public.nutrition_plan_templates (coach_id, updated_at DESC);

CREATE TRIGGER update_nutrition_plan_templates_updated_at
  BEFORE UPDATE ON public.nutrition_plan_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();