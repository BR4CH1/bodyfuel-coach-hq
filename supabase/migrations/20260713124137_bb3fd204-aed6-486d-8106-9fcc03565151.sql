
-- Restriktive Policy gegen Selbst-Ausweitung der eigenen Rolle in
-- organization_memberships. Spiegelt "staff no self elevation" auf
-- staff_assignments. Andere Policies (permissive) bestimmen weiterhin, WER
-- generell schreiben darf; diese Regel schneidet zusätzlich die Fälle raus,
-- in denen ein Staff-Mitglied mit manage_members die eigene Zeile auf
-- organization_admin/coach heben würde.
DROP POLICY IF EXISTS "org memberships no self elevation" ON public.organization_memberships;
CREATE POLICY "org memberships no self elevation"
  ON public.organization_memberships
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    user_id <> auth.uid()
    OR public.has_role(auth.uid(), 'platform_owner'::app_role)
    OR role NOT IN ('organization_admin'::organization_role, 'coach'::organization_role)
  )
  WITH CHECK (
    user_id <> auth.uid()
    OR public.has_role(auth.uid(), 'platform_owner'::app_role)
    OR role NOT IN ('organization_admin'::organization_role, 'coach'::organization_role)
  );

-- Zusätzlich den bestehenden Trigger härten: auch privilegierte
-- Nicht-Plattform-Owner dürfen die EIGENE role nicht ändern. Damit kann ein
-- organization_admin sich selbst nicht zum "coach" upgraden und ein
-- manage_members-Staff sich nicht zum "organization_admin".
CREATE OR REPLACE FUNCTION public.organization_memberships_self_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
  v_is_platform_owner boolean;
BEGIN
  v_is_platform_owner := public.has_role(auth.uid(), 'platform_owner'::app_role);
  v_is_admin :=
    v_is_platform_owner
    OR public.has_role(auth.uid(), 'coach'::app_role)
    OR public.is_org_admin(auth.uid(), NEW.organization_id)
    OR public.is_org_staff(auth.uid(), NEW.organization_id, 'manage_members');

  -- Selbst-Änderung von role/status ist nur für platform_owner erlaubt.
  IF NEW.user_id = auth.uid() AND NOT v_is_platform_owner THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'organization_memberships: eigene Rolle darf nicht selbst geändert werden';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'organization_memberships: eigener Status darf nicht selbst geändert werden';
    END IF;
  END IF;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Ohne Admin-Recht: role und status müssen unverändert bleiben.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'organization_memberships: role darf nur durch Admins geändert werden';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'organization_memberships: status darf nur durch Admins geändert werden';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'organization_memberships: identifizierende Felder unveränderlich';
  END IF;
  RETURN NEW;
END $function$;
