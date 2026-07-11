
-- Phase 1: Multi-tenant platform foundation
-- Extends organizations with terminology, branding mode and license fields.
-- Adds organization_coach_assignments for coach<->customer mapping in coach orgs.
-- No changes to existing rows (all new columns nullable / defaulted).

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS terminology jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS branding_mode text NOT NULL DEFAULT 'bodyfuel',
  ADD COLUMN IF NOT EXISTS branding_extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS license_plan text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS license_status text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS license_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS license_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS max_customers integer,
  ADD COLUMN IF NOT EXISTS max_coaches integer;

-- Value guards via CHECK constraints (both immutable — safe as CHECK).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_branding_mode_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_branding_mode_check
      CHECK (branding_mode IN ('bodyfuel','powered_by','white_label'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_license_status_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_license_status_check
      CHECK (license_status IN ('trial','active','payment_due','suspended','cancelled'));
  END IF;
END $$;

-- Coach<->Customer assignment table (org-scoped, mandantenfähig)
CREATE TABLE IF NOT EXISTS public.organization_coach_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  coach_user_id uuid NOT NULL,
  customer_user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'primary_coach',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, coach_user_id, customer_user_id, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_coach_assignments TO authenticated;
GRANT ALL ON public.organization_coach_assignments TO service_role;

ALTER TABLE public.organization_coach_assignments ENABLE ROW LEVEL SECURITY;

-- Role check helpers already exist: has_role, staff role via staff_assignments.
-- Owner/Admin of the same org can manage all rows.
CREATE POLICY "Org admins manage coach assignments"
  ON public.organization_coach_assignments
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'platform_owner')
    OR EXISTS (
      SELECT 1 FROM public.staff_assignments sa
      WHERE sa.user_id = auth.uid()
        AND sa.organization_id = organization_coach_assignments.organization_id
        AND sa.role IN ('organization_admin')
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'platform_owner')
    OR EXISTS (
      SELECT 1 FROM public.staff_assignments sa
      WHERE sa.user_id = auth.uid()
        AND sa.organization_id = organization_coach_assignments.organization_id
        AND sa.role IN ('organization_admin')
    )
  );

-- Coach sees rows where he is the coach.
CREATE POLICY "Coach reads own assignments"
  ON public.organization_coach_assignments
  FOR SELECT
  TO authenticated
  USING (coach_user_id = auth.uid());

-- Customer sees rows referencing herself (so she knows her coach).
CREATE POLICY "Customer reads own assignments"
  ON public.organization_coach_assignments
  FOR SELECT
  TO authenticated
  USING (customer_user_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS org_coach_assignments_updated_at ON public.organization_coach_assignments;
CREATE TRIGGER org_coach_assignments_updated_at
  BEFORE UPDATE ON public.organization_coach_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS org_coach_assignments_org_idx
  ON public.organization_coach_assignments (organization_id);
CREATE INDEX IF NOT EXISTS org_coach_assignments_coach_idx
  ON public.organization_coach_assignments (coach_user_id);
CREATE INDEX IF NOT EXISTS org_coach_assignments_customer_idx
  ON public.organization_coach_assignments (customer_user_id);
