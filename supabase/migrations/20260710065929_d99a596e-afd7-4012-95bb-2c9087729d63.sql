
DROP POLICY IF EXISTS "Coach manages roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles restrict writes to coach only" ON public.user_roles;

-- Coaches dürfen nur "normale" Rollen (nicht coach, nicht platform_owner) vergeben/ändern
CREATE POLICY "Coach manages non-privileged roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'coach'::app_role)
  AND role <> 'coach'::app_role
  AND role <> 'platform_owner'::app_role
)
WITH CHECK (
  public.has_role(auth.uid(), 'coach'::app_role)
  AND role <> 'coach'::app_role
  AND role <> 'platform_owner'::app_role
);

-- Platform-Owner dürfen alle Rollen inkl. coach / platform_owner verwalten
CREATE POLICY "Platform owner manages all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'platform_owner'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'platform_owner'::app_role));
