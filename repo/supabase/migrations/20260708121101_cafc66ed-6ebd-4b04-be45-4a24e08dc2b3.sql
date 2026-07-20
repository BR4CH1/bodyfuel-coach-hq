
DROP POLICY IF EXISTS "Org coaches manage week templates" ON public.org_training_week_template;
DROP POLICY IF EXISTS "Org members read week templates" ON public.org_training_week_template;

CREATE POLICY "otwt_read_staff" ON public.org_training_week_template
FOR SELECT
USING (
  public.has_role(auth.uid(), 'coach'::app_role)
  OR public.is_org_admin(auth.uid(), organization_id)
  OR public.is_org_staff(auth.uid(), organization_id, NULL::text)
  OR EXISTS (
    SELECT 1 FROM public.staff_assignments sa
    WHERE sa.organization_id = org_training_week_template.organization_id
      AND sa.user_id = auth.uid()
  )
);

CREATE POLICY "otwt_write_staff" ON public.org_training_week_template
FOR ALL
USING (
  public.has_role(auth.uid(), 'coach'::app_role)
  OR public.is_org_admin(auth.uid(), organization_id)
  OR public.is_org_staff(auth.uid(), organization_id, NULL::text)
  OR EXISTS (
    SELECT 1 FROM public.staff_assignments sa
    WHERE sa.organization_id = org_training_week_template.organization_id
      AND sa.user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'coach'::app_role)
  OR public.is_org_admin(auth.uid(), organization_id)
  OR public.is_org_staff(auth.uid(), organization_id, NULL::text)
  OR EXISTS (
    SELECT 1 FROM public.staff_assignments sa
    WHERE sa.organization_id = org_training_week_template.organization_id
      AND sa.user_id = auth.uid()
  )
);
