DROP POLICY IF EXISTS "staff no self elevation" ON public.staff_assignments;

CREATE POLICY "staff no self elevation"
ON public.staff_assignments
AS RESTRICTIVE
FOR ALL
USING (
  user_id <> auth.uid()
  OR has_role(auth.uid(), 'platform_owner'::app_role)
  OR (
    role <> ALL (ARRAY['organization_admin'::organization_role, 'coach'::organization_role])
    AND NOT (permissions && ARRAY['manage_organization','manage_staff','manage_billing','manage_roles','manage_permissions','manage_athletes','manage_teams']::text[])
  )
)
WITH CHECK (
  user_id <> auth.uid()
  OR has_role(auth.uid(), 'platform_owner'::app_role)
  OR (
    role <> ALL (ARRAY['organization_admin'::organization_role, 'coach'::organization_role])
    AND NOT (permissions && ARRAY['manage_organization','manage_staff','manage_billing','manage_roles','manage_permissions','manage_athletes','manage_teams']::text[])
  )
);