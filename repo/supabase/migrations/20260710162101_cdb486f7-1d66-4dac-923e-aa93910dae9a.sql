CREATE TABLE public.organization_load_day_athlete_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  date date NOT NULL,
  load_level smallint NOT NULL CHECK (load_level BETWEEN 0 AND 5),
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX organization_load_day_athlete_overrides_uk
  ON public.organization_load_day_athlete_overrides (organization_id, user_id, date);

CREATE INDEX organization_load_day_athlete_overrides_user_date_idx
  ON public.organization_load_day_athlete_overrides (user_id, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_load_day_athlete_overrides TO authenticated;
GRANT ALL ON public.organization_load_day_athlete_overrides TO service_role;

ALTER TABLE public.organization_load_day_athlete_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "athlete_manage_own_load_override"
  ON public.organization_load_day_athlete_overrides
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "org_staff_read_load_overrides"
  ON public.organization_load_day_athlete_overrides
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, NULL::text)
  );

CREATE TRIGGER update_organization_load_day_athlete_overrides_updated_at
  BEFORE UPDATE ON public.organization_load_day_athlete_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();