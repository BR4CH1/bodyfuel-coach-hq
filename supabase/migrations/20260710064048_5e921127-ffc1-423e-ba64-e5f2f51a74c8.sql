
-- team_memberships: restrict self insert/update to authenticated (not public)
DROP POLICY IF EXISTS "team memberships self insert own" ON public.team_memberships;
DROP POLICY IF EXISTS "team memberships self update own" ON public.team_memberships;

CREATE POLICY "team memberships self insert own"
ON public.team_memberships
FOR INSERT
TO authenticated
WITH CHECK (
  (user_id = auth.uid())
  AND (status = ANY (ARRAY['pending'::team_membership_status, 'active'::team_membership_status]))
  AND EXISTS (
    SELECT 1
    FROM organization_teams t
    JOIN organization_memberships om ON om.organization_id = t.organization_id
    WHERE t.id = team_memberships.team_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'::organization_membership_status
  )
);

CREATE POLICY "team memberships self update own"
ON public.team_memberships
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  (user_id = auth.uid())
  AND (status = ANY (ARRAY['pending'::team_membership_status, 'active'::team_membership_status]))
);

-- coach_exercise_library: hide internal/unverified rows from non-coaches
DROP POLICY IF EXISTS "cel_read_authenticated" ON public.coach_exercise_library;
CREATE POLICY "cel_read_authenticated"
ON public.coach_exercise_library
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coach'::app_role)
  OR COALESCE(is_active, true) = true
);

-- nutrition_foods: hide review/unverified rows from non-coaches
DROP POLICY IF EXISTS "auth read foods" ON public.nutrition_foods;
CREATE POLICY "auth read foods"
ON public.nutrition_foods
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coach'::app_role)
  OR COALESCE(needs_review, false) = false
);
