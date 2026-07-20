CREATE TABLE public.organization_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id uuid NULL REFERENCES public.organization_teams(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('match','training','tournament','camp','test','other')),
  title text NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NULL,
  opponent text NULL,
  location text NULL,
  competition text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'manual',
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX organization_events_org_starts_idx
  ON public.organization_events (organization_id, starts_at);

CREATE INDEX organization_events_team_starts_idx
  ON public.organization_events (team_id, starts_at)
  WHERE team_id IS NOT NULL;

CREATE INDEX organization_events_org_type_starts_idx
  ON public.organization_events (organization_id, event_type, starts_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_events TO authenticated;
GRANT ALL ON public.organization_events TO service_role;

ALTER TABLE public.organization_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_read_events"
  ON public.organization_events
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "org_staff_manage_events"
  ON public.organization_events
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

CREATE TRIGGER update_organization_events_updated_at
  BEFORE UPDATE ON public.organization_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();