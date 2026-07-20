
DROP POLICY IF EXISTS "otwt_read_staff" ON public.org_training_week_template;
CREATE POLICY "otwt_read_staff" ON public.org_training_week_template
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role) OR is_org_admin(auth.uid(), organization_id) OR is_org_staff(auth.uid(), organization_id, NULL::text) OR (EXISTS (SELECT 1 FROM staff_assignments sa WHERE sa.organization_id = org_training_week_template.organization_id AND sa.user_id = auth.uid())));

DROP POLICY IF EXISTS "otwt_write_staff" ON public.org_training_week_template;
CREATE POLICY "otwt_write_staff" ON public.org_training_week_template
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role) OR is_org_admin(auth.uid(), organization_id) OR is_org_staff(auth.uid(), organization_id, NULL::text) OR (EXISTS (SELECT 1 FROM staff_assignments sa WHERE sa.organization_id = org_training_week_template.organization_id AND sa.user_id = auth.uid())))
  WITH CHECK (has_role(auth.uid(), 'coach'::app_role) OR is_org_admin(auth.uid(), organization_id) OR is_org_staff(auth.uid(), organization_id, NULL::text) OR (EXISTS (SELECT 1 FROM staff_assignments sa WHERE sa.organization_id = org_training_week_template.organization_id AND sa.user_id = auth.uid())));

DROP POLICY IF EXISTS "team join links managed by roster admins" ON public.team_join_links;
CREATE POLICY "team join links managed by roster admins" ON public.team_join_links
  FOR ALL TO authenticated
  USING (is_org_admin(auth.uid(), organization_id) OR is_org_staff(auth.uid(), organization_id, 'manage_members'::text) OR (EXISTS (SELECT 1 FROM staff_assignments sa WHERE sa.user_id = auth.uid() AND sa.organization_id = team_join_links.organization_id AND sa.role = 'coach'::organization_role AND (sa.team_id IS NULL OR sa.team_id = team_join_links.team_id) AND ('invite_athletes' = ANY (COALESCE(sa.permissions, ARRAY[]::text[])) OR 'manage_organization' = ANY (COALESCE(sa.permissions, ARRAY[]::text[]))))))
  WITH CHECK (is_org_admin(auth.uid(), organization_id) OR is_org_staff(auth.uid(), organization_id, 'manage_members'::text) OR (EXISTS (SELECT 1 FROM staff_assignments sa WHERE sa.user_id = auth.uid() AND sa.organization_id = team_join_links.organization_id AND sa.role = 'coach'::organization_role AND (sa.team_id IS NULL OR sa.team_id = team_join_links.team_id) AND ('invite_athletes' = ANY (COALESCE(sa.permissions, ARRAY[]::text[])) OR 'manage_organization' = ANY (COALESCE(sa.permissions, ARRAY[]::text[]))))));
