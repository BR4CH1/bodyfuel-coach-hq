
-- =============== training_plan_templates ===============
CREATE TABLE IF NOT EXISTS public.training_plan_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  tags text[] NOT NULL DEFAULT '{}',
  weeks_count int NOT NULL DEFAULT 1 CHECK (weeks_count >= 1 AND weeks_count <= 52),
  is_archived boolean NOT NULL DEFAULT false,
  current_version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpt_owner ON public.training_plan_templates(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_tpt_org ON public.training_plan_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_tpt_archived ON public.training_plan_templates(is_archived);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_plan_templates TO authenticated;
GRANT ALL ON public.training_plan_templates TO service_role;

ALTER TABLE public.training_plan_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tpt_coach_all"
ON public.training_plan_templates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'coach'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'coach'::app_role));

CREATE OR REPLACE FUNCTION public.tpt_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_tpt_touch ON public.training_plan_templates;
CREATE TRIGGER trg_tpt_touch
BEFORE UPDATE ON public.training_plan_templates
FOR EACH ROW EXECUTE FUNCTION public.tpt_touch_updated_at();

-- =============== training_template_versions ===============
CREATE TABLE IF NOT EXISTS public.training_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.training_plan_templates(id) ON DELETE CASCADE,
  version int NOT NULL,
  structure jsonb NOT NULL,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_ttv_template ON public.training_template_versions(template_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_template_versions TO authenticated;
GRANT ALL ON public.training_template_versions TO service_role;

ALTER TABLE public.training_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ttv_coach_all"
ON public.training_template_versions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'coach'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'coach'::app_role));

-- =============== Provenance on nutrition_plans ===============
ALTER TABLE public.nutrition_plans
  ADD COLUMN IF NOT EXISTS source_template_id uuid REFERENCES public.training_plan_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_template_version_id uuid REFERENCES public.training_template_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_np_source_template ON public.nutrition_plans(source_template_id);
