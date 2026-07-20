CREATE POLICY "memberships no self elevation on insert"
ON public.organization_memberships
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  user_id <> auth.uid()
  OR role NOT IN ('organization_admin', 'coach')
);