-- Restrict self-update to onboarding_completed only; role/status changes require admin policy
DROP POLICY IF EXISTS "org memberships update own onboarding" ON public.organization_memberships;

CREATE POLICY "org memberships update own onboarding"
ON public.organization_memberships
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  -- Prevent self-escalation: role and status must not change via this policy
  AND role = (SELECT om.role FROM public.organization_memberships om WHERE om.id = organization_memberships.id)
  AND status = (SELECT om.status FROM public.organization_memberships om WHERE om.id = organization_memberships.id)
  AND organization_id = (SELECT om.organization_id FROM public.organization_memberships om WHERE om.id = organization_memberships.id)
  AND user_id = (SELECT om.user_id FROM public.organization_memberships om WHERE om.id = organization_memberships.id)
);