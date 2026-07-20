-- Helper: darf _viewer das Profil von _target lesen, weil beide im selben Verein sind
-- und _viewer dort Staff ist? SECURITY DEFINER umgeht RLS zur Vermeidung von Rekursion.
CREATE OR REPLACE FUNCTION public.can_view_org_member_profile(_viewer uuid, _target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_assignments sa
    WHERE sa.user_id = _viewer
      AND (
        EXISTS (
          SELECT 1 FROM public.organization_memberships om
          WHERE om.user_id = _target
            AND om.organization_id = sa.organization_id
            AND (om.status IS NULL OR om.status = 'active')
        )
        OR EXISTS (
          SELECT 1 FROM public.staff_assignments sa2
          WHERE sa2.user_id = _target
            AND sa2.organization_id = sa.organization_id
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_org_member_profile(uuid, uuid) TO authenticated;

-- Zusätzliche SELECT-Policy: Vereinsstaff darf Profile der eigenen Vereinsmitglieder lesen.
DROP POLICY IF EXISTS "org staff can read org member profiles" ON public.profiles;
CREATE POLICY "org staff can read org member profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.can_view_org_member_profile(auth.uid(), id));
