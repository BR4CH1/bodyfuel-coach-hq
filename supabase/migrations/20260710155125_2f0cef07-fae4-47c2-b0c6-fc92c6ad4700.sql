-- Belastungssteuerung: pro Org/Team ein Belastungstag
CREATE TABLE public.organization_load_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id uuid NULL REFERENCES public.organization_teams(id) ON DELETE CASCADE,
  date date NOT NULL,
  load_level smallint NOT NULL CHECK (load_level BETWEEN 0 AND 5),
  session_type text NULL,
  notes text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Uniqueness: one entry per (org, team-or-orgwide, date). Nulls in team_id are distinct in default UNIQUE,
-- so use a partial index setup to handle both cases.
CREATE UNIQUE INDEX organization_load_days_team_uk
  ON public.organization_load_days (organization_id, team_id, date)
  WHERE team_id IS NOT NULL;

CREATE UNIQUE INDEX organization_load_days_org_uk
  ON public.organization_load_days (organization_id, date)
  WHERE team_id IS NULL;

CREATE INDEX organization_load_days_org_date_idx
  ON public.organization_load_days (organization_id, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_load_days TO authenticated;
GRANT ALL ON public.organization_load_days TO service_role;

ALTER TABLE public.organization_load_days ENABLE ROW LEVEL SECURITY;

-- Coaches / Org-Staff dürfen lesen und schreiben
CREATE POLICY "org_staff_manage_load_days"
  ON public.organization_load_days
  FOR ALL
  TO authenticated
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, NULL::text)
  )
  WITH CHECK (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, NULL::text)
  );

-- Athleten der Organisation dürfen lesen (Team-Filterung erfolgt in der App-Query,
-- da team_id NULL = orgweit ebenfalls sichtbar sein soll).
CREATE POLICY "org_members_read_load_days"
  ON public.organization_load_days
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(auth.uid(), organization_id)
  );

CREATE TRIGGER update_organization_load_days_updated_at
  BEFORE UPDATE ON public.organization_load_days
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();