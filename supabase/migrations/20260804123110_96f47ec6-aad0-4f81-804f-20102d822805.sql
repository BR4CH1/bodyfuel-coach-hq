-- Harden team_memberships self-update: prevent switching into arbitrary teams
DROP POLICY IF EXISTS "team memberships self update own" ON public.team_memberships;
CREATE POLICY "team memberships self update own"
ON public.team_memberships
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND status = ANY (ARRAY['pending'::team_membership_status, 'active'::team_membership_status])
  AND EXISTS (
    SELECT 1
    FROM public.organization_teams t
    JOIN public.organization_memberships om ON om.organization_id = t.organization_id
    WHERE t.id = team_memberships.team_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'::organization_membership_status
  )
);

-- Harden athlete_training_session self-update: only own rows, staff-owned scope columns
-- remain protected by the ats_update_guard trigger (org/team/exercises/title/etc.).
DROP POLICY IF EXISTS "ats_update_own_progress" ON public.athlete_training_session;
CREATE POLICY "ats_update_own_progress"
ON public.athlete_training_session
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.athlete_training_session old
    WHERE old.id = athlete_training_session.id
      AND old.user_id = athlete_training_session.user_id
      AND old.organization_id IS NOT DISTINCT FROM athlete_training_session.organization_id
      AND old.team_id IS NOT DISTINCT FROM athlete_training_session.team_id
      AND old.session_date IS NOT DISTINCT FROM athlete_training_session.session_date
      AND old.focus IS NOT DISTINCT FROM athlete_training_session.focus
      AND old.title IS NOT DISTINCT FROM athlete_training_session.title
      AND old.exercises IS NOT DISTINCT FROM athlete_training_session.exercises
  )
);