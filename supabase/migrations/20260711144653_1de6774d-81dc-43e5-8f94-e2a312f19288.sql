
-- 1) bulls_ranking_events: explicit deny for client writes; only SECURITY DEFINER functions or service_role may write
CREATE POLICY "bulls_events_no_client_insert"
  ON public.bulls_ranking_events
  FOR INSERT TO authenticated
  WITH CHECK (false);
CREATE POLICY "bulls_events_no_client_update"
  ON public.bulls_ranking_events
  FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);
CREATE POLICY "bulls_events_no_client_delete"
  ON public.bulls_ranking_events
  FOR DELETE TO authenticated
  USING (false);

-- 2) staff_assignments: forbid self-assignment of elevated roles
CREATE POLICY "staff no self elevation"
  ON public.staff_assignments
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    user_id <> auth.uid()
    OR has_role(auth.uid(), 'platform_owner'::public.app_role)
    OR role NOT IN ('organization_admin', 'coach')
  )
  WITH CHECK (
    user_id <> auth.uid()
    OR has_role(auth.uid(), 'platform_owner'::public.app_role)
    OR role NOT IN ('organization_admin', 'coach')
  );

-- 3) profiles: restrict org staff visibility of profiles (incl. guardian columns) to coach/admin roles
CREATE OR REPLACE FUNCTION public.can_view_org_member_profile(_viewer uuid, _target uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_assignments sa
    WHERE sa.user_id = _viewer
      AND sa.role IN ('organization_admin', 'coach')
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
$function$;
