-- 1. Staff must hold 'view_members' permission to read athlete check-ins
DROP POLICY IF EXISTS "athlete_checkins_coach_read" ON public.athlete_checkins;
CREATE POLICY "athlete_checkins_coach_read"
ON public.athlete_checkins
FOR SELECT
TO authenticated
USING (
  public.coach_can_access_user(auth.uid(), user_id)
  OR (
    organization_id IS NOT NULL
    AND (
      public.is_org_admin(auth.uid(), organization_id)
      OR public.is_org_staff(auth.uid(), organization_id, 'view_members')
    )
  )
);

-- 2. Prevent self-assignment of any elevated organization role (incl. 'staff')
CREATE OR REPLACE FUNCTION public.membership_role_of(_membership_id uuid)
RETURNS public.organization_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.organization_memberships WHERE id = _membership_id
$$;

DROP POLICY IF EXISTS "org memberships update own onboarding" ON public.organization_memberships;
CREATE POLICY "org memberships update own onboarding"
ON public.organization_memberships
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND role = public.membership_role_of(id)
);

DROP POLICY IF EXISTS "memberships no self role change" ON public.organization_memberships;
CREATE POLICY "memberships no self role change"
ON public.organization_memberships
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (
  user_id <> auth.uid()
  OR role = public.membership_role_of(id)
  OR has_role(auth.uid(), 'platform_owner'::app_role)
  OR has_role(auth.uid(), 'coach'::app_role)
  OR public.is_org_admin(auth.uid(), organization_id)
);