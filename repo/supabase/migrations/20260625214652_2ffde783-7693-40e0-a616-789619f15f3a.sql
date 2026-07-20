
-- Tighten coach storage policies for bulls progress photos to require bulls group membership
DROP POLICY IF EXISTS "Coaches can read bulls progress photos" ON storage.objects;
DROP POLICY IF EXISTS "Coaches can update bulls progress photos" ON storage.objects;
DROP POLICY IF EXISTS "Coaches can delete bulls progress photos" ON storage.objects;

CREATE POLICY "Coaches can read bulls progress photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'bulls-progress-photos' AND has_role(auth.uid(), 'coach'::app_role) AND has_group(auth.uid(), 'bulls'::app_group));

CREATE POLICY "Coaches can update bulls progress photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'bulls-progress-photos' AND has_role(auth.uid(), 'coach'::app_role) AND has_group(auth.uid(), 'bulls'::app_group))
WITH CHECK (bucket_id = 'bulls-progress-photos' AND has_role(auth.uid(), 'coach'::app_role) AND has_group(auth.uid(), 'bulls'::app_group));

CREATE POLICY "Coaches can delete bulls progress photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'bulls-progress-photos' AND has_role(auth.uid(), 'coach'::app_role) AND has_group(auth.uid(), 'bulls'::app_group));

-- Scope email_send_state policy to service_role role directly instead of public
DROP POLICY IF EXISTS "Service role can manage send state" ON public.email_send_state;
CREATE POLICY "Service role can manage send state"
ON public.email_send_state FOR ALL TO service_role
USING (true) WITH CHECK (true);
