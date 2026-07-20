DROP POLICY IF EXISTS "ts org read" ON public.training_sessions;
CREATE POLICY "ts org read" ON public.training_sessions
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND client_id = auth.uid()
    AND public.is_org_member(auth.uid(), organization_id)
  );