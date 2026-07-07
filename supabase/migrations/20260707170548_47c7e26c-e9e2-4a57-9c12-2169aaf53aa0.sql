CREATE TABLE IF NOT EXISTS public.team_join_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.organization_teams(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_join_links_team ON public.team_join_links(team_id);
CREATE INDEX IF NOT EXISTS idx_team_join_links_token ON public.team_join_links(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_join_links TO authenticated;
GRANT ALL ON public.team_join_links TO service_role;

ALTER TABLE public.team_join_links ENABLE ROW LEVEL SECURITY;

-- Roster-Managers dürfen alles (Admin oder Head Coach oder Team Coach mit invite_athletes)
CREATE POLICY "team join links managed by roster admins"
  ON public.team_join_links
  FOR ALL
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_members'::text)
    OR EXISTS (
      SELECT 1 FROM public.staff_assignments sa
      WHERE sa.user_id = auth.uid()
        AND sa.organization_id = team_join_links.organization_id
        AND sa.role = 'coach'
        AND (sa.team_id IS NULL OR sa.team_id = team_join_links.team_id)
        AND ('invite_athletes' = ANY(COALESCE(sa.permissions, ARRAY[]::text[])) OR 'manage_organization' = ANY(COALESCE(sa.permissions, ARRAY[]::text[])))
    )
  )
  WITH CHECK (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.is_org_staff(auth.uid(), organization_id, 'manage_members'::text)
    OR EXISTS (
      SELECT 1 FROM public.staff_assignments sa
      WHERE sa.user_id = auth.uid()
        AND sa.organization_id = team_join_links.organization_id
        AND sa.role = 'coach'
        AND (sa.team_id IS NULL OR sa.team_id = team_join_links.team_id)
        AND ('invite_athletes' = ANY(COALESCE(sa.permissions, ARRAY[]::text[])) OR 'manage_organization' = ANY(COALESCE(sa.permissions, ARRAY[]::text[])))
    )
  );

CREATE TRIGGER trg_team_join_links_updated_at
  BEFORE UPDATE ON public.team_join_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();