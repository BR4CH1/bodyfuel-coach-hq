-- 1) Storage: coach read + owner/coach update for bulls-progress-photos
CREATE POLICY "Coaches can read bulls progress photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'bulls-progress-photos' AND public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Users can update own bulls progress photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'bulls-progress-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'bulls-progress-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Coaches can update bulls progress photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'bulls-progress-photos' AND public.has_role(auth.uid(), 'coach'))
WITH CHECK (bucket_id = 'bulls-progress-photos' AND public.has_role(auth.uid(), 'coach'));

-- 2) Lock down internal SECURITY DEFINER functions to service_role only
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_user_points(uuid) FROM PUBLIC, anon, authenticated;