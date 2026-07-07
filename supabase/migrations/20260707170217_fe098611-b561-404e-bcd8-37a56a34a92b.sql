-- Allow athletes to complete their own onboarding by inserting/updating
-- their own team_memberships row (status active or pending) for teams of
-- organizations where they have an active membership.
DROP POLICY IF EXISTS "team memberships self insert pending" ON public.team_memberships;
DROP POLICY IF EXISTS "team memberships self update pending" ON public.team_memberships;

CREATE POLICY "team memberships self insert own"
  ON public.team_memberships
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND status IN ('pending'::team_membership_status, 'active'::team_membership_status)
    AND EXISTS (
      SELECT 1
      FROM public.organization_teams t
      JOIN public.organization_memberships om ON om.organization_id = t.organization_id
      WHERE t.id = team_memberships.team_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'::organization_membership_status
    )
  );

CREATE POLICY "team memberships self update own"
  ON public.team_memberships
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND status IN ('pending'::team_membership_status, 'active'::team_membership_status)
  );