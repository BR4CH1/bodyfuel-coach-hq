
-- affiliate_partners: restrict coaches to partners they created
DROP POLICY IF EXISTS "Coaches manage partners" ON public.affiliate_partners;

CREATE POLICY "Coaches manage own partners"
  ON public.affiliate_partners
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role) AND created_by = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'coach'::app_role) AND created_by = auth.uid());

-- bulls_profiles: require coach AND explicit bulls group membership to read member data
DROP POLICY IF EXISTS "Coaches read bulls profiles" ON public.bulls_profiles;

CREATE POLICY "Bulls coaches read bulls profiles"
  ON public.bulls_profiles
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'coach'::app_role)
    AND has_group(auth.uid(), 'bulls'::app_group)
  );
