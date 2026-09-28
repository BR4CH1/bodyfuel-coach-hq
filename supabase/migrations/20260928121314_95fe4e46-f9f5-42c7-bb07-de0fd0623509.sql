CREATE TABLE public.partner_plan_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  client_a_id uuid NOT NULL,
  client_b_id uuid NOT NULL,
  plan_a_id uuid REFERENCES public.nutrition_plans(id) ON DELETE SET NULL,
  plan_b_id uuid REFERENCES public.nutrition_plans(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'pdf_import',
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_plan_groups_distinct_clients CHECK (client_a_id <> client_b_id),
  CONSTRAINT partner_plan_groups_source_check CHECK (source IN ('pdf_import','text_import','duplicate','builder'))
);
GRANT SELECT ON public.partner_plan_groups TO authenticated;
GRANT ALL ON public.partner_plan_groups TO service_role;
ALTER TABLE public.partner_plan_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coaches read partner plan groups" ON public.partner_plan_groups
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'coach'));
CREATE POLICY "Clients read own partner plan groups" ON public.partner_plan_groups
  FOR SELECT TO authenticated USING (auth.uid() = client_a_id OR auth.uid() = client_b_id);
CREATE INDEX partner_plan_groups_client_a_idx ON public.partner_plan_groups(client_a_id);
CREATE INDEX partner_plan_groups_client_b_idx ON public.partner_plan_groups(client_b_id);

CREATE OR REPLACE FUNCTION public.partner_plan_groups_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER partner_plan_groups_touch BEFORE UPDATE ON public.partner_plan_groups
  FOR EACH ROW EXECUTE FUNCTION public.partner_plan_groups_touch();

ALTER TABLE public.nutrition_plans
  ADD COLUMN IF NOT EXISTS partner_group_id uuid REFERENCES public.partner_plan_groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS nutrition_plans_partner_group_idx ON public.nutrition_plans(partner_group_id);