
-- Security-definer helper: is the caller a Bulls coach/admin (or platform coach)?
CREATE OR REPLACE FUNCTION public.is_bulls_coach(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'coach'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.staff_assignments s
      JOIN public.organizations o ON o.id = s.organization_id
      WHERE s.user_id = _user_id
        AND s.role IN ('organization_admin'::organization_role, 'coach'::organization_role)
        AND o.slug = 'bulls'
        AND o.status = 'active'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_bulls_coach(uuid) TO authenticated, service_role;

-- Tighten the two coach policies on bulls_performance_tests.
DROP POLICY IF EXISTS bpt_coach_read_all ON public.bulls_performance_tests;
DROP POLICY IF EXISTS bpt_coach_update_verify ON public.bulls_performance_tests;

CREATE POLICY bpt_coach_read_all
  ON public.bulls_performance_tests
  FOR SELECT
  TO authenticated
  USING (public.is_bulls_coach(auth.uid()));

CREATE POLICY bpt_coach_update_verify
  ON public.bulls_performance_tests
  FOR UPDATE
  TO authenticated
  USING (public.is_bulls_coach(auth.uid()))
  WITH CHECK (public.is_bulls_coach(auth.uid()));
