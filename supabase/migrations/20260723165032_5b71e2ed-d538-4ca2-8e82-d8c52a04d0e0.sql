DROP POLICY IF EXISTS "staff no self elevation" ON public.staff_assignments;

CREATE POLICY "staff no self elevation insert"
ON public.staff_assignments
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  user_id <> auth.uid()
  OR public.has_role(auth.uid(), 'platform_owner')
  OR (
    role <> ALL (ARRAY['organization_admin'::public.organization_role, 'coach'::public.organization_role])
    AND NOT (
      COALESCE(permissions, ARRAY[]::text[]) && ARRAY[
        'manage_organization',
        'manage_staff',
        'manage_billing',
        'manage_roles',
        'manage_permissions',
        'manage_athletes',
        'manage_teams'
      ]::text[]
    )
  )
);

CREATE POLICY "staff no self elevation update"
ON public.staff_assignments
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  user_id <> auth.uid()
  OR public.has_role(auth.uid(), 'platform_owner')
  OR (
    role <> ALL (ARRAY['organization_admin'::public.organization_role, 'coach'::public.organization_role])
    AND NOT (
      COALESCE(permissions, ARRAY[]::text[]) && ARRAY[
        'manage_organization',
        'manage_staff',
        'manage_billing',
        'manage_roles',
        'manage_permissions',
        'manage_athletes',
        'manage_teams'
      ]::text[]
    )
  )
)
WITH CHECK (
  user_id <> auth.uid()
  OR public.has_role(auth.uid(), 'platform_owner')
  OR (
    role <> ALL (ARRAY['organization_admin'::public.organization_role, 'coach'::public.organization_role])
    AND NOT (
      COALESCE(permissions, ARRAY[]::text[]) && ARRAY[
        'manage_organization',
        'manage_staff',
        'manage_billing',
        'manage_roles',
        'manage_permissions',
        'manage_athletes',
        'manage_teams'
      ]::text[]
    )
  )
);

CREATE POLICY "staff no self elevation delete"
ON public.staff_assignments
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
  user_id <> auth.uid()
  OR public.has_role(auth.uid(), 'platform_owner')
  OR (
    role <> ALL (ARRAY['organization_admin'::public.organization_role, 'coach'::public.organization_role])
    AND NOT (
      COALESCE(permissions, ARRAY[]::text[]) && ARRAY[
        'manage_organization',
        'manage_staff',
        'manage_billing',
        'manage_roles',
        'manage_permissions',
        'manage_athletes',
        'manage_teams'
      ]::text[]
    )
  )
);