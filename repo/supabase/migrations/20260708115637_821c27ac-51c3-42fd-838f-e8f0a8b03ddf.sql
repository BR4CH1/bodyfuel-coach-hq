
CREATE TABLE public.org_training_week_template (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sessions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_training_week_template TO authenticated;
GRANT ALL ON public.org_training_week_template TO service_role;

ALTER TABLE public.org_training_week_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read week templates"
  ON public.org_training_week_template FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.organization_id = org_training_week_template.organization_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

CREATE POLICY "Org coaches manage week templates"
  ON public.org_training_week_template FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.organization_id = org_training_week_template.organization_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.role IN ('coach','staff','organization_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.organization_id = org_training_week_template.organization_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.role IN ('coach','staff','organization_admin')
    )
  );

CREATE TRIGGER update_org_training_week_template_updated_at
  BEFORE UPDATE ON public.org_training_week_template
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
