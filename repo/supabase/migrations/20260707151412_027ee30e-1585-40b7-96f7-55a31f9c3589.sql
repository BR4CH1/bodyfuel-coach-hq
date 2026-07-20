
DROP POLICY IF EXISTS "team memberships manage own" ON public.team_memberships;

CREATE POLICY "team memberships self insert pending"
  ON public.team_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.organization_teams t
      JOIN public.organization_memberships om
        ON om.organization_id = t.organization_id
      WHERE t.id = team_memberships.team_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "team memberships self update pending"
  ON public.team_memberships
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "team memberships self delete"
  ON public.team_memberships
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
