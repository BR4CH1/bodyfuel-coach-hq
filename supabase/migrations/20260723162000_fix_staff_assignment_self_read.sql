-- A restrictive FOR ALL policy introduced in 20260712135443 accidentally
-- applies to SELECT as well. Elevated organization staff can therefore not
-- read their own staff_assignments row, even though the permissive
-- "staff read own or admin" policy explicitly allows it.
--
-- Keep the self-elevation guard for writes only. SELECT must remain governed
-- by the existing read policy so additive athlete + coach contexts are visible.

DROP POLICY IF EXISTS "staff no self elevation"
  ON public.staff_assignments;
DROP POLICY IF EXISTS "staff no self elevation insert"
  ON public.staff_assignments;
DROP POLICY IF EXISTS "staff no self elevation update"
  ON public.staff_assignments;

CREATE POLICY "staff no self elevation insert"
  ON public.staff_assignments
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id <> auth.uid()
    OR public.has_role(auth.uid(), 'platform_owner'::public.app_role)
    OR (
      role NOT IN (
        'organization_admin'::public.organization_role,
        'coach'::public.organization_role
      )
      AND NOT (
        permissions && ARRAY[
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
    OR public.has_role(auth.uid(), 'platform_owner'::public.app_role)
    OR (
      role NOT IN (
        'organization_admin'::public.organization_role,
        'coach'::public.organization_role
      )
      AND NOT (
        permissions && ARRAY[
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
    OR public.has_role(auth.uid(), 'platform_owner'::public.app_role)
    OR (
      role NOT IN (
        'organization_admin'::public.organization_role,
        'coach'::public.organization_role
      )
      AND NOT (
        permissions && ARRAY[
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
